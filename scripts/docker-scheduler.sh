#!/usr/bin/env bash
set -euo pipefail

cd /app

mkdir -p runtime/logs runtime/cache runtime/export runtime/archive/weekly

# Export current container env for cron jobs.
{
  while IFS='=' read -r name value; do
    printf 'export %s=%q\n' "$name" "$value"
  done < <(env)
} > runtime/.cron_env

chmod 600 runtime/.cron_env

crontab scripts/docker.crontab
exec cron -f -L 15
