---
name: wells-release
description: Prepara uma release seguindo o workflow e a política WELLS.
disable-model-invocation: true
argument-hint: "[versão ou âmbito]"
---

Lê `.agents/AGENTS.md`, `.agents/workflows/50-release-handoff.md` e a política de
changelog aplicável. Prepara $ARGUMENTS com SemVer, validações, documentação,
changelog e artefactos proporcionais ao projeto.
