# Compatibilidade entre IDEs e Agentes IA

Este pack não depende de um único IDE.

## Princípio

`AGENTS.md` + `docs/ai/` + `docs/architecture/` formam o núcleo neutro. Tudo o resto é adaptador.

## Mapeamento

| Ferramenta | Ficheiros úteis | Observação |
|---|---|---|
| Cursor | `.cursor/`, `.cursorrules` | Adaptador completo, não fonte de verdade |
| Claude Code | `CLAUDE.md`, `tools/ai-adapters/claude/.claude/skills/` | Deve seguir o núcleo neutro |
| Codex / OpenAI | `AGENTS.md`, `.codex/` | Usar prompts e workflows neutros |
| Gemini CLI | `GEMINI.md` | Espelha regras principais |
| GitHub Copilot | `.github/copilot-instructions.md` | Instruções compactas para sugestões/reviews |
| VS Code | `.vscode/`, `AGENTS.md` | Editor base, sem assumir agente específico |
| Windsurf / Devin Desktop | `.windsurfrules`, `.devin/` | Adaptador de regras de fluxo |
| Outros | `AGENTS.md`, `docs/ai/`, `docs/architecture/` | Seguir núcleo neutro |

## Regra para manter adaptadores

Quando o núcleo mudar, atualizar adaptadores apenas com o resumo necessário. Não duplicar documentação longa em todos os lados; apontar para `AGENTS.md` sempre que possível.
