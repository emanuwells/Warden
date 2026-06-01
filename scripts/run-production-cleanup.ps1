param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [switch]$DryRunOnly,
    [switch]$SkipCleanTron,
    [switch]$SkipWarden,
    [switch]$EnableMysqlCleanup
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
$wardenRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_RUNTIME_ROOT') -Default '/home/eferreira/MAIATRON/Warden'
$sudoPassword = Get-EnvValue -Values $envValues -Keys @('WARDEN_SUDO_PASSWORD')

Write-Host "[Warden] Diagnóstico inicial..."
Invoke-WardenRemote -Command @"
set -e
echo '=== df ==='
df -h / 2>/dev/null | tail -1
echo '=== Warden runtime ==='
du -sh $wardenRoot/runtime/* 2>/dev/null || true
"@

if (-not $SkipWarden) {
    Write-Host "[Warden] Limpeza Warden (janitor, logs, db_monitor history)..."
    Invoke-WardenRemote -Command @"
set -e
cd $wardenRoot
if test -x .venv/bin/python; then
  .venv/bin/python scripts/janitor.py
fi
find $wardenRoot/runtime/logs -maxdepth 1 -type f \( -name '*.log' -o -name '*.err.log' \) -size +1M -exec truncate -s 0 {} + 2>/dev/null || true
truncate -s 0 $wardenRoot/runtime/db_monitor_history.jsonl 2>/dev/null || true
truncate -s 0 /home/eferreira/D4MAIA/_crontab_logs/crontab_weather.txt 2>/dev/null || true
echo 'Warden cleanup done'
"@

}

if (-not $SkipCleanTron) {
    $cleantron = '/usr/local/sbin/maiatron_weekly_housekeeping.sh'
    $mysqlFlag = if ($EnableMysqlCleanup) { 'ENABLE_MYSQL_CLEANUP=1 ' } else { '' }

    function Invoke-CleanTron {
        param([switch]$DryRun)

        $flag = if ($DryRun) { '--dry-run' } else { '' }
        Write-Host "[Warden] CleanTron $flag ..."

        try {
            if ($sudoPassword -ne '') {
                $escaped = $sudoPassword.Replace("'", "'\''")
                Invoke-WardenRemote -Command "echo '$escaped' | sudo -S ${mysqlFlag}$cleantron $flag"
            } else {
                Invoke-WardenRemote -Command "sudo -n ${mysqlFlag}$cleantron $flag"
            }
        } catch {
            Write-Warning "CleanTron falhou (sudo). Define WARDEN_SUDO_PASSWORD em secrets/production.deploy.local.env ou executa manualmente: sudo $cleantron $flag"
            if ($sudoPassword -eq '') {
                Write-Warning $_.Exception.Message
            } else {
                throw
            }
        }
    }

    Invoke-CleanTron -DryRun
    if (-not $DryRunOnly) {
        Invoke-CleanTron
    }
}

Write-Host "[Warden] Validação final..."
Invoke-WardenRemote -Command @"
df -h / 2>/dev/null | tail -1
systemctl is-active warden 2>/dev/null || true
"@

Write-Host "[Warden] Concluído."
