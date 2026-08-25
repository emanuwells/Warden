# Claude Code

O adaptador usa dois componentes pessoais instalados uma vez:

1. `plugin/`: hooks e subagentes nativos;
2. `user-skills/`: comandos curtos e manuais, como `/wells`.

```bash
node .agents/tools/wells-toolkit.mjs configure --agent claude --apply
```

O projeto não necessita de `CLAUDE.md` nem `.claude/`. O plugin deteta
`.agents/AGENTS.md`, os comandos carregam o router sob pedido e os guards funcionam
sem chamadas adicionais ao modelo.

Modelo/provider: seguir `.agents/core/MODEL_ROUTING.md`; o adapter não fixa modelos concretos.
