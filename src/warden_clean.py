"""
Warden Clean retention.
Handles automatic data retention by deleting operational records older than N days.

Target tables are optional during bootstrap or partial schemas; missing tables are
skipped with a warning so the job stays resilient across environments.
"""

import logging
import re
from typing import Dict

from src.db_writer import get_connection
from src.settings import Settings, settings

logger = logging.getLogger("warden.clean")
TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


def _safe_table_names(names: list[str] | None) -> list[str]:
    safe = []
    for name in names or []:
        if TABLE_NAME_RE.match(name):
            safe.append(name)
        else:
            logger.warning("Warden Clean: ignored unsafe table name %r.", name)
    return safe


def _optimize_warden_tables(cur, cfg: Settings) -> list[str]:
    """
    Reclaim InnoDB free space for Warden-owned tables when explicitly enabled.

    OPTIMIZE TABLE rebuilds InnoDB tables, so it is gated by configuration and
    by a minimum data_free threshold to avoid daily churn on small tables.
    """
    min_bytes = max(0, cfg.warden_clean_optimize_min_free_mb) * 1024 * 1024
    optimized = []

    for table in _safe_table_names(cfg.warden_clean_optimize_tables):
        cur.execute(
            """
            SELECT COALESCE(data_free, 0) AS data_free
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name = %s
            """,
            (table,),
        )
        row = cur.fetchone()
        data_free = int((row or {}).get("data_free") or 0)
        if data_free < min_bytes:
            logger.info(
                "Warden Clean: skip optimize %s (free %.1f MB < %d MB).",
                table,
                data_free / 1024 / 1024,
                cfg.warden_clean_optimize_min_free_mb,
            )
            continue

        try:
            cur.execute(f"OPTIMIZE TABLE `{table}`")
            cur.fetchall()
            optimized.append(table)
            logger.info(
                "Warden Clean: optimized %s (free before %.1f MB).",
                table,
                data_free / 1024 / 1024,
            )
        except Exception as exc:
            logger.warning("Warden Clean: optimize skipped for %s (%s).", table, exc)

    return optimized


def _purge_binary_logs(cur, cfg: Settings) -> bool:
    """
    Purge MariaDB/MySQL binary logs older than the configured retention window.

    This is disabled by default because binlogs may be part of backup/PITR
    policy. When enabled, it keeps a recent recovery window and lets the server
    decide which logs are safe to remove before that timestamp.
    """
    days = int(cfg.warden_clean_binlog_retention_days or 0)
    if days <= 0:
        return False

    try:
        cur.execute("SHOW REPLICA STATUS")
        if cur.fetchall():
            logger.warning("Warden Clean: binlog purge skipped because this server has replica status.")
            return False
    except Exception:
        try:
            cur.execute("SHOW SLAVE STATUS")
            if cur.fetchall():
                logger.warning("Warden Clean: binlog purge skipped because this server has slave status.")
                return False
        except Exception:
            pass

    try:
        cur.execute(f"PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL {days} DAY)")
        logger.info("Warden Clean: purged binary logs older than %d days.", days)
        return True
    except Exception as exc:
        logger.warning("Warden Clean: binlog purge skipped (%s).", exc)
        return False


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

            if cfg.warden_clean_binlog_retention_days > 0:
                _purge_binary_logs(cur, cfg)

            if cfg.warden_clean_optimize_enabled:
                _optimize_warden_tables(cur, cfg)

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
