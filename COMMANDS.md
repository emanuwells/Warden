# COMMANDS.md

Comandos rápidos do Warden. Este ficheiro é referência operacional curta; detalhes completos ficam no `README.md` e em `.agents/ops/HANDOFF.md`.

## Ambiente

| Ação | Comando |
|---|---|
| Criar venv | `python3 -m venv .venv` |
| Ativar venv Linux | `. .venv/bin/activate` |
| Instalar dependências | `pip install -r requirements.txt` |
| Criar `.env` local | `cp .env.example .env` |
| Criar config DB local | `cp secrets/database.json.example secrets/database.json` |
| Setup schema | `.venv/bin/python warden.py --setup` |

## Runtime E Jobs

| Ação | Comando |
|---|---|
| Recolha única | `.venv/bin/python warden.py --once` |
| Export fast | `.venv/bin/python scripts/export_payload.py --mode fast` |
| Export heavy | `.venv/bin/python scripts/export_payload.py --mode heavy` |
| Export full | `.venv/bin/python scripts/export_payload.py --mode full` |
| Janitor | `.venv/bin/python scripts/janitor.py` |
| Slack alerts dry-run | `.venv/bin/python scripts/slack_alerts.py --dry-run` |
| Slack digest dry-run | `.venv/bin/python scripts/slack_daily_digest.py --dry-run` |
| Warden clean dry-run | `bash scripts/warden_clean.sh --dry-run` |

## Validação

| Ação | Comando |
|---|---|
| Python compile | `python -m py_compile warden.py src/settings.py src/alerts.py src/collector.py src/db_monitor.py src/slack_notifier.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py scripts/janitor.py scripts/weekly_archive.py` |
| Bash syntax | `bash -n scripts/warden_clean.sh` |
| PHP API local | `php -l public/www/api.php` |
| PHP API canónica | `php -l public/backend/apps/warden/api.php` |
| Compose web | `docker compose config` |
| Compose pipeline | `docker compose -f docker-compose.pipeline.yml config` |

## Docker

| Ação | Comando |
|---|---|
| UI/API local | `.\scripts\start-warden-dev.ps1` |
| Subir web local | `docker compose up -d --build` |
| Logs web local | `docker compose logs -f` |
| Subir pipeline | `docker compose -f docker-compose.pipeline.yml up -d --build` |
| Logs pipeline | `docker compose -f docker-compose.pipeline.yml logs -f` |
| Sync snapshots prod | `.\scripts\sync-prod-snapshots.ps1` |

## Produção BAZE2

| Ação | Comando |
|---|---|
| Configurar secrets locais | `.\scripts\setup-secrets-from-wells-api.ps1` |
| SSH wrapper | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand '<comando>'` |
| Ver estado remoto | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'cd /home/eferreira/MAIATRON/Warden && git status --short --branch'` |
| Pull remoto seguro | `.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand 'cd /home/eferreira/MAIATRON/Warden && git pull --ff-only origin main'` |
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
