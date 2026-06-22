# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo actual | Ops Center telemetria ~2s |
| Estado | Alinhado — `8090f43` local/origin/prod |
| Última versão registada | 2.1.0 (`VERSION`) |

## Fix Ops Center 2026-06-19

### Causa raiz

`warden.service` executava `warden.py` inexistente → collector em crash loop → `current.timestamp` com 60–80s de atraso → Ops Center mostrava "há 76s" e **ATENÇÃO** (telemetria stale).

### Correcção

- `warden.py` na raiz (shim para `src.warden`)
- `scripts/install-warden-systemd.sh` → `ExecStart=python -m src.warden`
- Prod: serviço **active**, validate **PASS**, fast idade **2s**

### Pipeline activo

| Lane | Estado |
|---|---|
| Collector 2s | active |
| Cron fast 2s | 30×/min |
| Ops Center poll | 1.2s (HUB) |

## Produção

- Pipeline: `/home/eferreira/MAIATRON/Warden`
- HUB: `/usr/share/nginx/html/MAIATRON-HUB`
- `COLLECT_INTERVAL=2`

## Limpeza DB Produção 2026-06-22

### Ações executadas

- `warden_clean` produção: reteve 7 dias e removeu linhas antigas do schema Warden.
- MariaDB binlogs: purga até `NOW() - INTERVAL 2 DAY`, sem replica ativa reportada por `SHOW REPLICA STATUS` / `SHOW SLAVE STATUS`.
- Tabelas Warden compactadas: `warden_ingest_registry`, `warden_alert_events`, `warden_metrics`.

### Resultado

| Métrica | Antes | Depois |
|---|---:|---:|
| `/` | 97% usado / 3.4G livres | 79% usado / 20G livres |
| Binlogs MariaDB | 194 ficheiros / ~18.58G | 98 ficheiros / ~9.39G |

### Notas operacionais

- Não foram limpos schemas de negócio (`d4maia`, `BAZE`, `GridVis_Torre_Lidador`).
- A manutenção DB adicional foi adicionada ao Warden Clean, mas continua dependente de configuração explícita para binlogs e `OPTIMIZE`.
- Confirmar política de backup/PITR antes de manter `WARDEN_CLEAN_BINLOG_RETENTION_DAYS=2` em produção.