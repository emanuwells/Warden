---
name: claude-memory-strategy
description: Gere memória no Claude sem duplicação: usa o grafo WELLS por defeito e ativa claude-mem apenas em perfil experimental isolado.
---

# Estratégia de memória Claude

1. Usar `.agents/knowledge` para conhecimento durável e partilhável entre agentes.
2. Usar HANDOFF/TODO para estado operacional.
3. Não guardar segredos, dados pessoais ou logs extensos.
4. Ativar claude-mem apenas após backup, revisão de hooks, exclusões e teste num projeto não crítico.
5. Evitar injetar memória WELLS e claude-mem duplicadas na mesma tarefa.
6. Medir contexto antes/depois e remover a integração se aumentar ruído ou revelar dados.
