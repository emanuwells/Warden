# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-07-26 |
| Objetivo actual | Operação normal pós-merge WELLS 0.5.0 |
| Estado | Concluído — local/origin/prod em `33ce878` |
| Versão registada | 2.1.0 (`VERSION`); toolkit 0.5.0 |

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

Ver [`docs/architecture/production-access-cleanup.md`](../../docs/architecture/production-access-cleanup.md) e [`COMMANDS.md`](../../COMMANDS.md).

## Limpeza de disco em produção (2026-08-10)

- Auditoria inicial e limpeza conservadora executadas com os scripts versionados e comandos SSH delimitados.
- `/` passou de 96%/4,4 GB livres para 94%/5,7 GB livres; inodes sem pressão (23%).
- `warden` activo; runtime Warden pequeno e sem temporários antigos relevantes.
- 96 binlogs ocupam 9,26 GB; não existem réplicas; `.env` define purga a 2 dias, mas o servidor mantém 7 dias por defeito.
- Removidos: sete Snaps desactivados, `.bak` excedentes, imagem/cache Docker, 25 760 registos Warden expirados e seis bundles antigos em `/tmp`.
- `/BackupNGINX` (4,3 GB) e `/BackupDB` (853 MB) contêm backups recentes e foram preservados.
- `warden_clean` diário está saudável no Overseer: últimas dez runs `ok`; o HTTP 500 observado era histórico/transitório.
- `host_hygiene` foi reactivado no crontab às 01:30; `cron` activo e script validado por execução real e dry-run final.
- Validação final: `warden` activo, `validate-pipeline.sh` PASS, zero Snaps desactivados e zero espaço Docker recuperável.
- Não limpar automaticamente: binlogs dentro da janela PITR, backups recentes, logs de auditoria ou áreas de aplicação externas ao Warden.
