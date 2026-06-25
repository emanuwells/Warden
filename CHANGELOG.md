# Changelog

Todas as alterações notáveis ao projeto **Warden** serão documentadas aqui.

## [Unreleased] - 2026-06-25

### Alterado
- Jobs operacionais (`warden_db_backup`, `warden_system_info`, `warden_webserver_backup`): notificações Slack só em falha, no canal Overseer (`#overseer`), alinhado com o padrão do Overseer.

## [Unreleased] - 2026-06-22

### Adicionado
- `scripts/weekly_archive.py --prune-only`: retenção de arquivos semanais sem gerar novo arquivo.
- `scripts/warden_clean.sh`: invoca prune semanal diário; remove `WARDEN_NGINX_TEMP_DIR` órfão (>1 dia).
- `scripts/run-production-cleanup.ps1`: diagnóstico alargado (top consumers, binlogs, journald) e purga binlogs pós-limpeza.
- `scripts/host-hygiene.sh`: remove revisões snap desactivadas e define `refresh.retain` (default 2) no cron diário.

### Corrigido
- API Warden (`api.php`): bloco `operations` propagado em payloads `fast`, `heavy` e `full` para a aba Info do HUB.
- Frontend HUB (`warden.js`): merge de `operations` nos snapshots fast/heavy.

### Alterado
- `.env.example` e `secrets/mariadb-dump.cnf.example`: paths Warden nativos (sem `BaZe_Management`).
- `scripts/warden_clean.sh`: lê `WARDEN_CLEAN_*` do `.env`, trunca `slack_alert_events.jsonl` e remove state antigo de `operational_jobs/`.
- `COMMANDS.md`: documenta `warden_clean.sh` com flags via `.env`.

## [Unreleased] - 2026-06-22

### Adicionado
- Módulos operacionais `warden_db_backup`, `warden_system_info` e `warden_webserver_backup` em `scripts/`.
- `src/operational_jobs.py`, `src/operational_paths.py` e `scripts/run_operational_job.py`.
- Bloco `operations` nos snapshots `fast`/`heavy`/`full` via `export_payload.py`.
- Tab **Info** no frontend HUB (`deploy/hub/`) com inventário de sistema e estado dos jobs.
- Linhas Overseer no `scripts/crontab.example` para os três novos jobs.

### Alterado
- `.env.example` com variáveis de paths operacionais e exemplo `secrets/mariadb-dump.cnf.example`.

## [Unreleased] - 2026-06-22

### Alterado
- `src/warden_clean.py` passa a suportar manutenção DB opcional: purga configurável de binlogs e compactação de tabelas Warden com limiar mínimo de espaço livre interno.
- `scripts/warden_clean.py` expõe `--purge-binlogs-days` e `--optimize` para execução pontual controlada.
- `.env.example`, `README.md`, `COMMANDS.md` e runbook de produção documentam as novas opções de manutenção DB.

### Operação
- Produção: purga de binlogs MariaDB mantendo 2 dias e compactação de tabelas Warden; `/` passou de 97% para 79% usado.
## [Unreleased] - 2026-06-19

### Adicionado
- Pipeline Fase 2: `src/fast_snapshot.py` exporta fast após cada collect (`EXPORT_FAST_ON_COLLECT`).
- `scripts/export_fast_fallback.sh` — cron fallback inteligente (só se snapshot >30s).
- `scripts/patch-crontab-phase2-fast.sh` — migração idempotente do cron fast.
- `docs/Warden_Pipeline.md` — Fase 1 (checklist operacional) e desenho Fase 2.
- `docs/adr/0001-warden-dual-snapshot-pipeline.md` — ADR do pipeline dual snapshot.
- `scripts/validate-pipeline.sh` — validação de frescura dos snapshots e serviço `warden`.
- `warden-paths.local.php.example` e loader em `api.php` para paths locais no HUB sem alterar php-fpm.
- Secção "Warden Clean — o que nunca apaga" no README e runbook de produção.
- Bloco PRESERVE em `scripts/warden_clean.sh`.
- `EXPORT_FAST_PATH`, `EXPORT_HEAVY_PATH`, `WEEKLY_ARCHIVE_RETENTION_WEEKS` em `.env.example`.
- Job cron `export_payload.py --mode full` (15 min) em `scripts/crontab.example` e `scripts/docker.crontab`.
- `scripts/host-hygiene.sh` e `scripts/host-hygiene.sudoers` — higiene diária de logs SO e artefactos `.bak` (cron `# overseer:host_hygiene`).

### Corrigido
- `warden.py` na raiz — entrypoint legacy para systemd que apontava para ficheiro inexistente.
- `scripts/install-warden-systemd.sh` — instala unit com `python -m src.warden`.
- Export fast em modo `cache_only` evita bloqueio de ~12s no cron/collector (process tops só via heavy).
- Cron fast 2s restaurado como lane primária (modelo Task Manager); collector só persiste na DB.
- `EXPORT_FAST_ON_COLLECT=0` por defeito — export inline opcional, não bloqueante recomendado.
- `export_payload.py` envia logs INFO para stdout (evita crescimento de `export_fast.err.log`).

### Alterado
- Cron fast: de 30×/min para fallback 1×/min (`crontab.example`, `docker.crontab`).
- `validate-pipeline.sh`: limiar fast derivado de `COLLECT_INTERVAL + 10s`.
- `scripts/warden_clean.sh` delega logs SO/apt a `host-hygiene.sh`.
- `scripts/run-production-cleanup.ps1` inclui passo `host-hygiene` (`-SkipHostHygiene` opcional).
- Documentação (README, PROJECT_CONTEXT, COMMANDS, docs/*) desacoplada de branding de plataforma específica.
- `scripts/warden_clean.sh` exige `WARDEN_ROOT`/`WARDEN_RUNTIME_ROOT` (fallback: diretório atual com `scripts/warden_clean.py`).
- `api.php` resolve snapshots via `WARDEN_RUNTIME_ROOT` em vez de paths hardcoded.
- `systemd/warden.service` passa a template genérico com paths de exemplo.
- `secrets/production.deploy.local.env.example` usa paths genéricos configuráveis.

### Mantido (integração host)
- Libs `maiatron-auth*.php` como adaptador opcional da plataforma host.
- Valores legacy de lock MySQL e fallbacks `MAIATRON_*` na API para compatibilidade.

## [Unreleased] - 2026-06-11

### Adicionado
- `src/warden.py` como implementação canónica e única do CLI Python.
- Dockerfiles e Compose especializados centralizados em `docker/`, mantendo `docker-compose.yml` na raiz como wrapper do stack web local.
- `scripts/warden_clean.sh` passa a cobrir temporários seguros do servidor, cache apt, logs textuais SQL grandes e limpeza Docker conservadora.
- Alertas Slack imediatos passam a suportar warnings e criticals com limite de `SLACK_ALERT_MAX_NOTIFICATIONS` por incidente.
- Digest Slack diário passa a incluir alertas ainda ativos, destacando incidentes que já atingiram o limite de notificações.
- Runner `scripts/warden_clean.sh` para expor a limpeza conservadora ao Overseer como `# overseer:warden_clean`.
- `warden_clean` passa a remover temporários atómicos antigos, cache runtime regenerável, caches Python, bytecode e ficheiros de editor/sistema dentro de `WARDEN_ROOT`, preservando snapshots ativos, backups, secrets, virtualenvs e dados.

### Alterado
- `systemd/warden.service`, Compose pipeline e documentação passam a usar `python -m src.warden`.
- Retenção de dados antiga fica exposta como `scripts/warden_clean.py`, removendo referências operacionais paralelas.
- A limpeza operacional fica concentrada no runner `warden_clean`, agendado pelo Overseer.
- `scripts/warden_clean.sh` passa a estar versionado como executável para uso direto em Linux/produção.
- Runbook de produção documenta o caso real em que o runner existe mas o crontab não contém `# overseer:warden_clean`, com correção por backup e inserção idempotente.
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
- `docker-compose.yml` passa a incluir `docker/compose.dev.yml` (um comando `docker compose up`).
- Documentação e badges atualizados para 2.1.0.

## [2.0.9] - 2026-06-01

### Adicionado
- `docker/compose.sync.yml`, `docker/Dockerfile.sync`, `scripts/docker-sync-prod-entry.sh` — serviço one-shot com venv, pip e SCP read-only dos snapshots de produção para `runtime/export/`.
- `scripts/sync-prod-snapshots.ps1`, `config/env.prod-sync.example` — orquestração Windows para validar UI local com JSON reais.

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
- Docker dev: `docker/compose.dev.yml`, `docker/Dockerfile.php`, `docker/nginx/`, `scripts/start-warden-dev.ps1`.
- `docker/compose.pipeline.yml` (collector/scheduler, separado do web).
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
- **Warden Clean:** Sistema de auto-expiração de dados (30 dias configurável).
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
- **Cron:** Templates para export periódico e Warden Clean diário.
- **Secrets:** Gestão segura via `.env` + `secrets/database.json`.
