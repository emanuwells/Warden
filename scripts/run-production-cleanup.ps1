param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [switch]$DryRunOnly,
    [switch]$SkipWarden,
    [switch]$SkipHostHygiene
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Resolve-RepoPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return (Join-Path (Get-RepoRoot) $Path)
}

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Ficheiro de deploy não encontrado: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') {
            continue
        }

        $parts = $trimmed -split '=', 2
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-EnvValue {
    param(
        [hashtable]$Values,
        [string[]]$Keys,
        [string]$Default = ''
    )

    foreach ($key in $Keys) {
        if ($Values.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$key])) {
            return [string]$Values[$key]
        }
    }

    return $Default
}

function Invoke-WardenRemote {
    param([string]$Command)

    & (Join-Path (Get-RepoRoot) 'scripts\Invoke-WardenSsh.ps1') `
        -DeployEnvPath $DeployEnvPath `
        -RemoteCommand $Command
}

$deployEnvFile = Resolve-RepoPath -Path $DeployEnvPath
$envValues = Read-EnvFile -Path $deployEnvFile
$wardenRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_RUNTIME_ROOT', 'WARDEN_ROOT') -Default ''
if ([string]::IsNullOrWhiteSpace($wardenRoot)) {
    throw 'Definir WARDEN_RUNTIME_ROOT em secrets/production.deploy.local.env'
}
$wardenHubRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_HUB_ROOT') -Default ''
$wardenCrontabLogDir = Get-EnvValue -Values $envValues -Keys @('WARDEN_CRONTAB_LOG_DIR') -Default ''

function Invoke-WardenDiskDiagnosis {
    param([string]$Label)

    Write-Host "[Warden] Diagnóstico $Label..."
    Invoke-WardenRemote -Command @"
set -e
echo '=== df ==='
df -h / 2>/dev/null | tail -1
echo '=== top consumers ==='
du -xh /var/lib/mysql /var/log /home /var/cache /BackupDB /BackupNGINX $wardenRoot/runtime 2>/dev/null | sort -hr | head -20 || true
echo '=== journald ==='
journalctl --disk-usage 2>/dev/null || true
echo '=== binlogs ==='
cd $wardenRoot && .venv/bin/python - <<'PY'
from src.db_writer import get_connection
with get_connection() as c:
    with c.cursor() as cur:
        cur.execute('SHOW BINARY LOGS')
        logs = cur.fetchall()
        total = sum(int(r.get('File_size') or 0) for r in logs)
        print(f'binlogs={len(logs)} total_gb={total / 1024 ** 3:.2f}')
PY
echo '=== Warden runtime ==='
du -sh $wardenRoot/runtime/* 2>/dev/null || true
"@
}

Invoke-WardenDiskDiagnosis -Label 'inicial'

if (-not $SkipWarden) {
    Write-Host "[Warden] warden_clean..."
    $dryRunFlag = if ($DryRunOnly) { '--dry-run' } else { '' }
    Invoke-WardenRemote -Command @"
set -e
cd $wardenRoot
export WARDEN_ROOT='$wardenRoot'
export WARDEN_CRONTAB_LOG_DIR='${wardenCrontabLogDir}'
if test -x scripts/warden_clean.sh; then
  bash scripts/warden_clean.sh $dryRunFlag
else
  echo 'scripts/warden_clean.sh não encontrado'
  exit 1
fi
"@
}

if (-not $SkipHostHygiene) {
    Write-Host "[Host] host-hygiene..."
    $hostDryRunFlag = if ($DryRunOnly) { '--dry-run' } else { '' }
    $hygieneScript = '/usr/local/sbin/warden-host-hygiene'
    Invoke-WardenRemote -Command @"
set -e
export WARDEN_HUB_ROOT='${wardenHubRoot}'
export WARDEN_CRONTAB_LOG_DIR='${wardenCrontabLogDir}'
if test -x $hygieneScript; then
  $hygieneScript $hostDryRunFlag
elif test -f $wardenRoot/scripts/host-hygiene.sh; then
  bash $wardenRoot/scripts/host-hygiene.sh $hostDryRunFlag
else
  echo 'host-hygiene não encontrado'
  exit 1
fi
"@
}

if (-not $DryRunOnly -and -not $SkipWarden) {
    Write-Host "[Warden] Purga binlogs + optimize (pontual)..."
    Invoke-WardenRemote -Command @"
set -e
cd $wardenRoot
.venv/bin/python scripts/warden_clean.py --purge-binlogs-days 2 --optimize
"@
}

Invoke-WardenDiskDiagnosis -Label 'final'
Invoke-WardenRemote -Command @"
systemctl is-active warden 2>/dev/null || true
"@

Write-Host "[Warden] Concluído."
