param(
    [string]$WellsApiRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'WELLS_API')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dst = Join-Path $repoRoot 'secrets'
$src = $WellsApiRoot

if (-not (Test-Path -LiteralPath (Join-Path $src 'secrets\production.deploy.local.env'))) {
    throw "WELLS_API não encontrado ou sem secrets: $src"
}

New-Item -ItemType Directory -Force -Path (Join-Path $dst '.ssh') | Out-Null

$files = @(
    @{ Src = 'secrets\production.deploy.local.env'; Dst = 'secrets\production.deploy.local.env' },
    @{ Src = 'secrets\platform.deploy.local.env'; Dst = 'secrets\platform.deploy.local.env' },
    @{ Src = 'secrets\environments.local.json'; Dst = 'secrets\environments.local.json' },
    @{ Src = 'secrets\.ssh\id_ed25519'; Dst = 'secrets\.ssh\id_ed25519' }
)

foreach ($item in $files) {
    $from = Join-Path $src $item.Src
    $to = Join-Path $repoRoot $item.Dst
    if (Test-Path -LiteralPath $from) {
        Copy-Item -LiteralPath $from -Destination $to -Force
        Write-Host "Copiado: $($item.Dst)"
    }
}

$deployEnv = Join-Path $dst 'production.deploy.local.env'
$content = Get-Content -LiteralPath $deployEnv -Raw
if ($content -notmatch 'WARDEN_RUNTIME_ROOT=') {
    Add-Content -LiteralPath $deployEnv -Value @(
        '',
        'WARDEN_DEPLOY_SSH_HOST=195.23.9.32',
        'WARDEN_DEPLOY_SSH_USER=eferreira',
        'WARDEN_DEPLOY_SSH_PORT=22',
        'WARDEN_RUNTIME_ROOT=/home/eferreira/MAIATRON/Warden'
    )
    Write-Host 'Adicionadas variáveis WARDEN_* ao production.deploy.local.env'
}

Write-Host 'Concluído. Testar: .\scripts\Invoke-WardenSsh.ps1 -RemoteCommand "hostname"'
