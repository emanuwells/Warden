# Arquitetura de Deploy e Operação — Warden

## Ambientes

| Ambiente | URL/Host | Origem de configuração | Observações |
|---|---|---|---|
| Local (Docker) | `http://127.0.0.1:8080/` | `.env` + `secrets/database.json` | UI/API dev |
| Pipeline (Docker) | N/A (interno) | `.env.docker` | Collector + scheduler |
| Produção BAZE2 | `/home/eferreira/MAIATRON/Warden` | `.env` real | systemd + cron |

## Build

- Sem build tradicional (Python interpretado).
- Artefactos gerados: `runtime/export/*.json`, `runtime/logs/*.log`.
- Variáveis necessárias: `DATABASE_*`, `SLACK_*`, `EXPORT_PATH`.

## Deploy

| Plataforma | Método | Observações |
|---|---|---|
| Host Linux | `systemd` + `cron` | Path canónico: `/home/eferreira/MAIATRON/Warden` |
| Docker Pipeline | `docker/compose.pipeline.yml` | Collector + scheduler |
| Docker Dev | `docker-compose.yml` | UI/API local (Nginx + PHP-FPM) |

## Docker

| Ficheiro | Serviço | Função |
|---|---|---|
| `docker-compose.yml` | web (nginx + php-fpm) | UI/API local |
| `docker/compose.dev.yml` | web (include) | Configuração dev |
| `docker/compose.pipeline.yml` | warden-collector, warden-scheduler | Pipeline |
| `docker/compose.sync.yml` | warden-sync | SCP snapshots de produção |
| `docker/Dockerfile` | pipeline | Collector + scheduler |
| `docker/Dockerfile.php` | web | PHP-FPM standalone |
| `docker/Dockerfile.sync` | warden-sync | SCP read-only |

## Observabilidade

| Área | Ferramenta | Observações |
|---|---|---|
| Logs | `runtime/logs/` | Gitignored |
| Alertas | Slack webhooks | Imediatos + digest diário |
| Métricas | Dashboard UI | Auto-refresh 30s |
| Health | `python -m src.warden --once` | Smoke manual |

## Regras

- Nunca commitar `.env` real.
- Validar compose antes de deploy: `docker compose config`.
- Documentar rollback antes de mexer em produção.
- Separar segredos de configuração versionada (`secrets/*.example`).
