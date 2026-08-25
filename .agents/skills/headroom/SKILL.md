---
name: headroom
description: Reduz contexto e output quando logs, JSON, pesquisas, código ou histórico são extensos, preservando erros e informação recuperável.
license: Apache-2.0
---

# Headroom

Aplicar automaticamente quando um resultado ultrapassa cerca de 200 tokens ou o
contexto começa a ficar saturado.

1. Classificar o conteúdo: JSON, log, pesquisa, código ou histórico.
2. Preservar erros, falhas, stack traces, primeiros três e últimos dois elementos.
3. Selecionar apenas resultados ligados à pergunta atual.
4. Referir a origem para permitir recuperação; nunca inventar o conteúdo removido.
5. Usar `.agents/tools/headroom.mjs` para compressão determinística quando aplicável.
6. Não comprimir outputs pequenos nem contratos que necessitem de leitura integral.

A política completa está em `.agents/policies/OUTPUT_EFFICIENCY.md`. O material
upstream está em `references/upstream.md`.
