# CleanTron

O `CleanTron` é o housekeeping semanal conservador do host MAIATRON, versionado neste repo.

- Script ativo no cron root:
  - `/usr/local/sbin/maiatron_weekly_housekeeping.sh`
- Cópia de referência versionada:
  - `scripts/maiatron_weekly_housekeeping.sh`

Agendamento atual (root crontab):
- `20 3 * * 0` (domingo 03:20)

Execução manual:
- `./scripts/maiatron_weekly_housekeeping.sh --dry-run`
- `sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh --dry-run`
- `sudo /usr/local/sbin/maiatron_weekly_housekeeping.sh`

Notas operacionais:
- Fora de `--dry-run`, o script exige `root`.
- A limpeza MySQL fica desligada por omissão; ativar com `ENABLE_MYSQL_CLEANUP=1`.
- A retenção de binlogs já é gerida por `/etc/mysql/conf.d/99-maiatron-binlog-retention.cnf`.
- A limpeza de temporários remove apenas ficheiros regulares antigos; não apaga diretórios, caches nem ficheiros `*.lock`, `*.pid` ou `*.sock`.
- A limpeza de `/var/crash` remove apenas ficheiros `*.crash`, `*.upload` e `*.uploaded` com mais de 30 dias.
- O script nao limpa `/var/lib/systemd/coredump`; essa retenção já é gerida pelo sistema via `tmpfiles.d`.

Limpeza de disco e acesso SSH: ver também [`Producao_Acesso_e_Limpeza.md`](Producao_Acesso_e_Limpeza.md).

Estado git do MAIATRON:
- `Warden/` é o repo canónico para versionar o `CleanTron`.
- `Overseer/` continua separado e deve manter-se limpo.
