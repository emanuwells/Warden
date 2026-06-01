# Produção — Acesso SSH e limpeza segura de disco

Runbook operacional para o host MAIATRON. **Não versionar** hostnames, passwords nem chaves privadas.

Documentação relacionada:

- [`Guia_Producao_Step_by_Step.md`](Guia_Producao_Step_by_Step.md)
- [`CleanTron.md`](CleanTron.md)
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
| `sudo` | CleanTron; opcional `WARDEN_SUDO_PASSWORD` no `.env` local para scripts |

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
echo "=== CleanTron ==="
ls -l /usr/local/sbin/maiatron_weekly_housekeeping.sh 2>/dev/null || true
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

### 2.2 Janitor (métricas antigas)

```bash
ssh USER@HOST 'cd /home/eferreira/MAIATRON/Warden && \
  . .venv/bin/activate 2>/dev/null || true; \
  .venv/bin/python scripts/janitor.py'
```

Retenção por omissão: `RETENTION_DAYS=7` (`.env`).

### 2.3 Arquivo semanal

Política: `WEEKLY_ARCHIVE_RETENTION_WEEKS=6`. Antes de apagar manualmente, listar:

```bash
ssh USER@HOST 'du -sh /home/eferreira/MAIATRON/Warden/runtime/archive/weekly/* 2>/dev/null | sort -hr | head'
```

Não apagar snapshots em `runtime/export/` — são regenerados pelos jobs de export mas a API pode depender do último ficheiro válido.

## 3. CleanTron (host, root, conservador)

Fonte versionada: `scripts/maiatron_weekly_housekeeping.sh`  
Instalação típica: `/usr/local/sbin/maiatron_weekly_housekeeping.sh`

**Ordem obrigatória:**

```bash
ssh USER@HOST 'sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh --dry-run'
```

Rever o output. Se estiver correto:

```bash
ssh USER@HOST 'sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh'
```

O script trata de:

- journald até 300M;
- logs rotativos antigos em `/var/log` (>7 dias, extensões seguras);
- ficheiros temporários antigos em `/tmp` e `/var/tmp` (não apaga diretórios nem `*.lock`/`*.pid`/`*.sock`);
- crash reports antigos em `/var/crash`;
- `apt-get clean`, cache snap, `snap refresh.retain=2`.

### MySQL (opt-in)

Limpeza de `BAZE.logs` (>30 dias) **desligada por omissão**. Só executar com autorização explícita:

```bash
ssh USER@HOST 'sudo ENABLE_MYSQL_CLEANUP=1 /usr/local/sbin/maiatron_weekly_housekeeping.sh --dry-run'
# depois, se aprovado:
ssh USER@HOST 'sudo ENABLE_MYSQL_CLEANUP=1 /usr/local/sbin/maiatron_weekly_housekeeping.sh'
```

## 4. Proibido por defeito

Só com aprovação explícita do responsável:

- `rm -rf` em diretórios de aplicação ou dados de negócio;
- `docker system prune` (não documentado para este host);
- apagar binlogs MySQL manualmente (retenção em `/etc/mysql/conf.d/99-maiatron-binlog-retention.cnf`);
- `DELETE` SQL em massa fora do script versionado.

## 5. Validação pós-limpeza

```bash
ssh USER@HOST 'df -h; systemctl is-active warden; \
  curl -sf "http://127.0.0.1/MAIATRON/apps/warden/api.php?action=ops_fast" | head -c 200'
```

Registar em `HANDOFF.md`: uso de disco antes/depois, ações executadas, serviços verificados.

## 6. Instalar ou atualizar CleanTron a partir do repo

No servidor, após `git pull` em `WARDEN_ROOT`:

```bash
sudo install -m 750 -o root -g root \
  /home/eferreira/MAIATRON/Warden/scripts/maiatron_weekly_housekeeping.sh \
  /usr/local/sbin/maiatron_weekly_housekeeping.sh
```

Agendamento root (domingo 03:20):

```text
20 3 * * 0 /usr/local/sbin/maiatron_weekly_housekeeping.sh
```
