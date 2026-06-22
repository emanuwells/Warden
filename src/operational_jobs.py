from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.operational_paths import SYSTEM_INFO_LATEST_JSON, crontab_log_dir
from src.settings import BASE_DIR

STATE_DIR = BASE_DIR / "runtime" / "operational_jobs"
DEFAULT_TIMEOUT_SECONDS = 6 * 60 * 60
_LOG_DIR = crontab_log_dir()
_WARDEN_ROOT = str(BASE_DIR)
_PYTHON = sys.executable or "python3"


@dataclass(frozen=True)
class OperationalJob:
    job_id: str
    label: str
    schedule: str
    command: list[str]
    cwd: str
    log_path: str
    artifacts: dict[str, str]
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS


JOBS: dict[str, OperationalJob] = {
    "warden_db_backup": OperationalJob(
        job_id="warden_db_backup",
        label="Warden DB Backup",
        schedule="0 2 * * *",
        command=[_PYTHON, "scripts/warden_db_backup.py"],
        cwd=_WARDEN_ROOT,
        log_path=str(_LOG_DIR / "crontab_warden_db_backup.txt"),
        artifacts={"backup_dir": "/BackupDB"},
    ),
    "warden_system_info": OperationalJob(
        job_id="warden_system_info",
        label="Warden System Info",
        schedule="0 2 * * 1",
        command=[_PYTHON, "scripts/warden_system_info.py"],
        cwd=_WARDEN_ROOT,
        log_path=str(_LOG_DIR / "crontab_warden_system_info.txt"),
        artifacts={"json": str(SYSTEM_INFO_LATEST_JSON)},
    ),
    "warden_webserver_backup": OperationalJob(
        job_id="warden_webserver_backup",
        label="Warden Webserver Backup",
        schedule="0 3 * * *",
        command=[_PYTHON, "scripts/warden_webserver_backup.py"],
        cwd=_WARDEN_ROOT,
        log_path=str(_LOG_DIR / "crontab_warden_nginx.txt"),
        artifacts={"backup_dir": "/BackupNGINX"},
    ),
    "warden_clean": OperationalJob(
        job_id="warden_clean",
        label="Warden Clean",
        schedule="0 1 * * *",
        command=["bash", "scripts/warden_clean.sh"],
        cwd=_WARDEN_ROOT,
        log_path=str(_LOG_DIR / "crontab_warden_clean.txt"),
        artifacts={},
    ),
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def state_path(job_id: str) -> Path:
    return STATE_DIR / f"{job_id}.json"


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return raw if isinstance(raw, dict) else None


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".tmp-{os.getpid()}")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    os.replace(tmp, path)


def tail_text(raw: str, max_chars: int = 8000) -> str:
    if len(raw) <= max_chars:
        return raw
    return raw[-max_chars:]


def tail_file(path: Path, max_chars: int = 8000) -> str:
    try:
        data = path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return ""
    except OSError:
        return ""
    return tail_text(data, max_chars=max_chars)


def base_job_payload(job: OperationalJob) -> dict[str, Any]:
    return {
        "job_id": job.job_id,
        "label": job.label,
        "schedule": job.schedule,
        "command": job.command,
        "cwd": job.cwd,
        "log_path": job.log_path,
        "artifacts": job.artifacts,
    }


def run_job(job_id: str, *, dry_run: bool = False) -> dict[str, Any]:
    if job_id not in JOBS:
        raise SystemExit(f"Job desconhecido: {job_id}")

    job = JOBS[job_id]
    planned = {
        **base_job_payload(job),
        "status": "dry_run" if dry_run else "running",
        "started_at": now_iso(),
        "ended_at": None,
        "duration_seconds": None,
        "exit_code": None,
        "stdout_tail": "",
        "stderr_tail": "",
        "log_tail": tail_file(Path(job.log_path)),
    }
    write_json_atomic(state_path(job_id), planned)
    if dry_run:
        planned["ended_at"] = now_iso()
        write_json_atomic(state_path(job_id), planned)
        return planned

    started = datetime.now(timezone.utc)
    try:
        result = subprocess.run(
            job.command,
            cwd=job.cwd,
            capture_output=True,
            text=True,
            timeout=job.timeout_seconds,
        )
        exit_code = result.returncode
        stdout_tail = tail_text(result.stdout or "")
        stderr_tail = tail_text(result.stderr or "")
    except subprocess.TimeoutExpired as exc:
        exit_code = 124
        stdout_tail = tail_text(exc.stdout or "")
        stderr_tail = tail_text(exc.stderr or "timeout")

    ended = datetime.now(timezone.utc)
    payload = {
        **base_job_payload(job),
        "status": "ok" if exit_code == 0 else "failed",
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "duration_seconds": round((ended - started).total_seconds(), 3),
        "exit_code": exit_code,
        "stdout_tail": stdout_tail,
        "stderr_tail": stderr_tail,
        "log_tail": tail_file(Path(job.log_path)),
    }
    write_json_atomic(state_path(job_id), payload)
    return payload


def load_job_states() -> dict[str, Any]:
    jobs = []
    by_id: dict[str, Any] = {}
    for job in JOBS.values():
        state = read_json(state_path(job.job_id)) or {}
        payload = {**base_job_payload(job), **state}
        payload["log_tail"] = tail_file(Path(job.log_path), max_chars=4000)
        jobs.append(payload)
        by_id[job.job_id] = payload
    return {
        "jobs": jobs,
        "by_id": by_id,
    }


def load_warden_system_info() -> dict[str, Any] | None:
    payload = read_json(SYSTEM_INFO_LATEST_JSON)
    return payload if payload else None


def build_operations_payload() -> dict[str, Any]:
    states = load_job_states()
    return {
        **states,
        "warden_system_info": load_warden_system_info(),
        "generated_at": now_iso(),
    }


def job_definitions() -> list[dict[str, Any]]:
    return [asdict(job) for job in JOBS.values()]
