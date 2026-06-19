"""
Warden Clean retention.
Handles automatic data retention by deleting operational records older than N days.
"""

import logging
from typing import Dict

from src.db_writer import get_connection
from src.settings import Settings, settings

logger = logging.getLogger("warden.clean")


def cleanup(cfg: Settings | None = None) -> int:
    """
    Delete operational rows older than retention_days.
    Returns the total number of rows deleted.
    """
    cfg = cfg or settings
    days = cfg.retention_days

    targets = [
        ("warden_metrics", "captured_at"),
        ("warden_alert_events", "observed_at"),
        ("warden_ingest_registry", "ingested_at"),
        ("warden_ts_minute", "bucket_minute"),
    ]

    deleted_by_table: Dict[str, int] = {}
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            for table, column in targets:
                sql = f"DELETE FROM `{table}` WHERE `{column}` < NOW() - INTERVAL %s DAY"
                try:
                    cur.execute(sql, (days,))
                    deleted_by_table[table] = int(cur.rowcount)
                except Exception as exc:
                    # Keep Warden Clean resilient during partial/bootstrap schemas.
                    deleted_by_table[table] = 0
                    logger.warning("Warden Clean: skipped %s (%s).", table, exc)

    deleted = sum(deleted_by_table.values())

    if deleted:
        logger.info(
            "Warden Clean: deleted %d rows older than %d days (%s).",
            deleted,
            days,
            ", ".join(f"{k}={v}" for k, v in deleted_by_table.items()),
        )
    else:
        logger.info("Warden Clean: nothing to clean (retention=%d days).", days)
    return deleted
