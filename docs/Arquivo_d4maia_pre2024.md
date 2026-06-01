# Arquivo d4maia — tabelas pré-2024

Arquivar tabelas do schema `d4maia` cujo **nome contém ano 2020–2023**, com dump local e remoção em produção após verificação.

## Critério

| Incluir (arquivar + DROP) | Excluir (manter) |
|---|---|
| `c15mta2020*`, `2021*`, `2022*`, `2023*` | `2024`, `2025`, `2026` no nome |
| | Tabelas sem ano (`Consumo15m`, `c15mta`, `ptd`, …) |

## Pré-requisitos

- `secrets/production.deploy.local.env` e `secrets/environments.local.json` (copiar de WELLS_API)
- `secrets/.ssh/id_ed25519`
- ≥10 GB livres em `C:\Users\cmm1490\Downloads`

## Comandos

```powershell
# Inventário
.\scripts\archive-d4maia-pre2024.ps1 -Phase inventory

# Dump (stream SSH → PC)
.\scripts\archive-d4maia-pre2024.ps1 -Phase dump

# Verificar antes de apagar
.\scripts\archive-d4maia-pre2024.ps1 -Phase verify

# DROP (só após verify OK)
.\scripts\archive-d4maia-pre2024.ps1 -Phase drop

# Pipeline completo
.\scripts\archive-d4maia-pre2024.ps1 -Phase all
```

## Destino local

```text
C:\Users\cmm1490\Downloads\d4maia\
  manifest.json
  verify-report.txt
  tables\{nome}.sql.gz
```

## Restaurar uma tabela

```bash
gunzip -c tables/c15mta2021IP.sql.gz | mysql -u USER -p d4maia
```

## Segurança

- Não commitar `secrets/environments.local.json` nem passwords.
- Sem DROP se algum dump falhar verificação gzip.

## Notas técnicas

- A fase `drop` valida existência com a lista completa `SHOW TABLES` no servidor (evita `SHOW TABLES LIKE '...'` dentro do comando SSH, que pode falhar silenciosamente por conflito de aspas).
- Reexecutar `-Phase drop` é seguro: só faz `DROP` se a tabela ainda existir e o `.sql.gz` local passar teste gzip.
