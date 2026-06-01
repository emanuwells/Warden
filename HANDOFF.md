# HANDOFF

## Metadados

| Campo | Valor |
|---|---|
| Última atualização | 2026-06-01 |
| Objetivo atual | Manter repo e documentação alinhados com `AGENTS.md` |
| Estado | Arquivo d4maia concluído; auditoria docs/README concluída |
| Última versão registada | 2.0.6 |
| Bloqueios | Nenhum |

## Objetivo / estado

| Área | Concluído | Em curso | Por fazer |
|---|---|---|---|
| d4maia pré-2024 | 16 dumps + verify + DROP | — | — |
| Limpeza BAZE2 | Warden + CleanTron | — | Monitorizar `df` |
| Documentação | README 2.0.6, PROJECT_CONTEXT, lessons | — | Licença (`LICENSE`) A confirmar; CI A confirmar |

## Produção BAZE2 — Arquivo d4maia (pré-2024)

| Métrica | Antes | Depois |
|---|---|---|
| `/` uso | ~98% (~2 GB livres) | **~89% (~11 GB livres)** |
| Tabelas `d4maia` ano 2020–2023 | 16 | **0** |
| Dumps locais | — | `C:\Users\cmm1490\Downloads\d4maia\tables\*.sql.gz` |

Rollback: `gunzip -c tables/NOME.sql.gz | mysql -u USER -p d4maia` (ver `docs/Arquivo_d4maia_pre2024.md`).

## Decisões técnicas

- Path canónico runtime: `/home/eferreira/MAIATRON/Warden`.
- Deteção de tabela no DROP: lista `SHOW TABLES` completa (não `SHOW TABLES LIKE` via SSH com aspas).
- MCP: não versionado no repo.

## Abordagens falhadas (registo)

- `SHOW TABLES LIKE 'tabela'` no comando SSH remoto → SQL mal formado → falso “tabela ausente” e SKIP indevido no DROP.

## Riscos de segurança

- `secrets/*` e passwords só em ficheiros locais gitignored.
- Não repetir credenciais em HANDOFF, README ou CHANGELOG.

## Testes e validação

- d4maia: 16/16 `dump_ok`, verify-report OK, DROP confirmado (`SHOW TABLES` sem 2020–2023).
- README: alinhado com checklist `AGENTS.md` (badges, Mermaid, estrutura, secções obrigatórias).

## Ficheiros relevantes

- `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`
- `scripts/archive-d4maia-pre2024.ps1`, `docs/Arquivo_d4maia_pre2024.md`
- `scripts/run-production-cleanup.ps1`, `docs/Producao_Acesso_e_Limpeza.md`

## Estado Git

- Branch: A confirmar no ambiente local.
- Alterações pendentes de commit: documentação e scripts versionados (não incluir `secrets/`).

## Skills usadas (auditoria)

- `repo-onboarding`, `documentation-keeper`, `handoff-maintainer`, `changelog-semver`, `definition-of-done`, `security-secrets-audit`.

## MCP

- N/A — sem configuração MCP versionada no repositório.

## ADRs

- Nenhum ADR aplicado; template em `docs/adr/0000-template.md`.

## Próximo passo

1. Definir licença (`LICENSE`) se o projeto for público.
2. Monitorizar `df -h` semanalmente; cron CleanTron (domingo 03:20).
3. Opcional: `OPTIMIZE TABLE` em `d4maia` se espaço InnoDB não refletir no `df`.
4. Validar CI/CD e branch principal (marcados A confirmar).

## Scripts

```powershell
.\scripts\archive-d4maia-pre2024.ps1 -Phase verify
.\scripts\run-production-cleanup.ps1
.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand "df -h /"
```
