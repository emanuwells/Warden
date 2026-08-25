---
name: code-review
description: Revê alterações com foco em bugs reais, regressões, segurança, testes e conformidade, reportando apenas problemas acionáveis e sustentados por evidência.
---

# Code Review

1. Determinar o diff e o objetivo da alteração.
2. Rever primeiro correção funcional, segurança, dados, concorrência e compatibilidade.
3. Confirmar cada problema no código, testes, histórico ou documentação aplicável.
4. Atribuir confiança de 0 a 100 e omitir observações abaixo de 80, salvo risco crítico.
5. Indicar `ficheiro:linha`, impacto e correção mínima.
6. Não comentar estilo coberto por formatter nem pedir refactors fora do âmbito.
7. Usar o plugin oficial Anthropic `/code-review` quando instalado; caso contrário, usar o workflow WELLS de qualidade.
