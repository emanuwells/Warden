#!/usr/bin/env python3
"""Backup diário dos schemas MariaDB críticos do servidor."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.operational_notify import send_slack_message
from src.operational_paths import (
    BACKUP_DB_DIR,
    BACKUP_RETENTION_DAYS,
    DATABASE_SCHEMAS,
    MARIADB_EXTRA_FILE,
)

SCRIPT_LABEL = "Warden_DB_Backup"
LOG_FILE = BACKUP_DB_DIR / "backup.log"


def _log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")
    BACKUP_DB_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _run_mysqldump(schema: str, output_file: Path) -> Tuple[bool, Optional[str]]:
    backup_cmd = [
        "mysqldump",
        f"--defaults-extra-file={MARIADB_EXTRA_FILE}",
        schema,
    ]
    _log(f"A iniciar o backup da base de dados: {schema}")
    with output_file.open("w", encoding="utf-8") as fh:
        result = subprocess.run(
            backup_cmd,
            stdout=fh,
            stderr=subprocess.PIPE,
            text=True,
        )
    if result.returncode != 0:
        try:
            output_file.unlink()
        except FileNotFoundError:
            pass
        return False, (result.stderr or "").strip() or "mysqldump terminou com erro"
    return True, None


def _compress_backup(backup_file: Path, zip_file: Path) -> Tuple[bool, Optional[str]]:
    compress_cmd = ["zip", "-j", str(zip_file), str(backup_file)]
    _log(f"A iniciar compressão: {zip_file}")
    result = subprocess.run(
        compress_cmd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False, (result.stderr or "").strip() or "zip terminou com erro"
    try:
        backup_file.unlink()
        _log(f"Ficheiro SQL original removido: {backup_file}")
    except FileNotFoundError:
        pass
    return True, None


def _remove_old_backups() -> List[str]:
    removed: List[str] = []
    cutoff = datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)
    for zip_file in BACKUP_DB_DIR.glob("*.zip"):
        if zip_file.stat().st_mtime < cutoff.timestamp():
            zip_file.unlink()
            removed.append(str(zip_file))
    return removed


def _backup_schema(schema: str, date_str: str) -> Tuple[bool, List[str], Optional[str], Optional[Path]]:
    backup_file = BACKUP_DB_DIR / f"{schema}-{date_str}.sql"
    zip_file = BACKUP_DB_DIR / f"{schema}-{date_str}.zip"
    summary = [f"{schema}: destino {zip_file}"]

    success, error = _run_mysqldump(schema, backup_file)
    if not success:
        _log(f"{schema}: backup falhado: {error}")
        summary.append(f"{schema}: backup falhado: {error}")
        return False, summary, error, None

    _log(f"{schema}: backup SQL criado: {backup_file}")
    summary.append(f"{schema}: backup SQL criado")

    success, error = _compress_backup(backup_file, zip_file)
    if not success:
        _log(f"{schema}: compressão falhada: {error}")
        summary.append(f"{schema}: compressão falhada: {error}")
        return False, summary, error, None

    _log(f"{schema}: compressão concluída: {zip_file}")
    summary.append(f"{schema}: OK -> {zip_file}")
    return True, summary, None, zip_file


def run() -> Tuple[bool, List[str], Optional[str], List[Path]]:
    BACKUP_DB_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    summary: List[str] = [
        f"Schemas: {', '.join(DATABASE_SCHEMAS)}",
        f"Destino backups: {BACKUP_DB_DIR}",
        f"defaults-extra-file: {MARIADB_EXTRA_FILE}",
    ]
    errors: List[str] = []
    zip_paths: List[Path] = []

    for schema in DATABASE_SCHEMAS:
        success, schema_summary, error, zip_path = _backup_schema(schema, date_str)
        summary.extend(schema_summary)
        if zip_path is not None:
            zip_paths.append(zip_path)
        if not success:
            errors.append(f"{schema}: {error}")

    removed = _remove_old_backups()
    if removed:
        summary.append(f"Backups antigos removidos: {len(removed)}")
        for item in removed:
            _log(f"Backup antigo removido: {item}")
    else:
        summary.append("Não foram encontrados backups antigos para remover.")

    _log(f"Log file guardado em: {LOG_FILE}")
    error_detail = "; ".join(errors) if errors else None
    return not errors, summary, error_detail, zip_paths


def main() -> None:
    status = "OK"
    error_detail: Optional[str] = None
    summary: List[str] = []
    zip_paths: List[Path] = []

    try:
        success, summary, error_detail, zip_paths = run()
        if not success:
            status = "NOK"
    except Exception as exc:  # pragma: no cover
        status = "NOK"
        error_detail = str(exc)
        summary.append(f"Erro inesperado: {error_detail}")
        _log(f"Erro inesperado: {error_detail}")

    slack_lines = list(summary[-6:])
    if zip_paths:
        slack_lines.insert(0, f"Ficheiros: {len(zip_paths)} zip(s)")
    if error_detail:
        slack_lines.append(f"Erro: {error_detail}")
    send_slack_message(SCRIPT_LABEL, status, slack_lines)

    if status != "OK":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
