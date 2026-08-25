---
name: agent-fallback-router
description: Escolhe continuidade segura entre perfis free/economical/premium, modelos, providers e agentes quando existe quota, falha, custo ou capacidade insuficiente.
---

# Routing de fallback

## Ordem

1. Classificar dificuldade/risco segundo `.agents/core/MODEL_ROUTING.md`.
2. Compactar contexto e tentar o mesmo agente numa classe adequada quando isso resolver a limitação.
3. Após uma falha útil, escalar `free → economical → premium`; não fazer loops de retries equivalentes.
4. Se o problema for provider/modelo, usar OmniRoute apenas num perfil testado.
5. Se for necessário mudar de CLI/agente, criar HANDOFF WELLS antes da transição.
6. O agente seguinte lê `.agents/AGENTS.md`, HANDOFF, TODO e evidência indicada.

OmniRoute não substitui handoff entre Claude, Codex, Gemini, Cursor, Copilot, Windsurf ou outros agentes.
