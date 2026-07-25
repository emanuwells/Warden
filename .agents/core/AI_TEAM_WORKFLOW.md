# Workflow da equipa IA sénior

Este sistema permite que qualquer agente trabalhe como uma equipa sénior sem
depender de uma ferramenta específica.

## Fluxo

1. Ler `.agents/AGENTS.md`.
2. Localizar os ficheiros diretamente relacionados com o pedido.
3. Consultar `.agents/INDEX.md` apenas se a tarefa exigir workflow ou skill.
4. Usar `.agents/core/ORCHESTRATOR.md` apenas em trabalho multiárea ou de risco.
5. Executar em passos pequenos, validar e rever o diff.
6. Atualizar estado e documentação proporcionalmente à alteração.

## Prompt universal

```text
Lê .agents/AGENTS.md e segue o carregamento seletivo. Tarefa: <pedido>.
```

## Continuação

```text
Lê .agents/AGENTS.md e continua a tarefa registada em
.agents/state/TODO.md e .agents/state/HANDOFF.md.
```
