# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-18 |
| Objetivo atual | Runner `warden_clean` diário em produção e limpeza operacional mais ampla, mas segura |
| Estado | Produção alinhada; `warden_clean` agendado diariamente e validado em execução manual |
| Última versão registada | 2.1.0 (`VERSION`) |

## Local genérico (Docker)

| Item | Valor |
|---|---|
| URL UI | `http://127.0.0.1:8080/` |
| URL API | `http://127.0.0.1:8080/api.php` |
| Login | Desligado (`WARDEN_DEV_SKIP_AUTH`, `dev-auth-stub.js`, `data-warden-dev`) |
| Snapshots | `runtime/export/` — sync SCP de prod ou pipeline local |

```powershell
.\scripts\sync-prod-snapshots.ps1   # JSON reais de BAZE2 (read-only)
.\scripts\start-warden-dev.ps1
```

## Produção BAZE

- Pipeline: `/home/eferreira/MAIATRON/Warden` (inalterado)
- HUB: `/usr/share/nginx/html/MAIATRON-HUB` — publicar só `deploy/hub/` com `publish-public.ps1`
- Digest Slack: templates/defaults locais e crontab real de BAZE2 ajustados para `08:30`.
- Backup do crontab antes da alteração: `/home/eferreira/warden_crontab_20260611142254.bak`.
- Runner Overseer: `/home/eferreira/overseer-runners/warden_clean/run.sh`, manifesto com `schedule: 0 1 * * *`.
- Causa encontrada em 2026-06-18: o runner existia, mas o `crontab -l` real não continha `# overseer:warden_clean`; o log dedicado estava vazio.
- Correção aplicada em 2026-06-18: backup do crontab em `/home/eferreira/warden_crontab_20260618160354.bak`; linha `# overseer:warden_clean` inserida de forma idempotente.
- Produção alinhada no commit `e75f96f`; `git status --short --branch` remoto limpo em `main...origin/main`.
- Validação final: crontab com `count=1`, serviço `warden` ativo, disco `/` em 89% e `runtime/export` reduzido para 34M.
- Execução manual validada: `warden_clean` correu sem WARN após preservar `runtime/cache/.gitkeep`; a retenção de dados removeu registos antigos conforme `RETENTION_DAYS=7`.

## Validação Local Mais Recente

- `python -m py_compile src\warden.py src\settings.py src\collector.py src\db_monitor.py scripts\export_payload.py scripts\slack_alerts.py scripts\slack_daily_digest.py scripts\warden_clean.py scripts\weekly_archive.py`
- `php -l public\www\api.php`
- `php -l public\backend\apps\warden\api.php`
- `docker compose -f docker/compose.pipeline.yml config` com `.env.docker` temporário gerado a partir de `config/env.docker.example` e removido no fim.
- `git diff --check` sem erros; apenas avisos esperados de line endings no Windows.
- BAZE2: `crontab -l` confirmou uma linha ativa `30 8 * * * ... scripts/slack_daily_digest.py ...`.
- BAZE2: `scripts/slack_daily_digest.py --dry-run` executou com sucesso, sem envio para Slack; ficheiro temporário em `/tmp` removido.

## Higiene De Raiz

- Raiz alinhada com o template: ficheiros de entrada do projeto na raiz, governança em `.agents/`, compatibilidade Claude em `tools/ai-adapters/claude/.claude/`.
- `COMMANDS.md` é a referência operacional curta e específica do Warden.
- Inventário de Skills vive em `.agents/skills/README.md`.
- `tasks/` foi removida enquanto só continha placeholders sem estado operacional útil.
- Auditoria agressiva desta iteração preserva `public/`, `deploy/hub/`, `runtime/**/.gitkeep` e exemplos de secrets como intencionais.

## Próximo passo

1. Confirmar no dia seguinte que `/home/eferreira/D4MAIA/_crontab_logs/crontab_warden_clean.txt` recebeu output do cron das 01:00.
2. Se o catálogo do Overseer ficar disponível, alinhar a definição declarativa com a linha de cron aplicada para evitar drift futuro.
3. `publish-public.ps1` continua só após validação e OK explícito, quando houver alterações em `public/`.

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `quality-gate-runner`, `secrets-layout-guardian`, `ssh-server-ops`
- MCP: N/A
