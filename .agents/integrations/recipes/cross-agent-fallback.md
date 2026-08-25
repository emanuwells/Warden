# Fallback entre providers e agentes

## Provider/modelo

OmniRoute pode selecionar outro modelo/provider num perfil testado. Mantém-se
experimental porque altera endpoint, autenticação, routing e possivelmente compressão.

## Agente/CLI

Mudar de Claude Code para Codex, Gemini ou Cursor não transfere o estado automaticamente.
Antes da mudança:

```bash
node .agents/tools/agent-handoff.mjs --project . --target codex --reason quota --task "Tarefa" --apply
```

O agente seguinte lê `.agents/AGENTS.md`, `NEXT_AGENT.md` e apenas os ficheiros de
estado/evidência referenciados. Confirma branch e diff antes de continuar.
