# Workflow 45 — Knowledge lint

Usar antes de release, depois de ingestão extensa ou quando o grafo parece incoerente.

1. Executar `knowledge build` em simulação e rever alterações esperadas.
2. Executar `knowledge lint`.
3. Corrigir IDs duplicados, links quebrados, fontes inexistentes e metadados inválidos.
4. Rever páginas órfãs e desatualizadas; não ligar entidades apenas para eliminar warnings.
5. Confirmar decisões `superseded`, incidentes `resolved` e fontes atuais.
6. Regenerar o índice e o grafo e registar o resultado no log.
