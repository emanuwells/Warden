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


def _severity(
    value: float,
    warn: float,
    critical_multiple: float = 1.12,
    critical_threshold: float | None = None,
) -> str:
    if critical_threshold is not None and value >= critical_threshold:
        return "critical"
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
    db_storage_gb = _to_float(db_current.get("storage_total_gb"))

    rules = [
        ("cpu_high", "CPU usage high", cpu_val, cfg.alert_cpu_warn, None),
        ("ram_high", "RAM usage high", ram_val, cfg.alert_ram_warn, None),
        ("disk_high", "Disk usage high", disk_val, cfg.alert_disk_warn, cfg.alert_disk_critical),
        (
            "db_threads_running_high",
            "MariaDB threads running high",
            db_threads,
            cfg.alert_db_threads_running_warn,
            None,
        ),
        (
            "db_storage_usage_high",
            "MariaDB storage usage high",
            db_storage_gb,
            cfg.alert_db_storage_gb_warn,
            None,
        ),
    ]

    out: list[dict[str, Any]] = []
    for key, title, value, threshold, critical_threshold in rules:
        firing = value >= float(threshold)
        severity = _severity(value, float(threshold), critical_threshold=critical_threshold)
        threshold_for_message = (
            float(critical_threshold)
            if (critical_threshold is not None and severity == "critical")
            else float(threshold)
        )
        out.append(
            {
                "key": key,
                "severity": severity,
                "title": title,
                "value": round(value, 3),
                "threshold": threshold_for_message,
                "status": "firing" if firing else "resolved",
                "first_seen_at": now_iso if firing else None,
                "evaluated_at": now_iso,
            }
        )
    return out
