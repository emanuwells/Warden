# Workflow 30 — Bugfix

## Objetivo

Corrigir a causa raiz, não apenas esconder sintomas.

## Passos

1. Se o sintoma estiver em produção ou atravessar infraestrutura, ativar `production-incident-diagnostics`; caso contrário reproduzir ou inferir o bug com evidência.
2. Localizar causa provável.
3. Criar correção mínima.
4. Adicionar teste de regressão quando possível.
5. Validar comandos relevantes.
6. Documentar causa, correção e risco restante.

## Saída

- causa raiz;
- ficheiros alterados;
- teste/validação;
- risco de regressão;
- changelog.
