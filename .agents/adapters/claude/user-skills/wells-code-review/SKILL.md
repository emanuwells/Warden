---
name: wells-code-review
description: Executa revisão WELLS ou delega no plugin oficial Anthropic quando disponível.
disable-model-invocation: true
---

# wells-code-review

Lê `.agents/AGENTS.md`, ativa `code-review` e `.agents/workflows/40-quality-review.md`. Revê o diff indicado, reporta apenas problemas acionáveis com confiança >=80 e valida com evidência.
