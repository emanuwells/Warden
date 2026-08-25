# Workflow — fallback e handoff entre modelos/agentes

1. Identificar a causa: quota, indisponibilidade, qualidade insuficiente, contexto, ferramenta incompatível ou custo.
2. Consultar `.agents/core/MODEL_ROUTING.md` e escolher `free`, `economical` ou `premium` pela complexidade/risco.
3. Preservar branch, diff, estado e evidência antes de repetir/escalar.
4. Se for apenas modelo/provider, compactar contexto e escalar uma classe; não repetir a mesma abordagem mais de duas vezes.
5. OmniRoute só pode ser usado num perfil previamente testado e nunca altera endpoints silenciosamente.
6. Se mudar de agente/CLI, gerar HANDOFF com objetivo, critérios, ficheiros, comandos, testes, riscos e próximo passo.
7. O agente seguinte lê `.agents/AGENTS.md` e apenas o handoff/contexto indicado; confirma o estado do repo antes de continuar.
