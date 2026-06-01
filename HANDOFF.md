# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-01 |
| Estado | Arquivo d4maia pré-2024 concluído |
| Última versão registada | 2.0.5 |

## Produção BAZE2 — Arquivo d4maia (pré-2024)

| Métrica | Antes | Depois |
|---|---|---|
| `/` uso | ~98% (~2 GB livres) | **~89% (~11 GB livres)** |
| Tabelas `d4maia` com ano 2020–2023 | 16 | **0** |
| Dumps locais | — | `C:\Users\cmm1490\Downloads\d4maia\tables\*.sql.gz` (16 ficheiros) |

### Executado

- Inventário via `SHOW TABLES` + tamanhos `.ibd` (sudo `du`).
- Dump `mysqldump | gzip` por tabela (stream SSH → PC).
- Verificação: gzip, SHA256, `COUNT(*)` remoto, `verify-report.txt` OK.
- `DROP TABLE` nas 16 tabelas após dumps validados.
- Correção no script: deteção de existência via `SHOW TABLES` completo (evitar `SHOW TABLES LIKE` com aspas no shell remoto).

### Tabelas removidas (exemplos)

`c15mta2021IP`, `c15mta2023IP`, `c15mta2022IP`, `c15mta2022IPold`, `c15mta2023PTD`, `c15mta2020IP`, … (16 no total; ver `manifest.json` local).

### Mantidas (sem drop)

Tabelas sem ano no nome (`Consumo15m`, `c15mta`, `ptd`, …) e tabelas **2024+** (`c15mta2024*`, etc.).

### Rollback

```bash
gunzip -c tables/NOME.sql.gz | mysql -u USER -p d4maia
```

## Produção BAZE2 — Limpeza 2026-06-01 (anterior)

- Janitor Warden + CleanTron: `/` passou de ~99% para ~98% antes do arquivo MySQL.
- `WARDEN_SUDO_PASSWORD` em `secrets/production.deploy.local.env` (gitignored).

## Skills / MCP

- Skills: `repo-onboarding`, `safe-git-operator`, `handoff-maintainer`, `changelog-semver`, `mysql-mariadb-dba`, `security-secrets-audit`.
- MCP: N/A para esta tarefa.

## Git

- Branch: A confirmar no ambiente local.
- Alterações versionáveis: script `archive-d4maia-pre2024.ps1`, `docs/Arquivo_d4maia_pre2024.md`, `HANDOFF.md`, `CHANGELOG.md`.

## Próximo passo

- Monitorizar `df -h` semanalmente; cron CleanTron (domingo 03:20).
- Opcional: `OPTIMIZE TABLE` em tabelas `d4maia` restantes se o espaço InnoDB não refletir totalmente no `df`.
- Não commitar `secrets/*` nem passwords de chat.

## Scripts

```powershell
.\scripts\archive-d4maia-pre2024.ps1 -Phase inventory
.\scripts\archive-d4maia-pre2024.ps1 -Phase dump
.\scripts\archive-d4maia-pre2024.ps1 -Phase verify
.\scripts\archive-d4maia-pre2024.ps1 -Phase drop
.\scripts\run-production-cleanup.ps1
```
