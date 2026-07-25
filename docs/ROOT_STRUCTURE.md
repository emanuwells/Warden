# Estrutura da Raiz

A raiz do repositório deve ser minimalista, previsível e profissional.

## Raiz Esperada

```text
.
├── .agents/                 # WELLS Agent Runtime (contrato, skills, estado)
├── .gitattributes
├── .gitignore
├── .github/
│   └── SECURITY.md
├── CHANGELOG.md
├── COMMANDS.md
├── CONTRIBUTING.md
├── LICENSE
├── PROJECT_CONTEXT.md
├── README.md
├── SECURITY.md
├── VERSION
├── docs/
├── scripts/
└── pastas do produto (src/, public/, docker/, deploy/, runtime/, secrets/)
```

## Ficheiros Git na raiz (obrigatório)

`.gitignore` e `.gitattributes` **devem ficar na raiz do repositório**. O Git não lê estes ficheiros a partir de `.github/` nem de outras pastas — mover quebraria ignores, normalização de line endings e atributos de merge.

Templates reutilizáveis ficam em `docs/resources/templates/` (ex.: `.gitignore.template`).

## Markdown permitido na raiz

- `README.md`
- `COMMANDS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `PROJECT_CONTEXT.md` (preenchido e útil para humanos e agentes)

O contrato de agentes vive em `.agents/AGENTS.md` (não na raiz).

## Fora da raiz por defeito

- `docs/resources/templates/PROJECT_CONTEXT.template.md`
- `docs/resources/templates/.env.example`
- `docs/resources/templates/.gitignore.template`
- `docs/governance/CONTRIBUTING.md` (espelho/histórico de governança)
- `.github/SECURITY.md`
- `docs/resources/examples/` para exemplos reutilizáveis
- adaptadores de IDE/agente em `.agents/adapters/`
- documentação longa em `docs/`

## O que não deve estar ativo na raiz por defeito

- `.cursor/`
- `.claude/`
- `.codex/`
- `.devin/`
- `.vscode/`
- `.cursorrules`
- `.windsurfrules`
- `CLAUDE.md`
- `GEMINI.md`
- `copilot-instructions.md`
- `AGENTS.md` (usar `.agents/AGENTS.md`)
- `PROJECT_CONTEXT.template.md`

## Política

- Ficheiros universais e de consulta diária ficam na raiz.
- Sistema de IA fica em `.agents/`.
- Documentação técnica fica em `docs/`.
- Templates e exemplos reutilizáveis ficam em `docs/resources/`.
- Políticas GitHub ficam em `.github/`.
- Estado operacional fica em `.agents/state/`.
- Automação fica em `scripts/`.
