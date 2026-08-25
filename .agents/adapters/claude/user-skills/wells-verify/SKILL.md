---
name: wells-verify
description: Executa as validações WELLS adequadas ao risco da alteração.
disable-model-invocation: true
argument-hint: "[âmbito ou comando]"
---

Lê `.agents/AGENTS.md` e a skill `.agents/skills/quality-gate-runner/SKILL.md`.
Valida $ARGUMENTS usando apenas os comandos reais do projeto. Nunca declares um
resultado que não tenha sido executado e observado.
