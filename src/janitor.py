"""
Warden — Janitor (The Janitor)
Handles automatic data retention — deletes records older than N days.
"""

import logging

from src.db_writer import get_connection
from src.settings import Settings, settings

logger = logging.getLogger("warden.janitor")


def cleanup(cfg: Settings | None = None) -> int:
    """
    Delete warden_metrics rows older than retention_days.
    Returns the number of rows deleted.
    """
    cfg = cfg or settings
    days = cfg.retention_days

    sql = """
        DELETE FROM warden_metrics
        WHERE captured_at < NOW() - INTERVAL %s DAY
    """
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (days,))
            deleted = cur.rowcount

    if deleted:
        logger.info("Janitor: deleted %d rows older than %d days.", deleted, days)
    else:
        logger.info("Janitor: nothing to clean (retention=%d days).", days)
    return deleted
