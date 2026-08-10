# Evidência Mínima

Registo mínimo esperado no fim de uma iteração técnica.

O objetivo é permitir auditoria leve: perceber o que mudou, o que foi validado, o que falhou e o que ficou pendente.

## Formato Recomendado

```md
## Evidência

### Ficheiros Alterados

- `<ficheiro>` — <descrição curta>

### Comandos Executados

- `<comando>` — <resultado curto>

### Comandos Não Executados

- `<comando>` — <motivo>

### Validação

- <validação feita ou motivo por não ter sido possível>

### Critérios de Conformidade

- Conformidade do agente: <cumprido / limitação>
- README badges: <cumprido / não aplicável / limitação>
- Idioma e acentuação: <PT-PT revisto / não aplicável / limitação>
- VERSION/LICENSE: <coerente / não aplicável / limitação>
- Auditoria de limpeza: <cumprida / não aplicável / limitação>

### Auditoria de Limpeza

- **Removidos:** `<path>` — <motivo objetivo ou N/A>
- **Mantidos:** `<path>` — <motivo objetivo ou N/A>
- **Candidatos a confirmação:** `<path>` — <risco/dúvida ou N/A>
- **Verificações feitas:** <referências/imports/scripts/docs/manifests/CI/Docker/comandos>

### Erros / Limitações

- <erro, limitação ou N/A>

### Próximos Passos

1. <ação concreta>
```

## Regras

- Não declarar testes como executados se não foram.
- Não ocultar erro por ser pequeno.
- Não copiar logs longos sem necessidade.
- Preferir resumo factual com nomes de ficheiros e comandos.
- Indicar limpezas realizadas ou justificar que não havia itens inequivocamente removíveis.
- Guardar logs completos apenas se forem úteis e se não contiverem segredos.

## 2026-08-10 — Limpeza conservadora em produção

### Comandos Executados

- `scripts/run-production-cleanup.ps1 -DryRunOnly` — diagnóstico e simulação concluídos sem remoções.
- `scripts/run-production-cleanup.ps1 -SkipWarden` — higiene do host executada, preservando Warden DB, binlogs e backups.
- Retenção Warden com `WARDEN_CLEAN_BINLOG_RETENTION_DAYS=0` e `WARDEN_CLEAN_OPTIMIZE_ENABLED=0` — 25 760 registos expirados removidos.
- Prune Docker e remoção de seis bundles de deploy antigos em `/tmp` — apenas artefactos regeneráveis, sem ficheiros abertos.
- Diagnósticos SSH read-only — disco, inodes, serviço, cron, binlogs, replicação, Docker, Snap, backups, runtime e logs dos runners.

### Validação

- Raiz: 98 GB, 89 GB usados, 4,5 GB livres (96%); inodes a 23%.
- Serviço `warden`: activo.
- Binlogs: 96 ficheiros, 9,26 GB; sem réplicas configuradas; retenção Warden de 2 dias e retenção nativa de 7 dias.
- Foram removidas sete revisões Snap desactivadas, uma imagem Docker não usada, cache de build, `.bak` antigos e 58,7 MB de bundles antigos em `/tmp`.
- Runtime Warden: sem temporários antigos nem estados operacionais expirados; cache ~22 KB.
- O `host_hygiene` diário foi reactivado às 01:30; `cron` está activo e existe um backup temporário do crontab anterior.
- Overseer saudável; as últimas dez runs diárias de `warden_clean` têm `status=ok` e `exit_code=0`.
- Estado final: 88 GB usados, 5,7 GB livres (94%); serviço activo e `validate-pipeline.sh` com `RESULT: PASS`.

### Auditoria de Limpeza

- **Removidos:** revisões Snap desactivadas, `.bak` excedentes, imagem/cache Docker, dados Warden expirados e seis bundles de deploy antigos em `/tmp`.
- **Mantidos:** `/BackupNGINX`, `/BackupDB`, snapshots, arquivos, dados MySQL e secrets — dados protegidos pelo runbook.
- **Candidatos a confirmação:** reduzir a janela de binlogs, alterar retenção dos backups ou intervir noutras áreas de aplicação — impacto operacional desconhecido ou perda de capacidade de recuperação.
- **Verificações feitas:** runbook, scripts versionados, configuração de retenção, cron, serviço, consumo de disco, replicação e outputs dry-run.

### Erros / Limitações

- Os binlogs continuam a ocupar cerca de 9,27 GB dentro da janela PITR configurada de dois dias; não foram purgados além da política existente.
