---
name: react-vite-typescript
description: Implementa e revê aplicações React com Vite e TypeScript, incluindo componentes, hooks, routing, estado e build. Usar quando esta stack estiver presente.
---

# React, Vite e TypeScript

- Respeitar TypeScript strict e evitar `any` sem fronteira justificada.
- Usar componentes funcionais e hooks segundo regras de hooks.
- Derivar valores durante render quando não precisam de estado.
- Usar efeitos apenas para sincronização com sistemas externos.
- Manter imports, aliases, env vars `VITE_` e configuração de build coerentes.
- Tratar loading, erro, vazio, acessibilidade e cleanup assíncrono.
- Executar lint, typecheck, testes e `vite build` aplicáveis.
