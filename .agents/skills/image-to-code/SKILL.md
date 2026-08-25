---
name: image-to-code
description: Converte screenshot, mockup ou referência visual em frontend fiel por pipeline imagem → análise → implementação → comparação; usar quando existe uma referência visual concreta.
---

# Image to Code — wrapper WELLS

## Processo

1. Confirmar a imagem/referência e separar estrutura, tokens, tipografia, espaçamento, componentes e estados.
2. Inferir apenas o que for necessário; não inventar assets, copy ou comportamento não visível sem o assinalar.
3. Implementar com a stack e componentes existentes, preservando acessibilidade e responsividade.
4. Validar a página em viewport equivalente e mobile com `playwright-cli` quando disponível.
5. Comparar diferenças por blocos (layout → tipografia → spacing → cor → polish) e corrigir no máximo duas rondas agrupadas.

## Combinações

- referência + marketing: `image-to-code` + `taste-frontend` na fase de direção;
- referência + produto/dashboard: `image-to-code` + `frontend-design-direction`;
- verificação: `playwright-cli` + `web-design-guidelines` numa fase separada.

Não usar apenas porque existe uma imagem decorativa; a referência deve orientar a implementação.
