# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-12 |
| Objetivo atual | Alertas Slack com limite por incidente, digest com incidentes ativos e runner `warden_clean` para Overseer |
| Estado | Alterações locais preparadas; deploy do runner deve ser feito pelo catálogo do Overseer |
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
- Runner planeado para Overseer: `/home/eferreira/overseer-runners/warden_clean/run.sh`, marcador `# overseer:warden_clean`.

## Validação Local Mais Recente

- `python -m py_compile warden.py src\settings.py src\collector.py src\db_monitor.py scripts\export_payload.py scripts\slack_alerts.py scripts\slack_daily_digest.py scripts\janitor.py scripts\weekly_archive.py`
- `php -l public\www\api.php`
- `php -l public\backend\apps\warden\api.php`
- `docker compose -f docker-compose.pipeline.yml config` com `.env.docker` temporário gerado a partir de `.env.docker.example` e removido no fim.
- `git diff --check` sem erros; apenas avisos esperados de line endings no Windows.
- BAZE2: `crontab -l` confirmou uma linha ativa `30 8 * * * ... scripts/slack_daily_digest.py ...`.
- BAZE2: `scripts/slack_daily_digest.py --dry-run` executou com sucesso, sem envio para Slack; ficheiro temporário em `/tmp` removido.

## Higiene De Raiz

- Raiz alinhada com o padrão aplicado no Overseer: ficheiros de entrada do projeto na raiz, governança em `.agents/`, compatibilidade Claude em `.claude/`.
- `COMMANDS.md` é a referência operacional curta e específica do Warden.
- Inventário de Skills vive em `.agents/skills/README.md`.
- `tasks/` foi removida enquanto só continha placeholders sem estado operacional útil.
- Auditoria agressiva desta iteração não encontrou ficheiros versionados obsoletos seguros para remover; `.claude/`, `public/`, `deploy/hub/`, `runtime/**/.gitkeep` e exemplos de secrets permanecem intencionais.

## Próximo passo

1. Executar gates documentados em `COMMANDS.md`.
2. Provisionar `warden_clean` pelo repo Overseer (`deploy/runners/baze2.yaml`).
3. Rever `git diff` e commitar apenas com pedido explícito.
4. `publish-public.ps1` continua só após validação e OK explícito, quando houver alterações em `public/`.

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `quality-gate-runner`, `secrets-layout-guardian`, `ssh-server-ops`
- MCP: N/A
