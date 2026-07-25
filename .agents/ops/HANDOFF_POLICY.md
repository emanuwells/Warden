# Política de handoff

O estado operacional atual vive em `.agents/state/HANDOFF.md`.

Atualizar o handoff quando:

- a tarefa fica incompleta;
- outro agente ou sessão deverá continuar;
- existem decisões, riscos, comandos ou validações que não podem ser perdidos;
- o trabalho é suficientemente complexo para exigir continuidade explícita.

O handoff deve ser curto e factual: objetivo, estado, ficheiros relevantes,
validações reais, bloqueios e próximo passo exato. Não copiar histórico extenso,
documentação ou todo o diff.
