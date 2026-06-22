#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.operational_jobs import JOBS, job_definitions, run_job


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa módulos operacionais orquestrados pelo Warden.")
    parser.add_argument("job_id", nargs="?", choices=sorted(JOBS), help="Módulo operacional a executar.")
    parser.add_argument("--dry-run", action="store_true", help="Regista a intenção sem executar o comando externo.")
    parser.add_argument("--list", action="store_true", help="Lista os módulos disponíveis em JSON.")
    args = parser.parse_args()

    if args.list:
        print(json.dumps(job_definitions(), ensure_ascii=False, indent=2))
        return
    if not args.job_id:
        parser.error("job_id é obrigatório excepto com --list")

    result = run_job(args.job_id, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result.get("status") == "failed":
        raise SystemExit(int(result.get("exit_code") or 1))


if __name__ == "__main__":
    main()
