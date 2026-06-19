# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo atual | Alinhamento prod/git, Warden Clean seguro e desacoplamento agnóstico de plataforma |
| Estado | Produção alinhada em `b147e1f`; pipeline e export validados |
| Última versão registada | 2.1.0 (`VERSION`) |

## Local genérico (Docker)

| Item | Valor |
|---|---|
| URL UI | `http://127.0.0.1:8080/` |
| URL API | `http://127.0.0.1:8080/api.php` |
| Login | Desligado (`WARDEN_DEV_SKIP_AUTH`, `dev-auth-stub.js`, `data-warden-dev`) |
| Snapshots | `runtime/export/` — sync SCP de prod ou pipeline local |

```powershell
.\scripts\sync-prod-snapshots.ps1
.\scripts\start-warden-dev.ps1
```

## Produção

- Pipeline: `$WARDEN_RUNTIME_ROOT` (valor real no `production.deploy.local.env` local)
- HUB: `$WARDEN_HUB_ROOT` — publicar só `deploy/hub/` com `publish-public.ps1`
- Git remoto: `b147e1f` (`main...origin/main` limpo após `git pull --ff-only`)
- Serviço `warden`: active
- Cron `warden_clean`: 1 linha `# overseer:warden_clean`
- Disco `/`: 91% (85G/98G) em 2026-06-19
- Export fast: OK (`export_payload.py --mode fast`)
- Snapshots: `warden_fast_snapshot.json` (67K), `warden_heavy_snapshot.json` (17M) atualizados
- API HUB: 403 sem sessão (esperado); ficheiro `api.php` presente no HUB

### Smoke 2026-06-19

| Verificação | Resultado |
|---|---|
| `git pull --ff-only origin main` | OK → `b147e1f` |
| `systemctl is-active warden` | active |
| `export_payload.py --mode fast` | OK |
| `warden_clean.sh --dry-run` | OK (sem WARN) |
| `df -h /` | 91% |

## Warden Clean

- `scripts/warden_clean.sh` exige `WARDEN_ROOT`/`WARDEN_RUNTIME_ROOT` ou execução a partir do diretório do runtime.
- Lista PRESERVE documentada no script e em `docs/Producao_Acesso_e_Limpeza.md`.
- `WARDEN_CRONTAB_LOG_DIR` opcional para truncar logs do runner Overseer.

## Próximo passo

1. Aplicar alterações agnósticas em prod após commit/push (novo `warden_clean.sh` requer `WARDEN_ROOT` no runner Overseer).
2. `publish-public.ps1` só após validação explícita, quando houver alterações em `public/`.
3. Monitorizar disco (91%) — considerar limpeza real com `run-production-cleanup.ps1` após deploy do script atualizado.

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `quality-gate-runner`, `ssh-server-ops`, `professional-documentation`
- MCP: N/A
