# Política de design frontend

## Objetivo

Produzir interfaces coerentes, distintas, acessíveis e adequadas ao contexto sem carregar todas as skills de design.

## Routing por fase

**Direção**
- Produto/dashboard/backoffice: `frontend-design-direction` + `impeccable-ui`.
- Landing/portfolio/marketing: `taste-frontend` + `frontend-design-direction`.
- Screenshot/mockup: `image-to-code` + direção adequada.
- Referência de brand/design: `awesome-design-md` + `frontend-design-direction`.

**Implementação**
- React: `react-vite-typescript` + `vercel-react-best-practices` apenas se material.
- Motion: `emil-design-engineering` + skill técnica da stack.
- shadcn: `shadcn-ui` apenas com `components.json` ou pedido explícito.

**Verificação**
- Browser/smoke/visual: `playwright-cli`.
- Auditoria final: `web-design-guidelines` + acessibilidade, numa fase separada.

Máximo de duas skills frontend por fase. Não usar Taste em dashboards, data tables ou fluxos multi-step.

## Contrato persistente

Projetos frontend devem promover para o grafo e/ou `DESIGN.md` apenas decisões duráveis: tipografia,
cores, spacing, radius, motion, densidade, componentes, acessibilidade e padrões proibidos. Uma referência
Awesome DESIGN.md é inspiração/fonte, não substitui o contrato do projeto.

## Verificação

Rever desktop, mobile, teclado e estados de loading/empty/error quando aplicáveis. Preferir Playwright CLI
para smoke/inspeção real e limitar polish a duas rondas agrupadas.
