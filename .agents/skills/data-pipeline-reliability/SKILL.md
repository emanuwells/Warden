---
name: data-pipeline-reliability
description: Desenha e revê pipelines de ingestão, transformação e datasets derivados com idempotência, checkpoints, lineage, qualidade, retries, backfills e sincronização de metadados; usar em ETL/ELT e persistência contínua.
---

# Data Pipeline Reliability

## Objetivo

Garantir que um pipeline pode ser reexecutado, recuperar de falhas e explicar de onde veio cada valor sem duplicar ou corromper dados.

## Contrato mínimo

Antes de implementar, identificar:

- fontes e chaves naturais/técnicas;
- granularidade e unidade temporal;
- regra de transformação;
- destino e estratégia de upsert;
- checkpoint/watermark de processamento;
- metadados e lineage exigidos;
- comportamento perante dados atrasados, corrigidos ou removidos.

## Padrões

1. **Idempotência:** a mesma entrada não cria resultados duplicados.
2. **Incrementalidade:** processar apenas o necessário, com checkpoint verificável.
3. **Late-arriving data:** definir janela de recomputação ou mecanismo de invalidação.
4. **Backfill:** separar backfill de execução normal, com range explícito e reentrância.
5. **Transações:** tornar atómica a unidade lógica de persistência; evitar estados parcialmente publicados.
6. **Upsert/dedup:** chave e política de conflito explícitas.
7. **Data quality:** validar schema, nulos, domínios, cardinalidade, ranges e invariantes de negócio antes de publicar.
8. **Lineage:** registar datasets/fontes, versão da fórmula e timestamps de cálculo quando material.
9. **Metadados:** atualizar metadados na mesma entrega lógica ou com reconciliação verificável.
10. **Retries:** apenas em operações transitórias e idempotentes; backoff e limite finitos.
11. **Observabilidade:** contagens input/output, rejeitados, duração, checkpoint, erro e run id.
12. **Reconciliation:** capacidade de comparar fonte → derivado e detetar drift.

## Validação

Testar pelo menos: primeira execução, reexecução sem mudanças, nova entrada, correção retroativa, falha a meio, retry, backfill e dataset vazio quando aplicável.

Para DDL/migrações combinar com `database-migration-safety`; para metadata pública combinar com `public-data-metadata`.
