# Produção — Acesso SSH e limpeza segura de disco

Runbook operacional para o host de produção. **Não versionar** hostnames, passwords nem chaves privadas.

Documentação relacionada:

- [`production-step-by-step.md`](production-step-by-step.md)
- [`../README.md`](../README.md)

## Pré-requisitos

Configuração local (mesmo padrão que **WELLS_API**):

1. Copiar de `../WELLS_API/secrets/` para `secrets/`:
   - `production.deploy.local.env`
   - `environments.local.json` (opcional)
   - `.ssh/id_ed25519`
2. Ou usar `docs/resources/examples/secrets/production.deploy.local.env.example` como modelo.

| Item | Ficheiro / valor |
|---|---|
| Host / user / porta | `secrets/production.deploy.local.env` |
| Chave SSH | `secrets/.ssh/id_ed25519` |
| `WARDEN_ROOT` | `WARDEN_RUNTIME_ROOT` no ficheiro de deploy |
| `WARDEN_CRONTAB_LOG_DIR` | Opcional — diretório de logs do runner Overseer |
| `sudo` | Não necessário para `warden_clean`; reservado para diagnósticos explícitos |

### Scripts PowerShell (recomendado no Windows)

```powershell
.\scripts\Invoke-WardenSsh.ps1 -RemoteCommand "df -h /"
.\scripts\run-production-cleanup.ps1 -DryRunOnly
.\scripts\run-production-cleanup.ps1
```

Ligação manual equivalente:

```bash
ssh -i secrets/.ssh/id_ed25519 USER@HOST 'hostname; df -h; ls -ld $WARDEN_RUNTIME_ROOT'
```

## 1. Diagnóstico (read-only)

Executar e registar output antes de qualquer limpeza. Substituir `$WARDEN_RUNTIME_ROOT` pelo valor real do deploy.

```bash
ssh USER@HOST 'set -e
WARDEN_ROOT="${WARDEN_RUNTIME_ROOT:-/opt/warden}"
echo "=== df ==="
df -h
df -i
echo "=== Warden path ==="
ls -ld "$WARDEN_ROOT"
echo "=== Top-level du ==="
du -xh /var/log /var/lib/mysql /home /var/lib/snapd /var/cache 2>/dev/null | sort -hr | head -20
echo "=== Warden runtime ==="
du -xh "$WARDEN_ROOT/runtime/logs" \
       "$WARDEN_ROOT/runtime/export" \
       "$WARDEN_ROOT/runtime/archive" \
       "$WARDEN_ROOT/runtime/cache" 2>/dev/null || true
echo "=== journald ==="
journalctl --disk-usage 2>/dev/null || true
echo "=== warden service ==="
systemctl status warden --no-pager 2>/dev/null || true
echo "=== warden_clean ==="
crontab -l 2>/dev/null | grep -n "overseer:warden_clean" || true
'
```

Validar paths ativos em produção (podem diferir dos templates):

```bash
ssh USER@HOST 'systemctl cat warden 2>/dev/null | head -30; echo "---"; crontab -l 2>/dev/null | head -20'
```

## 2. Limpeza Warden (baixo risco, utilizador do runtime)

Dentro de `WARDEN_ROOT`, sem root (exceto se logs exigirem permissões).

### 2.1 Truncar logs grandes (>20 MB)

Alinhado com `scripts/crontab.example`:

```bash
ssh USER@HOST 'find $WARDEN_RUNTIME_ROOT/runtime/logs -maxdepth 1 -type f \
  \( -name "*.log" -o -name "*.err.log" \) -size +20M -exec truncate -s 0 {} +'
```

### 2.2 Warden Clean (métricas antigas)

```bash
ssh USER@HOST 'cd $WARDEN_RUNTIME_ROOT && \
  . .venv/bin/activate 2>/dev/null || true; \
  .venv/bin/python scripts/warden_clean.py'
```

Retenção por omissão: `RETENTION_DAYS=7` (`.env`).


### 2.3 Manutenção DB opcional

Usar apenas depois de confirmar que a política de backup/point-in-time recovery permite a janela escolhida. A purga de binlogs é global ao servidor MariaDB; a compactação é limitada às tabelas Warden configuradas.

Diagnóstico read-only:

```bash
ssh USER@HOST 'cd $WARDEN_RUNTIME_ROOT && . .venv/bin/activate 2>/dev/null || true; python - <<"PY"
from src.db_writer import get_connection
with get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SHOW BINARY LOGS")
        logs = cur.fetchall()
        total = sum(int(row.get("File_size") or 0) for row in logs)
        print(f"binlogs={len(logs)} total_gb={total/1024/1024/1024:.2f}")
PY'
```

Execução pontual conservadora:

```bash
ssh USER@HOST 'cd $WARDEN_RUNTIME_ROOT && \
  . .venv/bin/activate 2>/dev/null || true; \
  .venv/bin/python scripts/warden_clean.py --purge-binlogs-days 2 --optimize'
```

Automação por `.env`:

```env
WARDEN_CLEAN_BINLOG_RETENTION_DAYS=2
WARDEN_CLEAN_OPTIMIZE_ENABLED=1
WARDEN_CLEAN_OPTIMIZE_MIN_FREE_MB=512
WARDEN_CLEAN_OPTIMIZE_TABLES=warden_metrics,warden_alert_events,warden_ingest_registry
```

Manter `WARDEN_CLEAN_BINLOG_RETENTION_DAYS=0` quando os binlogs forem necessários para recuperação granular ou replicação. Não aplicar `OPTIMIZE TABLE` a schemas de negócio sem plano de janela, backup e rollback.

### 2.4 Arquivo semanal

Política: `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`. Antes de apagar manualmente, listar:

```bash
ssh USER@HOST 'du -sh $WARDEN_RUNTIME_ROOT/runtime/archive/weekly/* 2>/dev/null | sort -hr | head'
```

Não apagar snapshots em `runtime/export/` — são regenerados pelos jobs de export mas a API pode depender do último ficheiro válido.

### 2.5 O que nunca apaga

`scripts/warden_clean.sh` remove apenas artefactos regeneráveis e scoped ao Warden:

- temporários atómicos antigos em `runtime/export/*.tmp-*` e `runtime/archive/weekly/*.tmp-*`;
- entradas antigas em `runtime/cache/` (preserva `.gitkeep`);
- `__pycache__`, `.pytest_cache`, `*.pyc` e `*.pyo`, excluindo `.git`, `.venv` e `secrets`;
- ficheiros de editor/sistema antigos: `*~`, `.DS_Store`, `Thumbs.db`, `*.swp`, `*.swo`.

**Nunca apaga:** snapshots JSON ativos (`runtime/export/*.json`), arquivos semanais (`runtime/archive/weekly/*.json.gz`), backups, dumps, diretórios de aplicação, volumes Docker, dados de negócio, relay logs, secrets, virtualenvs nem `.env`. Binlogs MariaDB só são purgados quando `WARDEN_CLEAN_BINLOG_RETENTION_DAYS` está explicitamente configurado.

Retenção de arquivos semanais: apenas `scripts/weekly_archive.py` — não o runner diário.

## 3. Runner `warden_clean` (Overseer)

Fonte versionada: `scripts/warden_clean.sh`

O runner deve exportar `WARDEN_ROOT` ou `WARDEN_RUNTIME_ROOT` antes de executar o script. Marcador no crontab:

```text
# overseer:warden_clean
```

Dry-run remoto:

```bash
ssh USER@HOST 'cd $WARDEN_RUNTIME_ROOT && export WARDEN_ROOT=$PWD && bash scripts/warden_clean.sh --dry-run'
```

## 4. Proibido por defeito

Só com aprovação explícita do responsável:

- `rm -rf` em diretórios de aplicação ou dados de negócio;
- `docker system prune`;
- apagar binlogs MySQL manualmente fora de `scripts/warden_clean.py --purge-binlogs-days N`;
- `DELETE` SQL em massa fora do script versionado.

## 5. Validação pós-limpeza

```bash
ssh USER@HOST 'df -h; systemctl is-active warden; \
  ls -lh $WARDEN_RUNTIME_ROOT/runtime/export/*.json | head -3'
```

Validação do pipeline (snapshots frescos + serviço):

```bash
ssh USER@HOST 'cd $WARDEN_RUNTIME_ROOT && bash scripts/validate-pipeline.sh'
```

Ver também [`warden-pipeline.md`](warden-pipeline.md) (Fase 1 checklist e Fase 2 desenho).

Registar em `docs/ai/ops/HANDOFF.md`: uso de disco antes/depois, ações executadas, serviços verificados.

## 6. Host hygiene (logs SO e artefactos .bak)

Script: [`scripts/host-hygiene.sh`](../scripts/host-hygiene.sh) — separado do `warden_clean` (scope Warden).

| Variável | Função |
|---|---|
| `WARDEN_HUB_ROOT` | Limpeza `.bak_*` / `*.backup-*` no HUB |
| `HOST_HYGIENE_NGINX_HTML` | Limpeza `.bak` em `/usr/share/nginx/html` (default) |
| `HOST_HYGIENE_BAK_KEEP` | Cópias a manter por diretório (default: `1`) |
| `HOST_HYGIENE_SNAP_PRUNE_ENABLED` | Remover revisões snap desactivadas (default: `1`) |
| `HOST_HYGIENE_SNAP_RETAIN` | Revisões snap a reter por pacote via `refresh.retain` (default: `2`) |
| `WARDEN_CRONTAB_LOG_DIR` | Truncar logs crontab Overseer >5 MB |

**Não apaga:** `/BackupNGINX`, `/BackupDB`, snapshots `runtime/export/*.json`, dados de negócio, snaps activos. Apenas revisões snap marcadas como `disabled`. Binlogs MySQL são tratados apenas pelo Warden Clean quando configurado explicitamente.

### 6.1 Instalar sudo NOPASSWD (uma vez, com sudo interactivo)

```bash
sudo ln -sf $WARDEN_RUNTIME_ROOT/scripts/host-hygiene.sh /usr/local/sbin/warden-host-hygiene
sudo chmod +x $WARDEN_RUNTIME_ROOT/scripts/host-hygiene.sh
sudo install -m 440 $WARDEN_RUNTIME_ROOT/scripts/host-hygiene.sudoers /etc/sudoers.d/warden-host-hygiene
sudo visudo -cf /etc/sudoers.d/warden-host-hygiene
```

### 6.2 Dry-run e execução

```bash
export WARDEN_HUB_ROOT=/usr/share/nginx/html/hub
export WARDEN_CRONTAB_LOG_DIR=/var/log/overseer
/usr/local/sbin/warden-host-hygiene --dry-run
/usr/local/sbin/warden-host-hygiene
```

Windows:

```powershell
.\scripts\run-production-cleanup.ps1 -DryRunOnly
.\scripts\run-production-cleanup.ps1 -SkipWarden   # só host-hygiene
```

### 6.3 Cron produção

Marcador: `# overseer:host_hygiene` (ver [`scripts/crontab.example`](../scripts/crontab.example), linha 01:30 após `warden_clean`).
