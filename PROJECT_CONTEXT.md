# PROJECT_CONTEXT — Warden

Este ficheiro descreve o contexto específico do projeto Warden (runtime MAIATRON).

Deve ser lido em conjunto com `AGENTS.md`, `HANDOFF.md`, `SKILLS.md` e `CHANGELOG_POLICY.md`.

## Identidade Do Projeto

| Campo | Valor |
|---|---|
| Nome | Warden |
| Tipo | Runtime de monitorização (collector + export + alertas) + fatia UI/API no HUB |
| Responsável | A confirmar |
| Estado | Produção (path home documentado) |

## Objetivo

Recolher métricas de sistema e MariaDB, persistir em `Warden.warden_metrics`, exportar snapshots JSON para consumo da API/UI MAIATRON e emitir alertas Slack.

## Stack Técnica

| Área | Tecnologia |
|---|---|
| Runtime | Python 3, venv local (`.venv`) |
| Base de dados | MariaDB/MySQL — schema `Warden`, tabela `warden_metrics` |
| Deploy host | systemd (`warden.service`) + cron (exports, janitor, Slack, archive) |
| Deploy alternativo | Docker Compose pipeline (`docker-compose.pipeline.yml`) |
| Frontend/API | PHP + estáticos em `public/` (HUB: `MAIATRON-HUB`) |
| Docker dev web | Nginx + PHP-FPM (`docker-compose.dev.yml`, porta 8080) |
| Testes | `python3 -m py_compile` (smoke manual documentado no README) |
| CI/CD | A confirmar |

## Estrutura Do Repositório

```text
public/                   # UI/API Warden (publicável no MAIATRON-HUB)
warden.py                 # CLI principal (collector)
src/                      # collector, db_writer, db_monitor, janitor, settings, alerts
scripts/                  # export, janitor, slack, publish-public, import-public, SSH
docker/                   # nginx para dev local
systemd/warden.service
config/
secrets/                  # *.example — credenciais reais não versionadas
runtime/                  # artefactos gerados (gitignored exceto .gitkeep)
docs/                     # produção, CleanTron, Warden_Public_Deploy, adr/
docker-compose.yml        # stack web local (atalho)
docker-compose.pipeline.yml
skills/
```

## Paths Oficiais (Produção)

| Componente | Path |
|---|---|
| Runtime/pipeline | `/home/eferreira/MAIATRON/Warden` |
| HUB (nginx root) | `/usr/share/nginx/html/MAIATRON-HUB` |
| Frontend Warden | `.../MAIATRON-HUB/frontend/apps/warden/` |
| API Warden (canónica) | `.../MAIATRON-HUB/backend/apps/warden/api.php` |
| URL pública UI/API | `/MAIATRON/apps/warden/` |
| Snapshots export | `.../Warden/runtime/export/warden_{fast,heavy}_snapshot.json`, `warden_payload.json` |
| CleanTron instalado | `/usr/local/sbin/maiatron_weekly_housekeeping.sh` |
| Legado templates | `/opt/warden` — não usar em produção nova |

## Acesso SSH A Produção (BAZE2)

| Item | Localização |
|---|---|
| Deploy SSH | `secrets/production.deploy.local.env` (ignorado pelo Git) |
| Chave | `secrets/.ssh/id_ed25519` |
| Copiar de WELLS_API | `scripts/setup-secrets-from-wells-api.ps1` |
| Limpeza remota | `scripts/run-production-cleanup.ps1`, `scripts/Invoke-WardenSsh.ps1` |
| Import `public/` | `scripts/import-public-from-prod.ps1` |
| Publish `public/` | `scripts/publish-public.ps1` |

## MCP Servers Do Projeto

| MCP Server | Finalidade | Configuração | Obrigatório | Estado |
|---|---|---|---:|---|
| N/A | — | Sem `.cursor/mcp.json` no repo | Não | Não configurado |

## Skills Do Projeto

Inventário completo: `SKILLS.md`.

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
| Setup DB | `.venv/bin/python warden.py --setup` |
| Recolha única | `.venv/bin/python warden.py --once` |
| Export | `.venv/bin/python scripts/export_payload.py --mode {fast,heavy,full}` |
| Dev Docker web | `.\scripts\start-warden-dev.ps1` |
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
| `public/` espelha fatia Warden do HUB | Alinhamento com WELLS_API; deploy isolado da UI/API |
| Pipeline permanece em `/home/eferreira/MAIATRON/Warden` | Não alterar produção até publish explícito do `public/` |
| `docker-compose.pipeline.yml` separado do web | Evitar confundir collector com stack PHP |

## Riscos Conhecidos

| Risco | Mitigação |
|---|---|
| Disco cheio no host | Runbook limpeza, CleanTron |
| Publish `public/` sem backup | `publish-public.ps1` com backup/rollback |
| Auth MAIATRON em Docker local | Smoke aceita 401 sem sessão |

## Dívida Técnica / Pendências

- Licença (`LICENSE`) A confirmar.
- CI/CD A confirmar.
- Validar `User`/`Group` em `systemd/warden.service`.
