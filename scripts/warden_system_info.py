#!/usr/bin/env python3
"""Inventário do sistema operativo e pacotes instalados (dpkg/snap)."""

from __future__ import annotations

import json
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.operational_notify import send_slack_message
from src.operational_paths import SYSTEM_INFO_LATEST_JSON, operational_output_dir

SCRIPT_LABEL = "Warden_System_Info"
OUTPUT_DIR = operational_output_dir()
LATEST_JSON = SYSTEM_INFO_LATEST_JSON


def _ts(message: str) -> None:
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}")


def _run_cmd(args: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True, check=True)


def list_dpkg_programs() -> Tuple[str, int]:
    header = f"{'Programa':<40} {'Versão':<20}\n"
    divider = f"{'-' * len('Programa'):<40} {'-' * len('Versão'):<20}\n"
    rows = [header, divider]
    count = 0

    dpkg_list = _run_cmd(["dpkg-query", "-W", "-f=${binary:Package} ${Version}\n"])
    for line in dpkg_list.stdout.splitlines():
        parts = line.split()
        if len(parts) < 2:
            continue
        package, version = parts[0], parts[1]
        try:
            dpkg_l = _run_cmd(["dpkg", "-L", package])
        except subprocess.CalledProcessError:
            continue
        paths = dpkg_l.stdout.splitlines()
        if any(p.startswith("/usr/bin/") or p.startswith("/usr/sbin/") for p in paths):
            rows.append(f"{package:<40} {version:<20}\n")
            count += 1
    return "".join(rows), count


def list_snap_programs() -> Tuple[str, int]:
    try:
        snap_list = _run_cmd(["snap", "list"])
    except (FileNotFoundError, subprocess.CalledProcessError):
        return "Snap não disponível neste servidor.\n", 0

    header = f"\n{'Programa':<40} {'Versão':<20}\n"
    divider = f"{'-' * len('Programa'):<40} {'-' * len('Versão'):<20}\n"
    rows = [header, divider]
    count = 0

    lines = snap_list.stdout.splitlines()
    for line in lines[1:]:
        parts = line.split()
        if len(parts) < 2:
            continue
        program, version = parts[0], parts[1]
        rows.append(f"{program:<40} {version:<20}\n")
        count += 1
    return "".join(rows), count


def _preview_text(path: Path, max_lines: int = 80) -> str:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return ""
    return "\n".join(lines[:max_lines])


def _write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def gather_info() -> Tuple[Path, Path, List[str]]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    current_date = datetime.now().strftime("%Y-%m-%d")
    output_file = OUTPUT_DIR / f"warden_system_info_{current_date}.txt"

    _ts("Obtendo informações do sistema operativo")
    os_name = _run_cmd(["lsb_release", "-d"]).stdout.split("\t")[1].strip()
    os_version = _run_cmd(["lsb_release", "-r"]).stdout.split("\t")[1].strip()

    _ts("Listando programas instalados via dpkg")
    dpkg_programs, dpkg_count = list_dpkg_programs()

    _ts("Listando programas instalados via snap")
    snap_programs, snap_count = list_snap_programs()

    _ts("A guardar informações no ficheiro")
    with output_file.open("w", encoding="utf-8") as fh:
        fh.write(f"Sistema Operativo: {os_name}\n")
        fh.write(f"Versão: {os_version}\n\n")
        fh.write("### Programas instalados via dpkg ###\n")
        fh.write(dpkg_programs)
        fh.write("\n### Programas instalados via Snap ###\n")
        fh.write(snap_programs)

    payload = {
        "generated_at": generated_at,
        "host": socket.gethostname(),
        "os": {
            "name": os_name,
            "version": os_version,
        },
        "packages": {
            "dpkg_count": dpkg_count,
            "snap_count": snap_count,
        },
        "artifacts": {
            "text_path": str(output_file),
            "json_path": str(LATEST_JSON),
        },
        "preview": _preview_text(output_file),
    }
    _write_json_atomic(LATEST_JSON, payload)

    _ts(f"Lista de programas guardada em {output_file}")
    _ts(f"JSON de inventário guardado em {LATEST_JSON}")

    summary = [
        f"Output: {output_file}",
        f"JSON: {LATEST_JSON}",
        f"dpkg listados: {dpkg_count}",
        f"snap listados: {snap_count}",
    ]
    return output_file, LATEST_JSON, summary


def main() -> None:
    status = "OK"
    summary: List[str] = []
    error_detail: Optional[str] = None

    try:
        _output_file, _json_file, summary = gather_info()
    except Exception as exc:  # pragma: no cover
        status = "NOK"
        error_detail = str(exc)
        summary.append(f"Erro: {error_detail}")
        _ts(f"Erro ocorrido: {error_detail}")

    slack_lines = list(summary)
    if error_detail:
        slack_lines.append(f"Erro: {error_detail}")
    send_slack_message(SCRIPT_LABEL, status, slack_lines)

    if status != "OK":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
