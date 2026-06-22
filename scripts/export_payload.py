#!/usr/bin/env python3
"""
Warden — Export Payload
Reads metrics from DB and writes JSON snapshots consumed by the Warden API/frontend.

Modes:
- fast: lightweight snapshot for near-real-time cards/charts
- heavy: slower snapshot with historical/process/disk-heavy sections
- full: compatibility payload (also refreshes fast+heavy)
"""

import argparse
import gzip
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.alerts import evaluate_alerts
from src.collector import collect, collect_disk_top, collect_process_tops
from src.db_monitor import HISTORY_PATH, collect_db_metrics
from src.db_writer import fetch_latest, fetch_summary
from src.operational_jobs import build_operations_payload
from src.settings import BASE_DIR, settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("warden.export")
ALERT_EVENTS_PATH = BASE_DIR / "runtime" / "slack_alert_events.jsonl"
DEFAULT_FAST_FILENAME = "warden_fast_snapshot.json"
DEFAULT_HEAVY_FILENAME = "warden_heavy_snapshot.json"
RUNTIME_CACHE_DIR = BASE_DIR / "runtime" / "cache"
FAST_PROCESS_CACHE_PATH = RUNTIME_CACHE_DIR / "warden_fast_processes.json"
FAST_PROCESS_NET_CACHE_PATH = RUNTIME_CACHE_DIR / "warden_fast_processes_network.json"
FAST_DISK_TOP_CACHE_PATH = RUNTIME_CACHE_DIR / "warden_fast_disk_top.json"
WEEKLY_ARCHIVE_DIR = BASE_DIR / "runtime" / "archive" / "weekly"
WEEKLY_ARCHIVE_GLOB = "warden_weekly_*.json.gz"
THIRTY_DAYS_HOURS = 30 * 24


def _as_path(raw: str) -> Path:
    p = Path(raw)
    if p.is_absolute():
        return p
    return BASE_DIR / p


def _resolve_output_paths() -> dict[str, Path]:
    full_path = _as_path(settings.export_path)
    default_fast = full_path.parent / DEFAULT_FAST_FILENAME
    default_heavy = full_path.parent / DEFAULT_HEAVY_FILENAME

    fast_raw = os.getenv("EXPORT_FAST_PATH", str(default_fast))
    heavy_raw = os.getenv("EXPORT_HEAVY_PATH", str(default_heavy))

    return {
        "full": full_path,
        "fast": _as_path(fast_raw),
        "heavy": _as_path(heavy_raw),
    }


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".tmp-{os.getpid()}")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)
    os.replace(tmp, path)


def _cache_read(path: Path, ttl_seconds: int) -> dict[str, Any] | None:
    if ttl_seconds <= 0 or not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(raw, dict):
        return None
    ts = _parse_iso(str(raw.get("captured_at") or ""))
    if ts is None:
        return None
    if (datetime.now(timezone.utc) - ts).total_seconds() > ttl_seconds:
        return None
    payload = raw.get("payload")
    return payload if isinstance(payload, dict) else None


def _cache_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(path, {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    })


def _collect_fast_live_extras(*, cache_only: bool = False) -> dict[str, Any]:
    """
    Optional process/disk extras for the fast snapshot lane.
    cache_only=True keeps the 2s cadence fast (<1s); heavy/full lanes refresh caches.
    """
    extras: dict[str, Any] = {}

    proc_ttl = max(2, int(getattr(settings, "process_top_scan_interval_seconds", 15) or 15))
    proc_payload = _cache_read(FAST_PROCESS_CACHE_PATH, proc_ttl)
    if proc_payload is None and not cache_only:
        try:
            proc_payload = collect_process_tops(force=True, include_network=False)
            _cache_write(FAST_PROCESS_CACHE_PATH, proc_payload)
        except Exception as exc:
            logger.warning("FAST process tops unavailable: %s", exc)
            proc_payload = None
    if isinstance(proc_payload, dict):
        net_ttl = max(
            proc_ttl,
            int(getattr(settings, "process_top_network_scan_interval_seconds", 15) or 15),
        )
        net_payload = _cache_read(FAST_PROCESS_NET_CACHE_PATH, net_ttl)
        if net_payload is None and not cache_only:
            try:
                net_payload = collect_process_tops(force=True, include_network=True)
                _cache_write(FAST_PROCESS_NET_CACHE_PATH, net_payload)
            except Exception as exc:
                logger.warning("FAST network process tops unavailable: %s", exc)
                net_payload = None

        if isinstance(net_payload, dict):
            proc_payload["top_network"] = net_payload.get("top_network", [])
            proc_payload["network_metric"] = net_payload.get("network_metric")
            proc_payload["network_metric_label"] = net_payload.get("network_metric_label")
            proc_payload["warning"] = net_payload.get("warning")
        elif proc_payload.get("warning") == "network_processes_skipped":
            proc_payload["warning"] = None

        extras["processes"] = proc_payload

    disk_ttl = max(30, int(getattr(settings, "disk_top_scan_interval_seconds", 300) or 300))
    disk_payload = _cache_read(FAST_DISK_TOP_CACHE_PATH, disk_ttl)
    if disk_payload is None and not cache_only:
        try:
            disk_payload = collect_disk_top(force=True)
            _cache_write(FAST_DISK_TOP_CACHE_PATH, disk_payload)
        except Exception as exc:
            logger.warning("FAST disk top unavailable: %s", exc)
            disk_payload = None
    if isinstance(disk_payload, dict):
        extras["disk_top_consumers"] = disk_payload

    return extras


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
    rows = rows[-max(1, limit):]
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


def _bucket_key(row: dict[str, Any]) -> str:
    return str(row.get("bucket") or row.get("timestamp") or "").strip()


def _rows_by_bucket(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = _bucket_key(row)
        if not key:
            continue
        out[key] = row
    return out


def _bucket_seconds(window_key: str) -> int:
    if window_key == "1h":
        return 60
    if window_key == "24h":
        return 300
    if window_key == "7d":
        return 1800
    return 3600


def _safe_float_or_none(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN
        return None
    return parsed


def _enrich_system_history_rows(
    rows: list[dict[str, Any]],
    fallback_total_gb: float | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    derived_total = 0
    derived_used = 0
    derived_free = 0
    derived_growth = 0
    prev_ts_ms: int | None = None
    prev_used_gb: float | None = None

    for raw in rows:
        if not isinstance(raw, dict):
            continue
        row = dict(raw)
        bucket_raw = row.get("bucket") or row.get("timestamp")
        bucket_ts_ms = parse_ts_ms = None
        if isinstance(bucket_raw, str):
            try:
                parsed_bucket = _parse_iso(bucket_raw)
                parse_ts_ms = int(parsed_bucket.timestamp() * 1000) if parsed_bucket else None
            except Exception:
                parse_ts_ms = None
        bucket_ts_ms = parse_ts_ms

        disk_total = _safe_float_or_none(row.get("disk_total_gb_avg"))
        if (disk_total is None or disk_total <= 0) and fallback_total_gb is not None and fallback_total_gb > 0:
            disk_total = float(fallback_total_gb)
            derived_total += 1

        disk_used = _safe_float_or_none(row.get("disk_used_gb_avg"))
        disk_pct = _safe_float_or_none(row.get("disk_avg"))
        if (disk_used is None or disk_used < 0) and disk_total is not None and disk_pct is not None:
            disk_used = disk_total * (disk_pct / 100.0)
            derived_used += 1

        disk_free = _safe_float_or_none(row.get("disk_free_gb_avg"))
        if (disk_free is None or disk_free < 0) and disk_total is not None and disk_used is not None:
            disk_free = max(0.0, disk_total - disk_used)
            derived_free += 1

        growth = _safe_float_or_none(row.get("disk_growth_gb_h_avg"))
        if growth is None and prev_ts_ms is not None and prev_used_gb is not None and bucket_ts_ms is not None and bucket_ts_ms > prev_ts_ms and disk_used is not None:
            elapsed_h = (bucket_ts_ms - prev_ts_ms) / 3600000.0
            if elapsed_h > 0:
                growth = (disk_used - prev_used_gb) / elapsed_h
                derived_growth += 1
        if growth is None and disk_used is not None:
            growth = 0.0

        if bucket_ts_ms is not None and disk_used is not None:
            prev_ts_ms = bucket_ts_ms
            prev_used_gb = disk_used

        row["disk_total_gb_avg"] = round(disk_total, 3) if disk_total is not None else None
        row["disk_used_gb_avg"] = round(disk_used, 3) if disk_used is not None else None
        row["disk_free_gb_avg"] = round(disk_free, 3) if disk_free is not None else None
        row["disk_growth_gb_h_avg"] = round(growth, 3) if growth is not None else None
        enriched.append(row)

    return enriched, {
        "derived_disk_total_rows": derived_total,
        "derived_disk_used_rows": derived_used,
        "derived_disk_free_rows": derived_free,
        "derived_disk_growth_rows": derived_growth,
    }


def _load_db_history_windows(include_30d: bool = False) -> dict[str, list[dict[str, Any]]]:
    windows = {"1h": 1, "24h": 24, "7d": 168}
    if include_30d:
        windows["30d"] = 720

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
            threads_running = _safe_float(row.get("threads_running"))
            threads_connected = _safe_float(row.get("threads_connected"))
            storage_total_bytes = _safe_float(row.get("storage_total_bytes"))
            storage_total_gb = _safe_float(row.get("storage_total_gb"))
            storage_growth_gb_h = _safe_float(row.get("storage_growth_gb_h"))

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
                        "threads_running_sum": 0.0,
                        "threads_running_max": 0.0,
                        "threads_connected_sum": 0.0,
                        "storage_total_bytes_sum": 0.0,
                        "storage_total_gb_sum": 0.0,
                        "storage_growth_gb_h_sum": 0.0,
                    },
                )
                agg["count"] += 1
                agg["qps_sum"] += qps
                agg["tps_sum"] += tps
                agg["threads_running_sum"] += threads_running
                agg["threads_running_max"] = max(agg["threads_running_max"], threads_running)
                agg["threads_connected_sum"] += threads_connected
                agg["storage_total_bytes_sum"] += storage_total_bytes
                agg["storage_total_gb_sum"] += storage_total_gb
                agg["storage_growth_gb_h_sum"] += storage_growth_gb_h

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
                    "threads_running_avg": round(item["threads_running_sum"] / count, 3),
                    "threads_running_max": round(item["threads_running_max"], 3),
                    "threads_connected_avg": round(item["threads_connected_sum"] / count, 3),
                    "storage_total_bytes_avg": int(round(item["storage_total_bytes_sum"] / count)),
                    "storage_total_gb_avg": round(item["storage_total_gb_sum"] / count, 3),
                    "storage_growth_gb_h_avg": round(item["storage_growth_gb_h_sum"] / count, 3),
                }
            )
        result[key] = rows
    return result


def _load_weekly_archive_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not WEEKLY_ARCHIVE_DIR.exists():
        return [], []

    sys_rows: list[dict[str, Any]] = []
    db_rows: list[dict[str, Any]] = []
    for path in sorted(WEEKLY_ARCHIVE_DIR.glob(WEEKLY_ARCHIVE_GLOB)):
        try:
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue

        history = payload.get("history")
        db_history = payload.get("db_history")
        if isinstance(history, list):
            sys_rows.extend([row for row in history if isinstance(row, dict)])
        if isinstance(db_history, list):
            db_rows.extend([row for row in db_history if isinstance(row, dict)])

    return sys_rows, db_rows


def _merge_rows_for_last_days(
    archived_rows: list[dict[str, Any]],
    live_rows: list[dict[str, Any]],
    days: int = 30,
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=max(1, days))

    merged = _rows_by_bucket(archived_rows)
    merged.update(_rows_by_bucket(live_rows))  # live rows always win on overlap

    out: list[dict[str, Any]] = []
    for key in sorted(merged):
        dt = _parse_iso(key)
        if dt is None:
            continue
        if dt < cutoff:
            continue
        out.append(merged[key])
    return out


def _build_30d_from_archives(
    live_system_rows_7d: list[dict[str, Any]],
    live_db_rows_7d: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    archived_system_rows, archived_db_rows = _load_weekly_archive_rows()
    system_30d = _merge_rows_for_last_days(archived_system_rows, live_system_rows_7d, days=30)
    db_30d = _merge_rows_for_last_days(archived_db_rows, live_db_rows_7d, days=30)
    return system_30d, db_30d


def _sanitize_realtime_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "timestamp": row.get("timestamp"),
        "cpu": {
            "total_percent": ((row.get("cpu") or {}).get("total_percent") if isinstance(row.get("cpu"), dict) else None),
        },
        "memory": {
            "percent": ((row.get("memory") or {}).get("percent") if isinstance(row.get("memory"), dict) else None),
        },
        "disk": {
            "percent": ((row.get("disk") or {}).get("percent") if isinstance(row.get("disk"), dict) else None),
            "read_mb_s": ((row.get("disk") or {}).get("read_mb_s") if isinstance(row.get("disk"), dict) else None),
            "write_mb_s": ((row.get("disk") or {}).get("write_mb_s") if isinstance(row.get("disk"), dict) else None),
        },
        "network": {
            "upload_mbps": ((row.get("network") or {}).get("upload_mbps") if isinstance(row.get("network"), dict) else None),
            "download_mbps": ((row.get("network") or {}).get("download_mbps") if isinstance(row.get("network"), dict) else None),
            "packets_sent": ((row.get("network") or {}).get("packets_sent") if isinstance(row.get("network"), dict) else None),
            "packets_recv": ((row.get("network") or {}).get("packets_recv") if isinstance(row.get("network"), dict) else None),
        },
    }


def _extract_fast_current(current: dict[str, Any]) -> dict[str, Any]:
    disk_raw = current.get("disk") if isinstance(current.get("disk"), dict) else {}
    disk = dict(disk_raw)
    disk.pop("top_consumers", None)

    out = {
        "cpu": current.get("cpu"),
        "memory": current.get("memory"),
        "disk": disk,
        "network": current.get("network"),
        "timestamp": current.get("timestamp"),
        "host": current.get("host"),
    }
    return out


def _extract_heavy_current(current: dict[str, Any]) -> dict[str, Any]:
    disk_raw = current.get("disk") if isinstance(current.get("disk"), dict) else {}
    return {
        "host": current.get("host"),
        "processes": current.get("processes"),
        "disk": {
            "top_consumers": disk_raw.get("top_consumers"),
        },
    }


def _collect_base_state(latest_limit: int = 180) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    latest = fetch_latest(limit=latest_limit)
    current = latest[-1]["metrics"] if latest else {}
    db_current = collect_db_metrics()
    alerts_current = evaluate_alerts(current, db_current)
    return latest, current, db_current, alerts_current


def _build_fast_payload(
    generated_at: str,
    latest: list[dict[str, Any]],
    current: dict[str, Any],
    db_current: dict[str, Any],
    alerts_current: list[dict[str, Any]],
    operations: dict[str, Any],
    live_extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    realtime_rows = []
    for row in latest[-120:]:
        metrics = row.get("metrics") if isinstance(row, dict) else None
        if not isinstance(metrics, dict):
            continue
        realtime_rows.append(_sanitize_realtime_row(metrics))

    fast_current = _extract_fast_current(current)
    extras = live_extras or {}
    if isinstance(extras.get("processes"), dict):
        fast_current["processes"] = extras["processes"]
    if isinstance(extras.get("disk_top_consumers"), dict):
        disk = fast_current.get("disk")
        if not isinstance(disk, dict):
            disk = {}
            fast_current["disk"] = disk
        disk["top_consumers"] = extras["disk_top_consumers"]

    return {
        "generated_at": generated_at,
        "current": fast_current,
        "db": {
            "current": db_current,
        },
        "alerts": {
            "current": alerts_current,
            "summary": _build_alert_summary(alerts_current),
        },
        "operations": operations,
        "realtime": realtime_rows,
        "meta": {
            "kind": "fast",
            "collector_interval_seconds": settings.collect_interval,
        },
    }


def _build_heavy_payload(
    generated_at: str,
    current: dict[str, Any],
    history_1h: list[dict[str, Any]],
    history_24h: list[dict[str, Any]],
    history_7d: list[dict[str, Any]],
    history_30d: list[dict[str, Any]],
    db_history: dict[str, list[dict[str, Any]]],
    alerts_history: list[dict[str, Any]],
    operations: dict[str, Any],
    history_derivation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    history_map = {
        "1h": history_1h,
        "24h": history_24h,
        "7d": history_7d,
        "30d": history_30d,
    }

    db_hist = {
        "1h": db_history.get("1h", []),
        "24h": db_history.get("24h", []),
        "7d": db_history.get("7d", []),
        "30d": db_history.get("30d", []),
    }

    return {
        "generated_at": generated_at,
        "current": _extract_heavy_current(current),
        "history": history_map,
        "history_1h": history_1h,
        "history_24h": history_24h,
        "history_7d": history_7d,
        "history_30d": history_30d,
        "db": {
            "history": db_hist,
        },
        "alerts": {
            "history_recent": alerts_history,
        },
        "operations": operations,
        "meta": {
            "kind": "heavy",
            "collector_interval_seconds": settings.collect_interval,
            "history_derivation": history_derivation or {},
        },
    }


def _build_full_payload(
    generated_at: str,
    latest: list[dict[str, Any]],
    current: dict[str, Any],
    db_current: dict[str, Any],
    db_history: dict[str, list[dict[str, Any]]],
    alerts_current: list[dict[str, Any]],
    alerts_history: list[dict[str, Any]],
    history_1h: list[dict[str, Any]],
    history_24h: list[dict[str, Any]],
    history_7d: list[dict[str, Any]],
    history_30d: list[dict[str, Any]],
    operations: dict[str, Any],
    history_derivation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    realtime = []
    for row in latest[-120:]:
        metrics = row.get("metrics") if isinstance(row, dict) else None
        if isinstance(metrics, dict):
            realtime.append(metrics)

    history_map = {
        "1h": history_1h,
        "24h": history_24h,
        "7d": history_7d,
        "30d": history_30d,
    }

    db_hist = {
        "1h": db_history.get("1h", []),
        "24h": db_history.get("24h", []),
        "7d": db_history.get("7d", []),
        "30d": db_history.get("30d", []),
    }

    return {
        "generated_at": generated_at,
        "current": current,
        "db": {
            "current": db_current,
            "history": db_hist,
        },
        "alerts": {
            "current": alerts_current,
            "summary": _build_alert_summary(alerts_current),
            "history_recent": alerts_history,
        },
        "realtime": realtime,
        "history": history_map,
        "history_1h": history_1h,
        "history_24h": history_24h,
        "history_7d": history_7d,
        "history_30d": history_30d,
        "operations": operations,
        "meta": {
            "history_derivation": history_derivation or {},
        },
    }


def export(mode: str = "full", hours_overview: int = 24) -> None:
    mode = (mode or "full").strip().lower()
    if mode not in {"fast", "heavy", "full"}:
        raise ValueError(f"Unsupported mode: {mode}")

    out = _resolve_output_paths()
    generated_at = datetime.now(timezone.utc).isoformat()

    latest, current, db_current, alerts_current = _collect_base_state(latest_limit=220)
    live_extras = _collect_fast_live_extras(cache_only=(mode == "fast"))
    operations = build_operations_payload()

    if mode == "fast":
        fast_payload = _build_fast_payload(
            generated_at,
            latest,
            current,
            db_current,
            alerts_current,
            operations,
            live_extras=live_extras,
        )
        _write_json_atomic(out["fast"], fast_payload)
        logger.info("FAST snapshot exported -> %s (%d bytes)", out["fast"], out["fast"].stat().st_size)
        return

    # heavy/full modes share heavy components
    current_disk = current.get("disk") if isinstance(current.get("disk"), dict) else {}
    fallback_disk_total_gb = _safe_float_or_none(current_disk.get("total_gb"))

    summary_1h_raw = fetch_summary(hours=1)
    summary_24h_raw = fetch_summary(hours=hours_overview)
    summary_7d_raw = fetch_summary(hours=168)
    summary_1h, deriv_1h = _enrich_system_history_rows(summary_1h_raw, fallback_total_gb=fallback_disk_total_gb)
    summary_24h, deriv_24h = _enrich_system_history_rows(summary_24h_raw, fallback_total_gb=fallback_disk_total_gb)
    summary_7d, deriv_7d = _enrich_system_history_rows(summary_7d_raw, fallback_total_gb=fallback_disk_total_gb)
    db_history = _load_db_history_windows(include_30d=False)
    summary_30d, db_30d = _build_30d_from_archives(
        live_system_rows_7d=summary_7d,
        live_db_rows_7d=db_history.get("7d", []),
    )
    if not summary_30d:
        # Safe fallback for bootstrap scenarios before first weekly archive exists.
        summary_30d = fetch_summary(hours=THIRTY_DAYS_HOURS)
    summary_30d, deriv_30d = _enrich_system_history_rows(summary_30d, fallback_total_gb=fallback_disk_total_gb)
    if not db_30d:
        db_30d = _load_db_history_windows(include_30d=True).get("30d", [])
    db_history["30d"] = db_30d
    alerts_history = _load_recent_alert_history()
    history_derivation = {
        "1h": deriv_1h,
        "24h": deriv_24h,
        "7d": deriv_7d,
        "30d": deriv_30d,
    }
    try:
        heavy_current = collect(include_heavy=True)
    except Exception:
        heavy_current = current

    heavy_payload = _build_heavy_payload(
        generated_at=generated_at,
        current=heavy_current,
        history_1h=summary_1h,
        history_24h=summary_24h,
        history_7d=summary_7d,
        history_30d=summary_30d,
        db_history=db_history,
        alerts_history=alerts_history,
        operations=operations,
        history_derivation=history_derivation,
    )
    _write_json_atomic(out["heavy"], heavy_payload)
    logger.info("HEAVY snapshot exported -> %s (%d bytes)", out["heavy"], out["heavy"].stat().st_size)

    if mode == "heavy":
        # Fast snapshot is produced by the collector hook and the cron fallback lane.
        # Avoid overwriting it here with an older capture taken at heavy start time.
        return

    # Keep fast/full refreshed when explicitly running full mode.
    fast_payload = _build_fast_payload(
        generated_at,
        latest,
        current,
        db_current,
        alerts_current,
        operations,
        live_extras=live_extras,
    )
    _write_json_atomic(out["fast"], fast_payload)

    full_payload = _build_full_payload(
        generated_at=generated_at,
        latest=latest,
        current=heavy_current,
        db_current=db_current,
        db_history=db_history,
        alerts_current=alerts_current,
        alerts_history=alerts_history,
        history_1h=summary_1h,
        history_24h=summary_24h,
        history_7d=summary_7d,
        history_30d=summary_30d,
        operations=operations,
        history_derivation=history_derivation,
    )
    _write_json_atomic(out["full"], full_payload)
    logger.info("FULL snapshot exported -> %s (%d bytes)", out["full"], out["full"].stat().st_size)


def main() -> None:
    parser = argparse.ArgumentParser(description="Warden payload export")
    parser.add_argument("--hours", type=int, default=24, help="Hours for overview summary")
    parser.add_argument(
        "--mode",
        choices=["fast", "heavy", "full"],
        default="full",
        help="Snapshot mode to export",
    )
    args = parser.parse_args()
    export(mode=args.mode, hours_overview=args.hours)


if __name__ == "__main__":
    main()
