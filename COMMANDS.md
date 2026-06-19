# COMMANDS.md

Comandos rápidos do Warden. Este ficheiro é referência operacional curta; detalhes completos ficam no `README.md` e em `.agents/ops/HANDOFF.md`.

Definir `WARDEN_RUNTIME_ROOT` em `secrets/production.deploy.local.env` antes de comandos SSH remotos.

## Ambiente

| Ação | Comando |
|---|---|
| Criar venv | `python3 -m venv .venv` |
| Ativar venv Linux | `. .venv/bin/activate` |
| Instalar dependências | `pip install -r requirements.txt` |
| Criar `.env` local | `cp .env.example .env` |
| Criar config DB local | `cp secrets/database.json.example secrets/database.json` |
| Setup schema | `.venv/bin/python -m src.warden --setup` |

## Runtime E Jobs

| Ação | Comando |
|---|---|
| Recolha única | `.venv/bin/python -m src.warden --once` |
| Export fast | `.venv/bin/python scripts/export_payload.py --mode fast` |
| Export heavy | `.venv/bin/python scripts/export_payload.py --mode heavy` |
| Export full | `.venv/bin/python scripts/export_payload.py --mode full` |
| Warden Clean retenção | `.venv/bin/python scripts/warden_clean.py` |
| Slack alerts dry-run | `.venv/bin/python scripts/slack_alerts.py --dry-run` |
| Slack digest dry-run | `.venv/bin/python scripts/slack_daily_digest.py --dry-run` |
| Warden clean dry-run | `WARDEN_ROOT=$PWD bash scripts/warden_clean.sh --dry-run` |
| Host hygiene dry-run | `WARDEN_HUB_ROOT=/path/to/hub bash scripts/host-hygiene.sh --dry-run` |
| Validar pipeline (prod) | `WARDEN_RUNTIME_ROOT=/path bash scripts/validate-pipeline.sh` |
| Patch cron fast Fase 2 | `WARDEN_RUNTIME_ROOT=/path bash scripts/patch-crontab-phase2-fast.sh --dry-run` |
| Restaurar cron fast 2s | `WARDEN_RUNTIME_ROOT=/path WARDEN_EXPORT_FAST_LOCK=/tmp/lock bash scripts/restore-crontab-fast-2s.sh` |
| Export fast fallback manual | `bash scripts/export_fast_fallback.sh` |

## Validação

| Ação | Comando |
|---|---|
| Python compile | `python -m py_compile src/warden.py src/settings.py src/alerts.py src/collector.py src/db_monitor.py src/slack_notifier.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py scripts/warden_clean.py scripts/weekly_archive.py` |
| Bash syntax | `bash -n scripts/warden_clean.sh` |
| Bash syntax host hygiene | `bash -n scripts/host-hygiene.sh` |
| Bash syntax validate pipeline | `bash -n scripts/validate-pipeline.sh` |
| Bash syntax export fast fallback | `bash -n scripts/export_fast_fallback.sh` |
| PHP API local | `php -l public/www/api.php` |
| PHP API canónica | `php -l public/backend/apps/warden/api.php` |
| Compose web | `docker compose config` |
| Compose pipeline | `docker compose -f docker/compose.pipeline.yml config` |

## Docker

| Ação | Comando |
|---|---|
| UI/API local | `.\scripts\start-warden-dev.ps1` |
| Subir web local | `docker compose up -d --build` |
| Logs web local | `docker compose logs -f` |
| Subir pipeline | `docker compose -f docker/compose.pipeline.yml up -d --build` |
| Logs pipeline | `docker compose -f docker/compose.pipeline.yml logs -f` |
| Sync snapshots prod | `.\scripts\sync-prod-snapshots.ps1` |

## Produção (SSH)

| Ação | Comando |
|---|---|
| Configurar secrets locais | `.\scripts\setup-secrets-from-wells-api.ps1` |
| SSH wrapper | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand '<comando>'` |
| Ver estado remoto | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'cd $WARDEN_RUNTIME_ROOT && git status --short --branch'` |
| Ver cron `warden_clean` | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'crontab -l 2>/dev/null \| grep -n "overseer:warden_clean" \|\| true'` |
| Ver cron `host_hygiene` | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'crontab -l 2>/dev/null \| grep -n "overseer:host_hygiene" \|\| true'` |
| Pull remoto seguro | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'cd $WARDEN_RUNTIME_ROOT && git pull --ff-only origin main'` |
| Limpeza produção dry-run | `.\scripts\run-production-cleanup.ps1 -DryRunOnly` |
| Limpeza produção | `.\scripts\run-production-cleanup.ps1` |
| Publicar `public/` dry-run | `.\scripts\publish-public.ps1 -DryRun` |

## Git

| Ação | Comando |
|---|---|
| Estado | `git status --short --branch` |
| Branch | `git branch --show-current` |
| Remotes | `git remote -v` |
| Fetch | `git fetch origin` |
| Pull local seguro | `git pull --ff-only origin main` |
| Push | `git push origin main` |

## Higiene

| Ação | Comando |
|---|---|
| Ver ficheiros não rastreados | `git status --short` |
| Validar diff | `git diff --check` |
| Procurar temporários PowerShell | `Get-ChildItem -Recurse -Force -Include *.tmp,*.bak,*.old` |
| Procurar configs MCP reais | `Get-ChildItem -Recurse -Force -Include *mcp*.json,.mcp.json` |

## MCP

| Ação | Comando |
|---|---|
| Ver política MCP | `Get-Content .agents/mcp/MCP_POLICY.md` |
| Ver exemplos MCP | `Get-ChildItem .agents/mcp` |
| Ver inventário de Skills | `Get-Content .agents/skills/README.md` |

## Comandos Proibidos Sem Confirmação

```bash
git reset --hard
git clean -fd
git push --force
docker compose down -v
rm -rf
DROP DATABASE
TRUNCATE TABLE
systemctl restart
reboot
```
