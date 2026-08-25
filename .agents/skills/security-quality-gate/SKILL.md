---
name: security-quality-gate
description: Executa verificações determinísticas de segurança proporcionais ao risco com Gitleaks, Trivy e opcionalmente Semgrep; usar em releases, auth, dependências, infra, secrets ou mudanças de risco, sem substituir revisão humana.
---

# Security Quality Gate

## Princípio

Preferir scanners determinísticos para problemas que não precisam de raciocínio do LLM. A ausência de uma ferramenta nunca equivale a um resultado limpo.

## Routing

### Quick gate

Usar em release, dependências, configuração, autenticação, infraestrutura ou alterações que possam expor segredos:

```text
node .agents/tools/security-gate.mjs --project . --mode quick
```

Quando disponíveis:

- **Gitleaks:** segredos em ficheiros/repositório;
- **Trivy:** vulnerabilidades, secrets e misconfigurations HIGH/CRITICAL.

### Deep gate

Usar para revisão de segurança explícita, código sensível ou incidente:

```text
node .agents/tools/security-gate.mjs --project . --mode deep
```

Adiciona **Semgrep** quando disponível.

## Regras

1. Não instalar ferramentas sem autorização/política do projeto.
2. Não enviar código privado para serviços remotos quando existe modo local adequado.
3. Tratar findings como evidência a validar, não como verdade absoluta.
4. Não adicionar ignores/suppressions apenas para obter verde; justificar falsos positivos.
5. Se uma ferramenta estiver ausente, reportar cobertura incompleta.
6. Para release crítico, usar `--strict` para falhar quando a toolchain mínima não estiver disponível.
