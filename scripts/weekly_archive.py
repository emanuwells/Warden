#!/usr/bin/env python3
"""
Warden — Weekly Archive Builder
Builds a compact hourly snapshot for one ISO week and keeps only the latest N weeks.
"""

import argparse
import gzip
import json
import os
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.db_monitor import HISTORY_PATH
from src.db_writer import get_connection
from src.settings import BASE_DIR

ARCHIVE_DIR = BASE_DIR / "runtime" / "archive" / "weekly"
ARCHIVE_PREFIX = "warden_weekly_"
ARCHIVE_SUFFIX = ".json.gz"
DEFAULT_RETENTION_WEEKS = 6


def _safe_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _week_bounds(target: date) -> tuple[datetime, datetime, str]:
    monday = target - timedelta(days=target.isoweekday() - 1)
    start = datetime.combine(monday, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=7)
    iso_year, iso_week, _ = monday.isocalendar()
    return start, end, f"{iso_year}-W{iso_week:02d}"


def _fetch_system_hourly(start: datetime, end: datetime) -> list[dict[str, Any]]:
    start_sql = start.strftime("%Y-%m-%d %H:%M:%S")
    end_sql = end.strftime("%Y-%m-%d %H:%M:%S")
    sql = """
        SELECT
            DATE_FORMAT(captured_at, '%%Y-%%m-%%dT%%H:00:00') AS bucket,
            AVG(JSON_EXTRACT(metrics, '$.cpu.total_percent'))    AS cpu_avg,
            AVG(JSON_EXTRACT(metrics, '$.memory.percent'))       AS mem_avg,
            AVG(JSON_EXTRACT(metrics, '$.disk.percent'))         AS disk_avg,
            AVG(JSON_EXTRACT(metrics, '$.network.upload_mbps'))  AS net_up_avg,
            AVG(JSON_EXTRACT(metrics, '$.network.download_mbps'))AS net_down_avg
        FROM warden_metrics
        WHERE captured_at >= %s
          AND captured_at < %s
        GROUP BY DATE_FORMAT(captured_at, '%%Y-%%m-%%d %%H')
        ORDER BY DATE_FORMAT(captured_at, '%%Y-%%m-%%d %%H') ASC
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (start_sql, end_sql))
            rows = cur.fetchall() or []

    out: list[dict[str, Any]] = []
    for row in rows:
        bucket = str(row.get("bucket") or "").strip()
        if not bucket:
            continue
        out.append(
            {
                "bucket": bucket,
                "cpu_avg": round(_safe_float(row.get("cpu_avg")), 3),
                "mem_avg": round(_safe_float(row.get("mem_avg")), 3),
                "disk_avg": round(_safe_float(row.get("disk_avg")), 3),
                "net_up_avg": round(_safe_float(row.get("net_up_avg")), 3),
                "net_down_avg": round(_safe_float(row.get("net_down_avg")), 3),
            }
        )
    return out


def _fetch_db_hourly(start: datetime, end: datetime) -> list[dict[str, Any]]:
    if not HISTORY_PATH.exists():
        return []

    buckets: dict[str, dict[str, float]] = {}
    with open(HISTORY_PATH, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            if not isinstance(row, dict):
                continue

            sampled_at = _parse_iso(str(row.get("sampled_at") or ""))
            if sampled_at is None or sampled_at < start or sampled_at >= end:
                continue

            bucket_ts = int(sampled_at.timestamp()) // 3600 * 3600
            bucket = datetime.fromtimestamp(bucket_ts, tz=timezone.utc).isoformat()
            agg = buckets.setdefault(
                bucket,
                {
                    "count": 0.0,
                    "qps_sum": 0.0,
                    "tps_sum": 0.0,
                    "threads_running_sum": 0.0,
                    "threads_running_max": 0.0,
                    "threads_connected_sum": 0.0,
                    "storage_total_gb_sum": 0.0,
                    "storage_growth_gb_h_sum": 0.0,
                },
            )

            threads_running = _safe_float(row.get("threads_running"))
            agg["count"] += 1.0
            agg["qps_sum"] += _safe_float(row.get("qps"))
            agg["tps_sum"] += _safe_float(row.get("tps"))
            agg["threads_running_sum"] += threads_running
            agg["threads_running_max"] = max(agg["threads_running_max"], threads_running)
            agg["threads_connected_sum"] += _safe_float(row.get("threads_connected"))
            agg["storage_total_gb_sum"] += _safe_float(row.get("storage_total_gb"))
            agg["storage_growth_gb_h_sum"] += _safe_float(row.get("storage_growth_gb_h"))

    out: list[dict[str, Any]] = []
    for bucket in sorted(buckets):
        item = buckets[bucket]
        count = max(1, int(item["count"]))
        out.append(
            {
                "bucket": bucket,
                "qps_avg": round(item["qps_sum"] / count, 3),
                "tps_avg": round(item["tps_sum"] / count, 3),
                "threads_running_avg": round(item["threads_running_sum"] / count, 3),
                "threads_running_max": round(item["threads_running_max"], 3),
                "threads_connected_avg": round(item["threads_connected_sum"] / count, 3),
                "storage_total_gb_avg": round(item["storage_total_gb_sum"] / count, 3),
                "storage_growth_gb_h_avg": round(item["storage_growth_gb_h_sum"] / count, 3),
            }
        )

    return out


def _write_gzip_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".tmp-{os.getpid()}")
    with gzip.open(tmp, "wt", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    os.replace(tmp, path)


def _prune_archives(retention_weeks: int) -> int:
    files = sorted(ARCHIVE_DIR.glob(f"{ARCHIVE_PREFIX}*{ARCHIVE_SUFFIX}"), key=lambda p: p.name)
    keep = max(1, int(retention_weeks))
    to_delete = files[:-keep] if len(files) > keep else []
    for path in to_delete:
        try:
            path.unlink()
        except FileNotFoundError:
            continue
    return len(to_delete)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build weekly Warden hourly archive")
    parser.add_argument("--target-date", default=None, help="ISO date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument(
        "--retention-weeks",
        type=int,
        default=int(os.getenv("WEEKLY_ARCHIVE_RETENTION_WEEKS", str(DEFAULT_RETENTION_WEEKS))),
        help="Number of weekly archives to keep.",
    )
    args = parser.parse_args()

    target = date.fromisoformat(args.target_date) if args.target_date else datetime.now(timezone.utc).date()
    start, end, week_id = _week_bounds(target)
    system_rows = _fetch_system_hourly(start, end)
    db_rows = _fetch_db_hourly(start, end)

    payload = {
        "schema_version": 1,
        "week": week_id,
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "history": system_rows,
        "db_history": db_rows,
        "meta": {
            "source": "warden_weekly_hourly_v1",
            "retention_weeks": max(1, int(args.retention_weeks)),
        },
    }

    out_path = ARCHIVE_DIR / f"{ARCHIVE_PREFIX}{week_id}{ARCHIVE_SUFFIX}"
    _write_gzip_json_atomic(out_path, payload)
    deleted = _prune_archives(args.retention_weeks)

    print(
        json.dumps(
            {
                "ok": True,
                "week": week_id,
                "path": str(out_path),
                "system_rows": len(system_rows),
                "db_rows": len(db_rows),
                "deleted_old_archives": deleted,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
