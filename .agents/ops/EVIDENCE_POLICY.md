# Nota de utilização

Política de evidência e validação. A evidência real vive em `.agents/state/EVIDENCE.md`.

# Evidência Mínima

Registo mínimo esperado no fim de uma iteração técnica.

O objetivo é permitir auditoria leve: perceber o que mudou, o que foi validado, o que falhou e o que ficou pendente.

## Formato Recomendado

```md
## Evidência

### Ficheiros Alterados

- `<ficheiro>` — <descrição curta>

### Comandos Executados

- `<comando>` — <resultado curto>

### Comandos Não Executados

- `<comando>` — <motivo>

### Validação

- <validação feita ou motivo por não ter sido possível>

### Critérios de Conformidade

- Conformidade do agente: <cumprido / limitação>
- README badges: <cumprido / não aplicável / limitação>
- Idioma e acentuação: <PT-PT revisto / não aplicável / limitação>
- VERSION/LICENSE: <coerente / não aplicável / limitação>
- Auditoria de limpeza: <cumprida / não aplicável / limitação>

### Auditoria de Limpeza

- **Removidos:** `<path>` — <motivo objetivo ou N/A>
- **Mantidos:** `<path>` — <motivo objetivo ou N/A>
- **Candidatos a confirmação:** `<path>` — <risco/dúvida ou N/A>
- **Verificações feitas:** <referências/imports/scripts/docs/manifests/CI/Docker/comandos>

### Erros / Limitações

- <erro, limitação ou N/A>

### Próximos Passos

1. <ação concreta>
```

## Regras

- Não declarar testes como executados se não foram.
- Não ocultar erro por ser pequeno.
- Não copiar logs longos sem necessidade.
- Preferir resumo factual com nomes de ficheiros e comandos.
- Indicar limpezas realizadas ou justificar que não havia itens inequivocamente removíveis.
- Guardar logs completos apenas se forem úteis e se não contiverem segredos.
