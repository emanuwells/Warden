# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-07-14 |
| Objetivo actual | Repo público GitHub + proxy Warden no WELLS_API |
| Estado | Em progresso — ver `git log` e `tasks/todo.md` |
| Versão registada | 2.1.0 (`VERSION`) |

## Estado operacional (resumo)

O pipeline Warden em produção depende de:

- Collector systemd: `python -m src.warden` (intervalo configurável, tipicamente 2s).
- Cron: export fast/heavy/full, alertas, Warden Clean, arquivo semanal.
- Snapshots em `$WARDEN_RUNTIME_ROOT/runtime/export/`.
- API/UI publicada em `$WARDEN_HUB_ROOT` (fatia em `deploy/hub/`).

Paths concretos de host, utilizador SSH e URLs internas **não** pertencem ao repositório. Definir em `secrets/production.deploy.local.env` (gitignored).

## Fix Ops Center (2026-06-19) — referência

**Causa:** entrypoint systemd incorrecto (`warden.py` inexistente) → telemetria stale no Ops Center.

**Correcção:** `ExecStart=python -m src.warden`; validate-pipeline PASS; fast snapshot ~2s.

## Manutenção disco/DB (2026-06-22) — referência

- `warden_clean` com retenção configurável; purga binlogs e `OPTIMIZE` só com flags explícitas.
- `host-hygiene.sh` para logs SO, `.bak` de deploy e revisões snap disabled.
- Schemas de negócio e backups externos não são tocados pelo Warden Clean.

## Próximo passo após merge

1. `git pull --ff-only` em `$WARDEN_RUNTIME_ROOT`.
2. `pip install -r src/requirements.txt` (se manifesto mudou).
3. `bash scripts/validate-pipeline.sh`.
4. Publicar `warden.php` no WELLS_API e validar `GET /api/warden.php`.

Ver [`docs/architecture/production-access-cleanup.md`](../architecture/production-access-cleanup.md) e [`COMMANDS.md`](../../COMMANDS.md).
