---
name: quality-review
description: Revê diffs ou implementação com foco em bugs, regressões, segurança, contratos, testes e documentação. Usar para revisão independente; não alterar código sem pedido.
---

# Revisão de qualidade

Inspecionar primeiro o diff e depois apenas o contexto necessário. Reportar findings por severidade com ficheiro/linha, impacto e correção recomendada.

Verificar:
- comportamento incorreto e regressões;
- validação, autorização e exposição de dados;
- contratos API e migrações;
- concorrência, idempotência e erros;
- testes ausentes ou frágeis;
- documentação e configuração desatualizadas;
- dependências e ficheiros desnecessários.

Se não houver findings, declarar o risco residual e as validações observadas.
