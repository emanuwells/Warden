# Arquitetura Backend

## Stack

- Runtime:
- Framework:
- Linguagem:
- ORM/query builder:
- Autenticação:
- Testes:

## Estrutura Recomendada

```text
src/
  domain/
  application/
  infrastructure/
  interfaces/
  config/
  tests/
```

Adaptar à stack real. Não forçar arquitetura complexa em projetos simples.

## Regras

- Separar regras de negócio de transporte HTTP/CLI/jobs.
- Validar dados na fronteira da aplicação.
- Usar erros previsíveis e mensagens seguras.
- Não expor segredos, stack traces ou dados sensíveis em respostas públicas.
- Garantir autorização junto dos recursos, não apenas nas rotas.
- Manter logs úteis sem tokens, passwords ou dados pessoais desnecessários.

## APIs

| Endpoint/Interface | Responsabilidade | Auth | Observações |
|---|---|---|---|
| A definir | A definir | A definir |  |

## Testes Esperados

- Unitários para regras puras.
- Integração para endpoints, DB e serviços externos.
- Casos negativos para validação e autorização.
