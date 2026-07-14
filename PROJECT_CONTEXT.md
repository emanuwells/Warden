# PROJECT_CONTEXT — Warden

Contexto do projeto Warden: runtime de monitorização agnóstico de plataforma.

Ler com `AGENTS.md`, `COMMANDS.md` e, em tarefas operacionais, `docs/ai/ops/HANDOFF.md`.

## Identidade

| Campo | Valor |
|---|---|
| Nome | Warden |
| Tipo | Collector + export + alertas + fatia UI/API publicável no HUB do host |
| Versão | `VERSION` (SemVer) |
| Licença | Proprietária (todos os direitos reservados) |
| Estado | Activo em produção (paths via env, não versionados) |

## Objetivo

Recolher métricas de sistema e MariaDB, persistir no schema `Warden`, exportar snapshots JSON para APIs/UI consumidoras e emitir alertas configuráveis (Slack via secrets ou `SLACK_WEBHOOK_URL`).

## Stack

| Área | Tecnologia |
|---|---|
| Runtime | Python 3.10+, venv, [`src/requirements.txt`](src/requirements.txt) |
| Base de dados | MariaDB/MySQL — schema `Warden` |
| Deploy | systemd + cron, ou Docker (`docker/compose.pipeline.yml`) |
| UI/API | PHP + estáticos em `public/` / `deploy/hub/` |
| Dev local | Docker Nginx+PHP (`docker/compose.dev.yml`, :8080) |

## Estrutura

```text
src/                    # Código Python (collector, settings, alerts, …)
src/requirements.txt    # Dependências Python
scripts/                # Export, clean, Slack, deploy SSH
public/, deploy/hub/    # UI/API
docker/                 # Compose e Dockerfiles
secrets/                # Runtime local (gitignored)
runtime/                # Logs, export, cache (gitignored)
docs/                   # Arquitectura, ADRs, recursos
```

## Variáveis de deploy

| Variável | Função |
|---|---|
| `WARDEN_RUNTIME_ROOT` | Raiz do repo/runtime no host |
| `WARDEN_HUB_ROOT` | Raiz do HUB onde a UI/API é publicada |
| `WARDEN_CRONTAB_LOG_DIR` | Logs dos runners Overseer (opcional) |
| `WARDEN_CLEAN_BINLOG_RETENTION_DAYS` | Purga binlogs (`0` = desligado) |
| `WARDEN_CLEAN_OPTIMIZE_ENABLED` | Compactação opcional de tabelas Warden |

## Consumo externo da telemetria

| Interface | Descrição |
|---|---|
| `api.php?action=ops_fast` | Telemetria leve (CPU, RAM, disco, alertas) — público |
| `api.php?action=ops_heavy` | Host + histórico — público |
| `api.php?action=full` | Payload completo — autenticado |
| WELLS_API `GET /api/warden.php` | Proxy read-only (repo irmão) para estado da máquina |

## Ops remotas

Secrets e SSH: `secrets/production.deploy.local.env`, `secrets/.ssh/`. Bootstrap a partir do repo WELLS_API: `scripts/setup-secrets-from-wells-api.ps1`.

## Segurança

Não versionar `.env`, `secrets/database.json`, `secrets/slack.json`, chaves SSH nem webhooks. Rever `public/` antes de commit após import de produção.

## Comandos rápidos

Ver [`COMMANDS.md`](COMMANDS.md). Entrypoint: `python -m src.warden`.

## Pendências conhecidas

- CI/CD no repositório (avaliar quando necessário).
- Validar `User`/`Group` em `deploy/systemd/warden.service` no host alvo.
