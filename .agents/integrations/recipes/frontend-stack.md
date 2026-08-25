# Frontend stack WELLS

## Routing

- Aplicação, dashboard ou backoffice: `frontend-design-direction` + `impeccable-ui`.
- Landing page, portfolio ou marketing: `taste-frontend` + `frontend-design-direction`.
- Motion: `emil-design-engineering` + skill técnica da stack.
- Auditoria: `web-design-guidelines` + acessibilidade, numa fase separada.
- shadcn: apenas com `components.json` ou pedido explícito.

## Instalação externa

Gera primeiro um plano fixado:

```bash
node .agents/tools/wells-toolkit.mjs integrations plan --project . --profile frontend --apply
```

Não instalar todos os packs por defeito. Wrappers WELLS funcionam em qualquer agente;
os packs upstream são opcionais e devem ser ativados apenas onde acrescentam valor.

## Design persistente

Criar uma página a partir de:

```text
.agents/templates/knowledge/frontend-design-system.template.md
```

Registar apenas decisões duráveis e associar fontes/referências verificáveis.
