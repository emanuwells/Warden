# ADR 0001 — Pipeline dual snapshot (fast / heavy / full)

| Campo | Valor |
|---|---|
| Estado | Aceite (Fase 1 + Fase 2 em produção) |
| Data | 2026-06-19 |
| Decisores | Equipa Warden / infra |

## Contexto

O Ops Center e a UI Warden consomem métricas via `api.php` com polling. A fonte de verdade é MariaDB; gerar JSON a cada pedido HTTP seria caro e acoplado. Snapshots pré-computados permitem servir `ops_fast` em &lt;100ms.

Problemas anteriores:

- `warden_payload.json` parado (cron full em falta).
- Permissões `700` no HUB após deploy impediam leitura pelo PHP-FPM.
- Logs INFO do export em stderr inflacionavam `export_fast.err.log`.

## Decisão

Manter arquitectura em **três lanes** de snapshot:

1. **Fast** — near-real-time (CPU, RAM, rede, alertas actuais).
2. **Heavy** — histórico, processos, disk top (custo elevado).
3. **Full** — merge para fallback legacy e reconciliação.

O collector (`systemd`) persiste na DB; crons exportam JSON; a API faz merge e expõe `ops_fast` / `ops_heavy`.

### Fase 1 (actual)

- Crons: fast 30×/min, heavy */5, full */15.
- Thresholds stale: fast 12s, heavy 10 min.
- `COLLECT_INTERVAL=15` no collector.

### Fase 2 (implementada 2026-06-19)

- Collector invoca export fast após cada insert (`EXPORT_FAST_ON_COLLECT=1`).
- Cron fast: fallback 1×/min via `export_fast_fallback.sh`.
- Ver `docs/Warden_Pipeline.md`.

## Alternativas consideradas

| Alternativa | Motivo de rejeição (agora) |
|---|---|
| API-only sem JSON | Maior carga PHP/DB; quebra contrato agnóstico |
| WebSocket push | Complexidade frontend + infra; polling suficiente |
| Export fast só no collector (sem cron) | Risco de gap se collector reiniciar; Fase 2 mantém fallback |

## Consequências

### Positivas

- Latência previsível para Ops Center.
- Separação de custo (fast leve vs heavy pesado).
- Deploy HUB desacoplado do runtime Python.

### Negativas

- Múltiplos crons fast (30/min) até Fase 2.
- Necessidade de alinhar permissões e paths em cada deploy.

## Validação

- `scripts/validate-pipeline.sh` no host.
- Smoke `ops_fast` HTTP 200 após deploy.
