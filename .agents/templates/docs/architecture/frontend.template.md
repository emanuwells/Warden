# Arquitetura Frontend

## Stack

- Framework:
- Linguagem:
- Gestão de estado:
- UI/componentes:
- Testes:
- Build:

## Estrutura Recomendada

```text
src/
  app/
  pages/
  features/
  components/
  services/
  hooks/
  lib/
  styles/
  tests/
```

Adaptar à stack real. Não criar pastas vazias sem uso.

## Regras

- Separar componentes de apresentação, estado e integração API.
- Evitar lógica de negócio pesada em componentes visuais.
- Validar inputs na fronteira.
- Tratar loading, erro e empty states.
- Preservar acessibilidade básica: labels, navegação por teclado, contraste e semântica.
- Não introduzir biblioteca de UI sem necessidade clara.

## Integração com API

- Cliente HTTP:
- Estratégia de autenticação:
- Tratamento de erros:
- Cache:

## Testes Esperados

- Testes de comportamento para fluxos críticos.
- Testes de integração para chamadas API quando aplicável.
- Testes visuais/manual checklist para componentes críticos.
