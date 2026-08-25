---
name: backend-architecture
description: Define e revê arquitetura backend, serviços, validação, erros, logs e separação de responsabilidades. Usar em mudanças estruturais de backend; não usar para correções locais triviais.
---

# Arquitetura backend

## Processo

1. Mapear entrypoint, domínio, persistência e integrações afetadas.
2. Manter regras de negócio fora de controllers, handlers e acesso a dados.
3. Preservar contratos públicos e fronteiras transacionais.
4. Tratar validação, erros, logging e observabilidade sem expor dados sensíveis.
5. Validar com testes na camada mais baixa que prove o comportamento.

## Regras

- Preferir composição e interfaces apenas quando reduzem acoplamento real.
- Evitar abstrações sem segundo caso de uso.
- Não capturar exceções genéricas sem acrescentar contexto ou recuperação.
- Operações externas devem ter timeouts, retries limitados e idempotência quando aplicável.
