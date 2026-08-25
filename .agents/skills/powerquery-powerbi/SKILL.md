---
name: powerquery-powerbi
description: Trabalha com Power Query M, DAX, modelação Power BI e qualidade de dados. Usar em queries, medidas, relações ou preparação de dados para BI.
---

# Power Query e Power BI

## Power Query

- Preservar query folding quando a fonte o suporta.
- Tipar colunas explicitamente após estabilizar nomes.
- Evitar expansão prematura e passos repetidos sobre a mesma fonte.
- Separar staging, dimensões, factos e parâmetros reutilizáveis.
- Tratar nulls, chaves, duplicados e erros de conversão de forma explícita.

## Modelo/DAX

- Preferir star schema, relações 1:* e direção simples.
- Usar medidas para cálculos dependentes do contexto de filtro.
- Distinguir row context, filter context e transição de contexto.
- Evitar relações many-to-many e colunas calculadas sem necessidade.

Validar totais, granularidade, cardinalidade e casos sem correspondência antes de concluir.
