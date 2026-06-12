# Changelog

Todas as alterações notáveis ao projeto **Warden** serão documentadas aqui.

## [Unreleased] - 2026-06-11

### Adicionado
- Alertas Slack imediatos passam a suportar warnings e criticals com limite de `SLACK_ALERT_MAX_NOTIFICATIONS` por incidente.
- Digest Slack diário passa a incluir alertas ainda ativos, destacando incidentes que já atingiram o limite de notificações.
- Runner `scripts/warden_clean.sh` para expor a limpeza conservadora ao Overseer como `# overseer:warden_clean`.

### Alterado
- A limpeza operacional fica concentrada no runner `warden_clean`, agendado pelo Overseer.
- `scripts/warden_clean.sh` passa a estar versionado como executável para uso direto em Linux/produção.
- Slack digest diário ajustado para `08:30` nos exemplos de cron, scheduler Docker e defaults de configuração.
- Estrutura de agentes consolidada em `.agents/`, com documentação a apontar para o handoff, políticas e Skills canónicas.
- Crontab real em BAZE2 atualizado para executar `scripts/slack_daily_digest.py` às `08:30`, com backup remoto antes da alteração.
- `COMMANDS.md` reescrito com comandos reais do Warden, removendo placeholders genéricos.
- Inventário de Skills consolidado em `.agents/skills/README.md`.

### Removido
- Script e documentação do housekeeping antigo; `warden_clean` é agora o único contrato de limpeza do Warden.
- Duplicação de documentação operacional auxiliar na raiz, mantendo a raiz focada em ficheiros de entrada do projeto.
- `SKILLS.md` e placeholders vazios em `tasks/`, por duplicarem informação sem valor operacional.
- Auditoria agressiva de higiene não identificou ficheiros versionados obsoletos seguros para remoção adicional; compatibilidade `.claude/`, `public/`, `deploy/hub/` e exemplos de secrets permanecem intencionais.

## [2.1.0] - 2026-06-01

### Adicionado
- `LICENSE` (MIT) e `VERSION` na raiz — padrão alinhado com WELLS_API.
- Campo `app_version` nas respostas JSON da API (`WARDEN_VERSION` / ficheiro `VERSION`).

### Alterado
- Estrutura `public/`: removido wrapper legado `public/backend/public/`; dev local só `public/www/` + `public/backend/`.
- `docker-compose.yml` passa a incluir `docker-compose.dev.yml` (um comando `docker compose up`).
- Documentação e badges atualizados para 2.1.0.

## [2.0.9] - 2026-06-01

### Adicionado
- `docker-compose.sync.yml`, `Dockerfile.sync`, `scripts/docker-sync-prod-entry.sh` — serviço one-shot com venv, pip e SCP read-only dos snapshots de produção para `runtime/export/`.
- `scripts/sync-prod-snapshots.ps1`, `.env.prod-sync.example` — orquestração Windows para validar UI local com JSON reais.

### Alterado
- `scripts/start-warden-dev.ps1` — aviso a sugerir `sync-prod-snapshots.ps1` quando snapshots em falta.
- Documentação: `README.md`, `PROJECT_CONTEXT.md`, `HANDOFF.md`, `docs/Warden_Public_Deploy.md`.

## [2.0.8] - 2026-06-01

### Adicionado
- `public/www/` — UI/API genérica em `http://127.0.0.1:8080/` (sem path MAIATRON, sem login em dev).
- `deploy/hub/` — fatia para publicação no MAIATRON-HUB (produção BAZE).
- `public/www/dev-auth-stub.js`, `WARDEN_DEV_SKIP_AUTH` na API.

### Alterado
- Docker nginx: web root `public/www`; URLs e documentação alinhadas.
- `import-public-from-prod.ps1` / `publish-public.ps1` usam `deploy/hub/`.

## [2.0.7] - 2026-06-01

### Adicionado
- Pasta [`public/`](public/) com UI/API Warden (import de `MAIATRON-HUB`).
- Docker dev: `docker-compose.dev.yml`, `Dockerfile.php`, `docker/nginx/`, `scripts/start-warden-dev.ps1`.
- `docker-compose.pipeline.yml` (collector/scheduler, separado do web).
- `scripts/import-public-from-prod.ps1`, `scripts/publish-public.ps1`, [`docs/Warden_Public_Deploy.md`](docs/Warden_Public_Deploy.md).

### Removido
- `scripts/archive-d4maia-pre2024.ps1`, `docs/Arquivo_d4maia_pre2024.md` (operação d4maia concluída).

### Alterado
- README, PROJECT_CONTEXT, HANDOFF: paths MAIATRON-HUB; sem referências operacionais a d4maia.
- `docker-compose.yml` passa a stack web local (pipeline em ficheiro dedicado).

## [2.0.6] - 2026-06-01

### Adicionado
- `.dockerignore` para builds Docker do pipeline.

### Alterado
- `README.md`: reestruturado conforme `AGENTS.md` (badges, funcionalidades, stack, Mermaid, árvore, requisitos, troubleshooting, licença A confirmar).
- `PROJECT_CONTEXT.md`, `HANDOFF.md`, `tasks/lessons.md`, `tasks/todo.md`: alinhamento pós-auditoria.

## [2.0.5] - 2026-06-01

### Alterado
- `README.md`: documentação de governança (AGENTS, Skills, HANDOFF), MCP, API MAIATRON, operações BAZE2 (arquivo `d4maia`, SSH).

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
- `README.md` e `docs/Guia_Producao_Step_by_Step.md`: ligações ao runbook e nota sobre legado `/opt/warden`.

## [2.0.1] - 2026-03-12

### Alterado
- Histórico de housekeeping antigo removido da documentação operacional ativa em favor de `warden_clean`.

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
