---
name: safe-refactor
description: Executa refactors estruturais seguros por fases. Use quando o pedido envolver refactor, reorganização, migração, dívida técnica, limpeza estrutural ou separação de responsabilidades.
---


# Safe Refactor

## Processo

1. Ler `AGENTS.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md` e `docs/ai/policies/SAFE_REFACTOR_POLICY.md`.
2. Mapear comportamento atual e dependências.
3. Identificar ficheiros afetados.
4. Propor fases pequenas.
5. Definir validações e rollback.
6. Esperar autorização antes de alterar código, salvo se o pedido já autorizou execução.
7. Executar uma fase de cada vez.
8. Validar.
9. Atualizar tasks, changelog e documentação.

## Saída obrigatória antes de código

- diagnóstico;
- plano por fases;
- ficheiros afetados;
- riscos;
- comandos de validação;
- rollback.
