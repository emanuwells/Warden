"""
Warden — Slack Notifier
Small helper around Slack incoming webhooks.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import requests
from requests import RequestException

from src.settings import BASE_DIR, settings

logger = logging.getLogger("warden.slack")


class SlackNotifier:
    def __init__(self, config_path: str | Path | None = None):
        self.webhook_url: str | None = None
        self.channel: str | None = None
        self.notify_on_recovery: bool = True
        path = Path(config_path or settings.slack_config_path)
        if not path.is_absolute():
            path = BASE_DIR / path
        self._load(path)

    @property
    def enabled(self) -> bool:
        return bool(settings.slack_enabled and self.webhook_url)

    def _load(self, path: Path) -> None:
        if not path.exists():
            logger.warning("Slack config not found at %s", path)
            return
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.error("Failed to parse Slack config %s: %s", path, exc)
            return
        self.webhook_url = str(payload.get("webhook_url") or "").strip() or None
        self.channel = str(payload.get("channel") or "").strip() or None
        if "notify_on_recovery" in payload:
            self.notify_on_recovery = bool(payload.get("notify_on_recovery"))
        elif "notify_on_ok" in payload:
            # Backward compatibility with Overseer naming.
            self.notify_on_recovery = bool(payload.get("notify_on_ok"))
        else:
            self.notify_on_recovery = True

    def send(self, text: str, channel_override: str | None = None) -> bool:
        if not self.enabled:
            return False
        body: dict[str, Any] = {"text": text}
        channel = channel_override or self.channel
        if channel:
            body["channel"] = channel
        try:
            resp = requests.post(self.webhook_url, json=body, timeout=8)
            if resp.status_code >= 400:
                logger.error("Slack webhook error %s: %s", resp.status_code, resp.text[:300])
                return False
            return True
        except RequestException as exc:
            logger.error("Slack network error: %s", exc)
            return False
