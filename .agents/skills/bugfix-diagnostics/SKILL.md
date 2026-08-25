---
name: bugfix-diagnostics
description: Diagnostica bugs e regressões com evidência, causa raiz, correção mínima e teste de regressão. Usar quando existe comportamento incorreto; não usar para features novas.
---

# Diagnóstico de bugs

1. Reproduzir ou delimitar o sintoma com dados concretos.
2. Formular hipóteses ordenadas por probabilidade e custo de verificação.
3. Inspecionar logs, estado, inputs e caminho de execução relevante.
4. Corrigir a causa mais próxima e não apenas o sintoma.
5. Adicionar ou executar teste de regressão.
6. Registar em `LESSONS.md` apenas quando a aprendizagem for reutilizável.

## Proibido

- Reescrever componentes inteiros sem evidência.
- Silenciar erros com `try/catch`, valores por defeito ou retries ilimitados.
- Declarar causa raiz sem reprodução, trace ou evidência equivalente.
