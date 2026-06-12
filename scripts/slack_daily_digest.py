#!/usr/bin/env python3
"""
Warden — Slack Daily Digest
Builds and sends a UTC daily digest to Slack.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.db_monitor import HISTORY_PATH as DB_HISTORY_PATH
from src.db_writer import get_connection
from src.settings import settings
from src.slack_notifier import SlackNotifier

ALERT_EVENTS_PATH = ROOT / "runtime" / "slack_alert_events.jsonl"
ALERT_STATE_PATH = ROOT / "runtime" / "slack_alert_state.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
)
logger = logging.getLogger("warden.slack_digest")
DIGEST_MENTION = "<!channel>"


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _fmt_num(value: Any, decimals: int = 2) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return str(value)
    if num.is_integer():
        return str(int(num))
    return f"{num:.{decimals}f}".rstrip("0").rstrip(".")


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    rows.append(obj)
            except Exception:
                continue
    return rows


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _parse_target_date(raw: str | None) -> date:
    if not raw:
        return (datetime.now(timezone.utc) - timedelta(days=1)).date()
    try:
        return datetime.strptime(raw.strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise SystemExit(f"Invalid date {raw!r}; expected YYYY-MM-DD.") from exc


def _load_host_summary(start_dt: datetime, end_dt: datetime) -> dict[str, Any]:
    sql = """
        SELECT
            COUNT(*) AS samples,
            MAX(CAST(JSON_EXTRACT(metrics, '$.cpu.total_percent') AS DECIMAL(10,3))) AS cpu_peak,
            MAX(CAST(JSON_EXTRACT(metrics, '$.memory.percent') AS DECIMAL(10,3))) AS ram_peak,
            MAX(CAST(JSON_EXTRACT(metrics, '$.disk.percent') AS DECIMAL(10,3))) AS disk_peak
        FROM warden_metrics
        WHERE captured_at >= %s
          AND captured_at < %s
    """
    row: dict[str, Any] = {}
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    (
                        start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
                row = cur.fetchone() or {}
    except Exception as exc:
        logger.error("Failed to load host summary from DB: %s", exc)

    samples = int(row.get("samples") or 0)
    expected = max(1, int((24 * 3600) / max(settings.collect_interval, 1)))
    uptime_pct = min(100.0, (samples / expected) * 100.0)
    return {
        "samples": samples,
        "expected_samples": expected,
        "uptime_pct_est": round(uptime_pct, 2),
        "cpu_peak": round(_to_float(row.get("cpu_peak")), 2),
        "ram_peak": round(_to_float(row.get("ram_peak")), 2),
        "disk_peak": round(_to_float(row.get("disk_peak")), 2),
    }


def _load_db_summary(start_dt: datetime, end_dt: datetime) -> dict[str, Any]:
    rows = _load_jsonl(DB_HISTORY_PATH)
    filtered: list[dict[str, Any]] = []
    for row in rows:
        sampled_at = _parse_iso(str(row.get("sampled_at") or ""))
        if sampled_at is None:
            continue
        if sampled_at.tzinfo is None:
            sampled_at = sampled_at.replace(tzinfo=timezone.utc)
        if start_dt <= sampled_at < end_dt:
            filtered.append(row)

    if not filtered:
        return {
            "count": 0,
            "qps_avg": 0.0,
            "tps_avg": 0.0,
            "db_storage_gb_max": 0.0,
            "storage_growth_gb_h_avg": 0.0,
            "storage_growth_gb_h_max": 0.0,
            "threads_running_max": 0,
        }

    return {
        "count": len(filtered),
        "qps_avg": round(mean(_to_float(item.get("qps")) for item in filtered), 3),
        "tps_avg": round(mean(_to_float(item.get("tps")) for item in filtered), 3),
        "db_storage_gb_max": round(max(_to_float(item.get("storage_total_gb")) for item in filtered), 3),
        "storage_growth_gb_h_avg": round(mean(_to_float(item.get("storage_growth_gb_h")) for item in filtered), 3),
        "storage_growth_gb_h_max": round(max(_to_float(item.get("storage_growth_gb_h")) for item in filtered), 3),
        "threads_running_max": int(max(_to_float(item.get("threads_running")) for item in filtered)),
    }


def _load_alert_summary(start_dt: datetime, end_dt: datetime, top_n: int) -> dict[str, Any]:
    rows = _load_jsonl(ALERT_EVENTS_PATH)
    filtered: list[dict[str, Any]] = []
    for row in rows:
        sent_at = _parse_iso(str(row.get("sent_at") or ""))
        if sent_at is None:
            continue
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if start_dt <= sent_at < end_dt:
            filtered.append(row)

    firing = [row for row in filtered if str(row.get("status") or "") == "firing"]
    critical = sum(1 for row in firing if str(row.get("severity") or "") == "critical")
    warning = sum(1 for row in firing if str(row.get("severity") or "") == "warning")
    recurring = Counter(str(row.get("key") or "") for row in firing if row.get("key"))
    top = [(key, count) for key, count in recurring.most_common(max(1, top_n))]
    return {
        "events_total": len(filtered),
        "firing_total": len(firing),
        "critical": critical,
        "warning": warning,
        "top_recurring": top,
    }


def _load_active_alerts(limit: int = 5) -> list[dict[str, Any]]:
    state = _load_json(ALERT_STATE_PATH)
    alerts = state.get("alerts")
    if not isinstance(alerts, dict):
        return []

    active: list[dict[str, Any]] = []
    for key, raw in alerts.items():
        if not isinstance(raw, dict):
            continue
        if str(raw.get("status") or "") != "firing":
            continue
        notifications_sent = int(_to_float(raw.get("notifications_sent")))
        max_notifications = int(_to_float(raw.get("max_notifications"))) or 5
        active.append(
            {
                "key": str(key),
                "severity": str(raw.get("severity") or "warning"),
                "open_since": raw.get("open_since"),
                "last_sent_at": raw.get("last_sent_at"),
                "last_value": raw.get("last_value"),
                "threshold": raw.get("threshold"),
                "notifications_sent": notifications_sent,
                "max_notifications": max_notifications,
                "notifications_exhausted": bool(raw.get("max_notifications_reached_at"))
                or notifications_sent >= max_notifications,
            }
        )

    severity_rank = {"critical": 0, "warning": 1}
    active.sort(
        key=lambda item: (
            severity_rank.get(str(item.get("severity") or ""), 2),
            str(item.get("open_since") or ""),
            str(item.get("key") or ""),
        )
    )
    return active[: max(1, limit)]


def _build_message(
    target_date: date,
    host_summary: dict[str, Any],
    db_summary: dict[str, Any],
    alert_summary: dict[str, Any],
    active_alerts: list[dict[str, Any]],
) -> str:
    critical_count = int(alert_summary.get("critical") or 0)
    warning_count = int(alert_summary.get("warning") or 0)
    active_critical_count = sum(1 for item in active_alerts if item.get("severity") == "critical")
    active_warning_count = sum(1 for item in active_alerts if item.get("severity") == "warning")
    if active_critical_count > 0 or critical_count > 0:
        status_icon = ":rotating_light:"
        status_line = f"{critical_count} critico(s) no periodo; {active_critical_count} ainda ativo(s)"
    elif active_warning_count > 0 or warning_count > 0:
        status_icon = ":warning:"
        status_line = f"{warning_count} warning(s) no periodo; {active_warning_count} ainda ativo(s)"
    else:
        status_icon = ":white_check_mark:"
        status_line = "Sem alertas de warning/critico no periodo"

    lines = [
        f"{DIGEST_MENTION} {status_icon} *Warden Daily Digest*",
        f"*Periodo:* `{target_date.isoformat()} UTC`",
        f"*Resumo:* {status_line}",
        "",
        ":desktop_computer: *Host*",
        (
            f"- Uptime estimado: `{_fmt_num(host_summary['uptime_pct_est'])}%` "
            f"({host_summary['samples']}/{host_summary['expected_samples']} snapshots)"
        ),
        (
            f"- Picos: CPU `{_fmt_num(host_summary['cpu_peak'])}%` | "
            f"RAM `{_fmt_num(host_summary['ram_peak'])}%` | "
            f"Disco `{_fmt_num(host_summary['disk_peak'])}%`"
        ),
        "",
        ":floppy_disk: *MariaDB*",
        (
            f"- Samples: `{db_summary['count']}` | "
            f"QPS medio: `{_fmt_num(db_summary['qps_avg'], 3)}` | "
            f"TPS medio: `{_fmt_num(db_summary['tps_avg'], 3)}`"
        ),
        (
            f"- Consumo DB max: `{_fmt_num(db_summary['db_storage_gb_max'], 3)} GB` | "
            f"crescimento medio/h: `{_fmt_num(db_summary['storage_growth_gb_h_avg'], 3)} GB/h`"
        ),
        (
            f"- Crescimento max/h: `{_fmt_num(db_summary['storage_growth_gb_h_max'], 3)} GB/h` | "
            f"threads_running max: `{db_summary['threads_running_max']}`"
        ),
        "",
        ":rotating_light: *Alertas*",
        (
            f"- Eventos: `{alert_summary['events_total']}` | "
            f"Firing: `{alert_summary['firing_total']}` | "
            f"Criticos: `{alert_summary['critical']}` | "
            f"Warnings: `{alert_summary['warning']}`"
        ),
    ]
    top = alert_summary.get("top_recurring") or []
    if top:
        lines.append("- Mais recorrentes:")
        for key, count in top:
            lines.append(f"  - `{key}` x{count}")
    else:
        lines.append("- Mais recorrentes: `nenhum`")

    lines.extend(["", ":warning: *Alertas ainda ativos*"])
    if active_alerts:
        for alert in active_alerts:
            exhausted = " | notificacoes esgotadas" if alert.get("notifications_exhausted") else ""
            lines.append(
                "- "
                f"`{alert['key']}` {alert['severity']} | "
                f"valor `{_fmt_num(alert.get('last_value'))}` / limite `{_fmt_num(alert.get('threshold'))}` | "
                f"notificacoes `{alert['notifications_sent']}/{alert['max_notifications']}`{exhausted}"
            )
    else:
        lines.append("- `nenhum`")
    return "\n".join(lines)


def run(target_date: date, top_n: int = 5, dry_run: bool = False) -> int:
    start_dt = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)

    notifier = SlackNotifier()
    if not notifier.enabled and not dry_run:
        logger.warning("Slack notifier disabled or invalid config.")
        return 1
    if not notifier.enabled and dry_run:
        logger.info("Dry-run mode: Slack config not required.")

    host_summary = _load_host_summary(start_dt, end_dt)
    db_summary = _load_db_summary(start_dt, end_dt)
    alert_summary = _load_alert_summary(start_dt, end_dt, top_n=top_n)
    active_alerts = _load_active_alerts(limit=top_n)
    message = _build_message(target_date, host_summary, db_summary, alert_summary, active_alerts)

    if dry_run:
        print(message)
        return 0

    if not notifier.send(message, channel_override=notifier.channel or "#overseer"):
        logger.error("Failed to send daily digest to Slack.")
        return 2
    logger.info("Daily digest sent to Slack.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Warden Slack daily digest")
    parser.add_argument("--date", default=None, help="UTC date YYYY-MM-DD (default: yesterday UTC)")
    parser.add_argument("--top", type=int, default=5, help="Top recurring alerts to include")
    parser.add_argument("--dry-run", action="store_true", help="Build message but do not send")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    target_date = _parse_target_date(args.date)
    top_n = max(1, min(int(args.top), 20))
    return run(target_date=target_date, top_n=top_n, dry_run=bool(args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
