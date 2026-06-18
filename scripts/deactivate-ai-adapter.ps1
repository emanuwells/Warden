<#
.SYNOPSIS
Remove adaptadores de IA/IDE previamente ativados na raiz do repositório.

.EXAMPLE
./scripts/deactivate-ai-adapter.ps1 -Adapter cursor
./scripts/deactivate-ai-adapter.ps1 -Adapter all -DryRun
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('cursor','claude','codex','gemini','copilot','vscode','windsurf','devin','all')]
    [string]$Adapter,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Remove-AdapterPath {
    param([Parameter(Mandatory = $true)][string]$RelPath)

    $Target = Join-Path $RepoRoot $RelPath

    if ($DryRun) {
        if (Test-Path $Target) {
            Write-Host "Removeria: $RelPath"
        } else {
            Write-Host "Não existe: $RelPath"
        }
        return
    }

    if (Test-Path $Target) {
        Remove-Item $Target -Recurse -Force
        Write-Host "Removido: $RelPath"
    } else {
        Write-Host "Não existe: $RelPath"
    }
}

function Disable-OneAdapter {
    param([Parameter(Mandatory = $true)][string]$Name)

    switch ($Name) {
        'cursor' {
            Remove-AdapterPath '.cursor'
            Remove-AdapterPath '.cursorrules'
        }
        'claude' {
            Remove-AdapterPath 'CLAUDE.md'
            Remove-AdapterPath '.claude'
        }
        'codex' {
            Remove-AdapterPath '.codex'
        }
        'gemini' {
            Remove-AdapterPath 'GEMINI.md'
        }
        'copilot' {
            Remove-AdapterPath '.github/copilot-instructions.md'
        }
        'vscode' {
            Remove-AdapterPath '.vscode'
        }
        'windsurf' {
            Remove-AdapterPath '.windsurfrules'
        }
        'devin' {
            Remove-AdapterPath '.devin'
        }
    }
}

if ($Adapter -eq 'all') {
    foreach ($Item in @('cursor','claude','codex','gemini','copilot','vscode','windsurf','devin')) {
        Disable-OneAdapter $Item
    }
} else {
    Disable-OneAdapter $Adapter
}

Write-Host "Desativação concluída. Confirma o diff antes de commitar."