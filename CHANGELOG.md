# Changelog

Todas as alterações notáveis ao projeto **Warden** serão documentadas aqui.

## [1.0.1] - 2026-02-23

### Alterado
- **Slack Alerts (`scripts/slack_alerts.py`):** warnings e criticals passam a ser enviados para Slack (antes só critical).
- **Slack Alerts (`scripts/slack_alerts.py`):** mensagens reformuladas para formato mais legível (emoji, severidade, valor/limite, timestamps, duração no recovery).
- **Slack Alerts (`scripts/slack_alerts.py`):** alertas imediatos passam a incluir menção global `<!channel>`.
- **Slack Digest (`scripts/slack_daily_digest.py`):** digest diário reformulado com secções (Host, MariaDB, Alertas) e resumo visual.
- **Slack Digest (`scripts/slack_daily_digest.py`):** digest diário inclui menção global `<!channel>`.
- **Cron:** agendamento diário do digest ajustado para `08:00` (hora local do servidor) e exemplo de cron atualizado.
- **Config Defaults:** `SLACK_DIGEST_HOUR_UTC=8` e `SLACK_DIGEST_MINUTE_UTC=0` em `src/settings.py` e `.env.example`.

## [1.0.0] - 2026-02-16

### Adicionado
- **Collector (The Agent):** Script Python + psutil para captura de CPU, RAM, Disco e Rede.
- **DB Writer:** Inserção em MariaDB com suporte a SSH tunnel.
- **Janitor:** Sistema de auto-expiração de dados (30 dias configurável).
- **CLI:** `warden.py` com modos `--setup`, `--once`, `--export`, `--cleanup`.
- **Export:** Script de exportação DB → JSON para frontend estático.
- **Frontend:** Dashboard MAIATRON Design System com:
  - Login screen com glass morphism
  - Dark/Light mode toggle (persistente)
  - Gauges para CPU, RAM, Disco
  - Line charts tempo real (CPU, Memória, Rede)
  - Gráficos históricos (24h e 7 dias)
  - Disk I/O e espaço em disco (doughnut)
  - Per-core CPU bars
  - Info cards para métricas detalhadas
  - Tab navigation (Overview, CPU, Memória, Disco, Rede)
  - Auto-refresh a cada 30 segundos
  - Responsivo (mobile-first)
- **systemd:** Unit file para serviço com auto-restart.
- **Cron:** Templates para export periódico e janitor diário.
- **Secrets:** Gestão segura via `.env` + `secrets/database.json`.
