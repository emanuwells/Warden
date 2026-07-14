"""Paths e constantes partilhados pelos jobs operacionais do Warden."""

from __future__ import annotations

import os
from pathlib import Path

from src.settings import BASE_DIR

_DEFAULT_CRONTAB_LOG_DIR = "/var/log/overseer"
_DEFAULT_MARIADB_EXTRA = str(BASE_DIR / "secrets" / "mariadb-dump.cnf")


def _path(key: str, default: str) -> Path:
    raw = (os.getenv(key) or default).strip()
    return Path(raw)


def crontab_log_dir() -> Path:
    return _path("WARDEN_CRONTAB_LOG_DIR", _DEFAULT_CRONTAB_LOG_DIR)


def operational_output_dir() -> Path:
    configured = os.getenv("WARDEN_OPERATIONAL_OUTPUT_DIR", "").strip()
    if configured:
        return Path(configured)
    return BASE_DIR / "runtime" / "operational"


BACKUP_DB_DIR = _path("WARDEN_BACKUP_DB_DIR", "/BackupDB")
BACKUP_RETENTION_DAYS = int(os.getenv("WARDEN_BACKUP_DB_RETENTION_DAYS", "3"))
MARIADB_EXTRA_FILE = _path("WARDEN_MARIADB_EXTRA_FILE", _DEFAULT_MARIADB_EXTRA)

NGINX_SOURCE_DIR = _path("WARDEN_NGINX_SOURCE_DIR", "/usr/share/nginx/html")
NGINX_EXCLUDE_DIR = _path("WARDEN_NGINX_EXCLUDE_DIR", "/usr/share/nginx/html/exclude")
NGINX_BACKUP_DIR = _path("WARDEN_NGINX_BACKUP_DIR", "/BackupNGINX")
NGINX_TEMP_DIR = _path("WARDEN_NGINX_TEMP_DIR", "/tmp/nginx_backup_temp")
NGINX_BACKUP_KEEP = int(os.getenv("WARDEN_NGINX_BACKUP_KEEP", "3"))

SYSTEM_INFO_LATEST_JSON = operational_output_dir() / "warden_system_info_latest.json"

DATABASE_SCHEMAS = [
    item.strip()
    for item in os.getenv(
        "WARDEN_BACKUP_DB_SCHEMAS",
        "BAZE,Chronos,Warden,Overseer,MAIATRON",
    ).split(",")
    if item.strip()
]
