# Routing de modelos e agentes

## Objetivo

Usar o modelo mais económico que consiga concluir a tarefa com qualidade verificável,
sem acoplar o runtime WELLS a um fornecedor, IDE ou nome de modelo específico.

## Perfis de capacidade

| Perfil | Usar quando | Exemplos de tarefa |
|---|---|---|
| `free` | tarefa local, bem definida, reversível e fácil de validar | CRUD simples, documentação, testes, pequenas correções |
| `economical` | tarefa multi-ficheiro, contexto maior ou primeira tentativa free insuficiente | feature normal, integração API, refactor limitado |
| `premium` | risco alto, arquitetura, debugging difícil ou falhas repetidas | migração crítica, segurança, causa raiz obscura, decisão estrutural |

Os perfis são classes de capacidade/custo, não listas fixas de modelos. A escolha concreta
depende do agente disponível, contexto, ferramentas, multimodalidade, latência e custo atual.

## Escalada

1. Começar em `free` quando a tarefa for baixa/média complexidade e tiver validação objetiva.
2. Subir para `economical` se faltar capacidade, contexto ou fiabilidade, ou após uma falha útil.
3. Subir para `premium` quando o risco o exigir desde o início ou após falha comprovada do nível anterior.
4. Não repetir a mesma abordagem mais de duas vezes; compactar contexto e transferir evidência.
5. Se mudar de agente/CLI, usar HANDOFF; se mudar apenas de modelo/provider no mesmo agente,
   preservar o estado e registar a razão apenas quando material.

## Nunca degradar

- segurança, privacidade, operações destrutivas ou produção para poupar tokens;
- verificação real, testes, type-check, build ou rollback quando aplicáveis;
- tarefas que exigem visão/ferramentas para um modelo que não as possui;
- fidelidade a contratos, dados ou requisitos explícitos.

## Sinais para escolher melhor modelo

Avaliar apenas capacidades relevantes: qualidade de código, tool use, contexto, visão,
latência, custo e estabilidade. Não escolher por ranking genérico nem por preferência de marca.

## Compatibilidade universal

Todos os adapters e agentes WELLS seguem esta política. Se a plataforma não permitir escolher
modelo, o perfil representa apenas o nível de exigência e serve para decidir se deve continuar,
compactar, fazer handoff ou escalar para outro agente.
