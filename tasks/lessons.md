# Lições Aprendidas

Este ficheiro regista padrões de erro, correções e antipadrões a evitar.

## Regras

- Adicionar nova entrada após correções do utilizador, bugs recorrentes ou falhas de processo.
- Não apagar histórico antigo.
- Escrever regras acionáveis para evitar repetição.
- Referenciar ficheiros, comandos ou decisões quando aplicável.

## Entradas

### 2026-06-01 — DROP d4maia: falso SKIP por quoting SSH

**Contexto:** Fase `drop` de `scripts/archive-d4maia-pre2024.ps1` após dumps validados.

**Erro / Antipadrão:** `SHOW TABLES LIKE 'nome'` embutido em `mysql -e '...'` via SSH; aspas simples interiores quebram o SQL remoto. Saída vazia + exit ≠ 0 foi interpretada como “tabela ausente”.

**Correção:** `Get-RemoteD4maiaTableSet` com `SHOW TABLES` completo; comparar nomes em PowerShell. Não marcar `dropped` sem confirmar ausência na lista remota.

**Regra Para O Futuro:** Evitar `LIKE '...'` com aspas em comandos SSH one-liner; preferir listagem completa ou `SELECT COUNT(*)` sem aspas conflituosas no shell.

**Refs:** `scripts/archive-d4maia-pre2024.ps1`, `docs/Arquivo_d4maia_pre2024.md`

---

### YYYY-MM-DD — <Título Curto>

**Contexto:**
A confirmar.

**Erro / Antipadrão:**
A confirmar.

**Correção:**
A confirmar.

**Regra Para O Futuro:**
A confirmar.

**Refs:**
A confirmar.

---
