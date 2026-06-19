# PROJECT_CONTEXT — Warden

Este ficheiro descreve o contexto específico do projeto Warden (runtime de monitorização agnóstico de plataforma).

Deve ser lido em conjunto com `AGENTS.md`, `.agents/ops/HANDOFF.md`, `.agents/skills/README.md` e `.agents/policies/CHANGELOG_POLICY.md`.

## Identidade Do Projeto

| Campo | Valor |
|---|---|
| Nome | Warden |
| Tipo | Runtime de monitorização (collector + export + alertas) + fatia UI/API publicável no HUB do host |
| Responsável | A confirmar |
| Versão repo | `VERSION` — 2.1.0 |
| Licença | MIT (`LICENSE`) |
| Estado | Produção |

## Objetivo

Recolher métricas de sistema e MariaDB, persistir em `Warden.warden_metrics`, exportar snapshots JSON para consumo por qualquer API/UI frontend e emitir alertas Slack.

## Stack Técnica

| Área | Tecnologia |
|---|---|
| Runtime | Python 3, venv local (`.venv`) |
| Base de dados | MariaDB/MySQL — schema `Warden`, tabela `warden_metrics` |
| Deploy host | systemd (`warden.service`) + cron (exports, Warden Clean, Slack, archive) |
| Deploy alternativo | Docker Compose pipeline (`docker/compose.pipeline.yml`) |
| Frontend/API | PHP + estáticos em `public/` (publicável no HUB do host) |
| Docker dev web | Nginx + PHP-FPM (`docker/compose.dev.yml`, porta 8080) |
| Testes | `python3 -m py_compile` (smoke manual documentado no README) |
| CI/CD | Não configurado no repositório |

## Estrutura Do Repositório

```text
VERSION, LICENSE          # Versão SemVer e licença MIT
public/www/, public/backend/
deploy/hub/               # Fatia para publicação no HUB do host
src/warden.py             # CLI principal (collector)
src/                      # collector, db_writer, db_monitor, warden_clean, settings, alerts
scripts/                  # export, warden_clean, slack, publish-public, import-public, SSH
docker/                   # Dockerfiles, Compose especializados e nginx dev local
systemd/warden.service    # Template — ajustar paths no deploy
config/
secrets/                  # *.example — credenciais reais não versionadas
runtime/                  # artefactos gerados (gitignored exceto .gitkeep)
docs/                     # produção, Warden_Public_Deploy, adr/
.agents/                  # policies, ops, mcp, templates e skills canónicas
docker-compose.yml        # wrapper web local (include docker/compose.dev.yml)
docker/compose.pipeline.yml
docker/compose.sync.yml
```

## Paths De Deploy (configuráveis)

Todos os paths de produção são definidos por ambiente. Variáveis canónicas:

| Variável | Função |
|---|---|
| `WARDEN_RUNTIME_ROOT` | Diretório raiz do runtime Warden no host |
| `WARDEN_HUB_ROOT` | Raiz do HUB/plataforma onde a UI/API é publicada (opcional) |
| `WARDEN_CRONTAB_LOG_DIR` | Logs do runner `warden_clean` no Overseer (opcional) |

| Componente | Path típico (exemplo) |
|---|---|
| Runtime/pipeline | `$WARDEN_RUNTIME_ROOT` |
| HUB (nginx root) | `$WARDEN_HUB_ROOT` |
| Frontend Warden | `$WARDEN_HUB_ROOT/frontend/apps/warden/` |
| API Warden (canónica) | `$WARDEN_HUB_ROOT/backend/apps/warden/api.php` |
| Snapshots export | `$WARDEN_RUNTIME_ROOT/runtime/export/warden_{fast,heavy}_snapshot.json`, `warden_payload.json` |
| Pipeline (Fase 1/2) | `docs/Warden_Pipeline.md`, ADR `docs/adr/0001-warden-dual-snapshot-pipeline.md` |
| Runner `warden_clean` | Path do Overseer no host (ver runbook) |
| Cron `warden_clean` | Uma linha `# overseer:warden_clean` no crontab real |
| Legado templates | `/opt/warden` — evitar em instalações novas |

## Acesso SSH A Produção

| Item | Localização |
|---|---|
| Deploy SSH | `secrets/production.deploy.local.env` (ignorado pelo Git) |
| Chave | `secrets/.ssh/id_ed25519` |
| Copiar de WELLS_API | `scripts/setup-secrets-from-wells-api.ps1` |
| Limpeza remota | `scripts/run-production-cleanup.ps1`, `scripts/Invoke-WardenSsh.ps1` |
| Import `public/` | `scripts/import-public-from-prod.ps1` |
| Sync snapshots prod → local | `scripts/sync-prod-snapshots.ps1` (`docker/compose.sync.yml`, SCP read-only) |
| Publish `public/` | `scripts/publish-public.ps1` |

## MCP Servers Do Projeto

| MCP Server | Finalidade | Configuração | Obrigatório | Estado |
|---|---|---|---:|---|
| N/A | — | Sem `.cursor/mcp.json` no repo | Não | Não configurado |

## Skills Do Projeto

Inventário completo: `.agents/skills/README.md`.

## Política De Git Do Projeto

| Regra | Estado |
|---|---|
| Commits automáticos por IA | Não (só com pedido explícito) |
| Comandos destrutivos Git | Proibido por defeito |

## Política De Segurança E Segredos

- Não versionar `.env`, credenciais reais, `secrets/database.json`, chaves SSH.
- `public/` importado: rever antes de commit (sem tokens/passwords).

## Comandos Principais

| Ação | Comando |
|---|---|
| Setup DB | `.venv/bin/python -m src.warden --setup` |
| Recolha única | `.venv/bin/python -m src.warden --once` |
| Export | `.venv/bin/python scripts/export_payload.py --mode {fast,heavy,full}` |
| Dev Docker web | `.\scripts\start-warden-dev.ps1` |
| Sync snapshots (prod) | `.\scripts\sync-prod-snapshots.ps1` |
| Publish public | `.\scripts\publish-public.ps1 -DryRun` |

## Endpoints / Interfaces Importantes

| Interface | Descrição |
|---|---|
| `api.php?action=ops_fast` | Snapshot leve |
| `api.php?action=ops_heavy` | Snapshot pesado |
| `api.php?action=full` | Payload completo |

## ADRs Do Projeto

Template em `docs/adr/0000-template.md` — sem ADRs aplicados ainda.

## Decisões Técnicas Atuais

| Decisão | Motivo |
|---|---|
| `public/` espelha fatia Warden do HUB | Deploy isolado da UI/API; sync com repositório da plataforma host |
| Pipeline configurável via `WARDEN_RUNTIME_ROOT` | O collector executa `python -m src.warden` a partir do diretório do projeto |
| `docker/compose.pipeline.yml` separado do web | Evitar confundir collector com stack PHP |
| Auth do host opcional | Libs em `core/shared/` são adaptador da plataforma; Warden core permanece agnóstico |

## Riscos Conhecidos

| Risco | Mitigação |
|---|---|
| Disco cheio no host | Runbook limpeza, `warden_clean` |
| Publish `public/` sem backup | `publish-public.ps1` com backup/rollback |
| Auth do host em Docker local | Smoke aceita 401 sem sessão |

## Dívida Técnica / Pendências

- CI/CD não configurado; avaliar pipeline leve quando houver necessidade de gates automáticos.
- Validar `User`/`Group` em `systemd/warden.service` no deploy real.
