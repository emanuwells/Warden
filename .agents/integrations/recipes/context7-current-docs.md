# Context7 — documentação atual on-demand

## Objetivo

Consultar documentação pública atual e específica de versão sem tornar Context7 uma dependência do runtime WELLS.

## Preferência WELLS

1. **CLI + skill**, por menor superfície de tools/contexto.
2. MCP apenas quando o cliente beneficia realmente de tool calling persistente.
3. Nunca enviar código privado, secrets ou dados internos na consulta.

## Instalação testada

```text
npm install -g ctx7@0.5.7
ctx7 --version
```

Ou sem instalação persistente:

```text
npx ctx7@0.5.7 library <nome> <consulta>
npx ctx7@0.5.7 docs <libraryId> <consulta>
```

O setup interativo oficial pode configurar skills/MCP por agente:

```text
npx ctx7@0.5.7 setup
```

Node.js 18+ é requisito do CLI. Atualizar o pin apenas após revisão do changelog e `integrations doctor`.
