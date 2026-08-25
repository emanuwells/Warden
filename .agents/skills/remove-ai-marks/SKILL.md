---
name: remove-ai-marks
description: Trata operações adicionais e explícitas de limpeza de marcas/metadata em conteúdo próprio ou autorizado; a higiene invisível segura já é automática via OUTPUT_HYGIENE_POLICY e não requer esta skill.
---

# Remove AI Marks — wrapper WELLS

## Âmbito autorizado

Usar apenas quando o utilizador possui o conteúdo ou tem autorização para o limpar. Não usar para
falsear autoria, contornar requisitos de disclosure, remover proveniência exigida por política/lei,
ou alterar evidência/autenticidade de terceiros.

## Processo

1. Não repetir a higiene safe always-on; confirmar ficheiros e objetivo adicional.
2. Verificar `WATERMARKS_SERVICE_URL` e disponibilidade do serviço upstream antes de executar.
3. Trabalhar sobre cópia/ficheiro de saída quando a alteração não for trivial ou reversível.
4. Comparar conteúdo visível antes/depois; a limpeza não pode modificar significado ou dados.
5. Registar quais os tipos de metadata/marcas removidos quando isso for material.

A skill WELLS é apenas um wrapper; o serviço externo não é iniciado nem instalado automaticamente. C2PA, metadata de autoria/proveniência e marcas visuais nunca são removidos automaticamente pelo runtime.
