# Hooks WELLS

Os hooks universais vivem em `.agents/extensions/hooks/`. Hooks personalizados começam desativados; `safe-output-hygiene` é o único built-in ativo por defeito e executa apenas higiene textual conservadora sem LLM. Workflows de qualquer agente podem executar hooks explicitamente.

No Claude Code, o plugin pessoal WELLS inclui `project-hooks.mjs`, que descobre os
hooks ativados do projeto nos eventos suportados sem exigir `.claude/` no projeto.
O dispatcher não usa shell nem LLM e só aceita handlers JavaScript dentro da pasta
do próprio hook.

Eventos ligados pelo plugin: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse` e `Stop`. O ficheiro `hook.json` controla eventos, matcher, prioridade,
timeout e `failureMode`.
