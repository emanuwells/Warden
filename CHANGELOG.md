# Changelog

Todas as alterações notáveis ao projeto **Warden** serão documentadas aqui.

## [2.0.4] - 2026-06-01

### Adicionado
- Script [`scripts/archive-d4maia-pre2024.ps1`](scripts/archive-d4maia-pre2024.ps1): inventário, dump comprimido via SSH, verificação gzip/SHA256 e `DROP TABLE` para tabelas `d4maia` com ano 2020–2023 no nome.
- Runbook [`docs/Arquivo_d4maia_pre2024.md`](docs/Arquivo_d4maia_pre2024.md).

### Alterado
- Operação em produção BAZE2: 16 tabelas arquivadas em `Downloads/d4maia`, removidas após verificação; disco `/` ~98% → **~89%** (~11 GB livres).

## [2.0.3] - 2026-06-01

### Adicionado
- Acesso SSH a produção alinhado com WELLS_API: `secrets/production.deploy.local.env.example`, `secrets/environments.local.json.example`, `secrets/README.md`.
- Scripts `scripts/Invoke-WardenSsh.ps1`, `scripts/run-production-cleanup.ps1`, `scripts/setup-secrets-from-wells-api.ps1`.

### Alterado
- `.gitignore`: ignora `secrets/` exceto `README.md` e `*.example`.
- `docs/Producao_Acesso_e_Limpeza.md` e `README.md`: fluxo PowerShell com chave em `secrets/.ssh/`.

## [2.0.2] - 2026-06-01

### Adicionado
- `PROJECT_CONTEXT.md` com stack, paths oficiais e políticas do projeto.
- Estrutura `runtime/{cache,export,archive,logs}/.gitkeep` no repositório.
- Runbook [`docs/Producao_Acesso_e_Limpeza.md`](docs/Producao_Acesso_e_Limpeza.md) para diagnóstico SSH e limpeza segura de disco.

### Alterado
- `systemd/warden.service` e `scripts/crontab.example`: path canónico `/home/eferreira/MAIATRON/Warden` (variável `WARDEN_ROOT` no cron).
- `README.md`, `docs/CleanTron.md`, `docs/Guia_Producao_Step_by_Step.md`: ligações ao runbook e nota sobre legado `/opt/warden`.

## [2.0.1] - 2026-03-12

### Adicionado
- Script versionado de housekeeping semanal do host em `scripts/maiatron_weekly_housekeeping.sh`.
- Documentação operacional dedicada do `CleanTron` em `docs/CleanTron.md`.
- Limpeza conservadora de crash reports antigos em `/var/crash` (`*.crash`, `*.upload`, `*.uploaded` com mais de 30 dias).

### Alterado
- `README.md`: documentação do `Warden` passa a incluir o contrato operacional do `CleanTron` e o fluxo de instalação para `/usr/local/sbin`.
- `scripts/maiatron_weekly_housekeeping.sh`: mantém `--dry-run`, exige `root` fora desse modo, preserva diretórios/locks em `/tmp` e deixa MySQL em opt-in.
- O `Warden` torna-se o repo canónico para versionar este housekeeping do host, eliminando a cópia solta na raiz do MAIATRON.

## [2.0.0] - 2026-03-10

### Adicionado
- Histórico de disco em GB por janela (`1h/24h/7d/30d`) com novos campos:
  - `disk_total_gb_avg`
  - `disk_used_gb_avg`
  - `disk_free_gb_avg`
  - `disk_growth_gb_h_avg`
- Novo gráfico no frontend (tab Disk): **Crescimento de Espaço em Disco (janela)** com séries `used GB` + `growth GB/h`.
- Novo gráfico dedicado no frontend (tab DB): **Consumo e Crescimento DB (janela)** separado do throughput `QPS/TPS`.
- Hints operacionais nos novos gráficos com semântica `Atual + Média janela`.

### Alterado
- `src/db_writer.py`: `fetch_summary` passou a agregar também os campos de disco em GB.
- `scripts/export_payload.py`: enriquecimento/fallback de histórico de disco para dados antigos sem colunas GB, mantendo compatibilidade.
- `scripts/weekly_archive.py`: snapshots semanais passam a incluir métricas de disco em GB e crescimento/h.
- `apps/warden/api.php`: ingest/fallback 30d estendidos para persistir e servir os novos campos de disco em GB/crescimento.
- `apps/warden/warden.js` e `index.html`: integração dos novos gráficos no ciclo de range + controlos de zoom/reset/ampliar.

## [1.0.2] - 2026-02-25

### Alterado
- **Slack Alerts (`scripts/slack_alerts.py`):** alerta inicial (`warning`/`critical`) passa a exigir persistência acima do threshold por uma janela temporal antes de enviar para Slack (anti-spike).
- **Slack Alerts (`scripts/slack_alerts.py`):** escalonamento para `critical` só dispara imediatamente após o alerta já ter sido confirmado/notificado.
- **Slack Alerts (`scripts/slack_alerts.py`):** recoveries e eventos `resolved` deixam de ser emitidos para spikes curtos que nunca geraram notificação.
- **Slack Events / Digest:** eventos `firing`/`resolved` em `runtime/slack_alert_events.jsonl` passam a refletir alertas confirmados, reduzindo ruído no digest diário.
- **Config:** novo parâmetro `SLACK_ALERT_SUSTAIN_MINUTES` adicionado em `src/settings.py` e `.env.example` (default `2`).

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
