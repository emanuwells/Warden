#!/usr/bin/env node
/**
 * Guard determinístico e sem LLM para segredos e operações destrutivas.
 * Só atua em projetos que contenham `.agents/AGENTS.md`.
 */
import fs from 'node:fs';
import path from 'node:path';

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data || '{}'); } catch { return {}; }
}

function findProject(start) {
  let current = path.resolve(start || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(current, '.agents', 'AGENTS.md'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  }));
}

function collectPaths(input) {
  const values = [];
  for (const key of ['file_path', 'path', 'notebook_path']) {
    if (typeof input?.[key] === 'string') values.push(input[key]);
  }
  if (Array.isArray(input?.edits)) {
    for (const edit of input.edits) if (typeof edit?.file_path === 'string') values.push(edit.file_path);
  }
  return values.map(value => value.replaceAll('\\', '/'));
}

function firstMatch(command, rules) {
  for (const rule of rules) if (rule.pattern.test(command)) return rule.reason;
  return '';
}

function relativeProjectPath(project, value) {
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(project, value);
  const relative = path.relative(project, absolute).replaceAll('\\', '/');
  return relative.toLowerCase();
}

function isToolkitSource(project) {
  const packageFile = path.join(project, 'package.json');
  if (!fs.existsSync(packageFile)) return false;
  try { return JSON.parse(fs.readFileSync(packageFile, 'utf8')).name === 'wells-ai-toolkit'; }
  catch { return false; }
}

const input = await readStdin();
const project = findProject(input.cwd);
if (!project) process.exit(0);

const tool = String(input.tool_name || '');
const toolInput = input.tool_input || {};
const paths = collectPaths(toolInput);
const relativePaths = paths.map(value => relativeProjectPath(project, value));
const immutableRuntime = new Set(['.agents/agents.md', '.agents/index.md', '.agents/manifest.json']);
if (!isToolkitSource(project) && ['Edit', 'Write', 'MultiEdit'].includes(tool)) {
  const blocked = relativePaths.find(value => immutableRuntime.has(value));
  if (blocked) {
    decide('deny', `Ficheiro canónico WELLS gerido pelo Toolkit: ${blocked}. Usa PROJECT_CONTEXT.md, COMMANDS.md, estado ou extensões; para atualizar o runtime usa wells-toolkit sync.`);
    process.exit(0);
  }
}
const secretPatterns = [
  /(^|\/)\.env($|\.)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.pypirc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)\.aws\/credentials$/,
  /(^|\/)\.ssh\/(id_|config$|known_hosts$)/,
  /(^|\/)secrets?(\/|$)/,
  /(^|\/)credentials?(\/|\.|$)/,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)($|\.)/,
  /\.(pem|key|p12|pfx|jks|keystore)$/
];

for (const rawValue of paths) {
  const value = rawValue.toLowerCase();
  if (value.endsWith('/.env.example') || value === '.env.example' || value.endsWith('/credentials.example.json')) continue;
  if (secretPatterns.some(pattern => pattern.test(value))) {
    decide('deny', `Acesso bloqueado a ficheiro sensível: ${value}`);
    process.exit(0);
  }
}

if (tool !== 'Bash') process.exit(0);

const command = String(toolInput.command || '').trim();
const normalized = command.replace(/\s+/g, ' ');
const catastrophic = [
  { pattern: /(^|[;&|]\s*)rm\s+(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+(?:--\s+)?\/(?:\s|$)/i, reason: 'Remoção recursiva da raiz do sistema.' },
  { pattern: /\b(?:format|format-volume|clear-disk|initialize-disk)\b/i, reason: 'Formatação ou inicialização destrutiva de disco.' },
  { pattern: /(^|[;&|]\s*)diskpart(?:\.exe)?\b/i, reason: 'Execução de diskpart bloqueada.' },
  { pattern: /\bremove-item\b[^\n]*(?:-recurse\b[^\n]*-force|-force\b[^\n]*-recurse)[^\n]*(?:[a-z]:\\?\s*$|[a-z]:\\\*|\/\s*$)/i, reason: 'Remove-Item destrutivo sobre a raiz de um volume.' },
  { pattern: /\b(?:del|erase|rd|rmdir)\b[^\n]*\/(?:s|q)[^\n]*\/(?:s|q)[^\n]*(?:[a-z]:\\\*|[a-z]:\\?\s*$)/i, reason: 'Remoção destrutiva sobre a raiz de um volume.' },
  { pattern: /\bgit\s+clean\b[^\n]*-[a-z]*f[a-z]*[dx][a-z]*/i, reason: 'git clean pode eliminar ficheiros não rastreados sem recuperação.' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, reason: 'git reset --hard descarta alterações locais.' },
  { pattern: /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|-f)(?:\s|$)/i, reason: 'Force push bloqueado.' },
  { pattern: /\bdrop\s+database\b/i, reason: 'DROP DATABASE bloqueado.' },
  { pattern: /\bdrop\s+schema\b[^;\n]*\bcascade\b/i, reason: 'DROP SCHEMA ... CASCADE bloqueado.' },
  { pattern: /\bshutdown\b[^\n]*\/(?:s|p)\b/i, reason: 'Desligamento imediato do sistema bloqueado.' }
];

const confirmationRequired = [
  { pattern: /\bremove-item\b[^\n]*(?:-recurse|-force)/i, reason: 'Remove-Item recursivo/forçado pode apagar dados.' },
  { pattern: /\b(?:del|erase|rd|rmdir)\b[^\n]*\/(?:s|q)\b/i, reason: 'Remoção recursiva/silenciosa no Windows.' },
  { pattern: /\bclear-content\b/i, reason: 'Clear-Content elimina o conteúdo de ficheiros.' },
  { pattern: /\bgit\s+(?:checkout\s+--\s+\.|restore\s+(?:--source=\S+\s+)?(?:--worktree\s+)?(?:--staged\s+)?\.)/i, reason: 'Operação Git pode descartar alterações locais.' },
  { pattern: /\bgit\s+stash\s+(?:drop|clear)\b/i, reason: 'Remoção de stashes pode ser irreversível.' },
  { pattern: /\bdrop\s+(?:table|schema)\b/i, reason: 'DROP pode eliminar estrutura e dados.' },
  { pattern: /\btruncate\s+(?:table\s+)?/i, reason: 'TRUNCATE elimina todos os registos.' },
  { pattern: /\bdelete\s+from\b/i, reason: 'DELETE requer confirmação e validação do WHERE/backup.' },
  { pattern: /\bupdate\s+[\w.\[\]"`]+\s+set\b(?![\s\S]*\bwhere\b)/i, reason: 'UPDATE sem WHERE detetado.' },
  { pattern: /\bmerge\s+into\b/i, reason: 'MERGE pode alterar vários conjuntos de dados.' },
  { pattern: /\balter\s+table\b[^;\n]*\bdrop\s+column\b/i, reason: 'DROP COLUMN pode destruir dados.' },
  { pattern: /\bterraform\s+(?:apply|destroy)\b/i, reason: 'Alteração de infraestrutura requer confirmação.' },
  { pattern: /\bkubectl\s+(?:apply|delete|replace|patch)\b/i, reason: 'Alteração de cluster requer confirmação.' },
  { pattern: /\bdocker\s+(?:system|volume|builder)\s+prune\b/i, reason: 'Docker prune pode remover dados e caches.' },
  { pattern: /\bnpm\s+publish\b/i, reason: 'Publicação de pacote requer confirmação.' },
  { pattern: /\bgh\s+release\s+create\b/i, reason: 'Criação de release requer confirmação.' },
  { pattern: /\b(?:stop-computer|restart-computer)\b/i, reason: 'Desligar/reiniciar o sistema requer confirmação.' }
];

const catastrophicReason = firstMatch(normalized, catastrophic);
if (catastrophicReason) {
  decide('deny', `${catastrophicReason} Usa uma alternativa reversível e apresenta rollback.`);
  process.exit(0);
}

const confirmationReason = firstMatch(normalized, confirmationRequired);
if (confirmationReason) {
  decide('ask', `${confirmationReason} Confirma explicitamente impacto, âmbito e rollback antes de executar.`);
  process.exit(0);
}
