param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [switch]$SkipBuild,
    [switch]$StartDev
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
        throw "Ficheiro de deploy não encontrado: $Path. Copie secrets/production.deploy.local.env.example."
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') {
            continue
        }

        $parts = $trimmed -split '=', 2
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $values[$key] = $value
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

$repoRoot = Get-RepoRoot
$deployEnvFile = Resolve-RepoPath -Path $DeployEnvPath
$exportDir = Join-Path $repoRoot 'runtime\export'
$keyPath = Join-Path $repoRoot 'secrets\.ssh\id_ed25519'

$envValues = Read-EnvFile -Path $deployEnvFile
$hostName = Get-EnvValue -Values $envValues -Keys @(
    'WARDEN_DEPLOY_SSH_HOST',
    'WELLS_API_DEPLOY_SSH_HOST',
    'API_DEPLOY_SSH_HOST'
)
$userName = Get-EnvValue -Values $envValues -Keys @(
    'WARDEN_DEPLOY_SSH_USER',
    'WELLS_API_DEPLOY_SSH_USER',
    'API_DEPLOY_SSH_USER'
)

if ($hostName -eq '' -or $userName -eq '') {
    throw 'O ficheiro de deploy deve definir WARDEN_DEPLOY_SSH_HOST e WARDEN_DEPLOY_SSH_USER.'
}

if (-not (Test-Path -LiteralPath $keyPath)) {
    throw "Chave SSH em falta: $keyPath"
}

if (-not (Test-Path -LiteralPath $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
}

Write-Host "Sync SCP (read-only): ${userName}@${hostName} -> runtime/export/"
Write-Host "Pré-requisito: snapshots em producao em `${WARDEN_RUNTIME_ROOT}/runtime/export/`"

Push-Location $repoRoot
try {
    $composeArgs = @('-f', 'docker-compose.sync.yml', 'run', '--rm', 'warden-sync-prod')
    if (-not $SkipBuild) {
        & docker compose -f docker-compose.sync.yml build warden-sync-prod
        if ($LASTEXITCODE -ne 0) { throw 'docker compose build falhou' }
    }

    & docker compose @composeArgs
    if ($LASTEXITCODE -ne 0) { throw 'docker compose run warden-sync-prod falhou' }

    $required = @(
        'warden_fast_snapshot.json',
        'warden_heavy_snapshot.json',
        'warden_payload.json'
    )
    foreach ($name in $required) {
        $path = Join-Path $exportDir $name
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Snapshot em falta após sync: $name"
        }
        $item = Get-Item -LiteralPath $path
        Write-Host "  $($item.Name): $($item.Length) bytes, $($item.LastWriteTime)"
    }

    if ($StartDev) {
        $devArgs = @()
        if ($SkipBuild) { $devArgs += '-SkipBuild' }
        & (Join-Path $repoRoot 'scripts\start-warden-dev.ps1') @devArgs
    } else {
        Write-Host ''
        Write-Host 'Proximo passo: .\scripts\start-warden-dev.ps1'
        Write-Host 'UI:  http://127.0.0.1:8080/'
        Write-Host 'API: http://127.0.0.1:8080/api.php?action=ops_fast'
    }
} finally {
    Pop-Location
}
