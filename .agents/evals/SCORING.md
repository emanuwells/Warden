# Scoring dos evals

| Critério | Peso |
|---|---:|
| Resultado correto e completo | 35% |
| Testes/build/type-check realmente passam | 20% |
| Seguiu AGENTS/workflow/skills aplicáveis | 15% |
| Diff mínimo e ausência de regressões | 10% |
| Número de retries/intervenções | 10% |
| Custo total normalizado | 10% |

## Regras

- Falha de segurança, perda de dados ou declaração falsa de validação: reprovação automática.
- `N/A` redistribui o peso apenas se o critério for objetivamente inaplicável.
- Registar versão/modelo, agente, commit, data, contexto e comandos de validação.
- Comparar pelo menos três execuções antes de declarar vencedor quando a diferença for pequena.
