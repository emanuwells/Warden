# Arquitetura Frontend — Warden

## Stack

| Campo | Valor |
|---|---|
| Tipo | Dashboard estático (HTML/JS) + API PHP |
| UI | Design system do host (dark/light mode quando integrado) |
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
    apps/warden/          # API PHP canónica + adaptador auth do host
      api.php
      warden.js
      index.html
```

## Regras

- UI é estática e consome JSON da API PHP.
- Auth do host em produção; smoke aceita 401 em dev local (`WARDEN_DEV_SKIP_AUTH`).
- Snapshots em `runtime/export/` devem existir para UI funcionar.

## Integração com API

| Endpoint | Responsabilidade | Auth |
|---|---|---|
| `api.php?action=ops_fast` | Snapshot leve | Sessão do host (se ativa) |
| `api.php?action=ops_heavy` | Snapshot pesado | Sessão do host (se ativa) |
| `api.php?action=full` | Payload completo | Sessão do host (se ativa) |

## Testes Esperados

- Smoke local: `curl -I http://127.0.0.1:8080/`
- Smoke API: `curl -s "http://127.0.0.1:8080/api.php?action=ops_fast" | head`
