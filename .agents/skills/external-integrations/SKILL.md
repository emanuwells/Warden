---
name: external-integrations
description: Planeia, instala e audita integrações externas WELLS de forma proporcional ao risco, sem ativar automaticamente routing, memória ou serviços persistentes.
---

# External Integrations

1. Ler `.agents/integrations/registry.json` e selecionar apenas a integração pedida.
2. Executar `integrations plan` antes de instalar.
3. Exigir confirmação adicional para `experimental`.
4. Verificar binários, versões, ficheiros modificados e possibilidade de rollback.
5. Não ativar simultaneamente routers ou memórias automáticas sobrepostos.
6. Registar decisão durável no grafo apenas quando a integração passar a fazer parte da arquitetura.
