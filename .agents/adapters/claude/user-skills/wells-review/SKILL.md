---
name: wells-review
description: Revê alterações através do workflow WELLS de qualidade.
disable-model-invocation: true
argument-hint: "[âmbito ou ficheiros]"
---

Lê `.agents/AGENTS.md`, `.agents/workflows/40-quality-review.md` e apenas as
skills selecionadas pelo router. Revê $ARGUMENTS com foco em bugs, regressões,
segurança, contratos, testes e documentação. Não alteres código sem pedido explícito.
