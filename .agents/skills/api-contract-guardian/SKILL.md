---
name: api-contract-guardian
description: Protege contratos HTTP/API: rotas, payloads, autenticação, códigos de estado e compatibilidade. Usar ao criar ou alterar endpoints; não usar para mudanças internas sem impacto externo.
---

# Guardião de contratos de API

## Procedimento

1. Identificar consumidores, versão e comportamento atual.
2. Comparar request, response, erros, autenticação e códigos de estado.
3. Preservar compatibilidade; quando não for possível, documentar breaking change e migração.
4. Validar inputs no limite da aplicação e produzir erros consistentes.
5. Atualizar especificação, exemplos e testes de contrato quando existirem.

## Critérios

- Não expor campos internos, segredos ou detalhes de stack.
- Distinguir `400`, `401`, `403`, `404`, `409`, `422` e `500` de forma coerente.
- Confirmar serialização, nullability, paginação, filtros e idempotência.
- Testar pelo menos sucesso, input inválido e autorização.
