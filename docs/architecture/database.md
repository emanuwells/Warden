# Arquitetura de Base de Dados — Warden

## Tecnologia

| Campo | Valor |
|---|---|
| Motor | MariaDB/MySQL |
| Schema | `Warden` |
| Tabela principal | `warden_metrics` |
| Ambiente local | `.env` + `secrets/database.json` |
| Produção | BAZE2 — SSH tunnel ou acesso direto |

## Modelo de Dados

| Entidade/Tabela | Responsabilidade | Dados sensíveis | Observações |
|---|---|---|---|
| `Warden.warden_metrics` | Métricas de sistema e DB | Não | Retenção configurável (`RETENTION_DAYS`) |

### Schema `warden_metrics`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | Chave primária |
| `timestamp` | DATETIME | Momento da recolha |
| `cpu_percent` | FLOAT | Uso de CPU |
| `memory_percent` | FLOAT | Uso de memória |
| `disk_*` | FLOAT | Métricas de disco |
| `network_*` | FLOAT | Métricas de rede |
| `processes_*` | TEXT | Top processos |
| `db_history_*` | FLOAT | Crescimento DB |

## Regras

- Usar migrações manuais via `warden.py --setup`.
- Evitar alterações destrutivas sem plano de rollback.
- Não guardar segredos em texto claro.
- Não executar operações destrutivas contra produção sem confirmação explícita.

## Performance

| Query | Frequência | Índice |
|---|---|---|
| INSERT métricas | A cada 5 min (cron) | Chave primária em `id` |
| SELECT histórico | UI (30s refresh) | Índice em `timestamp` |

## Backup e Rollback

- Estratégia produção: backup MariaDB gerido externamente.
- Rollback: `warden_clean` remove métricas antigas; dados antigos retidos conforme `RETENTION_DAYS`.