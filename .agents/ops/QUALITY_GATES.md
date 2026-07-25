# QUALITY_GATES.md

Critérios de qualidade proporcionais ao risco.

## Regra principal

Não concluir trabalho técnico sem validação adequada ou limitação declarada.

## Universal

```text
[ ] Objetivo cumprido.
[ ] Alterações do utilizador preservadas.
[ ] Sem segredos reais.
[ ] Sem dados sensíveis expostos.
[ ] Naming claro e profissional.
[ ] Estrutura coerente.
[ ] Dependências justificadas.
[ ] Documentação afetada atualizada.
[ ] .agents/state/TODO.md atualizado em iteração não trivial.
[ ] .agents/state/LESSONS.md atualizado quando houve aprendizagem.
[ ] CHANGELOG.md atualizado quando houve alteração versionável.
[ ] Auditoria de limpeza executada em tarefa não trivial.
```

## Frontend

```text
[ ] Build passa ou limitação declarada.
[ ] Typecheck passa quando existir.
[ ] Lint passa quando existir.
[ ] Estados loading/error/empty considerados.
[ ] Acessibilidade básica considerada: labels, foco, teclado, semântica.
[ ] Responsividade considerada.
[ ] Integração API com erros tratados.
[ ] Testes de comportamento executados quando existirem.
```

## Backend / API

```text
[ ] Validação de input na fronteira.
[ ] Autenticação/autorização consideradas.
[ ] Erros previsíveis e sem fuga de detalhes sensíveis.
[ ] Logs úteis e sem segredos.
[ ] Contrato API coerente: payloads, status codes, erros.
[ ] Testes executados quando existirem.
[ ] Performance básica considerada para queries ou loops críticos.
```

## Base de Dados

```text
[ ] Migração reversível ou rollback documentado.
[ ] Dados existentes considerados.
[ ] Índices considerados para queries críticas.
[ ] Integridade referencial preservada.
[ ] Operações destrutivas exigem confirmação explícita.
[ ] Backup considerado para produção.
```

## Full Stack

```text
[ ] Frontend e backend mantêm contrato coerente.
[ ] Variáveis de ambiente documentadas.
[ ] Fluxo ponta-a-ponta validado quando possível.
[ ] Erros de rede/API tratados.
[ ] Compatibilidade de tipos/payloads revista.
```

## Docker / CI/CD / Deploy

```text
[ ] Dockerfile/compose coerentes.
[ ] Portas, volumes e env vars documentados.
[ ] Healthcheck considerado.
[ ] Pipeline não expõe segredos.
[ ] Rollback conhecido.
[ ] Produção não alterada sem confirmação explícita.
```

## Segurança

```text
[ ] Segredos fora do Git.
[ ] Inputs externos tratados como não confiáveis.
[ ] Autorização revista em operações sensíveis.
[ ] Dados pessoais/sensíveis minimizados.
[ ] Dependências novas verificadas.
[ ] Logs e erros sem credenciais.
```

## Documentação

```text
[ ] README atualizado quando uso/configuração/arquitetura mudou.
[ ] COMMANDS.md atualizado quando comandos mudaram.
[ ] CHANGELOG.md append-only.
[ ] PT-PT com acentuação correta.
[ ] Badges refletem tecnologias reais.
```
