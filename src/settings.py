"""
Warden — Settings
Loads configuration from .env, environment variables, and secrets/database.json.
Priority: env vars > secrets/database.json > defaults.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRETS_DIR = BASE_DIR / "secrets"
DB_SECRETS_FILE = SECRETS_DIR / "database.json"


def _load_db_secrets() -> dict:
    """Load DB credentials from secrets/database.json if available."""
    if DB_SECRETS_FILE.exists():
        with open(DB_SECRETS_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return {}


def _env(key: str, default: str = "", secrets: dict | None = None) -> str:
    """Return env var, falling back to secrets dict, then default."""
    val = os.getenv(key)
    if val is not None:
        return val
    if secrets and key.replace("DB_", "").lower() in secrets:
        return str(secrets[key.replace("DB_", "").lower()])
    return default


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(key: str, default: list[str]) -> list[str]:
    raw = os.getenv(key)
    if raw is None:
        return list(default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------
@dataclass
class Settings:
    # Database
    db_host: str = ""
    db_port: int = 3306
    db_user: str = ""
    db_password: str = ""
    db_name: str = "Warden"

    # SSH tunnel (optional)
    ssh_host: str = ""
    ssh_port: int = 22
    ssh_user: str = ""
    ssh_key_path: str = ""

    # Collector
    collect_interval: int = 15        # seconds
    retention_days: int = 30
    disk_top_enabled: bool = True
    disk_top_root: str = "/"
    disk_top_max_items: int = 10
    disk_top_scan_interval_seconds: int = 300
    disk_top_timeout_seconds: int = 10
    disk_top_exclude_prefixes: list[str] | None = None
    disk_top_scan_mode: str = "local"  # local | sudo_helper | auto
    disk_top_sudo_helper_cmd: str = "/usr/local/sbin/warden-disk-top-helper"
    disk_top_sudo_timeout_seconds: int = 12

    # Export
    export_path: str = "frontend/warden_payload.json"

    # Logging
    log_level: str = "INFO"
    log_file: str = "runtime/logs/warden.log"

    # DB monitor
    db_monitor_enabled: bool = True
    db_monitor_interval: int = 60

    # Slack
    slack_enabled: bool = True
    slack_config_path: str = "secrets/slack.json"
    slack_alert_cooldown_minutes: int = 15
    slack_digest_hour_utc: int = 8
    slack_digest_minute_utc: int = 0

    # Alert thresholds
    alert_cpu_warn: float = 85.0
    alert_ram_warn: float = 90.0
    alert_disk_warn: float = 92.0
    alert_db_threads_running_warn: float = 20.0
    alert_db_slow_qps_warn: float = 1.0

    @classmethod
    def load(cls) -> "Settings":
        secrets = _load_db_secrets()
        return cls(
            db_host=_env("DB_HOST", "127.0.0.1", secrets),
            db_port=int(_env("DB_PORT", "3306", secrets)),
            db_user=_env("DB_USER", "warden", secrets),
            db_password=_env("DB_PASSWORD", "", secrets),
            db_name=_env("DB_NAME", "Warden", secrets),
            ssh_host=os.getenv("SSH_HOST", ""),
            ssh_port=int(os.getenv("SSH_PORT", "22")),
            ssh_user=os.getenv("SSH_USER", ""),
            ssh_key_path=os.getenv("SSH_KEY_PATH", ""),
            collect_interval=int(os.getenv("COLLECT_INTERVAL", "15")),
            retention_days=int(os.getenv("RETENTION_DAYS", "30")),
            disk_top_enabled=_env_bool("DISK_TOP_ENABLED", True),
            disk_top_root=os.getenv("DISK_TOP_ROOT", "/"),
            disk_top_max_items=int(os.getenv("DISK_TOP_MAX_ITEMS", "10")),
            disk_top_scan_interval_seconds=int(os.getenv("DISK_TOP_SCAN_INTERVAL_SECONDS", "300")),
            disk_top_timeout_seconds=int(os.getenv("DISK_TOP_TIMEOUT_SECONDS", "10")),
            disk_top_exclude_prefixes=_env_csv(
                "DISK_TOP_EXCLUDE_PREFIXES",
                ["/proc", "/sys", "/dev", "/run", "/snap", "/tmp", "/var/tmp"],
            ),
            disk_top_scan_mode=os.getenv("DISK_TOP_SCAN_MODE", "local").strip().lower() or "local",
            disk_top_sudo_helper_cmd=os.getenv("DISK_TOP_SUDO_HELPER_CMD", "/usr/local/sbin/warden-disk-top-helper"),
            disk_top_sudo_timeout_seconds=int(os.getenv("DISK_TOP_SUDO_TIMEOUT_SECONDS", "12")),
            export_path=os.getenv("EXPORT_PATH", "frontend/warden_payload.json"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            log_file=os.getenv("LOG_FILE", "runtime/logs/warden.log"),
            db_monitor_enabled=_env_bool("DB_MONITOR_ENABLED", True),
            db_monitor_interval=int(os.getenv("DB_MONITOR_INTERVAL", "60")),
            slack_enabled=_env_bool("SLACK_ENABLED", True),
            slack_config_path=os.getenv("SLACK_CONFIG_PATH", "secrets/slack.json"),
            slack_alert_cooldown_minutes=int(os.getenv("SLACK_ALERT_COOLDOWN_MINUTES", "15")),
            slack_digest_hour_utc=int(os.getenv("SLACK_DIGEST_HOUR_UTC", "8")),
            slack_digest_minute_utc=int(os.getenv("SLACK_DIGEST_MINUTE_UTC", "0")),
            alert_cpu_warn=float(os.getenv("ALERT_CPU_WARN", "85")),
            alert_ram_warn=float(os.getenv("ALERT_RAM_WARN", "90")),
            alert_disk_warn=float(os.getenv("ALERT_DISK_WARN", "92")),
            alert_db_threads_running_warn=float(os.getenv("ALERT_DB_THREADS_RUNNING_WARN", "20")),
            alert_db_slow_qps_warn=float(os.getenv("ALERT_DB_SLOW_QPS_WARN", "1")),
        )

    @property
    def use_ssh(self) -> bool:
        return bool(self.ssh_host)


# Singleton
settings = Settings.load()
