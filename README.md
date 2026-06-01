# Warden — Runtime Oficial do Pipeline

Warden é o runtime de monitorização (collector + export + alertas) do ecossistema MAIATRON.

## Documentação do projeto

| Documento | Conteúdo |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras obrigatórias para agentes de IA |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Stack, paths, secrets, critérios de verificação |
| [`HANDOFF.md`](HANDOFF.md) | Estado operacional atual (produção, bloqueios, próximos passos) |
| [`SKILLS.md`](SKILLS.md) | Inventário de Skills (`skills/` e `.claude/skills/`) |
| [`CHANGELOG.md`](CHANGELOG.md) / [`CHANGELOG_POLICY.md`](CHANGELOG_POLICY.md) | Histórico e política de versionamento |
| [`tasks/todo.md`](tasks/todo.md) | Plano de execução em curso |

### MCP

Este repositório **não inclui** configuração MCP versionada (sem `.cursor/mcp.json` / `.mcp.json` na raiz). Configurar MCP no IDE do utilizador quando necessário; ver `PROJECT_CONTEXT.md` e skill `mcp-server-operator`.

## Contrato operacional atual

- Frontend oficial: `/usr/share/nginx/html/MAIATRON/apps/warden` (UI + `api.php`)
- Runtime oficial deste repo: `/home/eferreira/MAIATRON/Warden` (path canónico em produção)
- Templates antigos referiam `/opt/warden`; usar sempre o path home em instalações novas
- Snapshots exportados para consumo da API:
  - `runtime/export/warden_fast_snapshot.json`
  - `runtime/export/warden_heavy_snapshot.json`
  - `runtime/export/warden_payload.json`
- Retenção operacional: `RETENTION_DAYS=7`
- Histórico estendido: snapshot semanal agregado (`runtime/archive/weekly`)
- Janelas operacionais suportadas no frontend: `1h`, `24h`, `7d`, `30d` (30d agregado)

## Arquitetura

1. `warden.py` recolhe métricas (CPU/RAM/Disco/Rede + processos/top disco).
2. Dados entram na DB `Warden` (`warden_metrics`).
3. `scripts/export_payload.py` gera snapshots `fast/heavy/full`.
4. `apps/warden/api.php` (no MAIATRON, fora deste repo) lê snapshots e expõe ações HTTP.
5. Jobs auxiliares:
   - `scripts/janitor.py`
   - `scripts/slack_alerts.py`
   - `scripts/slack_daily_digest.py`
   - `scripts/weekly_archive.py`

## Métricas de crescimento (v2.x)

Além de CPU/RAM/Rede, o payload expõe crescimento por janela para Disco e DB:

- Histórico sistema (`history_*`):
  - `disk_total_gb_avg`
  - `disk_used_gb_avg`
  - `disk_free_gb_avg`
  - `disk_growth_gb_h_avg`
- Histórico DB (`db.history.*`):
  - `storage_total_gb_avg`
  - `storage_growth_gb_h_avg`

No frontend:
- Tab `Disk`: gráfico dedicado `Disco usado (GB)` + `Crescimento/h (GB/h)`.
- Tab `DB`: gráfico dedicado `Consumo DB (GB)` + `Crescimento/h (GB/h)` separado de throughput.

Fallback compatível com histórico antigo:
- quando faltarem colunas GB antigas, o export deriva `disk_used_gb_avg` a partir de `disk_avg` e `disk_total_gb` atual.

## Setup rápido (host)

```bash
cd /home/eferreira/MAIATRON/Warden
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cp secrets/database.json.example secrets/database.json
```

Criar schema base:

```bash
.venv/bin/python warden.py --setup
```

Teste de recolha:

```bash
.venv/bin/python warden.py --once
.venv/bin/python scripts/export_payload.py --mode fast
.venv/bin/python scripts/export_payload.py --mode heavy
.venv/bin/python scripts/export_payload.py --mode full
```

## Serviço + cron (host)

- Serviço systemd: `systemd/warden.service`
- Cron recomendado: `scripts/crontab.example`

Passos típicos:

```bash
sudo cp systemd/warden.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warden
# Evitar collector duplicado via user service:
systemctl --user stop warden.service || true
systemctl --user disable warden.service || true
crontab -e
# colar conteúdo de scripts/crontab.example
```

## API e frontend (MAIATRON)

O UI e a API vivem no host nginx, não neste repo:

| Recurso | Path / URL típica |
|---|---|
| UI | `http://127.0.0.1/MAIATRON/apps/warden/index.html` |
| API | `http://127.0.0.1/MAIATRON/apps/warden/api.php` |

Ações principais (`action=`):

| Ação | Uso |
|---|---|
| `ops_fast` | Snapshot leve (métricas recentes) |
| `ops_heavy` | Snapshot pesado (processos, top disco, etc.) |
| `full` | Payload completo exportado |

Os ficheiros JSON em `runtime/export/` são a fonte que a API consome após `scripts/export_payload.py`.

## Produção (BAZE2) — SSH e operações

Host alinhado com **WELLS_API** (ex.: BAZE2). Credenciais apenas em `secrets/` local (gitignored) — ver [`secrets/README.md`](secrets/README.md).

### Configuração inicial (Windows / PowerShell)

```powershell
# Copiar secrets do repo WELLS_API (recomendado)
.\scripts\setup-secrets-from-wells-api.ps1

# Shell remoto genérico
.\scripts\Invoke-WardenSsh.ps1
```

### Limpeza de disco no host

Runbook: [`docs/Producao_Acesso_e_Limpeza.md`](docs/Producao_Acesso_e_Limpeza.md) (diagnóstico, janitor Warden, CleanTron, validação pós-limpeza).

```powershell
.\scripts\run-production-cleanup.ps1
```

CleanTron em produção pode exigir `WARDEN_SUDO_PASSWORD` no ficheiro local `secrets/production.deploy.local.env` (nunca commitar).

### Arquivo MySQL `d4maia` (tabelas pré-2024)

Runbook: [`docs/Arquivo_d4maia_pre2024.md`](docs/Arquivo_d4maia_pre2024.md).

Arquivar tabelas do schema `d4maia` cujo nome contém **2020–2023**, com dump local e `DROP` só após verificação:

```powershell
.\scripts\archive-d4maia-pre2024.ps1 -Phase inventory
.\scripts\archive-d4maia-pre2024.ps1 -Phase dump
.\scripts\archive-d4maia-pre2024.ps1 -Phase verify
.\scripts\archive-d4maia-pre2024.ps1 -Phase drop   # só após verify OK
```

Destino local predefinido: `C:\Users\<user>\Downloads\d4maia\` (`manifest.json`, `tables\*.sql.gz`).

## Host housekeeping (CleanTron)

Este repo também versiona o housekeeping semanal conservador do host:

- script versionado: `scripts/maiatron_weekly_housekeeping.sh`
- script ativo em produção: `/usr/local/sbin/maiatron_weekly_housekeeping.sh`
- documentação operacional: `docs/CleanTron.md`

Princípios do script:
- limpa apenas artefactos seguros e antigos
- não apaga diretórios em `/tmp` nem ficheiros `*.lock`, `*.pid` ou `*.sock`
- mantém MySQL como passo opt-in (`ENABLE_MYSQL_CLEANUP=1`)
- não gere retenção de `/var/lib/systemd/coredump`, porque essa política já existe no sistema

Validação/execução manual:

```bash
./scripts/maiatron_weekly_housekeeping.sh --dry-run
sudo install -m 750 -o root -g root scripts/maiatron_weekly_housekeeping.sh /usr/local/sbin/maiatron_weekly_housekeeping.sh
sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh --dry-run
sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh
```

## Docker (pipeline-only, DB externa)

Este repo inclui dockerização do pipeline (não frontend).

Ficheiros:
- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `scripts/docker.crontab`
- `scripts/docker-scheduler.sh`

Arranque:

```bash
cp .env.docker.example .env.docker
docker compose up -d --build
```

Serviços:
- `warden-collector`: corre `python warden.py`
- `warden-scheduler`: corre cron para export/janitor/slack/archive

### Host metrics em Docker

Para recolher métricas da máquina anfitriã:

- `MONITOR_ROOT_PATH=/hostfs` (env)
- mount host root read-only: `/:/hostfs:ro`
- `pid: host`
- `network_mode: host`

Isto mantém o comportamento de monitorização de disco/processos coerente com host.

## Variáveis-chave

- `RETENTION_DAYS=7`
- `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`
- `EXPORT_PATH`, `EXPORT_FAST_PATH`, `EXPORT_HEAVY_PATH`
- `MONITOR_ROOT_PATH` (novo)
- `ALERT_DISK_WARN=95`, `ALERT_DISK_CRITICAL=98`
- `SLACK_WARNING_*` e `SLACK_CRITICAL_*`

## QA rápido

```bash
python3 -m py_compile warden.py src/settings.py src/collector.py src/db_monitor.py scripts/export_payload.py scripts/slack_alerts.py scripts/slack_daily_digest.py scripts/janitor.py scripts/weekly_archive.py
```

Smoke API (no host MAIATRON — ver secção [API e frontend](#api-e-frontend-maiatron)):

```bash
curl -I http://127.0.0.1/MAIATRON/apps/warden/index.html
curl -s "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast" | head
curl -s "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_heavy" | head
curl -s "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=full" | head
```

## Git readiness checklist

- Não commitar `.env` nem segredos em `secrets/*.json` reais.
- Não commitar artefactos gerados em `runtime/export`, `runtime/cache`, `runtime/archive`, `runtime/logs`.
- O housekeeping semanal do host deve ser alterado apenas a partir de `scripts/maiatron_weekly_housekeeping.sh` e documentado em `docs/CleanTron.md`.
- Commits devem conter apenas código, docs, scripts e templates (`*.example`).
