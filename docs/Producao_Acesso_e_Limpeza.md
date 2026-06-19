# Produção — Acesso SSH e limpeza segura de disco

Runbook operacional para o host MAIATRON. **Não versionar** hostnames, passwords nem chaves privadas.

Documentação relacionada:

- [`Guia_Producao_Step_by_Step.md`](Guia_Producao_Step_by_Step.md)
- [`../README.md`](../README.md)

## Pré-requisitos

Configuração local (mesmo padrão que **WELLS_API**):

1. Copiar de `../WELLS_API/secrets/` para `secrets/`:
   - `production.deploy.local.env`
   - `environments.local.json` (opcional)
   - `.ssh/id_ed25519`
2. Ou usar `secrets/production.deploy.local.env.example` como modelo.

| Item | Ficheiro / valor |
|---|---|
| Host / user / porta | `secrets/production.deploy.local.env` |
| Chave SSH | `secrets/.ssh/id_ed25519` |
| `WARDEN_ROOT` | `WARDEN_RUNTIME_ROOT` no `.env` ou `/home/eferreira/MAIATRON/Warden` |
| `sudo` | Não necessário para `warden_clean`; reservado para diagnósticos explícitos |

### Scripts PowerShell (recomendado no Windows)

```powershell
.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand "df -h /"
.\scripts\run-production-cleanup.ps1
.\scripts\run-production-cleanup.ps1 -DryRunOnly
```

Ligação manual equivalente:

```bash
ssh -i secrets/.ssh/id_ed25519 eferreira@HOST 'hostname; df -h; ls -ld /home/eferreira/MAIATRON/Warden'
```

## 1. Diagnóstico (read-only)

Executar e registar output antes de qualquer limpeza.

```bash
ssh USER@HOST 'set -e
echo "=== df ==="
df -h
df -i
echo "=== Warden path ==="
ls -ld /home/eferreira/MAIATRON/Warden
echo "=== Top-level du ==="
du -xh /var/log /var/lib/mysql /home /var/lib/snapd /var/cache 2>/dev/null | sort -hr | head -20
echo "=== Warden runtime ==="
du -xh /home/eferreira/MAIATRON/Warden/runtime/logs \
       /home/eferreira/MAIATRON/Warden/runtime/export \
       /home/eferreira/MAIATRON/Warden/runtime/archive \
       /home/eferreira/MAIATRON/Warden/runtime/cache 2>/dev/null || true
echo "=== journald ==="
journalctl --disk-usage 2>/dev/null || true
echo "=== warden service ==="
systemctl status warden --no-pager 2>/dev/null || true
echo "=== warden_clean ==="
ls -l /home/eferreira/overseer-runners/warden_clean/run.sh 2>/dev/null || true
crontab -l 2>/dev/null | grep -n "overseer:warden_clean" || true
'
```

Validar paths ativos em produção (podem diferir dos templates):

```bash
ssh USER@HOST 'systemctl cat warden 2>/dev/null | head -30; echo "---"; crontab -l 2>/dev/null | head -20'
```

Opcional — top consumidores de disco (se helper instalado):

```bash
ssh USER@HOST 'sudo /usr/local/sbin/warden-disk-top-helper 2>/dev/null || true'
```

## 2. Limpeza Warden (baixo risco, utilizador do runtime)

Dentro de `WARDEN_ROOT`, sem root (exceto se logs exigirem permissões).

### 2.1 Truncar logs grandes (>20 MB)

Alinhado com `scripts/crontab.example`:

```bash
ssh USER@HOST 'find /home/eferreira/MAIATRON/Warden/runtime/logs -maxdepth 1 -type f \
  \( -name "*.log" -o -name "*.err.log" \) -size +20M -exec truncate -s 0 {} +'
```

### 2.2 Warden Clean (métricas antigas)

```bash
ssh USER@HOST 'cd /home/eferreira/MAIATRON/Warden && \
  . .venv/bin/activate 2>/dev/null || true; \
  .venv/bin/python scripts/warden_clean.py'
```

Retenção por omissão: `RETENTION_DAYS=7` (`.env`).

### 2.3 Arquivo semanal

Política: `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`. Antes de apagar manualmente, listar:

```bash
ssh USER@HOST 'du -sh /home/eferreira/MAIATRON/Warden/runtime/archive/weekly/* 2>/dev/null | sort -hr | head'
```

Não apagar snapshots em `runtime/export/` — são regenerados pelos jobs de export mas a API pode depender do último ficheiro válido.

### 2.4 Temporários e cache regenerável

`scripts/warden_clean.sh` também remove apenas artefactos regeneráveis e scoped ao Warden:

- temporários atómicos antigos em `runtime/export/*.tmp-*` e `runtime/archive/weekly/*.tmp-*`;
- entradas antigas em `runtime/cache/`;
- `__pycache__`, `.pytest_cache`, `*.pyc` e `*.pyo`, excluindo `.git`, `.venv` e `secrets`;
- ficheiros de editor/sistema antigos: `*~`, `.DS_Store`, `Thumbs.db`, `*.swp`, `*.swo`.

O script continua a preservar snapshots JSON ativos, backups, dumps, diretórios de aplicação, volumes Docker, dados MySQL, binlogs, secrets e virtualenvs.

## 3. Runner `warden_clean` (Overseer, utilizador do runtime)

Fonte versionada: `scripts/warden_clean.sh`
Instalação típica: `/home/eferreira/overseer-runners/warden_clean/run.sh`

O runner executa limpeza conservadora diária para ser visível ao Overseer pelo marcador:

```text
# overseer:warden_clean
```

O runner pode existir sem linha ativa no crontab. Quando isso acontecer, corrigir diretamente o crontab real com backup e inserção idempotente:

```bash
ssh USER@HOST 'set -e
backup="/home/eferreira/warden_crontab_$(date +%Y%m%d%H%M%S).bak"
line="0 1 * * * /home/eferreira/overseer-runners/warden_clean/run.sh >> /home/eferreira/D4MAIA/_crontab_logs/crontab_warden_clean.txt 2>&1 # overseer:warden_clean"
crontab -l > "$backup"
if ! crontab -l | grep -Fq "# overseer:warden_clean"; then
  { crontab -l; printf "%s\n" "$line"; } | crontab -
fi
echo "$backup"
crontab -l | grep -n "overseer:warden_clean"'
```

Quando o catálogo do Overseer estiver disponível, alinhar também a definição declarativa para evitar drift futuro.

Linha esperada no crontab:

```text
0 1 * * * /home/eferreira/overseer-runners/warden_clean/run.sh >> /home/eferreira/D4MAIA/_crontab_logs/crontab_warden_clean.txt 2>&1 # overseer:warden_clean
```

O runner não apaga backups, dumps, diretórios de aplicação, volumes Docker, dados MySQL, binlogs, secrets, virtualenvs nem snapshots ativos.

## 4. Proibido por defeito

Só com aprovação explícita do responsável:

- `rm -rf` em diretórios de aplicação ou dados de negócio;
- `docker system prune`;
- apagar binlogs MySQL manualmente (retenção em `/etc/mysql/conf.d/99-maiatron-binlog-retention.cnf`);
- `DELETE` SQL em massa fora do script versionado.

## 5. Validação pós-limpeza

```bash
ssh USER@HOST 'df -h; systemctl is-active warden; \
  curl -sf "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast" | head -c 200'
```

Registar em `.agents/ops/HANDOFF.md`: uso de disco antes/depois, ações executadas, serviços verificados.
