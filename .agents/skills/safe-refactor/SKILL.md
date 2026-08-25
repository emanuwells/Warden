---
name: safe-refactor
description: Executa refactors e reorganizações preservando comportamento, com fases, testes e rollback. Usar para mudanças estruturais; não usar em correção local simples.
---

# Refactor seguro

1. Definir comportamento que não pode mudar e validações existentes.
2. Mapear dependências e consumidores do código afetado.
3. Dividir em fases pequenas e reversíveis.
4. Separar movimentos mecânicos de mudanças comportamentais.
5. Executar testes antes e depois de cada fase relevante.
6. Atualizar contratos/documentação apenas quando a interface muda.

Refactors de risco alto devem apresentar plano, ficheiros, validações e rollback antes da execução.
