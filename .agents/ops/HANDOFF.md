# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-19 |
| Objetivo atual | Alinhamento prod/git, Warden Clean seguro e desacoplamento agnóstico de plataforma |
| Estado | Concluído — local, origin e produção em `27aca6a` |
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
- Git remoto: `27aca6a` (`main...origin/main` limpo)
- Serviço `warden`: active
- Cron `warden_clean`: 1 linha `# overseer:warden_clean`
- Overseer manifest: `cwd` em `$WARDEN_RUNTIME_ROOT` — compatível com novo `warden_clean.sh` (fallback por diretório)
- Disco `/`: 90% (84G/98G) em 2026-06-19 pós-limpeza
- Export fast: OK (`export_payload.py --mode fast`)
- Snapshots: `warden_fast_snapshot.json` (67K), `warden_heavy_snapshot.json` (17M) atualizados
- API HUB: 403 sem sessão (esperado); ficheiro `api.php` presente no HUB

### Smoke 2026-06-19 (final)

| Verificação | Resultado |
|---|---|
| `git push` + `git pull --ff-only origin main` (prod) | OK → `27aca6a` |
| `systemctl is-active warden` | active |
| `export_payload.py --mode fast` | OK |
| `warden_clean.sh --dry-run` (só `cwd`, como Overseer) | OK (sem WARN) |
| `df -h /` | 90% |

## Warden Clean

- `scripts/warden_clean.sh` exige `WARDEN_ROOT`/`WARDEN_RUNTIME_ROOT` ou execução a partir do diretório do runtime.
- Lista PRESERVE documentada no script e em `docs/Producao_Acesso_e_Limpeza.md`.
- `WARDEN_CRONTAB_LOG_DIR` opcional para truncar logs do runner Overseer.

## Próximo passo

1. Monitorizar disco (90%) e log do cron `warden_clean` às 01:00.
2. `publish-public.ps1` só após validação explícita, quando houver alterações em `public/` no HUB.
3. Opcional: definir `WARDEN_CRONTAB_LOG_DIR` no runner Overseer para truncar logs de crontab do host.

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `quality-gate-runner`, `ssh-server-ops`, `professional-documentation`
- MCP: N/A
