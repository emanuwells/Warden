---
name: web-design-guidelines
description: Audita UI, UX e acessibilidade por ficheiro e linha usando as Web Interface Guidelines da Vercel; usar numa fase de revisão separada depois da implementação.
---

# Web Design Guidelines — wrapper WELLS

## Processo

1. Rever os ficheiros alterados, não o repositório inteiro.
2. Verificar teclado/foco, forms, loading, URL/state, motion, tipografia, imagens, performance, touch, dark mode e i18n conforme aplicável.
3. Reportar achados por `ficheiro:linha`, severidade e correção concreta.
4. Aplicar apenas correções confirmadas pelo âmbito e validar novamente o fluxo afetado.

## Fonte e atualização

Usar a referência pinada em `.agents/integrations/registry.json`. Não fazer fetch remoto automático
em cada sessão; atualizar o snapshot/referência apenas numa revisão explícita da integração.
