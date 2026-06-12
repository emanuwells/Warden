param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [switch]$DryRunOnly,
    [switch]$SkipWarden
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

Write-Host "[Warden] Diagnóstico inicial..."
Invoke-WardenRemote -Command @"
set -e
echo '=== df ==='
df -h / 2>/dev/null | tail -1
echo '=== Warden runtime ==='
du -sh $wardenRoot/runtime/* 2>/dev/null || true
"@

if (-not $SkipWarden) {
    Write-Host "[Warden] warden_clean..."
    $dryRunFlag = if ($DryRunOnly) { '--dry-run' } else { '' }
    Invoke-WardenRemote -Command @"
set -e
cd $wardenRoot
if test -x scripts/warden_clean.sh; then
  bash scripts/warden_clean.sh $dryRunFlag
else
  echo 'scripts/warden_clean.sh não encontrado'
  exit 1
fi
"@

}

Write-Host "[Warden] Validação final..."
Invoke-WardenRemote -Command @"
df -h / 2>/dev/null | tail -1
systemctl is-active warden 2>/dev/null || true
"@

Write-Host "[Warden] Concluído."
