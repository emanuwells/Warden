# AGENTS.md — Warden

## Projeto
**Warden** — Monitor de recursos de sistema (CPU, RAM, Disco, Rede) para servidores Ubuntu.

## Arquitetura
```
DB → JSON → Static Frontend (No-API runtime)
```

### Componentes
| Componente | Ficheiro | Função |
|---|---|---|
| **Collector** | `src/collector.py` | Captura métricas via psutil |
| **DB Writer** | `src/db_writer.py` | Inserção/leitura MariaDB (PyMySQL, SSH tunnel opcional) |
| **Janitor** | `src/janitor.py` | Limpeza de dados > 30 dias |
| **Settings** | `src/settings.py` | Carregamento de config (.env + secrets/database.json) |
| **Slack Notifier** | `src/slack_notifier.py` | Envio via Slack Incoming Webhook |
| **Warden CLI** | `warden.py` | Entrypoint principal: `--setup`, `--once`, `--export`, `--cleanup` |
| **Export** | `scripts/export_payload.py` | DB → JSON para frontend (cron) |
| **Slack Alerts** | `scripts/slack_alerts.py` | Warnings/criticals imediatos (dedupe + cooldown) |
| **Slack Digest** | `scripts/slack_daily_digest.py` | Resumo diário para Slack (08:00) |
| **Frontend** | `frontend/` | Dashboard HTML/CSS/JS (MAIATRON Design System) |

### Fluxo de Dados
1. `warden.py` corre como serviço systemd — captura métricas a cada 5s → insere em MariaDB.
2. `scripts/export_payload.py` corre via cron — lê DB → gera `warden_payload.json`.
3. `scripts/slack_alerts.py` corre via cron (1 min) — envia `warning`/`critical` e recoveries para Slack com `<!channel>`.
4. `scripts/slack_daily_digest.py` corre via cron (08:00) — envia digest diário para Slack com `<!channel>`.
5. Frontend (nginx) lê o JSON estático e renderiza gauges + gráficos.

## Regras de Código
- Python 3.10+
- Type hints obrigatórios
- Logging via `logging` (nunca `print` em production)
- Segredos via `.env` ou `secrets/database.json` — nunca hardcoded
- Frontend segue MAIATRON Design System PRD v1.0

## Tabela Chave
**warden_metrics**: `id`, `captured_at` (TIMESTAMP indexed), `metrics` (JSON)

## Comandos Úteis
```bash
python warden.py --setup      # Cria tabela
python warden.py               # Arranca collector
python warden.py --once        # Captura única
python warden.py --export      # Exporta JSON
python warden.py --cleanup     # Janitor manual
```
