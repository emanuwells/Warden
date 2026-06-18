# Adaptadores IA/IDE

Esta pasta guarda adaptadores opcionais para ferramentas específicas. Eles não devem estar ativos na raiz por defeito.

## Adaptadores

| Adaptador | Ficheiros ativados |
|---|---|
| `cursor` | `.cursor/`, `.cursorrules` |
| `claude` | `CLAUDE.md`, `.claude/` |
| `codex` | `.codex/` |
| `gemini` | `GEMINI.md` |
| `github-copilot` | `.github/copilot-instructions.md` |
| `vscode` | `.vscode/` |
| `windsurf` | `.windsurfrules` |
| `devin` | `.devin/` |

## Ativar

```bash
./scripts/activate-ai-adapter.sh cursor
```

```powershell
./scripts/activate-ai-adapter.ps1 -Adapter cursor
```

## Desativar

```bash
./scripts/deactivate-ai-adapter.sh cursor
./scripts/deactivate-ai-adapter.sh all
```

```powershell
./scripts/deactivate-ai-adapter.ps1 -Adapter cursor
./scripts/deactivate-ai-adapter.ps1 -Adapter all
```

## Regra

O adaptador traduz o núcleo para a ferramenta. A fonte de verdade continua a ser `AGENTS.md`, `PROJECT_CONTEXT.md`, `COMMANDS.md`, `docs/ai/` e `docs/architecture/`.