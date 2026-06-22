"""Notificações Slack para scripts operacionais do Warden."""

from __future__ import annotations

from typing import Optional

from src.slack_notifier import SlackNotifier


def load_slack_notifier() -> Optional[SlackNotifier]:
    try:
        return SlackNotifier()
    except Exception:
        return None


def send_slack_message(label: str, status: str, lines: list[str]) -> None:
    slack = load_slack_notifier()
    if not slack or not slack.enabled:
        return
    emoji = "OK" if status == "OK" else "ERRO"
    body = "\n".join([f"{emoji} {label}", f"Estado: {status}", *lines])
    slack.send(body)
