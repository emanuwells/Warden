"""
Warden — MariaDB Monitor
Collects lightweight MariaDB runtime metrics using SHOW GLOBAL STATUS.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.db_writer import get_connection
from src.settings import BASE_DIR, Settings, settings

logger = logging.getLogger("warden.db_monitor")

STATE_PATH = BASE_DIR / "runtime" / "db_monitor_state.json"
HISTORY_PATH = BASE_DIR / "runtime" / "db_monitor_history.jsonl"

STATUS_VARS = (
    "Threads_running",
    "Threads_connected",
    "Questions",
    "Queries",
    "Com_commit",
    "Com_rollback",
    "Uptime",
    "Innodb_data_written",
)


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _append_history(sample: dict[str, Any]) -> None:
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_PATH, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(sample) + "\n")


def _delta_per_second(current: float, previous: float, elapsed: float) -> float:
    if elapsed <= 0:
        return 0.0
    delta = current - previous
    if delta < 0:
        return 0.0
    return delta / elapsed


TOP_SCHEMA_LIMIT = 8
TOP_TABLE_LIMIT = 12


def _fetch_status_and_storage(
    cfg: Settings,
) -> tuple[dict[str, float], int, list[dict[str, Any]], list[dict[str, Any]]]:
    placeholders = ", ".join(["%s"] * len(STATUS_VARS))
    status_sql = f"""
        SHOW GLOBAL STATUS
        WHERE Variable_name IN ({placeholders})
    """
    storage_sql = """
        SELECT COALESCE(SUM(data_length + index_length), 0) AS total_bytes
        FROM information_schema.tables
    """
    schema_sql = f"""
        SELECT
            table_schema AS schema_name,
            COALESCE(SUM(data_length + index_length), 0) AS total_bytes
        FROM information_schema.tables
        GROUP BY table_schema
        ORDER BY total_bytes DESC
        LIMIT {TOP_SCHEMA_LIMIT}
    """
    table_sql = f"""
        SELECT
            table_schema AS schema_name,
            table_name AS table_name,
            COALESCE(data_length + index_length, 0) AS total_bytes
        FROM information_schema.tables
        ORDER BY total_bytes DESC
        LIMIT {TOP_TABLE_LIMIT}
    """
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(status_sql, STATUS_VARS)
            rows = cur.fetchall()
            cur.execute(storage_sql)
            storage_row = cur.fetchone() or {}
            cur.execute(schema_sql)
            schema_rows = cur.fetchall() or []
            cur.execute(table_sql)
            table_rows = cur.fetchall() or []

    values: dict[str, float] = {}
    for row in rows:
        key = str(row.get("Variable_name") or "").strip().lower()
        values[key] = _safe_float(row.get("Value"))
    total_bytes = max(0, int(_safe_float(storage_row.get("total_bytes"))))
    return values, total_bytes, schema_rows, table_rows


def collect_db_metrics(cfg: Settings | None = None, force: bool = False) -> dict[str, Any]:
    """
    Collect MariaDB metrics and compute rates based on persisted counters.
    Uses db_monitor_interval to reduce DB overhead.
    """
    cfg = cfg or settings
    if not cfg.db_monitor_enabled:
        return {}

    state = _load_state()
    previous_current = state.get("current") if isinstance(state.get("current"), dict) else {}
    last_sample_at = _parse_iso(str(state.get("last_sample_at") or ""))
    now = datetime.now(timezone.utc)

    if (
        not force
        and previous_current
        and last_sample_at
        and (now - last_sample_at).total_seconds() < max(1, cfg.db_monitor_interval)
    ):
        return previous_current

    try:
        counters, storage_total_bytes, schema_rows, table_rows = _fetch_status_and_storage(cfg)
    except Exception as exc:
        logger.error("DB monitor failed: %s", exc)
        return previous_current

    previous_counters = state.get("counters") if isinstance(state.get("counters"), dict) else {}
    previous_schema_sizes = state.get("schema_sizes") if isinstance(state.get("schema_sizes"), dict) else {}
    previous_table_sizes = state.get("table_sizes") if isinstance(state.get("table_sizes"), dict) else {}
    previous_ts = _parse_iso(str(state.get("last_sample_at") or ""))
    elapsed = (now - previous_ts).total_seconds() if previous_ts else 0.0

    questions_total = counters.get("questions", counters.get("queries", 0.0))
    previous_questions = _safe_float(
        previous_counters.get("questions", previous_counters.get("queries", 0.0))
    )
    commit_total = counters.get("com_commit", 0.0)
    rollback_total = counters.get("com_rollback", 0.0)
    previous_commit = _safe_float(previous_counters.get("com_commit", 0.0))
    previous_rollback = _safe_float(previous_counters.get("com_rollback", 0.0))
    data_written_total = counters.get("innodb_data_written", 0.0)
    previous_data_written = _safe_float(previous_counters.get("innodb_data_written", 0.0))
    qps = _delta_per_second(questions_total, previous_questions, elapsed)
    tps = _delta_per_second(
        commit_total + rollback_total,
        previous_commit + previous_rollback,
        elapsed,
    )
    storage_write_bytes_h = 0.0
    if elapsed > 0:
        storage_write_bytes_h = ((data_written_total - previous_data_written) / elapsed) * 3600.0
        if storage_write_bytes_h < 0:
            storage_write_bytes_h = 0.0
    previous_storage_total_bytes = _safe_float(previous_current.get("storage_total_bytes", 0.0))
    storage_growth_bytes_h = 0.0
    if elapsed > 0:
        storage_growth_bytes_h = ((float(storage_total_bytes) - previous_storage_total_bytes) / elapsed) * 3600.0

    def _growth_bytes_h(current_bytes: int, prev_bytes: float | None) -> float:
        if elapsed <= 0:
            return 0.0
        if prev_bytes is None:
            return 0.0
        return ((float(current_bytes) - float(prev_bytes)) / elapsed) * 3600.0

    top_schemas: list[dict[str, Any]] = []
    for row in schema_rows:
        schema_name = str(row.get("schema_name") or "").strip()
        if not schema_name:
            continue
        total_schema_bytes = max(0, int(_safe_float(row.get("total_bytes"))))
        prev_schema_bytes = _safe_float(previous_schema_sizes.get(schema_name)) if schema_name in previous_schema_sizes else None
        schema_growth_gb_h = _growth_bytes_h(total_schema_bytes, prev_schema_bytes) / (1024.0 ** 3)
        top_schemas.append(
            {
                "schema": schema_name,
                "total_bytes": total_schema_bytes,
                "total_gb": round(total_schema_bytes / (1024.0 ** 3), 3),
                "growth_gb_h": round(schema_growth_gb_h, 3),
            }
        )

    top_tables: list[dict[str, Any]] = []
    for row in table_rows:
        schema_name = str(row.get("schema_name") or "").strip()
        table_name = str(row.get("table_name") or "").strip()
        if not schema_name or not table_name:
            continue
        total_table_bytes = max(0, int(_safe_float(row.get("total_bytes"))))
        table_key = f"{schema_name}.{table_name}"
        prev_table_bytes = _safe_float(previous_table_sizes.get(table_key)) if table_key in previous_table_sizes else None
        table_growth_gb_h = _growth_bytes_h(total_table_bytes, prev_table_bytes) / (1024.0 ** 3)
        top_tables.append(
            {
                "schema": schema_name,
                "table": table_name,
                "total_bytes": total_table_bytes,
                "total_gb": round(total_table_bytes / (1024.0 ** 3), 3),
                "growth_gb_h": round(table_growth_gb_h, 3),
            }
        )

    current: dict[str, Any] = {
        "sampled_at": now.isoformat(),
        "threads_running": int(counters.get("threads_running", 0.0)),
        "threads_connected": int(counters.get("threads_connected", 0.0)),
        "qps": round(qps, 3),
        "tps": round(tps, 3),
        "questions_total": int(questions_total),
        "transactions_total": int(commit_total + rollback_total),
        "uptime_seconds": int(counters.get("uptime", 0.0)),
        "storage_total_bytes": int(storage_total_bytes),
        "storage_total_gb": round(float(storage_total_bytes) / (1024.0 ** 3), 3),
        "storage_growth_gb_h": round(storage_growth_bytes_h / (1024.0 ** 3), 3),
        "storage_write_gb_h": round(storage_write_bytes_h / (1024.0 ** 3), 3),
        "top_schemas": top_schemas,
        "top_tables": top_tables,
    }

    new_state = {
        "last_sample_at": now.isoformat(),
        "counters": counters,
        "schema_sizes": {item["schema"]: item["total_bytes"] for item in top_schemas},
        "table_sizes": {f"{item['schema']}.{item['table']}": item["total_bytes"] for item in top_tables},
        "current": current,
    }
    _save_state(new_state)
    _append_history(current)
    return current
