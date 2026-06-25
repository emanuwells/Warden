"""Notificações Slack para scripts operacionais do Warden (padrão Overseer)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from src.slack_notifier import SlackNotifier
from src.settings import BASE_DIR, settings

DEFAULT_OVERSEER_CHANNEL = "#overseer"
ENV_OVERSEER_CHANNEL = "WARDEN_OPERATIONAL_SLACK_CHANNEL"


def _load_overseer_channel() -> str:
    env_channel = os.getenv(ENV_OVERSEER_CHANNEL, "").strip()
    if env_channel:
        return env_channel

    path = Path(settings.slack_config_path)
    if not path.is_absolute():
        path = BASE_DIR / path
    if not path.exists():
        return DEFAULT_OVERSEER_CHANNEL
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return DEFAULT_OVERSEER_CHANNEL
    channel = str(payload.get("overseer_channel") or "").strip()
    return channel or DEFAULT_OVERSEER_CHANNEL


def load_slack_notifier() -> Optional[SlackNotifier]:
    try:
        return SlackNotifier()
    except Exception:
        return None


def send_slack_message(label: str, status: str, lines: list[str]) -> None:
    """Envia alerta Slack apenas em falha, para o canal Overseer."""
    if status.upper() == "OK":
        return

    slack = load_slack_notifier()
    if not slack or not slack.enabled:
        return

    body = "\n".join([f"ERRO {label}", f"Estado: {status}", *lines])
    slack.send(body, channel_override=_load_overseer_channel())
