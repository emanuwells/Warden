param(
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [Parameter(Mandatory = $true)]
    [string]$RemoteCommand
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
        throw "Ficheiro de deploy não encontrado: $Path. Copie docs/resources/examples/secrets/production.deploy.local.env.example ou o ficheiro homólogo de WELLS_API."
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

function Get-SshArgs {
    param(
        [hashtable]$EnvValues,
        [string]$Target
    )

    $port = Get-EnvValue -Values $EnvValues -Keys @(
        'WARDEN_DEPLOY_SSH_PORT',
        'WELLS_API_DEPLOY_SSH_PORT',
        'API_DEPLOY_SSH_PORT'
    ) -Default '22'

    $keyPath = Join-Path (Get-RepoRoot) 'secrets/.ssh/id_ed25519'
    $sshArgs = @('-p', $port, $Target)

    if (Test-Path -LiteralPath $keyPath) {
        $sshArgs = @('-p', $port, '-i', $keyPath, '-o', 'BatchMode=yes', $Target)
    } else {
        $sshArgs = @('-p', $port, '-o', 'BatchMode=yes', $Target)
    }

    return $sshArgs
}

$deployEnvFile = Resolve-RepoPath -Path $DeployEnvPath
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
    throw 'O ficheiro de deploy deve definir host e utilizador SSH.'
}

$target = "$userName@$hostName"
$sshArgs = Get-SshArgs -EnvValues $envValues -Target $target
$normalized = ($RemoteCommand -replace "`r`n", "`n" -replace "`r", "").Trim()

$runtimeRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_RUNTIME_ROOT') 
$hubRoot = Get-EnvValue -Values $envValues -Keys @('WARDEN_HUB_ROOT')
if ($runtimeRoot -ne '') {
    $normalized = $normalized.Replace('$WARDEN_RUNTIME_ROOT', $runtimeRoot)
}
if ($hubRoot -ne '') {
    $normalized = $normalized.Replace('$WARDEN_HUB_ROOT', $hubRoot)
}

& ssh @sshArgs $normalized
if ($LASTEXITCODE -ne 0) {
    throw "Comando remoto falhou com código $LASTEXITCODE."
}
