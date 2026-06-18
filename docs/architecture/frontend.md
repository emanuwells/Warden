# Arquitetura Frontend — Warden

## Stack

| Campo | Valor |
|---|---|
| Tipo | Dashboard estático (HTML/JS) + API PHP |
| UI | MAIATRON Design System (dark/light mode) |
| Refresh | Auto-refresh a cada 30 segundos |
| Responsivo | Mobile-first |

## Estrutura

```text
public/
  www/                    # UI/API local (Docker :8080)
    index.html            # Dashboard Warden
    warden.js             # Lógica de visualização
    api.php               # API local (dev)
  backend/
    apps/warden/          # API PHP canónica + auth MAIATRON
      api.php
      warden.js
      index.html
```

## Regras

- UI é estática e consome JSON da API PHP.
- Auth MAIATRON em produção; smoke aceita 401 em dev local.
- Snapshots em `runtime/export/` devem existir para UI funcionar.

## Integração com API

| Endpoint | Responsabilidade | Auth |
|---|---|---|
| `api.php?action=ops_fast` | Snapshot leve | MAIATRON session |
| `api.php?action=ops_heavy` | Snapshot pesado | MAIATRON session |
| `api.php?action=full` | Payload completo | MAIATRON session |

## Testes Esperados

- Smoke local: `curl -I http://127.0.0.1:8080/`
- Smoke API: `curl -s "http://127.0.0.1:8080/api.php?action=ops_fast" | head`
- Smoke produção: `curl -I http://127.0.0.1/MAIATRON/apps/warden/index.html`