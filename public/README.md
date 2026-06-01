# public/ — fatia Warden do MAIATRON-HUB

Conteúdo publicável da app Warden (frontend + API), importado de produção.

| Path local | Destino em produção |
|---|---|
| `frontend/apps/warden/` | `/usr/share/nginx/html/MAIATRON-HUB/frontend/apps/warden/` |
| `backend/apps/warden/` | `.../backend/apps/warden/` |
| `backend/public/apps/warden/` | `.../backend/public/apps/warden/` |

`backend/core/shared/` existe apenas para builds Docker locais; **não** publicar com `publish-public.ps1` (partilhado pelo HUB).

Ver [`docs/Warden_Public_Deploy.md`](../docs/Warden_Public_Deploy.md).
