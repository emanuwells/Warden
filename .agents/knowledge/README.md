# Knowledge graph WELLS

Conhecimento curado e durável do projeto. Não é um dump do código, chat ou logs.

- `SCHEMA.md`: contrato das páginas.
- `SOURCES.yml`: fontes, hashes, verificação e páginas derivadas.
- `pages/`: páginas pequenas por entidade ou conceito.
- `INDEX.md`: índice gerado.
- `GRAPH.json`: grafo determinístico gerado.
- `LOG.md`: histórico append-only apenas de alterações semânticas.

## Fluxo

```bash
node .agents/tools/wells-toolkit.mjs knowledge source add --project . --id auth-code --path src/auth --source-type code --apply
node .agents/tools/wells-toolkit.mjs knowledge add --project . --type decision --id auth-jwt --title "Autenticação JWT" --apply
# Associar a fonte no frontmatter e preencher a página.
node .agents/tools/wells-toolkit.mjs knowledge source verify --project . --apply
node .agents/tools/wells-toolkit.mjs knowledge build --project . --apply
node .agents/tools/wells-toolkit.mjs knowledge lint --project .
node .agents/tools/wells-toolkit.mjs knowledge coverage --project .
node .agents/tools/wells-toolkit.mjs knowledge stale --project .
```

`build` é idempotente: não altera timestamp, grafo ou log sem mudança semântica.
Páginas ativas devem ter proveniência. Uma fonte alterada fica `stale` até as páginas
derivadas serem revistas e a fonte novamente verificada.
