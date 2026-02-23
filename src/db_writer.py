"""
Warden — DB Writer
Handles MariaDB connection (with optional SSH tunnel) and metric insertion.
"""

import json
import logging
from contextlib import contextmanager
from datetime import datetime

import pymysql
from pymysql.cursors import DictCursor

from src.settings import Settings, settings

logger = logging.getLogger("warden.db")

# ---------------------------------------------------------------------------
# SSH Tunnel (optional)
# ---------------------------------------------------------------------------
_tunnel = None


def _start_tunnel(cfg: Settings):
    global _tunnel
    if cfg.use_ssh and _tunnel is None:
        from sshtunnel import SSHTunnelForwarder
        _tunnel = SSHTunnelForwarder(
            (cfg.ssh_host, cfg.ssh_port),
            ssh_username=cfg.ssh_user,
            ssh_pkey=cfg.ssh_key_path or None,
            remote_bind_address=(cfg.db_host, cfg.db_port),
        )
        _tunnel.start()
        logger.info("SSH tunnel started → localhost:%s", _tunnel.local_bind_port)
    return _tunnel


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

@contextmanager
def get_connection(cfg: Settings | None = None):
    """Yield a PyMySQL connection (with optional SSH tunnel)."""
    cfg = cfg or settings
    tunnel = _start_tunnel(cfg)

    host = "127.0.0.1" if tunnel else cfg.db_host
    port = tunnel.local_bind_port if tunnel else cfg.db_port

    conn = pymysql.connect(
        host=host,
        port=port,
        user=cfg.db_user,
        password=cfg.db_password,
        database=cfg.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=10,
    )
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Table bootstrap
# ---------------------------------------------------------------------------
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS warden_metrics (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    captured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    metrics     JSON         NOT NULL,
    INDEX idx_captured_at (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""


def ensure_table(cfg: Settings | None = None):
    """Create warden_metrics table if it doesn't exist."""
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(CREATE_TABLE_SQL)
    logger.info("Table warden_metrics ready.")


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------

def insert_metric(payload: dict, cfg: Settings | None = None):
    """Insert a JSON metric payload into warden_metrics."""
    ts = payload.get("timestamp", datetime.utcnow().isoformat())
    sql = "INSERT INTO warden_metrics (captured_at, metrics) VALUES (%s, %s)"
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (ts, json.dumps(payload)))
    logger.debug("Metric inserted at %s", ts)


# ---------------------------------------------------------------------------
# Read (for export)
# ---------------------------------------------------------------------------

def fetch_latest(limit: int = 720, cfg: Settings | None = None) -> list[dict]:
    """
    Fetch the latest N metrics (default 720 = ~1 hour at 5s interval).
    Returns list of dicts with 'captured_at' and 'metrics'.
    """
    sql = """
        SELECT id, captured_at, metrics
        FROM warden_metrics
        ORDER BY captured_at DESC
        LIMIT %s
    """
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (limit,))
            rows = cur.fetchall()
    # Parse JSON strings
    for row in rows:
        if isinstance(row["metrics"], str):
            row["metrics"] = json.loads(row["metrics"])
        row["captured_at"] = row["captured_at"].isoformat() if hasattr(row["captured_at"], "isoformat") else str(row["captured_at"])
    return list(reversed(rows))  # chronological order


def fetch_summary(hours: int = 24, cfg: Settings | None = None) -> list[dict]:
    """
    Fetch aggregated 5-minute averages for the last N hours.
    Used for the dashboard overview charts.
    """
    sql = """
        SELECT
            DATE_FORMAT(captured_at, '%%Y-%%m-%%dT%%H:%%i:00') AS bucket,
            AVG(JSON_EXTRACT(metrics, '$.cpu.total_percent'))    AS cpu_avg,
            AVG(JSON_EXTRACT(metrics, '$.memory.percent'))       AS mem_avg,
            AVG(JSON_EXTRACT(metrics, '$.disk.percent'))         AS disk_avg,
            AVG(JSON_EXTRACT(metrics, '$.network.upload_mbps'))  AS net_up_avg,
            AVG(JSON_EXTRACT(metrics, '$.network.download_mbps'))AS net_down_avg
        FROM warden_metrics
        WHERE captured_at >= NOW() - INTERVAL %s HOUR
        GROUP BY bucket
        ORDER BY bucket ASC
    """
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (hours,))
            rows = cur.fetchall()
    # Convert Decimals to float
    for row in rows:
        for k, v in row.items():
            if v is not None and not isinstance(v, (str, int, float)):
                row[k] = float(v)
    return rows
