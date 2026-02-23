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
    "Slow_queries",
    "Questions",
    "Queries",
    "Com_commit",
    "Com_rollback",
    "Uptime",
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


def _fetch_status(cfg: Settings) -> dict[str, float]:
    placeholders = ", ".join(["%s"] * len(STATUS_VARS))
    sql = f"""
        SHOW GLOBAL STATUS
        WHERE Variable_name IN ({placeholders})
    """
    with get_connection(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, STATUS_VARS)
            rows = cur.fetchall()

    values: dict[str, float] = {}
    for row in rows:
        key = str(row.get("Variable_name") or "").strip().lower()
        values[key] = _safe_float(row.get("Value"))
    return values


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
        counters = _fetch_status(cfg)
    except Exception as exc:
        logger.error("DB monitor failed: %s", exc)
        return previous_current

    previous_counters = state.get("counters") if isinstance(state.get("counters"), dict) else {}
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
    slow_total = counters.get("slow_queries", 0.0)
    previous_slow = _safe_float(previous_counters.get("slow_queries", 0.0))

    qps = _delta_per_second(questions_total, previous_questions, elapsed)
    tps = _delta_per_second(
        commit_total + rollback_total,
        previous_commit + previous_rollback,
        elapsed,
    )
    slow_qps = _delta_per_second(slow_total, previous_slow, elapsed)

    current: dict[str, Any] = {
        "sampled_at": now.isoformat(),
        "threads_running": int(counters.get("threads_running", 0.0)),
        "threads_connected": int(counters.get("threads_connected", 0.0)),
        "qps": round(qps, 3),
        "tps": round(tps, 3),
        "slow_qps": round(slow_qps, 3),
        "slow_queries_total": int(slow_total),
        "questions_total": int(questions_total),
        "transactions_total": int(commit_total + rollback_total),
        "uptime_seconds": int(counters.get("uptime", 0.0)),
    }

    new_state = {
        "last_sample_at": now.isoformat(),
        "counters": counters,
        "current": current,
    }
    _save_state(new_state)
    _append_history(current)
    return current
