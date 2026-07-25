# Política de Testes e Validação

Escolher testes proporcionais ao risco e ao tipo de alteração.

A ausência de testes automatizados não dispensa validação. Quando não for possível executar testes, registar o motivo e a validação alternativa.

## Matriz de Validação

| Tipo | Validação mínima | Validação recomendada |
|---|---|---|
| Documentação | revisão de coerência e links | spellcheck/lint markdown se existir |
| Script local | execução com caso simples | execução com erro esperado e caso limite |
| Frontend | build ou lint | testes unitários/e2e quando existirem |
| Backend/API | teste rápido do fluxo alterado | testes unitários + integração |
| base de dados | revisão de migração/query | teste em ambiente local/staging |
| Docker | `docker compose config` ou build | container up + verificação de saúde/teste rápido |
| CI/CD | validação YAML/config | pipeline em branch segura |
| Produção | confirmação explícita + plano | execução controlada + rollback definido |

## Comandos Comuns

### Node.js

```bash
npm install
npm run lint
npm test
npm run build
```

### Python

```bash
python -m compileall .
python -m pytest
ruff check .
```

### PHP

```bash
composer install
composer test
php -l <ficheiro.php>
```

### Docker

```bash
docker compose config
docker compose build
docker compose up -d
```

## Regras

- Não inventar testes executados.
- Não ocultar falhas.
- Não colar logs extensos na resposta final.
- Se o teste falhar por ambiente ausente, indicar a dependência em falta.
- Se não houver manifesto de dependências, não instalar pacotes à sorte; propor manifesto adequado.
- Para tarefas críticas, pedir confirmação antes de comandos destrutivos ou alterações em produção.
