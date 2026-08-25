---
name: quality-gate-runner
description: Executa os critérios mínimos de qualidade adequados ao risco: lint, typecheck, testes, build, diff e segurança. Usar no fecho de tarefas não triviais.
---

# Executor de quality gates

1. Ler comandos reais em `COMMANDS.md` ou configuração da stack.
2. Selecionar apenas gates relacionados com o diff.
3. Antes dos gates finais, se houve alterações, executar `wells-finalize.mjs --changed --apply`.
4. Executar do mais rápido para o mais caro: format/lint, typecheck, testes focados, suite, build.
5. Resumir outputs extensos e preservar a mensagem de erro relevante.
6. Em release, auth, dependências, infra ou mudanças de risco, ativar `security-quality-gate` em fase separada; ferramenta ausente = cobertura incompleta.
7. Registar comando, resultado e limitações em `EVIDENCE.md` quando a tarefa for não trivial.
8. Nunca converter falha em sucesso por omissão.
