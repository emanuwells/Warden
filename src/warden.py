#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║  WARDEN — System Resource Monitor                          ║
║  The Guardian of your infrastructure.                       ║
║                                                             ║
║  Usage:                                                     ║
║    python -m src.warden          # Run collector loop       ║
║    python -m src.warden --once   # Single capture & exit    ║
║    python -m src.warden --export # Export payload to JSON   ║
║    python -m src.warden --cleanup # Run Warden Clean        ║
║    python -m src.warden --setup  # Create DB table          ║
╚══════════════════════════════════════════════════════════════╝
"""

import argparse
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure project root is in path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.settings import settings, BASE_DIR
from src.collector import collect
from src.db_writer import ensure_table, insert_metric, fetch_latest, fetch_summary
from src.warden_clean import cleanup
from src.db_monitor import collect_db_metrics
from src.alerts import evaluate_alerts
from src.fast_snapshot import export_fast_snapshot_after_collect

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR = BASE_DIR / "runtime" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s  [%(levelname)-7s]  %(name)s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(BASE_DIR / settings.log_file, encoding="utf-8"),
    ],
)
logger = logging.getLogger("warden")
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

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
_running = True


def _handle_signal(signum, frame):
    global _running
    logger.info("Signal %s received — shutting down gracefully.", signum)
    _running = False


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_setup():
    """Create the DB table."""
    logger.info("Setting up database table...")
    ensure_table()
    logger.info("Done.")


def cmd_once():
    """Single metric capture → DB insert → stdout."""
    payload = collect(include_heavy=True)
    insert_metric(payload)
    print(json.dumps(payload, indent=2))
    logger.info("Single capture done.")


def cmd_run():
    """
    Main collector loop.
    Captures metrics every N seconds and inserts into DB.
    Runs Warden Clean retention once per day.
    """
    ensure_table()
    interval = settings.collect_interval
    logger.info("Warden collector started (interval=%ds, retention=%dd, export_fast_on_collect=%s).",
                interval, settings.retention_days, settings.export_fast_on_collect)

    last_cleanup_date = None

    while _running:
        try:
            payload = collect(include_heavy=False)
            insert_metric(payload)
            export_fast_snapshot_after_collect()
            logger.debug("Metric captured: CPU=%.1f%% MEM=%.1f%%",
                         payload["cpu"]["total_percent"],
                         payload["memory"]["percent"])
        except Exception as exc:
            logger.error("Collection/insert error: %s", exc, exc_info=True)

        # Daily Warden Clean retention
        today = datetime.now(timezone.utc).date()
        if last_cleanup_date != today:
            try:
                deleted = cleanup()
                last_cleanup_date = today
                logger.info("Daily Warden Clean retention complete. Deleted: %d", deleted)
            except Exception as exc:
                logger.error("Warden Clean retention error: %s", exc, exc_info=True)

        time.sleep(interval)

    logger.info("Warden collector stopped.")


def cmd_export():
    """
    Export latest metrics + 24h summary → JSON payload for the frontend.
    """
    logger.info("Exporting payload...")
    latest = fetch_latest(limit=720)          # ~1h of 5s data
    summary_24h = fetch_summary(hours=24)     # 24h averages
    summary_7d = fetch_summary(hours=168)     # 7d averages

    # Current snapshot (last record)
    current = latest[-1]["metrics"] if latest else collect(include_heavy=True)
    db_current = collect_db_metrics()
    alerts_current = evaluate_alerts(current, db_current)
    alerts_history = _load_recent_alert_history()

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current": current,
        "db": {"current": db_current},
        "alerts": {
            "current": alerts_current,
            "summary": _build_alert_summary(alerts_current),
            "history_recent": alerts_history,
        },
        "realtime": [row["metrics"] for row in latest[-120:]],    # last 10 min
        "history_24h": summary_24h,
        "history_7d": summary_7d,
    }

    out_path = BASE_DIR / settings.export_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)

    logger.info("Payload exported → %s (%d bytes)", out_path, out_path.stat().st_size)


def cmd_cleanup():
    """Manual Warden Clean retention run."""
    deleted = cleanup()
    print(f"Warden Clean: {deleted} rows deleted.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="warden",
        description="Warden — System Resource Monitor",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--setup", action="store_true", help="Create DB table")
    group.add_argument("--once", action="store_true", help="Single capture")
    group.add_argument("--export", action="store_true", help="Export JSON payload")
    group.add_argument("--cleanup", action="store_true", help="Run Warden Clean retention")

    args = parser.parse_args()

    if args.setup:
        cmd_setup()
    elif args.once:
        cmd_once()
    elif args.export:
        cmd_export()
    elif args.cleanup:
        cmd_cleanup()
    else:
        cmd_run()


if __name__ == "__main__":
    main()
