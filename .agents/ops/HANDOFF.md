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
- HUB: `$WARDEN_HUB_ROOT` — publicado em 2026-06-19 (`publish-public.ps1`, backup `*.bak_20260619_115647`)
- HUB `api.php`: novo + `warden-paths.local.php` com paths do runtime
- ACL `www-data` em `runtime/` e `runtime/export/` para leitura dos snapshots
- Git remoto: ver abaixo
- Serviço `warden`: active
- Cron `warden_clean`: 1 linha `# overseer:warden_clean`
- Overseer manifest: `cwd` em `$WARDEN_RUNTIME_ROOT` — compatível com novo `warden_clean.sh` (fallback por diretório)
- Disco `/`: 90% (84G/98G) em 2026-06-19 pós-limpeza
- Export fast: OK (`export_payload.py --mode fast`)
- Snapshots: `warden_fast_snapshot.json` (67K), `warden_heavy_snapshot.json` (17M) atualizados
- API HUB: 403 sem sessão (esperado); ficheiro `api.php` presente no HUB

### Smoke 2026-06-19 (HUB publish)

| Verificação | Resultado |
|---|---|
| `publish-public.ps1` | OK — HUB `api.php` 19 Jun |
| `warden-paths.local.php` no HUB | OK — paths para `runtime/export/` |
| ACL `www-data` em `runtime/export` | OK |
| Snapshot fast legível + `generated_at` | OK (2026-06-19T10:58Z) |
| API `ops_fast` sem sessão | 403 (esperado) |

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

1. Validar Warden app e Ops Center no browser (com sessão) — dados devem refletir `generated_at` recente.
2. Monitorizar cron `warden_clean` às 01:00 (log ainda vazio).
3. Opcional: envs `WARDEN_*` no php-fpm pool (redundante se `warden-paths.local.php` existir).

## Skills / MCP (esta entrega)

- Skills: `repo-hygiene`, `quality-gate-runner`, `ssh-server-ops`, `professional-documentation`
- MCP: N/A
