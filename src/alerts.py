"""
Warden — Alert Rules Engine
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.settings import Settings, settings


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _severity(value: float, warn: float, critical_multiple: float = 1.12) -> str:
    if value >= (warn * critical_multiple):
        return "critical"
    return "warning"


def evaluate_alerts(
    current: dict[str, Any] | None,
    db_current: dict[str, Any] | None,
    cfg: Settings | None = None,
) -> list[dict[str, Any]]:
    cfg = cfg or settings
    current = current or {}
    db_current = db_current or {}
    now_iso = datetime.now(timezone.utc).isoformat()

    cpu_val = _to_float((current.get("cpu") or {}).get("total_percent"))
    ram_val = _to_float((current.get("memory") or {}).get("percent"))
    disk_val = _to_float((current.get("disk") or {}).get("percent"))
    db_threads = _to_float(db_current.get("threads_running"))
    db_slow_qps = _to_float(db_current.get("slow_qps"))

    rules = [
        ("cpu_high", "CPU usage high", cpu_val, cfg.alert_cpu_warn),
        ("ram_high", "RAM usage high", ram_val, cfg.alert_ram_warn),
        ("disk_high", "Disk usage high", disk_val, cfg.alert_disk_warn),
        (
            "db_threads_running_high",
            "MariaDB threads running high",
            db_threads,
            cfg.alert_db_threads_running_warn,
        ),
        (
            "db_slow_qps_high",
            "MariaDB slow query rate high",
            db_slow_qps,
            cfg.alert_db_slow_qps_warn,
        ),
    ]

    out: list[dict[str, Any]] = []
    for key, title, value, threshold in rules:
        firing = value >= float(threshold)
        out.append(
            {
                "key": key,
                "severity": _severity(value, float(threshold)),
                "title": title,
                "value": round(value, 3),
                "threshold": float(threshold),
                "status": "firing" if firing else "resolved",
                "first_seen_at": now_iso if firing else None,
                "evaluated_at": now_iso,
            }
        )
    return out
