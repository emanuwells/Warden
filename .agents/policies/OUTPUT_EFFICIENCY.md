# Política de eficiência de output

Aplica-se automaticamente a todas as tarefas.

## Objetivo

Entregar a solução mínima correta, reduzir tokens de entrada e saída e preservar
informação necessária para executar, validar e manter o trabalho.

## Regras

1. Não repetir o pedido nem narrar operações óbvias.
2. Referir ficheiros e símbolos em vez de voltar a colar conteúdo já visível.
3. Resumir logs e resultados extensos, preservando erros, falhas, início e fim relevantes.
4. Usar a solução nativa, standard library ou padrão já existente antes de criar abstrações ou dependências.
5. Evitar scaffolding especulativo, alternativas não pedidas e documentação sem valor durável.
6. Em código, aplicar Ponytail em modo `full`: menor diff correto, causa-raiz, poucos ficheiros e nenhuma complexidade futura sem requisito atual.
7. Em respostas técnicas, apresentar resultado, validação, limitações e próximo passo apenas quando existir.
8. Nunca encurtar critérios de aceitação, segurança, comandos, contratos, troubleshooting ou secções documentais obrigatórias.

## Compressão Headroom

Antes de transportar para o contexto um output superior a cerca de 200 tokens:

- JSON: preservar erros, estrutura, primeiros três e últimos dois elementos;
- logs: preservar falhas, warnings relevantes, início e fim;
- pesquisa: agrupar por ficheiro e manter apenas ocorrências relevantes;
- código: ler intervalos e símbolos, não o ficheiro inteiro sem necessidade;
- histórico: remover primeiro outputs antigos de ferramentas, nunca a decisão atual ou evidência crítica.

Quando for necessário recuperar o original, usar o ficheiro ou artefacto de origem, não uma reconstrução inventada.
