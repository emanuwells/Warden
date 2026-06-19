param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [string]$RemoteHubRoot = '',
    [switch]$DryRun,
    [switch]$SkipValidation,
    [switch]$Rollback,
    [string]$RollbackFrom = ''
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
    if (-not (Test-Path -LiteralPath $Path)) { throw "Deploy env nao encontrado: $Path" }
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

function Get-SshScpArgs {
    param([string]$Target, [hashtable]$EnvValues)
    $port = Get-EnvValue -Values $EnvValues -Keys @('WARDEN_DEPLOY_SSH_PORT', 'WELLS_API_DEPLOY_SSH_PORT') -Default '22'
    $keyPath = Join-Path (Get-RepoRoot) 'secrets\.ssh\id_ed25519'
    $ssh = @('-p', $port, $Target)
    $scp = @('-P', $port)
    if (Test-Path -LiteralPath $keyPath) {
        $ssh = @('-p', $port, '-i', $keyPath, $Target)
        $scp = @('-P', $port, '-i', $keyPath)
    }
    return @{ Ssh = $ssh; Scp = $scp }
}

function Invoke-Remote {
    param([string[]]$SshArgs, [string]$Command)
    & ssh @SshArgs $Command
    if ($LASTEXITCODE -ne 0) { throw "Comando remoto falhou (exit $LASTEXITCODE)" }
}

function Test-PhpSyntax {
    param([string]$RepoRoot)
    $phpFiles = @(
        (Join-Path $RepoRoot 'deploy\hub\backend\apps\warden\api.php'),
        (Join-Path $RepoRoot 'deploy\hub\backend\public\apps\warden\api.php')
    )
    foreach ($f in $phpFiles) {
        if (-not (Test-Path -LiteralPath $f)) { throw "Ficheiro em falta: $f" }
        $out = & php -l $f 2>&1
        if ($LASTEXITCODE -ne 0) { throw "php -l falhou em ${f}: $out" }
        Write-Host "php -l OK: $f"
    }
}

$repoRoot = Get-RepoRoot
$hubRoot = Join-Path $repoRoot 'deploy\hub'
$deployEnv = Resolve-RepoPath -Path $DeployEnvPath
$envValues = Read-EnvFile -Path $deployEnv
$hostName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_HOST', 'WELLS_API_DEPLOY_SSH_HOST')
$userName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_USER', 'WELLS_API_DEPLOY_SSH_USER')
if ($RemoteHubRoot -eq '') {
    $RemoteHubRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_HUB_ROOT') -Default ''
}
if ($RemoteHubRoot -eq '') { throw 'Definir WARDEN_HUB_ROOT em secrets/production.deploy.local.env ou -RemoteHubRoot.' }
if ($hostName -eq '' -or $userName -eq '') { throw 'Host/user SSH em falta.' }

$target = "${userName}@${hostName}"
$sshScp = Get-SshScpArgs -Target $target -EnvValues $envValues

$publishMaps = @(
    @{ Local = 'frontend\apps\warden'; Remote = "$RemoteHubRoot/frontend/apps/warden" },
    @{ Local = 'backend\apps\warden'; Remote = "$RemoteHubRoot/backend/apps/warden" },
    @{ Local = 'backend\public\apps\warden'; Remote = "$RemoteHubRoot/backend/public/apps/warden" }
)

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

if ($Rollback) {
    foreach ($map in $publishMaps) {
        $remote = $map.Remote
        $backup = if ($RollbackFrom) { $RollbackFrom } else {
            (Invoke-Remote -SshArgs $sshScp.Ssh -Command "ls -1dt ${remote}.bak_* 2>/dev/null | head -1" | Out-String).Trim()
        }
        if ([string]::IsNullOrWhiteSpace($backup)) { throw "Sem backup para $remote" }
        Write-Host "Rollback $remote <- $backup"
        if (-not $DryRun) {
            Invoke-Remote -SshArgs $sshScp.Ssh -Command "set -e; rm -rf '$remote'; cp -a '$backup' '$remote'"
        }
    }
    Write-Host 'Rollback concluido.'
    exit 0
}

if (-not (Test-Path -LiteralPath $hubRoot)) {
    throw "deploy/hub/ nao encontrado. Executar import-public-from-prod.ps1"
}

if (-not $SkipValidation) {
    if (Get-Command php -ErrorAction SilentlyContinue) {
        Test-PhpSyntax -RepoRoot $repoRoot
    } else {
        Write-Warning 'php CLI nao encontrado; validacao omitida.'
    }
}

foreach ($map in $publishMaps) {
    $localDir = Join-Path $hubRoot $map.Local
    $remote = $map.Remote
    $remoteBackup = "${remote}.bak_${timestamp}"
    if (-not (Test-Path -LiteralPath $localDir)) { throw "Local em falta: $localDir" }

    Write-Host "Backup remoto: $remote -> $remoteBackup"
    if (-not $DryRun) {
        Invoke-Remote -SshArgs $sshScp.Ssh -Command @"
set -e
if [ -d '$remote' ]; then cp -a '$remote' '$remoteBackup'; else mkdir -p '$remote'; fi
"@
    }

    Write-Host "Publicar: $localDir -> ${target}:$remote/"
    if ($DryRun) { continue }

    & scp -r @($sshScp.Scp + @("${localDir}/.", "${target}:${remote}/"))
    if ($LASTEXITCODE -ne 0) { throw "scp falhou para $remote" }
}

Write-Host 'Publicacao HUB concluida (nao altera public/www local generico).'
