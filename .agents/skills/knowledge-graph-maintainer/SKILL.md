---
name: knowledge-graph-maintainer
description: Cria, atualiza, relaciona e valida conhecimento durável em `.agents/knowledge/`, com proveniência e sem duplicar o código.
---

# Knowledge Graph Maintainer

1. Determinar se a aprendizagem é durável segundo `KNOWLEDGE_GRAPH_POLICY.md`.
2. Procurar uma página existente pelo ID, título, fonte e relações antes de criar outra.
3. Atualizar síntese, fontes, relações e data sem apagar histórico válido.
4. Criar uma página nova apenas quando representa uma entidade ou conceito distinto.
5. Executar `node .agents/tools/wells-toolkit.mjs knowledge build --project . --apply`.
6. Executar `node .agents/tools/wells-toolkit.mjs knowledge lint --project .`.
7. Registar a operação em `knowledge/LOG.md` sem copiar raciocínio transitório.
