<#
.SYNOPSIS
Valida a estrutura essencial do repositório Warden (WELLS Agent Runtime 0.5.0).
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

@(
    'README.md','COMMANDS.md','CHANGELOG.md','VERSION','LICENSE',
    'CONTRIBUTING.md','SECURITY.md','PROJECT_CONTEXT.md',
    '.gitattributes','.gitignore',
    '.agents/AGENTS.md','.agents/INDEX.md','.agents/manifest.json',
    '.agents/toolkit-lock.json',
    '.github/SECURITY.md','docs/governance/CONTRIBUTING.md',
    'docs/ROOT_STRUCTURE.md',
    'docs/resources/templates/.gitignore.template',
    'docs/resources/templates/.env.example',
    'docs/resources/examples/secrets/README.md',
    'src/requirements.txt',
    'docker/compose.dev.yml','docker/.dockerignore'
) | ForEach-Object { Assert-File $_ }

@(
    '.agents','.agents/core','.agents/skills','.agents/workflows',
    '.agents/roles','.agents/policies','.agents/ops','.agents/mcp',
    '.agents/adapters','.agents/state','.agents/tools',
    '.github','docs','docs/architecture','docs/adr','docs/governance',
    'docs/resources','docs/resources/templates','docs/resources/examples',
    'docs/resources/examples/secrets','docs/resources/examples/config',
    'scripts','src','public','docker','deploy','deploy/systemd','runtime','secrets'
) | ForEach-Object { Assert-Dir $_ }

@(
    '.agents/core/DAILY_AGENT_WORKFLOW.md',
    '.agents/policies/CONTEXT_BUDGET_POLICY.md',
    '.agents/policies/SECRETS_POLICY.md',
    '.agents/state/HANDOFF.md',
    '.agents/ops/RUNBOOK.md',
    'docs/architecture/overview.md',
    'docs/architecture/deployment.md',
    'deploy/systemd/warden.service'
) | ForEach-Object { Assert-File $_ }

@(
    'AGENTS.md','PROJECT_CONTEXT.template.md',
    '.gitignore.template','.env.example','docker-compose.yml','warden.py','.dockerignore'
) | ForEach-Object {
    if (Test-Path $_) {
        throw "Ficheiro não deve estar na raiz: $_"
    }
}

@('.cursor','.claude','.codex','.devin','.vscode','.cursorrules','.windsurfrules','CLAUDE.md','GEMINI.md') | ForEach-Object {
    if (Test-Path $_) {
        throw "Item não deve estar na raiz por defeito: $_"
    }
}

if (Test-Path '.github/copilot-instructions.md') {
    throw 'Adaptador Copilot ativo na raiz por defeito.'
}

$Manifest = Get-Content '.agents/manifest.json' -Raw | ConvertFrom-Json
if ($Manifest.version -ne '0.5.0') {
    throw "Toolkit esperado 0.5.0; encontrado: $($Manifest.version)"
}

$AgentsWords = ((Get-Content '.agents/AGENTS.md' -Raw) -split '\s+').Where({ $_ }).Count
if ($AgentsWords -gt 700) {
    throw ".agents/AGENTS.md demasiado longo: $AgentsWords palavras. Objetivo: <= 700."
}

$Version = (Get-Content 'VERSION' -Raw).Trim()
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "VERSION não usa SemVer: $Version"
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    node .agents/tools/validate-project.mjs | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'validate-project.mjs falhou.'
    }
}

Write-Host "Estrutura válida. Warden: $Version. Toolkit: $($Manifest.version). AGENTS.md: $AgentsWords palavras."
