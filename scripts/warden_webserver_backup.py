#!/usr/bin/env python3
"""Backup diário do conteúdo servido pelo nginx (exclui pasta gdrive)."""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.operational_notify import send_slack_message
from src.operational_paths import (
    NGINX_BACKUP_DIR,
    NGINX_BACKUP_KEEP,
    NGINX_EXCLUDE_DIR,
    NGINX_SOURCE_DIR,
    NGINX_TEMP_DIR,
)

SCRIPT_LABEL = "Warden_Webserver_Backup"
LOG_FILE = NGINX_BACKUP_DIR / "backup.log"


def _log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")
    NGINX_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _ensure_temp_dir() -> None:
    if NGINX_TEMP_DIR.exists():
        shutil.rmtree(NGINX_TEMP_DIR)
    NGINX_TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _is_inside_exclude(path: Path) -> bool:
    try:
        path.resolve().relative_to(NGINX_EXCLUDE_DIR.resolve())
        return True
    except ValueError:
        return False


def _copy_with_exclude(src: Path, dest: Path) -> None:
    for root, _dirs, files in os.walk(src):
        root_path = Path(root)
        if _is_inside_exclude(root_path):
            continue
        try:
            relative = root_path.relative_to(src)
        except ValueError:
            relative = Path()
        dest_path = dest / relative
        dest_path.mkdir(parents=True, exist_ok=True)

        for file in files:
            src_file = root_path / file
            if _is_inside_exclude(src_file):
                continue
            shutil.copy2(src_file, dest_path / file)


def _create_archive(zip_file: Path) -> Tuple[bool, Optional[str]]:
    _ensure_temp_dir()
    try:
        _copy_with_exclude(NGINX_SOURCE_DIR, NGINX_TEMP_DIR)
        base_name = zip_file.with_suffix("")
        shutil.make_archive(str(base_name), "zip", str(NGINX_TEMP_DIR))
    except Exception as exc:
        return False, str(exc)
    finally:
        shutil.rmtree(NGINX_TEMP_DIR, ignore_errors=True)
    return zip_file.exists(), None


def _remove_old_backups() -> List[str]:
    backups = sorted(NGINX_BACKUP_DIR.glob("NGINX-*.zip"), reverse=True)
    removed: List[str] = []
    for old in backups[NGINX_BACKUP_KEEP:]:
        old.unlink()
        removed.append(str(old))
    return removed


def run() -> Tuple[bool, List[str], Optional[str], Optional[Path]]:
    NGINX_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    zip_file = NGINX_BACKUP_DIR / f"NGINX-{date_str}.zip"

    summary: List[str] = [
        f"Origem: {NGINX_SOURCE_DIR}",
        f"Excluído: {NGINX_EXCLUDE_DIR}",
        f"Destino: {zip_file}",
    ]

    _log("A iniciar backup do webserver (nginx)")
    success, error = _create_archive(zip_file)
    if not success:
        _log(f"Backup falhou: {error}")
        summary.append(f"Backup falhou: {error}")
        return False, summary, error, None

    _log(f"Backup e compressão concluídos: {zip_file}")
    summary.append(f"Compressão concluída: {zip_file}")

    removed = _remove_old_backups()
    if removed:
        summary.append(f"Backups antigos removidos: {len(removed)}")
        for item in removed:
            _log(f"Backup antigo removido: {item}")
    else:
        summary.append(f"Sem backups antigos para remover (retenção={NGINX_BACKUP_KEEP})")

    _log(f"Log file guardado em: {LOG_FILE}")
    return True, summary, None, zip_file


def main() -> None:
    status = "OK"
    error_detail: Optional[str] = None
    summary: List[str] = []
    zip_path: Optional[Path] = None

    try:
        success, summary, error_detail, zip_path = run()
        if not success:
            status = "NOK"
    except Exception as exc:  # pragma: no cover
        status = "NOK"
        error_detail = str(exc)
        summary.append(f"Erro inesperado: {error_detail}")
        _log(f"Erro inesperado: {error_detail}")

    slack_lines = [f"Origem: {NGINX_SOURCE_DIR}"]
    if zip_path:
        slack_lines.append(f"Ficheiro: {zip_path}")
    if error_detail:
        slack_lines.append(f"Erro: {error_detail}")
    else:
        slack_lines.extend(summary[-2:])
    send_slack_message(SCRIPT_LABEL, status, slack_lines)

    if status != "OK":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
