# Visão Geral da Arquitetura — Warden

## Objetivo do Sistema

Runtime de monitorização agnóstico de plataforma. Recolhe métricas de sistema (CPU, RAM, disco, rede, processos) e MariaDB, persiste em `Warden.warden_metrics`, exporta snapshots JSON para consumo por qualquer API/UI e envia alertas Slack.

## Contexto

| Campo | Valor |
|---|---|
| Domínio | Monitorização de infraestrutura e base de dados |
| Utilizadores principais | Operadores de sistemas, equipa de infraestrutura |
| Sistemas externos | MariaDB, canal de alertas (Slack), HUB/plataforma host (API/UI opcional) |
| Dados críticos | Métricas de sistema, snapshots JSON, eventos de alerta |
| Restrições técnicas | Python 3.10+, MariaDB, systemd/cron, Docker opcional |

## Componentes

| Componente | Responsabilidade | Tecnologia | Observações |
|---|---|---|---|
| Collector | Recolha de métricas de sistema e DB | Python 3 + psutil | `src.warden`, executado por systemd/cron |
| DB Writer | Persistência em MariaDB | Python 3 + PyMySQL | `src/db_writer.py` |
| Export | Geração de snapshots JSON | Python 3 | `scripts/export_payload.py` |
| Warden Clean | Limpeza de métricas antigas | Python 3 | `scripts/warden_clean.py` |
| Slack Alerts | Alertas imediatos e digest diário | Python 3 + requests | `scripts/slack_alerts.py`, `scripts/slack_daily_digest.py` |
| API/UI | Interface web para visualização | PHP + estáticos | `public/` (publicável no HUB do host) |

## Fluxo Principal

```text
src.warden (collector, COLLECT_INTERVAL) --> MariaDB (warden_metrics)
cron fast/heavy/full --> export_payload.py --> runtime/export/*.json
cron/systemd --> warden_clean.py --> MariaDB (cleanup)
cron/systemd --> slack_alerts.py --> canal de alertas
cron/systemd --> slack_daily_digest.py --> canal de alertas
runtime/export/*.json --> api.php (ops_fast / ops_heavy) --> UI (polling)
```

Detalhe do pipeline e roadmap Fase 2: `docs/architecture/warden-pipeline.md`.

## Fronteiras

### Dentro do sistema

- Collector, export, Warden Clean, Slack alerts/digest.
- Persistência em MariaDB (schema `Warden`).
- Snapshots JSON em `runtime/export/`.

### Fora do sistema

- MariaDB (dados de monitorização).
- Slack (notificações).
- HUB/plataforma host (API PHP e UI).
- Sistema operativo (métricas via psutil).

## Riscos Arquiteturais

| Risco | Mitigação |
|---|---|
| Disco cheio no host | Runbook limpeza, `warden_clean` |
| Alertas duplicados | Cooldown, `SLACK_ALERT_MAX_NOTIFICATIONS` |
| API/UI em produção sem sessão | Smoke aceita 401 sem sessão em dev |

## Dívida Técnica Conhecida

- CI/CD não configurado.
- Sem suite de testes automatizada.
- Validar `User`/`Group` em `deploy/systemd/warden.service` no deploy real.
