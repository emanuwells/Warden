# Integrações WELLS

O runtime funciona sem integrações externas. `registry.json` guarda origem, licença,
risco, versão/referência testada, data de verificação e política de atualização.

## Perfis

- `core`: capacidades incorporadas e automáticas.
- `recommended`: Graphify, CodeBurn, Context7, Playwright e packs oficiais selecionados.
- `frontend`: direção, polish, motion, auditoria e shadcn.
- `knowledge`: Graphify e Obsidian quando aplicáveis.
- `observability`: CodeBurn.
- `docs`: Context7 para documentação atual.
- `security`: Gitleaks + Trivy; `security-deep` acrescenta Semgrep.
- `mcp-optional`: GitHub, Docker MCP Toolkit e Sentry, apenas por necessidade.
- `experimental`: Headroom proxy, OmniRoute e claude-mem.

## Regras

- nenhuma integração externa é auto-instalada; built-ins locais como `safe-output-hygiene` não contam como integração externa;
- high risk exige `--accept-risk`;
- instalar por versão/referência revista;
- validar permissões, hooks, processos, dados, endpoints e rollback;
- gerar `LOCK.json` para auditoria do projeto;
- wrappers WELLS são pequenas e não copiam packs extensos para o contexto.
