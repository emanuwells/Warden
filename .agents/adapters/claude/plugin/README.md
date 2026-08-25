# Plugin pessoal Claude Code

Fornece hooks, output profiles e subagente nativos sem `CLAUDE.md` nem `.claude/`
nos projetos.

## Instalação

```bash
node .agents/tools/wells-toolkit.mjs configure --agent claude --apply
```

O configurador prepara `~/.wells-ai/claude-marketplace`, valida-a com o CLI Claude
quando disponível, regista-a em scope `user` e instala `wells-runtime@wells-ai`.
Os atalhos `/wells*` são copiados para `~/.claude/skills/`.

## Comportamento

- `SessionStart`: deteta `.agents/AGENTS.md` e injeta só um ponteiro curto.
- `UserPromptSubmit`: aplica eficiência e escrita contextual.
- `PreToolUse`: ativa escrita por ficheiro, protege segredos e operações perigosas.
- `project-hooks.mjs`: executa e agrega hooks explicitamente ativados.

As skills de domínio e o knowledge graph permanecem no projeto e só entram no
contexto quando o router os seleciona.
