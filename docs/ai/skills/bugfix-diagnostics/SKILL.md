---
name: bugfix-diagnostics
description: Diagnostica e corrige bugs com causa provável, evidência, correção mínima e validação de regressão.
---


# Bugfix Diagnostics

## Processo

1. Recolher sintomas e contexto.
2. Localizar causa provável.
3. Corrigir com alteração mínima.
4. Adicionar ou propor teste de regressão.
5. Executar validação.
6. Registar aprendizagem em `tasks/lessons.md` quando for reutilizável.

## Proibido

- Reescrever componentes inteiros sem necessidade.
- Mascarar erro com `try/catch` genérico sem entender causa.
