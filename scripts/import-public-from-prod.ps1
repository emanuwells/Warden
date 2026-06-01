param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [string]$RemoteHubRoot = '/usr/share/nginx/html/MAIATRON-HUB',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Resolve-RepoPath {
    param([string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    return (Join-Path (Get-RepoRoot) $Path)
}

function Read-EnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Ficheiro de deploy nao encontrado: $Path"
    }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') { continue }
        $parts = $trimmed -split '=', 2
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Get-EnvValue {
    param([hashtable]$Values, [string[]]$Keys, [string]$Default = '')
    foreach ($key in $Keys) {
        if ($Values.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$key])) {
            return [string]$Values[$key]
        }
    }
    return $Default
}

$repoRoot = Get-RepoRoot
$envValues = Read-EnvFile -Path (Resolve-RepoPath -Path $DeployEnvPath)
$hostName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_HOST', 'WELLS_API_DEPLOY_SSH_HOST')
$userName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_USER', 'WELLS_API_DEPLOY_SSH_USER')
$port = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_PORT', 'WELLS_API_DEPLOY_SSH_PORT') -Default '22'
if ($hostName -eq '' -or $userName -eq '') { throw 'Host/user SSH em falta.' }

$keyPath = Join-Path $repoRoot 'secrets\.ssh\id_ed25519'
if (-not (Test-Path -LiteralPath $keyPath)) { throw "Chave SSH nao encontrada: $keyPath" }

$tempKey = Join-Path $env:TEMP "warden_import_key_$PID"
Copy-Item -LiteralPath $keyPath -Destination $tempKey -Force
icacls $tempKey /inheritance:r | Out-Null
icacls $tempKey /grant:r "$($env:USERNAME):(R)" | Out-Null

$target = "${userName}@${hostName}"
$hubRoot = Join-Path $repoRoot 'deploy\hub'
$remotePairs = @(
    @{ Local = 'frontend\apps\warden'; Remote = "$RemoteHubRoot/frontend/apps/warden" },
    @{ Local = 'backend\apps\warden'; Remote = "$RemoteHubRoot/backend/apps/warden" },
    @{ Local = 'backend\public\apps\warden'; Remote = "$RemoteHubRoot/backend/public/apps/warden" }
)

foreach ($pair in $remotePairs) {
    $localDir = Join-Path $hubRoot $pair.Local
    if (-not (Test-Path -LiteralPath $localDir)) {
        New-Item -ItemType Directory -Force -Path $localDir | Out-Null
    }
    $scpArgs = @('-r', '-P', $port, '-i', $tempKey, "${target}:$($pair.Remote)/.", $localDir)
    Write-Host "[import] $($pair.Remote) -> $localDir"
    if ($DryRun) {
        Write-Host "  dry-run: scp $($scpArgs -join ' ')"
        continue
    }
    & scp @scpArgs
    if ($LASTEXITCODE -ne 0) {
        throw "scp falhou para $($pair.Remote)"
    }
}

Write-Host '[import] Concluido em deploy/hub/. Dev local: public/www/ (manter api.php e dev-auth-stub.js); assets UI podem copiar-se de deploy/hub/frontend/apps/warden/.'
