---
name: vercel-react-best-practices
description: Aplica guidelines de performance React/Next.js da Vercel, priorizando waterfalls, bundle, data fetching, re-renders e rendering; usar apenas quando a stack React/Next estiver presente.
---

# Vercel React Best Practices — wrapper WELLS

## Aplicação

1. Confirmar React/Next.js antes de ativar.
2. Avaliar primeiro regras de impacto crítico: waterfalls e bundle.
3. Depois rever data fetching, re-renders e rendering apenas nos ficheiros alterados.
4. Aplicar regras Next.js apenas se o projeto for Next.js; em React/Vite ignorar regras de RSC, Server Actions e `next/*`.
5. Medir ou validar impacto quando a alteração é motivada por performance; não fazer micro-optimizações especulativas.

## Combinação

- implementação React: `react-vite-typescript` + `vercel-react-best-practices`;
- performance medida: `frontend-performance-web-vitals` + esta skill;
- auditoria visual/UX ocorre noutra fase.
