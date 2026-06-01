param(
    [switch]$SkipBuild,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

$repoRoot = Get-RepoRoot
$exportDir = Join-Path $repoRoot 'runtime\export'
$required = @(
    'warden_fast_snapshot.json',
    'warden_heavy_snapshot.json',
    'warden_payload.json'
)

$missing = @($required | Where-Object { -not (Test-Path -LiteralPath (Join-Path $exportDir $_)) })
if ($missing.Count -gt 0) {
    Write-Warning "Snapshots em falta em runtime/export: $($missing -join ', ')"
    Write-Warning "De producao (read-only): .\scripts\sync-prod-snapshots.ps1"
    Write-Warning "Ou localmente: warden.py --once e export_payload.py --mode fast|heavy|full"
}

$publicWarden = Join-Path $repoRoot 'public\www\index.html'
if (-not (Test-Path -LiteralPath $publicWarden)) {
    throw "public/www/ em falta. Copiar UI de deploy/hub ou import-public-from-prod.ps1"
}

Push-Location $repoRoot
try {
    $composeArgs = @('-f', 'docker-compose.yml', 'up')
    if (-not $SkipBuild) { $composeArgs += '--build' }
    $composeArgs += '-d'
    & docker compose @composeArgs
    if ($LASTEXITCODE -ne 0) { throw 'docker compose falhou' }

    if (-not $SkipSmoke) {
        Start-Sleep -Seconds 3
        $base = 'http://127.0.0.1:8080'
        $ui = "$base/"
        $api = "$base/api.php?action=ops_fast"
        try {
            $r1 = Invoke-WebRequest -Uri $ui -UseBasicParsing -TimeoutSec 30
            Write-Host "Smoke UI: HTTP $($r1.StatusCode) $ui"
        } catch {
            Write-Warning "Smoke UI falhou: $($_.Exception.Message)"
        }
        try {
            $r2 = Invoke-WebRequest -Uri $api -UseBasicParsing -TimeoutSec 30
            Write-Host "Smoke API: HTTP $($r2.StatusCode) $api"
        } catch {
            $code = 0
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode.value__ }
            if ($code -eq 401 -or $code -eq 403) {
                Write-Host "Smoke API: HTTP $code (inesperado em dev; verificar WARDEN_DEV_SKIP_AUTH)"
            } else {
                Write-Warning "Smoke API: HTTP $code - $($_.Exception.Message)"
            }
        }
    }

    Write-Host 'Dev stack ativo. Parar: docker compose -f docker-compose.yml down'
} finally {
    Pop-Location
}
