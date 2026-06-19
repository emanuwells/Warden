# Warden — Runtime Oficial do Pipeline

![Stack](https://img.shields.io/badge/stack-Python%203.10%2B%20%7C%20MariaDB%20%7C%20Docker%20%7C%20systemd-3776ab)
![Status](https://img.shields.io/badge/status-produ%C3%A7%C3%A3o-2ecc71)
![Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-2ecc71)

Runtime de monitorização (collector + export + alertas) do ecossistema **MAIATRON**. Recolhe métricas de sistema e MariaDB, persiste em `Warden.warden_metrics`, exporta snapshots JSON para a API/UI e envia alertas Slack.

## Funcionalidades principais

- Recolha periódica de CPU, RAM, disco, rede, processos e top consumo de disco.
- Monitorização de schemas MariaDB (tamanhos, crescimento).
- Export de snapshots `fast`, `heavy` e `full` para consumo pela API PHP no host MAIATRON.
- Warden Clean com retenção configurável (`RETENTION_DAYS`).
- Alertas Slack imediatos e digest diário, com limite de notificações por incidente.
- Arquivo semanal agregado (`runtime/archive/weekly`).
- Housekeeping conservador via runner `warden_clean`, visível no Overseer.
- Pasta [`public/`](public/) com UI/API Warden (fatia MAIATRON-HUB), importável e publicável de forma controlada.
- Scripts PowerShell: import/publicação de `public/`, SSH e limpeza remota em BAZE2.

## Stack tecnológica

| Área | Tecnologia |
|---|---|
| Runtime | Python 3.10+, venv (`.venv`) |
| Dependências | `psutil`, `PyMySQL`, `python-dotenv`, `requests`, … — ver [`requirements.txt`](requirements.txt) |
| Base de dados | MariaDB/MySQL — schema `Warden`, tabela `warden_metrics` |
| Deploy host | systemd + cron |
| Deploy alternativo | Docker Compose (pipeline only; DB externa) |
| Frontend/API | Versionados em `public/`; em produção dentro de `MAIATRON-HUB` (URL `/MAIATRON/apps/warden/`) |
| CI/CD | Não configurado no repositório |

## Arquitetura

```mermaid
flowchart LR
  subgraph host [Host Linux]
    warden[src.warden collector]
    cron[cron / systemd]
    export[export_payload.py]
    clean[warden_clean.py]
    slack[slack_alerts.py]
    warden --> dbW[(MariaDB Warden)]
    cron --> export
    cron --> clean
    cron --> slack
    export --> snapshots[runtime/export/*.json]
  end
  subgraph hub [MAIATRON-HUB public]
    api[api.php]
    ui[index.html]
    api --> snapshots
    ui --> api
  end
  snapshots --> api
  slack --> slackExt[Slack webhooks]
  warden --> monitor[Host filesystem]
```

Fluxo resumido:

1. `src.warden` recolhe métricas e grava em `Warden.warden_metrics`.
2. `scripts/export_payload.py` gera `warden_fast_snapshot.json`, `warden_heavy_snapshot.json`, `warden_payload.json`.
3. `api.php` (no host MAIATRON) serve `ops_fast`, `ops_heavy`, `full`.
4. Jobs auxiliares: Warden Clean, Slack e arquivo semanal.

## Estrutura do projeto

```text
Warden/
├── VERSION                        # Versão SemVer canónica (fonte para releases)
├── LICENSE                        # MIT
├── AGENTS.md, PROJECT_CONTEXT.md, COMMANDS.md
├── CHANGELOG.md
├── README.md
├── .agents/                       # Políticas, runbook, handoff, MCP, templates e Skills
├── public/www/                    # UI/API local (Docker :8080)
├── public/backend/                # API PHP canónica + auth MAIATRON
├── deploy/hub/                    # Fatia para publicação no MAIATRON-HUB
├── src/, scripts/, requirements.txt
├── docker-compose.yml             # Wrapper web local (include → docker/compose.dev.yml)
├── docker/                        # Dockerfiles, Compose especializados e nginx dev
│   ├── compose.pipeline.yml       # Collector + scheduler
│   └── compose.sync.yml           # SCP snapshots de produção
├── secrets/, runtime/, docs/
└── tools/ai-adapters/             # Adaptadores de IDE/agentes
```

## Requisitos

- **Host:** Linux com Python 3.10+, MariaDB acessível, systemd (opcional) e cron.
- **Docker (opcional):** Docker Engine + Compose v2; DB MariaDB externa ao compose.
- **Produção BAZE2 (ops):** SSH com chave em `secrets/.ssh/`; ver [`secrets/README.md`](secrets/README.md).
- **Windows (ops):** PowerShell 5.1+ para scripts `*.ps1`.

## Instalação (host)

```bash
cd /home/eferreira/MAIATRON/Warden
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp secrets/database.json.example secrets/database.json
# Editar .env e secrets/database.json com valores reais (não commitar)
.venv/bin/python -m src.warden --setup
```

Path canónico em produção: `/home/eferreira/MAIATRON/Warden`. Templates antigos usavam `/opt/warden` — não usar em instalações novas.

## Configuração

| Ficheiro | Função |
|---|---|
| `.env` | Host, DB, retenção, paths de export, alertas, Slack |
| `secrets/database.json` | Credenciais MariaDB do collector |
| `secrets/slack.json` | Webhooks Slack |
| `secrets/production.deploy.local.env` | SSH produção (local, gitignored) |

Variáveis principais (ver `.env.example`):

| Variável | Descrição |
|---|---|
| `RETENTION_DAYS` | Retenção de métricas (ex.: `7`) |
| `EXPORT_PATH`, `EXPORT_FAST_PATH`, `EXPORT_HEAVY_PATH` | Snapshots JSON |
| `MONITOR_ROOT_PATH` | Raiz para métricas de disco (`/` ou `/hostfs` em Docker) |
| `WEEKLY_ARCHIVE_RETENTION_WEEKS` | Retenção de arquivo semanal |
| `ALERT_DISK_WARN`, `ALERT_DISK_CRITICAL` | Limiares de alerta |
| `WARDEN_SLACK_IMMEDIATE` | Ativa alertas imediatos por Slack (`1` em produção) |
| `SLACK_WARNING_*`, `SLACK_CRITICAL_*` | Janelas de confirmação e cooldown por severidade |
| `SLACK_ALERT_MAX_NOTIFICATIONS` | Máximo de notificações por incidente (`5` por defeito) |
| `SLACK_DIGEST_HOUR_UTC`, `SLACK_DIGEST_MINUTE_UTC` | Hora do digest diário Slack (`08:30` por defeito) |

## Utilização

Recolha única e export:

```bash
.venv/bin/python -m src.warden --once
.venv/bin/python scripts/export_payload.py --mode fast
.venv/bin/python scripts/export_payload.py --mode heavy
.venv/bin/python scripts/export_payload.py --mode full
```

Serviço systemd + cron:

```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
systemctl --user stop warden.service || true
systemctl --user disable warden.service || true
crontab -e   # colar scripts/crontab.example
```

Contrato operacional:

- Snapshots: `runtime/export/warden_{fast,heavy}_snapshot.json`, `warden_payload.json`
- Retenção: `RETENTION_DAYS=7`
- Janelas UI: `1h`, `24h`, `7d`, `30d` (30d agregado)

## Comandos principais

| Ação | Comando |
|---|---|
| Setup schema | `.venv/bin/python -m src.warden --setup` |
| Recolha única | `.venv/bin/python -m src.warden --once` |
| Export | `.venv/bin/python scripts/export_payload.py --mode {fast,heavy,full}` |
| Warden Clean retenção | `.venv/bin/python scripts/warden_clean.py` |
| Runner `warden_clean` | `./scripts/warden_clean.sh --dry-run` |
| SSH remoto | `.\scripts\Invoke-WardenSsh.ps1` (PowerShell) |
| Limpeza produção | `.\scripts\run-production-cleanup.ps1` |
| Importar `public/` | `.\scripts\import-public-from-prod.ps1` |
| Publicar `public/` | `.\scripts\publish-public.ps1 -DryRun` (depois sem dry-run, com OK explícito) |
| Dev UI/API Docker | `.\scripts\start-warden-dev.ps1` |

## API e frontend (MAIATRON-HUB)

Código em [`public/`](public/); em produção sob `/usr/share/nginx/html/MAIATRON-HUB/frontend|backend/...`. URL pública nginx:

| Recurso | URL típica |
|---|---|
| UI (local Docker) | `http://127.0.0.1:8080/` |
| API (local Docker) | `http://127.0.0.1:8080/api.php` |
| UI (produção HUB) | `/MAIATRON/apps/warden/` (nginx) |

| `action=` | Uso |
|---|---|
| `ops_fast` | Snapshot leve |
| `ops_heavy` | Snapshot pesado |
| `full` | Payload completo |

## Testes, lint e build

Não há suite de testes automatizada versionada. Validação documentada:

```bash
python3 -m py_compile src/warden.py src/settings.py src/alerts.py src/collector.py src/db_monitor.py \
  src/slack_notifier.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py \
  scripts/warden_clean.py scripts/weekly_archive.py
bash -n scripts/warden_clean.sh
```

Smoke local (Docker):

```bash
curl -I http://127.0.0.1:8080/
curl -s "http://127.0.0.1:8080/api.php?action=ops_fast" | head
```

Smoke em produção (host BAZE, com auth MAIATRON):

```bash
curl -I http://127.0.0.1/MAIATRON/apps/warden/index.html
curl -s "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast" | head
```

**Lint / CI:** não há ferramenta de lint nem pipeline CI configurados no repositório.

## Docker e deploy

### UI/API local (Nginx + PHP-FPM)

```powershell
.\scripts\import-public-from-prod.ps1   # primeira vez (UI do HUB)
.\scripts\sync-prod-snapshots.ps1       # snapshots JSON de prod (SCP read-only)
.\scripts\start-warden-dev.ps1         # http://127.0.0.1:8080/
```

Snapshots em `runtime/export/`: copiar de produção com `sync-prod-snapshots.ps1`, ou gerar localmente com `python -m src.warden --once` e `export_payload.py`.

### Pipeline em Docker (sem PHP)

```bash
cp config/env.docker.example .env.docker
docker compose -f docker/compose.pipeline.yml up -d --build
```

| Serviço | Função |
|---|---|
| `warden-collector` | `python -m src.warden` |
| `warden-scheduler` | cron interno (export, Warden Clean, slack, archive) |

Para alterar a porta do stack web local, definir `WARDEN_DEV_PORT` antes de executar o compose ou `scripts/start-warden-dev.ps1`. Em ambientes onde Docker não consegue montar `runtime/export` diretamente, definir `WARDEN_EXPORT_DIR` para um diretório local alternativo com os snapshots JSON.

Host metrics: `MONITOR_ROOT_PATH=/hostfs`, mount `/:/hostfs:ro`, `pid: host`, `network_mode: host`.

### Publicação do `public/` em produção

Ver [`docs/Warden_Public_Deploy.md`](docs/Warden_Public_Deploy.md). **Não altera** o pipeline em `/home/eferreira/MAIATRON/Warden` até pedido explícito.

Deploy pipeline (host): [`docs/Guia_Producao_Step_by_Step.md`](docs/Guia_Producao_Step_by_Step.md).

## Produção (BAZE2) — operações

| Runbook | Conteúdo |
|---|---|
| [`docs/Warden_Public_Deploy.md`](docs/Warden_Public_Deploy.md) | `public/`, Docker dev, publish |
| [`docs/Producao_Acesso_e_Limpeza.md`](docs/Producao_Acesso_e_Limpeza.md) | SSH, diagnóstico e `warden_clean` |

```powershell
.\scripts\setup-secrets-from-wells-api.ps1
.\scripts\run-production-cleanup.ps1
.\scripts\publish-public.ps1 -DryRun
```

O runner `warden_clean` vive em `/home/eferreira/overseer-runners/warden_clean/run.sh`; o crontab real deve conter exatamente uma linha com `# overseer:warden_clean`. Se o runner existir mas o cron estiver ausente, seguir o runbook de produção para criar backup do crontab e inserir a linha de forma idempotente.

## Troubleshooting

| Sintoma | Verificar |
|---|---|
| API 404 em `ops_fast` | vhost/nginx; path `apps/warden`; snapshots em `runtime/export/` |
| Disco cheio | `df -h`; `warden_clean`; runbook produção |
| Collector duplicado | `systemctl --user` vs `systemctl` — desativar user service |
| Path legado `/opt/warden` | `crontab -l`, `systemctl cat warden` |
| Export vazio | DB `Warden` acessível; `python -m src.warden --once` |
| Docker sem métricas de disco | `MONITOR_ROOT_PATH` e mount `/hostfs` |
| API 401 em Docker local | Auth MAIATRON; esperado sem sessão — validar UI estática e PHP a responder |
| `public/` vazio | `.\scripts\import-public-from-prod.ps1` |
| `snapshot_unavailable` em dev | `.\scripts\sync-prod-snapshots.ps1` ou gerar JSON localmente |
| SCP sync: bad permissions | `icacls` na chave em `secrets/.ssh/id_ed25519` (ver `docs/Warden_Public_Deploy.md`) |

## Segurança e gestão de segredos

- Não commitar `.env`, `.env.docker`, `secrets/database.json`, `secrets/slack.json`, chaves SSH nem `production.deploy.local.env`.
- Usar apenas ficheiros `*.example` no Git.
- Não versionar `runtime/export`, `runtime/logs`, `runtime/cache`, `runtime/archive` (exceto `.gitkeep`).
- A limpeza operacional versionada vive em `scripts/warden_clean.sh` e cobre retenção de dados, logs grandes, temporários atómicos antigos, cache regenerável, caches Python, ficheiros de editor/sistema, logs textuais SQL grandes e cache Docker antiga sem apagar backups, dados, secrets, volumes, binlogs, relay logs ou snapshots ativos.

## MCP servers e Skills

| Item | Estado |
|---|---|
| MCP no repo | **N/A** — sem `.cursor/mcp.json` / `.mcp.json` versionado; configurar no IDE se necessário |
| Skills | Pacote canónico em `.agents/skills/`; compatibilidade Claude Code em `tools/ai-adapters/claude/.claude/skills/` — inventário em [`.agents/skills/README.md`](.agents/skills/README.md) |
| Regras para IAs | [`AGENTS.md`](AGENTS.md) |

Documentação de governança:

| Documento | Uso |
|---|---|
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Stack, paths, comandos, riscos |
| [`.agents/ops/HANDOFF.md`](.agents/ops/HANDOFF.md) | Estado operacional e próximos passos |

## Métricas de crescimento (v2.x)

O payload expõe crescimento por janela para disco e DB (`disk_*_gb_avg`, `disk_growth_gb_h_avg`, `db.history.*`). No frontend: tabs **Disk** e **DB** com gráficos dedicados. Fallback: deriva `disk_used_gb_avg` a partir de `disk_avg` quando faltarem colunas antigas.

## Changelog

Alterações versionadas: [`CHANGELOG.md`](CHANGELOG.md) (política em [`.agents/policies/CHANGELOG_POLICY.md`](.agents/policies/CHANGELOG_POLICY.md)).

## Licença e versão

- Versão canónica: [`VERSION`](VERSION) (SemVer; alinhar com `CHANGELOG.md` e badge acima).
- Licença: [MIT](LICENSE)
