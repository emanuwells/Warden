# Security toolchain — execução determinística

## Ferramentas

- **Gitleaks:** secrets em Git/ficheiros;
- **Trivy:** vulnerabilidades, secrets e misconfigurations em filesystem/containers;
- **Semgrep CE:** SAST on-demand para revisão profunda.

O Toolkit não instala nenhuma delas automaticamente.

## Uso WELLS

```text
node .agents/tools/security-gate.mjs --project . --mode quick
node .agents/tools/security-gate.mjs --project . --mode deep
```

Adicionar `--strict` em releases de risco quando a ausência de uma ferramenta deve bloquear a entrega.

## Política

- findings não são suprimidos só para obter verde;
- regras/ignores entram no repo apenas com justificação;
- preferir execução local para código privado;
- versões/instalação são geridas pela máquina/CI, não pelo runtime universal.
