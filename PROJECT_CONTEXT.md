# PROJECT_CONTEXT — Warden

Este ficheiro descreve o contexto específico do projeto Warden (runtime MAIATRON).

Deve ser lido em conjunto com `AGENTS.md`, `HANDOFF.md`, `SKILLS.md` e `CHANGELOG_POLICY.md`.

## Identidade Do Projeto

| Campo | Valor |
|---|---|
| Nome | Warden |
| Tipo | Runtime de monitorização (collector + export + alertas) |
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
| Deploy alternativo | Docker Compose (pipeline-only, DB externa) |
| Frontend/API | Fora deste repo — `/usr/share/nginx/html/MAIATRON/apps/warden` |
| Testes | `python3 -m py_compile` (smoke manual documentado no README) |
| CI/CD | A confirmar |

## Estrutura Do Repositório

```text
warden.py                 # CLI principal (collector)
src/                      # collector, db_writer, db_monitor, janitor, settings, alerts
scripts/                  # export, janitor, slack, weekly_archive, CleanTron, crontab examples
systemd/warden.service    # unidade systemd (ajustar User/Group ao host)
config/                   # exemplos de auth local
secrets/                  # *.example — credenciais reais não versionadas
runtime/                  # artefactos gerados (gitignored exceto .gitkeep)
docs/                     # guias produção, CleanTron, runbook limpeza
docker-compose.yml        # pipeline Docker opcional
skills/                   # pacote Skills para agentes (AGENTS.md)
```

## Paths Oficiais (Produção)

| Componente | Path |
|---|---|
| Runtime/pipeline | `/home/eferreira/MAIATRON/Warden` |
| Frontend/API | `/usr/share/nginx/html/MAIATRON/apps/warden` |
| Snapshots export | `runtime/export/warden_{fast,heavy}_snapshot.json`, `warden_payload.json` |
| CleanTron instalado | `/usr/local/sbin/maiatron_weekly_housekeeping.sh` |
| Legado templates | `/opt/warden` — apenas em exemplos antigos; não usar em produção nova |

## Acesso SSH A Produção (BAZE2)

| Item | Localização |
|---|---|
| Deploy SSH | `secrets/production.deploy.local.env` (ignorado pelo Git) |
| Chave | `secrets/.ssh/id_ed25519` |
| Modelo | `secrets/production.deploy.local.env.example` |
| Copiar de WELLS_API | `scripts/setup-secrets-from-wells-api.ps1` |
| Limpeza remota | `scripts/run-production-cleanup.ps1`, `scripts/Invoke-WardenSsh.ps1` |

Host/utilizador típicos (não versionar passwords): alinhados com `WELLS_API` — ver `secrets/production.deploy.local.env` local.

CleanTron requer `sudo`; para automação sem TTY, definir `WARDEN_SUDO_PASSWORD` apenas no ficheiro local de deploy.

## MCP Servers Do Projeto

| MCP Server | Finalidade | Configuração | Obrigatório | Estado | Limitações / Riscos |
|---|---|---|---:|---|---|
| N/A | — | Sem `.cursor/mcp.json` no repo | Não | Não configurado | Usar shell/SSH para operações de host |

## Skills Do Projeto

| Skill | Finalidade | Localização | Obrigatória | Quando Usar |
|---|---|---|---:|---|
| repo-onboarding | Leitura inicial de políticas | `skills/repo-onboarding/` | Sim (tarefas não triviais) | Início de trabalho |
| documentation-keeper | Coerência de docs | `skills/documentation-keeper/` | Quando docs mudam | Alterações de documentação |
| docker-coolify-deploy | Docker/deploy | `skills/docker-coolify-deploy/` | Não | Compose/Docker |
| mysql-mariadb-dba | DB | `skills/mysql-mariadb-dba/` | Não | Migrations/DB |
| safe-git-operator | Git seguro | `skills/safe-git-operator/` | Sim | Antes de Git |

Inventário completo: `SKILLS.md`.

## Política De Git Do Projeto

| Regra | Estado | Nota |
|---|---|---|
| Branch principal | A confirmar | — |
| Commits automáticos por IA | Não | Só com pedido explícito |
| Push automático por IA | Não | Só com pedido explícito |
| Comandos destrutivos Git | Proibido por defeito | Requer autorização explícita |

## Política De Segurança E Segredos

- Não versionar `.env`, `.env.docker`, `secrets/database.json`, `secrets/slack.json`, `secrets/ssh_key`.
- Usar `*.example` com valores fictícios.
- SSH/host de produção: documentar placeholders em `docs/Producao_Acesso_e_Limpeza.md` — nunca commitar credenciais.

## Comandos Principais

| Ação | Comando | Estado |
|---|---|---|
| Setup DB | `.venv/bin/python warden.py --setup` | Documentado |
| Recolha única | `.venv/bin/python warden.py --once` | Documentado |
| Export fast/heavy/full | `.venv/bin/python scripts/export_payload.py --mode {fast,heavy,full}` | Documentado |
| Janitor | `.venv/bin/python scripts/janitor.py` | Documentado |
| CleanTron dry-run | `sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh --dry-run` | Documentado |
| QA sintaxe | `python3 -m py_compile warden.py src/*.py scripts/*.py` | Documentado |

## Variáveis De Ambiente

| Variável | Obrigatória | Descrição | Exemplo seguro |
|---|---:|---|---|
| `DB_HOST` | Sim | Host MariaDB | `127.0.0.1` |
| `DB_NAME` | Sim | Schema Warden | `Warden` |
| `RETENTION_DAYS` | Sim | Retenção métricas | `7` |
| `EXPORT_*_PATH` | Sim | Paths snapshots | `runtime/export/...` |
| `MONITOR_ROOT_PATH` | Sim (Docker: `/hostfs`) | Raiz de monitorização de disco | `/` |
| `WEEKLY_ARCHIVE_RETENTION_WEEKS` | Não | Arquivo semanal | `6` |

Ver `.env.example` e `.env.docker.example`.

## Endpoints / Interfaces Importantes

| Interface | Descrição | Estado |
|---|---|---|
| `api.php?action=ops_fast` | Snapshot leve | Host MAIATRON |
| `api.php?action=ops_heavy` | Snapshot pesado | Host MAIATRON |
| `api.php?action=full` | Payload completo | Host MAIATRON |

## ADRs Do Projeto

| ADR | Decisão | Estado | Impacto |
|---|---|---|---|
| — | Template em `docs/adr/0000-template.md` | Sem ADRs aplicados ainda | — |

## Critérios De Verificação Antes De Concluir Trabalho

Ver checklist em `AGENTS.md` e skill `definition-of-done`.

## Decisões Técnicas Atuais

| Decisão | Motivo | Impacto | ADR |
|---|---|---|---|
| Path canónico em `/home/eferreira/MAIATRON/Warden` | Alinhamento com produção documentada | systemd/cron examples atualizados | A confirmar |
| CleanTron versionado neste repo | Fonte única de housekeeping host | Script em `scripts/maiatron_weekly_housekeeping.sh` | — |
| Retenção métricas 7 dias | Contrato operacional | Janitor diário | — |

## Riscos Conhecidos

| Risco | Impacto | Mitigação |
|---|---|---|
| Disco cheio no host | Falha de exports/logs/DB | Runbook `docs/Producao_Acesso_e_Limpeza.md`, CleanTron |
| Path legado `/opt/warden` em cron antigo | Jobs a falhar | Validar `crontab -l` e `systemctl cat warden` em produção |
| Collector duplicado (user + system service) | Métricas duplicadas | Desativar `warden.service` user |

## Dívida Técnica / Pendências

- Validar `User`/`Group` em `systemd/warden.service` vs utilizador real do host (`eferreira` vs `warden`).
- Confirmar host SSH de produção fora do repositório.
