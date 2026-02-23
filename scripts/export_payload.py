#!/usr/bin/env python3
"""
Warden — Export Payload
Reads metrics from DB and generates the static JSON payload consumed by the frontend.

Usage:
    python scripts/export_payload.py
    python scripts/export_payload.py --hours 48

Designed to run via cron every 15s–60s for near-real-time dashboard updates.
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Any
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.settings import settings, BASE_DIR
from src.db_writer import fetch_latest, fetch_summary
from src.db_monitor import HISTORY_PATH, collect_db_metrics
from src.alerts import evaluate_alerts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
)
logger = logging.getLogger("warden.export")
ALERT_EVENTS_PATH = BASE_DIR / "runtime" / "slack_alert_events.jsonl"


def _build_alert_summary(alerts: list[dict[str, Any]]) -> dict[str, Any]:
    firing = [item for item in alerts if item.get("status") == "firing"]
    critical = sum(1 for item in firing if item.get("severity") == "critical")
    warning = sum(1 for item in firing if item.get("severity") == "warning")
    return {
        "firing_total": len(firing),
        "critical": critical,
        "warning": warning,
        "keys": [str(item.get("key")) for item in firing],
    }


def _load_recent_alert_history(limit: int = 80) -> list[dict[str, Any]]:
    if not ALERT_EVENTS_PATH.exists():
        return []
    rows: list[dict[str, Any]] = []
    with open(ALERT_EVENTS_PATH, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if isinstance(obj, dict):
                rows.append(obj)
    rows = rows[-max(1, limit) :]
    rows.reverse()
    return rows


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _bucket_seconds(window_key: str) -> int:
    if window_key == "1h":
        return 60
    if window_key == "24h":
        return 300
    return 1800


def _load_db_history_windows() -> dict[str, list[dict[str, Any]]]:
    windows = {"1h": 1, "24h": 24, "7d": 168}
    bucket_by_window = {key: _bucket_seconds(key) for key in windows}
    now = datetime.now(timezone.utc)
    oldest = now - timedelta(hours=max(windows.values()))
    series = {key: {} for key in windows}

    if not HISTORY_PATH.exists():
        return {key: [] for key in windows}

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
            if sampled_at is None or sampled_at < oldest:
                continue

            qps = _safe_float(row.get("qps"))
            tps = _safe_float(row.get("tps"))
            slow_qps = _safe_float(row.get("slow_qps"))
            threads_running = _safe_float(row.get("threads_running"))
            threads_connected = _safe_float(row.get("threads_connected"))

            for key, hours in windows.items():
                cutoff = now - timedelta(hours=hours)
                if sampled_at < cutoff:
                    continue
                bucket_size = bucket_by_window[key]
                bucket_ts = int(sampled_at.timestamp()) // bucket_size * bucket_size
                bucket = datetime.fromtimestamp(bucket_ts, tz=timezone.utc).isoformat()
                agg = series[key].setdefault(
                    bucket,
                    {
                        "bucket": bucket,
                        "count": 0,
                        "qps_sum": 0.0,
                        "tps_sum": 0.0,
                        "slow_qps_sum": 0.0,
                        "threads_running_sum": 0.0,
                        "threads_running_max": 0.0,
                        "threads_connected_sum": 0.0,
                    },
                )
                agg["count"] += 1
                agg["qps_sum"] += qps
                agg["tps_sum"] += tps
                agg["slow_qps_sum"] += slow_qps
                agg["threads_running_sum"] += threads_running
                agg["threads_running_max"] = max(agg["threads_running_max"], threads_running)
                agg["threads_connected_sum"] += threads_connected

    result: dict[str, list[dict[str, Any]]] = {}
    for key, buckets in series.items():
        rows = []
        for bucket in sorted(buckets):
            item = buckets[bucket]
            count = max(1, int(item["count"]))
            rows.append(
                {
                    "bucket": item["bucket"],
                    "qps_avg": round(item["qps_sum"] / count, 3),
                    "tps_avg": round(item["tps_sum"] / count, 3),
                    "slow_qps_avg": round(item["slow_qps_sum"] / count, 3),
                    "threads_running_avg": round(item["threads_running_sum"] / count, 3),
                    "threads_running_max": round(item["threads_running_max"], 3),
                    "threads_connected_avg": round(item["threads_connected_sum"] / count, 3),
                }
            )
        result[key] = rows
    return result


def export(hours_overview: int = 24):
    """Generate the frontend payload JSON."""
    latest = fetch_latest(limit=720)
    summary_1h = fetch_summary(hours=1)
    summary_24h = fetch_summary(hours=hours_overview)
    summary_7d = fetch_summary(hours=168)
    db_history = _load_db_history_windows()

    current = latest[-1]["metrics"] if latest else {}
    db_current = collect_db_metrics()
    alerts_current = evaluate_alerts(current, db_current)
    alerts_history = _load_recent_alert_history()

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current": current,
        "db": {
            "current": db_current,
            "history": db_history,
        },
        "alerts": {
            "current": alerts_current,
            "summary": _build_alert_summary(alerts_current),
            "history_recent": alerts_history,
        },
        "realtime": [row["metrics"] for row in latest[-120:]],
        "history": {
            "1h": summary_1h,
            "24h": summary_24h,
            "7d": summary_7d,
        },
        "history_1h": summary_1h,
        "history_24h": summary_24h,
        "history_7d": summary_7d,
    }

    out_path = BASE_DIR / settings.export_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)

    logger.info("Payload exported → %s (%d bytes)", out_path, out_path.stat().st_size)


def main():
    parser = argparse.ArgumentParser(description="Warden payload export")
    parser.add_argument("--hours", type=int, default=24, help="Hours for overview summary")
    args = parser.parse_args()
    export(args.hours)


if __name__ == "__main__":
    main()
