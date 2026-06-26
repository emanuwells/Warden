# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-22 |
| Objetivo actual | Ops Center telemetria ~2s |
| Estado | Alinhado — `8090f43` local/origin/prod |
| Última versão registada | 2.1.0 (`VERSION`) |

## Fix Ops Center 2026-06-19

### Causa raiz

`warden.service` executava `warden.py` inexistente → collector em crash loop → `current.timestamp` com 60–80s de atraso → Ops Center mostrava "há 76s" e **ATENÇÃO** (telemetria stale).

### Correcção

- `python -m src.warden` como único entrypoint do collector
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

## Limpeza disco Produção 2026-06-22 (sessão 2)

### Diagnóstico

- `/` a **84%** (78G usados / 16G livres); binlogs MariaDB **83 ficheiros / ~7.87 GB**.
- Principais consumidores fora do Warden: `/eRedes` (~11G, dados de negócio), `/BackupNGINX` (2.9G), `/var/lib/snapd` (3.1G).
- `.env` produção já tinha `WARDEN_CLEAN_BINLOG_RETENTION_DAYS=2` e `WARDEN_CLEAN_OPTIMIZE_ENABLED=1`.

### Ações executadas

- `run-production-cleanup.ps1`: `warden_clean.sh` + `host-hygiene` + purga binlogs pontual.
- Scripts actualizados em prod: `warden_clean.sh` (`--prune-only` semanal, temp nginx), `weekly_archive.py`.
- Dry-run `warden_clean.sh` e `validate-pipeline.sh`: **PASS**.

### Resultado

| Métrica | Antes | Depois |
|---|---:|---:|
| `/` | 84% usado / 16G livres | 83% usado / 17G livres |
| Binlogs MariaDB | 83 ficheiros / ~7.87G | 77 ficheiros / ~7.29G |
| `warden.service` | active | active |

### Notas operacionais

- Libertação modesta (~1 GB): binlogs dentro da janela de 2 dias dominam o volume; não foram tocados `/eRedes`, schemas de negócio nem backups.
- Warden Clean diário passa a incluir prune de arquivos semanais e limpeza de `WARDEN_NGINX_TEMP_DIR` órfão.

## Limpeza snaps Produção 2026-06-22 (sessão 3)

### Ações

- `host-hygiene.sh`: purga de revisões snap `disabled` + `refresh.retain=2`.
- Sincronização local ↔ prod (`61bea8c`) e execução imediata de `run-production-cleanup.ps1`.

### Resultado

| Métrica | Antes | Depois |
|---|---:|---:|
| `/` | 83% usado / 17G livres | 83% usado / 17G livres |
| Revisão snap removida | chromium rev 3459 (disabled) | removida |
| `refresh.retain` | não definido | `2` |
| `warden.service` | active | active |

### Notas

- Apenas revisões `disabled` são removidas; snaps activos (chromium, docker, lxd, …) preservados.
- O volume `/var/lib/snapd` (~3.1G) reflecte snaps em uso; a retenção limita crescimento futuro.