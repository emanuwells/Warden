# Workflow — frontend design

1. Identificar superfície: produto/dashboard, marketing/portfolio, screenshot/mockup, motion ou auditoria.
2. Ler apenas o contrato visual existente (`DESIGN.md`/grafo) e componentes diretamente envolvidos.
3. **Direção:** selecionar até duas skills: Taste/Impeccable/Image-to-Code/Awesome DESIGN.md + direção adequada.
4. Definir critérios visuais, funcionais, responsivos e de acessibilidade verificáveis.
5. **Implementação:** usar a stack existente; em React combinar `react-vite-typescript` com Vercel React Best Practices apenas quando útil.
6. **Verificação browser:** quando a aplicação possa arrancar localmente, usar `playwright-cli` para percurso principal, desktop/mobile, consola e estados relevantes.
7. **Auditoria:** executar Vercel Web Guidelines/WCAG numa fase separada quando o risco ou âmbito o justificar.
8. Corrigir em lote e confirmar no máximo mais uma ronda visual.
9. Persistir `DESIGN.md`/grafo apenas se surgir uma decisão de design durável.

Cada fase mantém o limite de duas skills; uma fase termina antes da seguinte começar.
