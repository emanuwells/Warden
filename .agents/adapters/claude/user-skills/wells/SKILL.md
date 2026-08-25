---
name: wells
description: Executa uma tarefa através do router WELLS do projeto.
disable-model-invocation: true
argument-hint: "<tarefa>"
---

Lê `.agents/AGENTS.md` como contrato canónico do projeto e executa a tarefa abaixo.
Segue o routing progressivo definido nesse ficheiro: não carregues antecipadamente
`INDEX.md`, todas as skills, workflows, políticas ou o repositório inteiro.

Tarefa: $ARGUMENTS
