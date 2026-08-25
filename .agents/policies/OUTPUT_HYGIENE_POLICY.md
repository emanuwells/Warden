# Política de higiene determinística de outputs

## Objetivo

Remover automaticamente apenas caracteres invisíveis não semânticos e suspeitos em ficheiros textuais alterados pelo trabalho do agente, sem chamar LLMs e sem adulterar proveniência/autenticidade.

## Always-on safe mode

Antes de concluir uma tarefa que alterou ficheiros, executar:

```text
node .agents/tools/wells-finalize.mjs --project . --changed --apply
```

O safe mode pode remover apenas o conjunto conservador implementado por `watermark-hygiene.mjs`, atualmente:

- ZERO WIDTH SPACE (`U+200B`);
- WORD JOINER (`U+2060`);
- SOFT HYPHEN (`U+00AD`);
- BOM (`U+FEFF`) apenas fora do início do ficheiro;
- Unicode TAG characters (`U+E0000–U+E007F`).

Não normaliza Unicode globalmente, não remove ZWJ/ZWNJ, bidi marks, NBSP ou caracteres que possam ser linguisticamente significativos.

## Fora do modo automático

Nunca remover automaticamente:

- C2PA/content credentials;
- EXIF/metadata de autoria/proveniência;
- marcas visuais em imagens;
- texto ou metadata para ocultar autoria, enganar sistemas de deteção ou contornar requisitos legais/políticas.

Operações adicionais da skill `remove-ai-marks` exigem pedido/objetivo explícito, conteúdo próprio/autorizado e revisão do impacto.

## Falhas

A higiene é best-effort e não pode bloquear uma tarefa por ausência de Git ou por erro de leitura. Se alterar ficheiros, a alteração deve permanecer visível no diff.
