---
name: graphify
description: Usa um grafo estrutural do código para responder a perguntas de arquitetura e dependências antes de pesquisar extensivamente ficheiros brutos.
license: Apache-2.0 OR MIT
---

# Graphify

Usar apenas quando `graphify` estiver instalado e existir `graphify-out/graph.json`.

1. Consultar primeiro `graphify query`, `graphify explain` ou `graphify path` com o âmbito concreto.
2. Abrir código bruto apenas para confirmar a subárvore devolvida ou quando o grafo estiver desatualizado.
3. Não carregar `GRAPH_REPORT.md` integralmente por defeito.
4. Reconstruir o grafo após alterações estruturais relevantes.
5. Distinguir arestas extraídas de inferidas e confirmar inferências críticas no código.

O grafo Graphify descreve estrutura de código; `.agents/knowledge/` guarda conhecimento
curado e decisões. Nenhum substitui o outro.
