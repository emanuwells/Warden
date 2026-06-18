<#
.SYNOPSIS
Valida a estrutura essencial do template Warden.
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

function Assert-File {
    param([string]$Path)
    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Ficheiro obrigatório ausente: $Path"
    }
}

function Assert-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path -PathType Container)) {
        throw "Pasta obrigatória ausente: $Path"
    }
}

@('AGENTS.md','README.md','COMMANDS.md','CHANGELOG.md','VERSION','LICENSE','.env.example','.editorconfig','.gitattributes','.gitignore','.gitignore.template','.github/SECURITY.md','docs/governance/CONTRIBUTING.md','docs/templates/PROJECT_CONTEXT.template.md') | ForEach-Object { Assert-File $_ }
@('.github','docs','docs/ai','docs/architecture','docs/adr','docs/governance','docs/templates','tasks','scripts','tools','tools/ai-adapters') | ForEach-Object { Assert-Dir $_ }
@('docs/ai/DAILY_AGENT_WORKFLOW.md','docs/ai/policies/CONTEXT_BUDGET_POLICY.md','docs/architecture/overview.md','docs/architecture/frontend.md','docs/architecture/backend.md','docs/architecture/database.md','docs/architecture/deployment.md','docs/architecture/decisions.md') | ForEach-Object { Assert-File $_ }

@('CONTRIBUTING.md','SECURITY.md','PROJECT_CONTEXT.template.md') | ForEach-Object {
    if (Test-Path $_) {
        throw "Ficheiro não deve estar na raiz por defeito: $_"
    }
}

@('.cursor','.claude','.codex','.devin','.vscode','.cursorrules','.windsurfrules','CLAUDE.md','GEMINI.md') | ForEach-Object {
    if (Test-Path $_) {
        throw "Adaptador ativo na raiz por defeito: $_"
    }
}

if (Test-Path '.github/copilot-instructions.md') {
    throw 'Adaptador Copilot ativo na raiz por defeito.'
}

$AgentsLines = (Get-Content 'AGENTS.md').Count
if ($AgentsLines -gt 220) {
    throw "AGENTS.md demasiado longo: $AgentsLines linhas. Objetivo: <= 220."
}

$Version = (Get-Content 'VERSION' -Raw).Trim()
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION não usa SemVer: $Version"
}

Write-Host "Template válido. Versão: $Version. AGENTS.md: $AgentsLines linhas."