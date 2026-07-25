
# Estrutura profissional do repositório

```text
projeto/
├── .agents/            # todo o sistema específico de IA
├── .github/            # metadados GitHub
├── docs/               # documentação técnica/funcional
├── README.md
├── PROJECT_CONTEXT.md
├── COMMANDS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── VERSION
├── LICENSE
└── pastas reais do produto
```

Não criar `src/`, `tests/`, `docs/architecture/` ou outras pastas apenas por
antecipação. Um único script pode permanecer na raiz ou em `scripts/`.
Aplicações maiores criam estrutura apenas quando existe necessidade real.
