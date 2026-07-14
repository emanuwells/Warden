<#
.SYNOPSIS
Valida a estrutura essencial do repositório Warden (alinhada com Repo template).
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
    'AGENTS.md','README.md','COMMANDS.md','CHANGELOG.md','VERSION','LICENSE',
    '.gitattributes','.gitignore',
    '.github/SECURITY.md','docs/governance/CONTRIBUTING.md',
    'docs/ROOT_STRUCTURE.md',
    'docs/resources/templates/PROJECT_CONTEXT.template.md',
    'docs/resources/templates/.gitignore.template',
    'docs/resources/templates/.env.example',
    'docs/resources/examples/secrets/README.md',
    'PROJECT_CONTEXT.md','src/requirements.txt',
    'docker/compose.dev.yml','docker/.dockerignore'
) | ForEach-Object { Assert-File $_ }

@(
    '.github','docs','docs/ai','docs/architecture','docs/adr','docs/governance',
    'docs/resources','docs/resources/templates','docs/resources/examples',
    'docs/resources/examples/secrets','docs/resources/examples/config',
    'tasks','scripts','tools','tools/ai-adapters',
    'src','public','docker','deploy','deploy/systemd','runtime','secrets'
) | ForEach-Object { Assert-Dir $_ }

@(
    'docs/ai/DAILY_AGENT_WORKFLOW.md',
    'docs/ai/policies/CONTEXT_BUDGET_POLICY.md',
    'docs/ai/policies/SECRETS_POLICY.md',
    'docs/ai/ops/HANDOFF.md',
    'docs/ai/ops/RUNBOOK.md',
    'docs/architecture/overview.md',
    'docs/architecture/deployment.md',
    'deploy/systemd/warden.service'
) | ForEach-Object { Assert-File $_ }

@(
    'CONTRIBUTING.md','SECURITY.md','PROJECT_CONTEXT.template.md',
    '.gitignore.template','.env.example','docker-compose.yml','warden.py','.dockerignore'
) | ForEach-Object {
    if (Test-Path $_) {
        throw "Ficheiro não deve estar na raiz: $_"
    }
}

@('.cursor','.claude','.codex','.devin','.vscode','.cursorrules','.windsurfrules','CLAUDE.md','GEMINI.md','.agents') | ForEach-Object {
    if (Test-Path $_) {
        throw "Item não deve estar na raiz por defeito: $_"
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

Write-Host "Estrutura válida. Versão: $Version. AGENTS.md: $AgentsLines linhas."
