#!/usr/bin/env python3
"""
Warden — Slack Immediate Alerts
Evaluates current payload alerts and sends deduplicated Slack notifications.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.alerts import evaluate_alerts
from src.settings import BASE_DIR, settings
from src.slack_notifier import SlackNotifier

STATE_PATH = BASE_DIR / "runtime" / "slack_alert_state.json"
EVENTS_PATH = BASE_DIR / "runtime" / "slack_alert_events.jsonl"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-7s]  %(message)s",
)
logger = logging.getLogger("warden.slack_alerts")
SEND_WARNINGS_TO_SLACK = True
ALERT_MENTION = "<!channel>"


def _fmt_num(value: Any) -> str:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return str(value)
    if num.is_integer():
        return str(int(num))
    return f"{num:.2f}".rstrip("0").rstrip(".")


def _value_with_unit(alert: dict[str, Any], field: str) -> str:
    key = str(alert.get("key") or "")
    raw = alert.get(field)
    if key in {"cpu_high", "ram_high", "disk_high"}:
        return f"{_fmt_num(raw)}%"
    if key == "db_slow_qps_high":
        return f"{_fmt_num(raw)} qps"
    return _fmt_num(raw)


def _severity_badge(severity: str) -> str:
    sev = severity.lower()
    if sev == "critical":
        return "CRITICO"
    return "WARNING"


def _format_duration(start_iso: str | None, end_iso: str | None) -> str | None:
    start = _parse_iso(start_iso)
    end = _parse_iso(end_iso)
    if not start or not end or end < start:
        return None
    total_seconds = int((end - start).total_seconds())
    hours, rem = divmod(total_seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Invalid JSON at %s: %s", path, exc)
        return {}


def _load_payload(path: Path | None = None) -> dict[str, Any]:
    if path:
        return _load_json(path)
    primary = BASE_DIR / settings.export_path
    fallback = BASE_DIR / "frontend" / "warden_payload.json"
    if primary.exists():
        return _load_json(primary)
    if fallback.exists():
        return _load_json(fallback)
    return {}


def _load_state() -> dict[str, Any]:
    state = _load_json(STATE_PATH)
    if not state:
        return {"version": 1, "alerts": {}, "updated_at": None}
    state.setdefault("alerts", {})
    return state


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _append_event(event: dict[str, Any]) -> None:
    EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(EVENTS_PATH, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")


def _format_firing(alert: dict[str, Any], first_seen_at: str, reminder: bool) -> str:
    severity = str(alert.get("severity") or "warning")
    mode_label = "LEMBRETE" if reminder else "ALERTA"
    mode_emoji = ":bell:" if reminder else (":rotating_light:" if severity == "critical" else ":warning:")
    evaluated_at = str(alert.get("evaluated_at") or "-")
    return (
        f"{ALERT_MENTION} {mode_emoji} *Warden {mode_label}* | *{_severity_badge(severity)}*\n"
        f"*{alert.get('title')}*\n"
        f"Valor atual: `{_value_with_unit(alert, 'value')}` | Limite: `{_value_with_unit(alert, 'threshold')}`\n"
        f"Chave: `{alert.get('key')}`\n"
        f"Ativo desde: `{first_seen_at}`\n"
        f"Avaliado em: `{evaluated_at}`"
    )


def _format_resolved(alert: dict[str, Any], open_since: str | None, resolved_at: str) -> str:
    duration = _format_duration(open_since, resolved_at)
    duration_line = f"\nDuração do alerta: `{duration}`" if duration else ""
    return (
        f":white_check_mark: *Warden Recovery* | *{_severity_badge(str(alert.get('severity') or 'warning'))}*\n"
        f"*{alert.get('title')}* voltou ao normal\n"
        f"Valor atual: `{_value_with_unit(alert, 'value')}` | Limite: `{_value_with_unit(alert, 'threshold')}`\n"
        f"Chave: `{alert.get('key')}`\n"
        f"Resolvido em: `{resolved_at}`{duration_line}"
    )


def run(payload_path: Path | None = None, dry_run: bool = False) -> int:
    payload = _load_payload(payload_path)
    if not payload:
        logger.error("Payload not found or invalid.")
        return 1

    notifier = SlackNotifier()
    if not notifier.enabled and not dry_run:
        logger.warning("Slack notifier disabled or invalid config.")
        return 0
    if not notifier.enabled and dry_run:
        logger.info("Dry-run mode: Slack config not required.")

    current = payload.get("current") if isinstance(payload.get("current"), dict) else {}
    db = payload.get("db") if isinstance(payload.get("db"), dict) else {}
    db_current = db.get("current") if isinstance(db.get("current"), dict) else {}
    alerts = evaluate_alerts(current, db_current)

    state = _load_state()
    state_alerts = state.get("alerts", {})
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    cooldown = timedelta(minutes=max(1, settings.slack_alert_cooldown_minutes))

    sent_count = 0
    for alert in alerts:
        key = str(alert.get("key") or "")
        if not key:
            continue
        previous = state_alerts.get(key, {})
        previous_status = str(previous.get("status") or "resolved")
        previous_severity = str(previous.get("severity") or "")
        new_status = str(alert.get("status") or "resolved")
        previous_last_sent = _parse_iso(str(previous.get("last_sent_at") or ""))
        open_since = str(previous.get("open_since") or now_iso)
        severity = str(alert.get("severity") or "warning")
        is_critical = severity == "critical"
        previous_notified = bool(previous.get("notified_firing"))

        if new_status == "firing":
            send_now = False
            reminder = False
            escalated_to_critical = (
                previous_status == "firing"
                and is_critical
                and previous_severity != "critical"
            )
            became_firing = previous_status != "firing"

            if became_firing:
                open_since = now_iso
            elif escalated_to_critical:
                send_now = True

            if SEND_WARNINGS_TO_SLACK or is_critical:
                if became_firing:
                    send_now = True
                elif previous_last_sent and (now - previous_last_sent) >= cooldown:
                    send_now = True
                    reminder = True
                elif previous_last_sent is None:
                    send_now = True

            sent_to_slack = False

            if send_now:
                message = _format_firing(alert, open_since, reminder=reminder)
                if dry_run or notifier.send(message):
                    sent_count += 1
                    sent_to_slack = True
                    previous["last_sent_at"] = now_iso

            if became_firing or reminder or escalated_to_critical:
                notification = "reminder" if reminder else ("escalated" if escalated_to_critical else "firing")
                _append_event(
                    {
                        "sent_at": now_iso,
                        "notification": notification,
                        "delivered_to_slack": sent_to_slack,
                        "key": key,
                        "status": "firing",
                        "severity": alert.get("severity"),
                        "title": alert.get("title"),
                        "value": alert.get("value"),
                        "threshold": alert.get("threshold"),
                    }
                )

            previous.update(
                {
                    "status": "firing",
                    "open_since": open_since,
                    "resolved_at": None,
                    "severity": alert.get("severity"),
                    "last_value": alert.get("value"),
                    "threshold": alert.get("threshold"),
                    "notified_firing": (previous_notified or sent_to_slack),
                }
            )
            state_alerts[key] = previous
            continue

        # resolved
        resolved_at = now_iso
        was_firing = previous_status == "firing"
        sent_to_slack = False
        if was_firing and notifier.notify_on_recovery and previous_notified:
            message = _format_resolved(alert, previous.get("open_since"), resolved_at)
            if dry_run or notifier.send(message):
                sent_count += 1
                sent_to_slack = True
                previous["last_sent_at"] = now_iso

        if was_firing:
            _append_event(
                {
                    "sent_at": now_iso,
                    "notification": "resolved",
                    "delivered_to_slack": sent_to_slack,
                    "key": key,
                    "status": "resolved",
                    "severity": alert.get("severity"),
                    "title": alert.get("title"),
                    "value": alert.get("value"),
                    "threshold": alert.get("threshold"),
                }
            )

        previous.update(
            {
                "status": "resolved",
                "resolved_at": resolved_at,
                "severity": alert.get("severity"),
                "last_value": alert.get("value"),
                "threshold": alert.get("threshold"),
                "notified_firing": False,
            }
        )
        state_alerts[key] = previous

    state["alerts"] = state_alerts
    state["updated_at"] = now_iso
    _save_state(state)
    logger.info("Slack alerts run finished. Notifications sent: %d", sent_count)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Warden Slack immediate alerts")
    parser.add_argument("--payload", default=None, help="Path to payload JSON")
    parser.add_argument("--dry-run", action="store_true", help="Do not send to Slack")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload_path = Path(args.payload).resolve() if args.payload else None
    return run(payload_path=payload_path, dry_run=bool(args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
