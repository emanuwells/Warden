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
