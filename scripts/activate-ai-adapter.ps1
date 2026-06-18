<#
.SYNOPSIS
Ativa um adaptador de IA/IDE copiando os ficheiros necessários para a raiz do repositório.

.EXAMPLE
./scripts/activate-ai-adapter.ps1 -Adapter cursor
./scripts/activate-ai-adapter.ps1 -Adapter claude -Force
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('cursor','claude','codex','gemini','copilot','vscode','windsurf','devin','list')]
    [string]$Adapter,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$AdaptersRoot = Join-Path $RepoRoot 'tools/ai-adapters'

function Copy-AdapterPath {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRel,
        [Parameter(Mandatory = $true)][string]$TargetRel
    )

    $Source = Join-Path $AdaptersRoot $SourceRel
    $Target = Join-Path $RepoRoot $TargetRel

    if (-not (Test-Path $Source)) {
        throw "Fonte não encontrada: $Source"
    }

    if ((Test-Path $Target) -and (-not $Force)) {
        throw "Destino já existe: $Target. Usa -Force para sobrescrever."
    }

    $TargetParent = Split-Path $Target -Parent
    if (-not (Test-Path $TargetParent)) {
        New-Item -ItemType Directory -Path $TargetParent | Out-Null
    }

    if (Test-Path $Target) {
        Remove-Item $Target -Recurse -Force
    }

    Copy-Item $Source $Target -Recurse -Force
    Write-Host "Ativado: $TargetRel"
}

if ($Adapter -eq 'list') {
    Get-ChildItem $AdaptersRoot -Directory | Select-Object -ExpandProperty Name | Sort-Object
    exit 0
}

switch ($Adapter) {
    'cursor' {
        Copy-AdapterPath 'cursor/.cursor' '.cursor'
        Copy-AdapterPath 'cursor/.cursorrules' '.cursorrules'
    }
    'claude' {
        Copy-AdapterPath 'claude/CLAUDE.md' 'CLAUDE.md'
        Copy-AdapterPath 'claude/.claude' '.claude'
    }
    'codex' {
        Copy-AdapterPath 'codex/.codex' '.codex'
    }
    'gemini' {
        Copy-AdapterPath 'gemini/GEMINI.md' 'GEMINI.md'
    }
    'copilot' {
        Copy-AdapterPath 'github-copilot/.github/copilot-instructions.md' '.github/copilot-instructions.md'
    }
    'vscode' {
        Copy-AdapterPath 'vscode/.vscode' '.vscode'
    }
    'windsurf' {
        Copy-AdapterPath 'windsurf/.windsurfrules' '.windsurfrules'
    }
    'devin' {
        Copy-AdapterPath 'devin/.devin' '.devin'
    }
}

Write-Host "Adaptador '$Adapter' ativado. Confirma o diff antes de commitar."