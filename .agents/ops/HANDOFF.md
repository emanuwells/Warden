# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo atual | Host hygiene diário (logs SO + artefactos .bak) |
| Estado | Alinhado — local, origin e produção em `9ae9d85` |
| Última versão registada | 2.1.0 (`VERSION`) |

## Host hygiene (2026-06-19)

| Item | Valor |
|---|---|
| Script | `scripts/host-hygiene.sh` → `/usr/local/sbin/warden-host-hygiene` |
| Sudoers | `/etc/sudoers.d/warden-host-hygiene` (NOPASSWD) |
| Cron | `30 1 * * *` — `# overseer:host_hygiene` |
| Retenção `.bak` | 1 cópia mais recente por diretório |
| Backups NGINX/DB | **Intocados** (retenção 3 dias existente) |

### Execução manual 2026-06-19

| Métrica | Antes | Depois |
|---|---|---|
| `df -h /` uso | 83G / 98G (89%) | 82G / 98G (89%) |
| Espaço livre | 11G | 12G |

- Removidos artefactos `.bak` antigos em `MAIATRON-HUB` e `/usr/share/nginx/html` (api.bak_*, HUB.backup, secrets/*.bak_* antigos).
- Journald vacuum 7d, truncagem logs SO >50M, `apt-get clean`.
- API `ops_fast`: HTTP 200 pós-limpeza.

### Warden Clean 2026-06-19 (pós-push)

- `warden_clean.sh`: apagadas **8508 linhas** (>7 dias) em `warden_*`.
- Docker prune: ~97 MB recuperados.
- `df -h /`: 82G/98G (88%), serviço `warden` active.

### Pendente git

Nenhum — `9ae9d85` em local, `origin/main` e produção.

## Produção (Warden)

- Pipeline: `/home/eferreira/MAIATRON/Warden`
- HUB: `/usr/share/nginx/html/MAIATRON-HUB`
- Cron `warden_clean`: `# overseer:warden_clean` (01:00)
- Cron `host_hygiene`: `# overseer:host_hygiene` (01:30)
- Serviço `warden`: active

## Próximo passo

1. `git commit` + `push` das alterações versionadas (host-hygiene, docs, crontab.example).
2. Rotacionar password sudo (foi usada para instalar sudoers).
3. Monitorizar `crontab_host_hygiene.txt` após 01:30.

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `ssh-server-ops`, `professional-documentation`
- MCP: N/A
