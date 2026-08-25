#!/usr/bin/env node
/**
 * WELLS AI Toolkit 1.3.0
 *
 * Gere a biblioteca universal `.agents/`, instala adaptadores pessoais opcionais
 * e aplica/migra projetos com simulação, backup, auditoria e preservação de estado.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { knowledgeCommand, auditKnowledge } from './lib/knowledge.mjs';
import { integrationsCommand, auditIntegrations } from './lib/integrations.mjs';
import { githubCommand } from './lib/github.mjs';

const TOOL_FILE = fileURLToPath(import.meta.url);
const TOOLKIT_ROOT = path.resolve(path.dirname(TOOL_FILE), '..', '..');
const RUNTIME_MANIFEST = JSON.parse(fs.readFileSync(path.join(TOOLKIT_ROOT, '.agents', 'manifest.json'), 'utf8'));
const VERSION = RUNTIME_MANIFEST.version;
const START = '<!-- WELLS AI TOOLKIT START -->';
const END = '<!-- WELLS AI TOOLKIT END -->';
const USER_HOME = path.resolve(process.env.WELLS_HOME || os.homedir());

const STATE_FILES = new Set([
  '.agents/state/TODO.md',
  '.agents/state/HANDOFF.md',
  '.agents/state/LESSONS.md',
  '.agents/state/DECISIONS.md',
  '.agents/state/EVIDENCE.md'
]);

const ROOT_DOCS = [
  'README.md',
  'PROJECT_CONTEXT.md',
  'COMMANDS.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'VERSION'
];

const ROOT_AGENT_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
const LEGACY_ROOTS = ['.ai', 'docs/ai', 'tools/ai-adapters'];
const PROVIDER_ROOTS = ['.claude', '.codex', '.cursor', '.gemini'];
const MANAGED_EXCLUDES = [
  '.agents/migration/',
  '.agents/toolkit-lock.json'
];
const RETIRED_MANAGED_FILES = [
  '.agents/templates/github/mirror.yml'
];
const IMMUTABLE_RUNTIME_FILES = new Set(RUNTIME_MANIFEST.immutableRuntimeFiles || [
  '.agents/AGENTS.md',
  '.agents/INDEX.md',
  '.agents/manifest.json'
]);

/** Converte argumentos CLI simples em objeto. */
function parseArgs(argv) {
  const output = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      output._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      output[key] = next;
      index += 1;
    } else {
      output[key] = true;
    }
  }
  return output;
}

/** Garante a existência de um diretório. */
function ensure(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

/** Cria um timestamp seguro para nomes de pasta. */
function stamp() {
  return new Date().toISOString().replaceAll(':', '-');
}

/** Calcula SHA-256 de um ficheiro. */
function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Lista ficheiros recursivamente, por ordem estável. */
function walk(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

/** Copia um ficheiro criando o diretório de destino. */
function copy(source, target) {
  ensure(path.dirname(target));
  fs.copyFileSync(source, target);
}

/** Copia uma árvore, substituindo o destino quando indicado. */
function copyTree(source, target, replace = false) {
  if (replace && fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  ensure(path.dirname(target));
  fs.cpSync(source, target, { recursive: true });
}

/** Normaliza um nome para slug seguro. */
function slugify(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 64) throw new Error('Nome inválido; usa até 64 caracteres alfanuméricos e hífenes.');
  return slug;
}

/** Encontra o template adjacente ou explicitamente indicado. */
function findTemplate(explicit) {
  const candidates = [
    explicit,
    process.env.WELLS_PROJECT_TEMPLATE_PATH,
    path.resolve(TOOLKIT_ROOT, '..', 'WELLS_Project_Template')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, '.agents', 'manifest.json'))) return resolved;
  }
  return null;
}

/** Escolhe a pasta de backups sem poluir a raiz quando existe Git. */
function backupRoot(project, id) {
  return fs.existsSync(path.join(project, '.git'))
    ? path.join(project, '.git', 'wells-ai-toolkit', 'backups', id)
    : path.join(project, '.wells-backups', id);
}

/** Guarda um ficheiro ou diretório antes de o alterar. */
function backup(project, relative, id) {
  const source = path.join(project, relative);
  if (!fs.existsSync(source)) return;
  const target = path.join(backupRoot(project, id), relative);
  ensure(path.dirname(target));
  fs.cpSync(source, target, { recursive: true });
}

/** Escapa texto para uma expressão regular. */
function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Insere ou atualiza apenas o bloco WELLS num ficheiro pessoal. */
function upsertBlock(target, block) {
  ensure(path.dirname(target));
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.wells-backup-${stamp()}`);
  const expression = new RegExp(`${regexEscape(START)}[\\s\\S]*?${regexEscape(END)}\\s*`, 'g');
  const cleaned = current.replace(expression, '').trim();
  fs.writeFileSync(target, `${cleaned ? `${cleaned}\n\n` : ''}${block.trim()}\n`, 'utf8');
}

/** Remove apenas blocos geridos pelo WELLS, preservando conteúdo externo. */
function removeManagedBlock(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { changed: false, removedFile: false };
  const current = fs.readFileSync(file, 'utf8');
  const expression = new RegExp(`${regexEscape(START)}[\\s\\S]*?${regexEscape(END)}\\s*`, 'g');
  const cleaned = current.replace(expression, '').trim();
  if (cleaned === current.trim()) return { changed: false, removedFile: false };
  if (!cleaned) {
    fs.rmSync(file, { force: true });
    return { changed: true, removedFile: true };
  }
  fs.writeFileSync(file, `${cleaned}\n`, 'utf8');
  return { changed: true, removedFile: false };
}

/** Devolve os ficheiros WELLS geridos dentro de `.agents/`. */
function managedFiles() {
  return walk(path.join(TOOLKIT_ROOT, '.agents'))
    .map(file => path.relative(TOOLKIT_ROOT, file).replaceAll('\\', '/'))
    .filter(relative => !MANAGED_EXCLUDES.some(exclude => relative === exclude || relative.startsWith(exclude)));
}

/** Constrói o lock determinístico do runtime distribuído. */
function runtimeLockFromToolkit() {
  const files = {};
  for (const relative of managedFiles()) files[relative] = hash(path.join(TOOLKIT_ROOT, relative));
  return { version: VERSION, files };
}

/** Executa Git localmente sem alterar rede/remotes. */
function runGit(project, args) {
  return spawnSync('git', args, { cwd: project, encoding: 'utf8' });
}

/** Evita aplicar sync WELLS sobre trabalho local ou upstream conhecido em atraso. */
function assertSyncGitPreflight(project) {
  if (!fs.existsSync(path.join(project, '.git'))) return;
  const status = runGit(project, ['status', '--porcelain']);
  if (status.error?.code === 'ENOENT') return;
  if (status.status !== 0) throw new Error(`Não foi possível validar Git antes do sync: ${status.stderr || status.stdout}`);
  if (String(status.stdout || '').trim()) {
    throw new Error('sync --apply requer working tree limpo. Faz commit/stash do trabalho do projeto e Pull antes de atualizar o runtime WELLS.');
  }

  const upstream = runGit(project, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstream.status !== 0) return;
  const divergence = runGit(project, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
  if (divergence.status !== 0) return;
  const [aheadRaw, behindRaw] = String(divergence.stdout || '').trim().split(/\s+/);
  const behind = Number(behindRaw || 0);
  if (behind > 0) {
    throw new Error(`branch está ${behind} commit(s) atrás do upstream conhecido. Faz Pull antes de sync --apply para evitar stash/merge conflicts no runtime WELLS.`);
  }
}

/** Lê o lockfile de sincronização. */
function readLock(project) {
  const target = path.join(project, '.agents', 'toolkit-lock.json');
  if (!fs.existsSync(target)) return { files: {} };
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch { return { files: {} }; }
}

/** Resolve a origem de um documento profissional da raiz. */
function rootDocSource(relative, template) {
  const fromTemplate = template && path.join(template, relative);
  if (fromTemplate && fs.existsSync(fromTemplate)) return fromTemplate;
  const local = path.join(TOOLKIT_ROOT, relative);
  return fs.existsSync(local) ? local : null;
}

/** Planeia apply/sync sem alterar o projeto. */
function planApply(project, mode, template) {
  const oldLock = readLock(project);
  const actions = [];
  const newLock = { version: VERSION, files: {} };

  for (const relative of managedFiles()) {
    const source = path.join(TOOLKIT_ROOT, relative);
    const target = path.join(project, relative);
    const sourceHash = hash(source);
    newLock.files[relative] = sourceHash;

    if (STATE_FILES.has(relative) && fs.existsSync(target)) {
      actions.push({ type: 'preserve-state', relative, source, target });
      continue;
    }
    if (!fs.existsSync(target)) {
      actions.push({ type: 'create', relative, source, target });
      continue;
    }
    const targetHash = hash(target);
    if (targetHash === sourceHash) {
      actions.push({ type: 'keep', relative, source, target });
      continue;
    }
    if (mode === 'sync' && IMMUTABLE_RUNTIME_FILES.has(relative)) {
      actions.push({ type: 'refresh-canonical', relative, source, target });
      continue;
    }
    const previous = oldLock.files?.[relative];
    if (mode === 'sync' && previous && targetHash === previous) {
      actions.push({ type: 'update', relative, source, target });
      continue;
    }
    actions.push({ type: 'candidate', relative, source, target });
  }

  for (const relative of RETIRED_MANAGED_FILES) {
    const target = path.join(project, relative);
    if (fs.existsSync(target)) actions.push({ type: 'retire', relative, target });
  }

  for (const relative of ROOT_DOCS) {
    const source = rootDocSource(relative, template);
    const target = path.join(project, relative);
    if (source && !fs.existsSync(target)) actions.push({ type: 'create-root', relative, source, target });
    else actions.push({ type: 'preserve-root', relative, source, target });
  }
  return { actions, newLock };
}

/** Mostra um plano legível. */
function printPlan(title, actions) {
  const labels = {
    create: 'CRIAR',
    update: 'ATUALIZAR',
    'refresh-canonical': 'REPOR CANÓNICO',
    candidate: 'CANDIDATO',
    keep: 'MANTER',
    'preserve-state': 'PRESERVAR ESTADO',
    'create-root': 'CRIAR RAIZ',
    'preserve-root': 'PRESERVAR RAIZ',
    retire: 'REMOVER OBSOLETO',
    'write-lock': 'GERAR LOCK'
  };
  console.log(`\n${title}\n`);
  for (const action of actions) console.log(`${labels[action.type] || action.type}: ${action.relative}`);
}

/** Executa um plano apply/sync. */
function executeApply(project, mode, template) {
  const id = stamp();
  const candidateRoot = path.join(project, '.agents', 'migration', 'candidates', id);
  const { actions, newLock } = planApply(project, mode, template);

  for (const action of actions) {
    if (['create', 'update', 'refresh-canonical', 'create-root'].includes(action.type)) {
      if (action.type === 'update' || action.type === 'refresh-canonical') backup(project, action.relative, id);
      copy(action.source, action.target);
    } else if (action.type === 'candidate') {
      copy(action.source, path.join(candidateRoot, action.relative));
    } else if (action.type === 'retire') {
      backup(project, action.relative, id);
      fs.rmSync(action.target, { recursive: true, force: true });
    }
  }

  ensure(path.join(project, '.agents'));
  fs.writeFileSync(
    path.join(project, '.agents', 'toolkit-lock.json'),
    `${JSON.stringify(newLock, null, 2)}\n`,
    'utf8'
  );
  printPlan('ALTERAÇÕES APLICADAS', actions);
  console.log(`\nBackup: ${backupRoot(project, id)}`);
  console.log('Revê as alterações na branch antes do merge.');
  if (mode === 'sync') console.log('Depois de validar, faz commit da atualização WELLS antes de Pull, checkout ou novo stash.');
}

/** Simula ou executa apply/sync. */
function applyCommand(project, mode, template, doApply) {
  const plan = planApply(project, mode, template);
  printPlan('SIMULAÇÃO — nada foi alterado', plan.actions);
  if (doApply) {
    if (mode === 'sync') assertSyncGitPreflight(project);
    executeApply(project, mode, template);
  } else console.log('\nPara aplicar, repete com --apply.');
}

/** Transporta estado legado para o runtime atual quando o destino ainda não existe. */
function seed(project, targetRelative, candidates, id, doApply, notes) {
  const target = path.join(project, targetRelative);
  if (fs.existsSync(target)) return;
  for (const relative of candidates) {
    const source = path.join(project, relative);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    notes.push(`TRANSPORTAR: ${relative} -> ${targetRelative}`);
    if (doApply) {
      backup(project, relative, id);
      copy(source, target);
    }
    return;
  }
}

/** Migra um projeto, removendo apenas legado WELLS conhecido e preservando configurações externas. */
function migrate(project, template, doApply) {
  const id = stamp();
  const notes = [];

  seed(project, '.agents/state/TODO.md', ['tasks/todo.md', '.ai/state/todo.md', '.ai/TASKS.md'], id, doApply, notes);
  seed(project, '.agents/state/LESSONS.md', ['tasks/lessons.md', '.ai/state/lessons.md', '.ai/LESSONS.md'], id, doApply, notes);
  seed(project, '.agents/state/HANDOFF.md', ['docs/ai/ops/HANDOFF.md', '.ai/toolkit/operations/HANDOFF.md', '.agents/HANDOFF.md'], id, doApply, notes);
  seed(project, '.agents/state/DECISIONS.md', ['docs/ai/ops/DECISIONS.md', '.ai/toolkit/operations/DECISIONS.md'], id, doApply, notes);
  seed(project, '.agents/state/EVIDENCE.md', ['docs/ai/ops/EVIDENCE.md', '.ai/toolkit/operations/EVIDENCE.md'], id, doApply, notes);

  const existingLegacy = LEGACY_ROOTS.filter(relative => fs.existsSync(path.join(project, relative)));
  for (const relative of existingLegacy) notes.push(`REMOVER APÓ BACKUP: ${relative}`);

  for (const relative of ROOT_AGENT_FILES) {
    const target = path.join(project, relative);
    if (!fs.existsSync(target)) continue;
    const text = fs.readFileSync(target, 'utf8');
    if (text.includes(START) && text.includes(END)) notes.push(`REMOVER BLOCO WELLS: ${relative}`);
    else notes.push(`PRESERVAR CONFIGURAÇÃO EXTERNA: ${relative}`);
  }

  for (const relative of PROVIDER_ROOTS) {
    if (fs.existsSync(path.join(project, relative))) notes.push(`PRESERVAR CONFIGURAÇÃO NATIVA: ${relative}`);
  }

  const tasks = path.join(project, 'tasks');
  let removeTasks = false;
  if (fs.existsSync(tasks)) {
    const files = walk(tasks).map(file => path.relative(tasks, file).replaceAll('\\', '/'));
    removeTasks = files.length > 0 && files.every(value => ['todo.md', 'lessons.md', 'template.md'].includes(value));
    if (removeTasks) notes.push('REMOVER APÓ BACKUP: tasks');
  }

  console.log(`\nSIMULAÇÃO DE MIGRAÇÃO — nada foi alterado\n${notes.join('\n') || 'Sem legado a remover.'}`);
  if (!doApply) {
    applyCommand(project, 'sync', template, false);
    return;
  }

  const legacyCandidate = path.join(project, '.agents', 'migration', 'legacy', id);
  for (const relative of existingLegacy) {
    const target = path.join(project, relative);
    backup(project, relative, id);
    copyTree(target, path.join(legacyCandidate, relative), true);
    fs.rmSync(target, { recursive: true, force: true });
  }

  for (const relative of ROOT_AGENT_FILES) {
    const target = path.join(project, relative);
    if (!fs.existsSync(target)) continue;
    const text = fs.readFileSync(target, 'utf8');
    if (!text.includes(START) || !text.includes(END)) continue;
    backup(project, relative, id);
    removeManagedBlock(target);
  }

  if (removeTasks) {
    backup(project, 'tasks', id);
    fs.rmSync(tasks, { recursive: true, force: true });
  }

  executeApply(project, 'sync', template);
  const report = path.join(project, '.agents', 'migration', `REPORT-${id}.md`);
  ensure(path.dirname(report));
  fs.writeFileSync(
    report,
    `# Migração WELLS\n\n- Versão: ${VERSION}\n- Backup: \`${backupRoot(project, id)}\`\n\n${notes.map(note => `- ${note}`).join('\n') || '- Nenhuma alteração de legado'}\n`,
    'utf8'
  );
  console.log(`\nRelatório: ${report}`);
}

/** Extrai referências de caminhos markdown para auditoria. */
function extractRefs(text) {
  const refs = [];
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    let value = match[1].trim();
    if (value.includes(' ') || value.includes('*') || value.includes('<') || value.includes('>')) continue;
    if (value.startsWith('.agents/') || ROOT_DOCS.includes(value) || ['LICENSE'].includes(value)) {
      refs.push(value.replace(/[.,;:]$/, ''));
    }
  }
  return refs;
}

/** Lê frontmatter YAML simples de uma skill. */
function readFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

/** Regenera o inventário compacto sem carregar os corpos das skills. */
function rebuildSkillsInventory(project) {
  const root = path.join(project, '.agents', 'skills');
  const rows = [];
  if (fs.existsSync(root)) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, entry.name, 'SKILL.md');
      if (!fs.existsSync(file)) continue;
      const metadata = readFrontmatter(file) || {};
      const description = String(metadata.description || 'Descrição por completar').replaceAll('|', '\\|');
      rows.push(`| \`${entry.name}\` | ${description} |`);
    }
  }
  const content = [
    '# Inventário de skills',
    '',
    `As ${rows.length} skills vivem exclusivamente em \`.agents/skills/\` e nunca devem ser todas`,
    'carregadas por defeito.',
    '',
    '| Skill | Finalidade principal |',
    '|---|---|',
    ...rows,
    '',
    'O routing canónico está em `.agents/INDEX.md`. Skills novas só devem ser',
    'adicionadas ao INDEX quando precisarem de uma rota explícita; caso contrário, o',
    'agente pode localizá-las por nome e descrição quando a tarefa o justificar.',
    ''
  ].join('\n');
  const target = path.join(project, '.agents', 'core', 'SKILLS.md');
  ensure(path.dirname(target));
  fs.writeFileSync(target, content, 'utf8');
}

/** Audita estrutura, versões, referências, skills e adaptador Claude. */
function audit(project) {
  const required = [
    '.agents/AGENTS.md',
    '.agents/INDEX.md',
    '.agents/core/ORCHESTRATOR.md',
    '.agents/state/TODO.md',
    '.agents/state/HANDOFF.md',
    '.agents/state/LESSONS.md',
    '.agents/state/DECISIONS.md',
    '.agents/state/EVIDENCE.md',
    '.agents/adapters/claude/plugin/.claude-plugin/plugin.json',
    '.agents/adapters/claude/plugin/hooks/hooks.json',
    '.agents/adapters/claude/plugin/scripts/session-start.mjs',
    '.agents/adapters/claude/plugin/scripts/safety-guard.mjs',
    '.agents/adapters/claude/plugin/scripts/project-hooks.mjs',
    '.agents/adapters/claude/plugin/scripts/output-profile.mjs',
    '.agents/knowledge/SCHEMA.md',
    '.agents/knowledge/SOURCES.yml',
    '.agents/knowledge/INDEX.md',
    '.agents/knowledge/GRAPH.json',
    '.agents/integrations/registry.json',
    '.agents/tools/validate-claude-plugin.mjs',
    'PROJECT_CONTEXT.md',
    'COMMANDS.md',
    'CHANGELOG.md'
  ];
  const issues = required
    .filter(relative => !fs.existsSync(path.join(project, relative)))
    .map(relative => `EM FALTA: ${relative}`);
  const warnings = [];

  for (const relative of ROOT_AGENT_FILES) {
    const target = path.join(project, relative);
    if (!fs.existsSync(target)) continue;
    const text = fs.readFileSync(target, 'utf8');
    if (text.includes(START) && text.includes(END)) issues.push(`BLOCO WELLS ANTIGO NA RAIZ: ${relative}`);
    else warnings.push(`CONFIGURAÇÃO EXTERNA PRESERVADA NA RAIZ: ${relative}`);
  }
  for (const relative of PROVIDER_ROOTS) {
    if (fs.existsSync(path.join(project, relative))) warnings.push(`CONFIGURAÇÃO NATIVA EXTERNA PRESERVADA: ${relative}`);
  }

  const countDirectories = relative => fs.existsSync(path.join(project, relative))
    ? fs.readdirSync(path.join(project, relative), { withFileTypes: true }).filter(entry => entry.isDirectory()).length
    : 0;
  const countMarkdown = relative => fs.existsSync(path.join(project, relative))
    ? fs.readdirSync(path.join(project, relative), { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.md')).length
    : 0;

  const counts = {
    skills: countDirectories('.agents/skills'),
    roles: countMarkdown('.agents/roles'),
    policies: countMarkdown('.agents/policies'),
    workflows: countMarkdown('.agents/workflows'),
    knowledgePages: walk(path.join(project, '.agents', 'knowledge', 'pages')).filter(file => file.endsWith('.md') && path.basename(file).toLowerCase() !== 'readme.md').length
  };
  let expectedCounts = {};
  try { expectedCounts = JSON.parse(fs.readFileSync(path.join(project, '.agents', 'manifest.json'), 'utf8')).counts || {}; }
  catch (error) { issues.push(`FICHEIRO INVÁLIDO: .agents/manifest.json (${error.message})`); }
  for (const key of ['skills', 'roles', 'policies', 'workflows']) {
    const expected = Number(expectedCounts[key] || 0);
    if (expected && counts[key] < expected) issues.push(`${key.toUpperCase()} INCOMPLETOS: ${counts[key]}/${expected}`);
    if (expected && counts[key] !== expected) warnings.push(`CONTAGEM ${key}: ${counts[key]} (manifest: ${expected})`);
  }

  const runtimeLock = readLock(project);
  for (const relative of IMMUTABLE_RUNTIME_FILES) {
    const target = path.join(project, relative);
    const expectedHash = runtimeLock.files?.[relative];
    if (!fs.existsSync(target) || !expectedHash) continue;
    if (hash(target) !== expectedHash) {
      issues.push(`RUNTIME CANÓNICO ALTERADO LOCALMENTE: ${relative}. Usa PROJECT_CONTEXT.md/COMMANDS.md/extensões para personalização e executa sync para repor o runtime.`);
    }
  }

  const agentsPath = path.join(project, '.agents', 'AGENTS.md');
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
  const agentsWords = agents.trim().split(/\s+/).filter(Boolean).length;
  if (agentsWords > 650) issues.push(`.agents/AGENTS.md excessivo: ${agentsWords}/650 palavras`);

  for (const relative of ['.agents/AGENTS.md', '.agents/INDEX.md']) {
    const target = path.join(project, relative);
    if (!fs.existsSync(target)) continue;
    for (const reference of extractRefs(fs.readFileSync(target, 'utf8'))) {
      if (!fs.existsSync(path.join(project, reference))) issues.push(`REFERÊNCIA INVÁLIDA em ${relative}: ${reference}`);
    }
  }

  const skillsRoot = path.join(project, '.agents', 'skills');
  if (fs.existsSync(skillsRoot)) {
    for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skill = path.join(skillsRoot, entry.name, 'SKILL.md');
      if (!fs.existsSync(skill)) {
        issues.push(`SKILL.md EM FALTA: .agents/skills/${entry.name}/SKILL.md`);
        continue;
      }
      const frontmatter = readFrontmatter(skill);
      if (!frontmatter) issues.push(`FRONTMATTER EM FALTA: .agents/skills/${entry.name}/SKILL.md`);
      else {
        if ((frontmatter.name || entry.name) !== entry.name) issues.push(`NOME DA SKILL DIVERGENTE: ${entry.name}`);
        if (!frontmatter.description) issues.push(`DESCRIÇÃO EM FALTA: ${entry.name}`);
      }
    }
  }

  const pluginValidation = spawnSync(process.execPath, [path.join(project, '.agents', 'tools', 'validate-claude-plugin.mjs'), path.join(project, '.agents', 'adapters', 'claude', 'plugin')], { encoding: 'utf8' });
  if (pluginValidation.status !== 0) issues.push(`PLUGIN CLAUDE INVÁLIDO: ${pluginValidation.stderr || pluginValidation.stdout}`);

  const versionFiles = [
    ['.agents/manifest.json', value => JSON.parse(value).version],
    ['.agents/adapters/claude/plugin/.claude-plugin/plugin.json', value => JSON.parse(value).version]
  ];
  const packagePath = path.join(project, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageData.name === 'wells-ai-toolkit') versionFiles.push(['package.json', value => JSON.parse(value).version]);
    } catch (error) {
      issues.push(`FICHEIRO INVÁLIDO: package.json (${error.message})`);
    }
  }
  for (const [relative, parse] of versionFiles) {
    const target = path.join(project, relative);
    if (!fs.existsSync(target)) continue;
    try {
      const value = parse(fs.readFileSync(target, 'utf8'));
      if (value !== VERSION) issues.push(`VERSÃO DIVERGENTE em ${relative}: ${value} != ${VERSION}`);
    } catch (error) {
      issues.push(`FICHEIRO INVÁLIDO: ${relative} (${error.message})`);
    }
  }

  const knowledge = auditKnowledge(project);
  for (const issue of knowledge.issues) issues.push(`KNOWLEDGE: ${issue}`);
  for (const warning of knowledge.warnings) warnings.push(`KNOWLEDGE: ${warning}`);
  for (const issue of auditIntegrations(project)) issues.push(`INTEGRAÇÃO: ${issue}`);

  const canonical = ['core', 'skills', 'workflows', 'roles', 'policies', 'ops', 'mcp'];
  const seen = new Map();
  for (const directory of canonical) {
    for (const file of walk(path.join(project, '.agents', directory))) {
      const digest = hash(file);
      const relative = path.relative(project, file).replaceAll('\\', '/');
      if (seen.has(digest)) issues.push(`DUPLICADO EXATO: ${seen.get(digest)} = ${relative}`);
      else seen.set(digest, relative);
    }
  }

  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ ok: true, version: VERSION, counts, agentsWords, warnings }, null, 2));
}

/** Atualiza a cópia do runtime no Project Template. */
function refreshTemplate(template, doApply) {
  if (!template) throw new Error('Indica --template.');
  const actions = [];
  for (const relative of managedFiles()) {
    const source = path.join(TOOLKIT_ROOT, relative);
    const target = path.join(template, relative);
    actions.push({ type: fs.existsSync(target) ? 'update' : 'create', relative, source, target });
  }
  for (const relative of RETIRED_MANAGED_FILES) {
    if (fs.existsSync(path.join(template, relative))) actions.push({ type: 'remove-retired', relative });
  }
  for (const relative of ROOT_AGENT_FILES) {
    if (fs.existsSync(path.join(template, relative))) actions.push({ type: 'remove-root-agent', relative });
  }
  actions.push({ type: 'write-lock', relative: '.agents/toolkit-lock.json' });
  printPlan('SYNC DO TEMPLATE', actions);
  if (!doApply) {
    console.log('\nPara aplicar, repete com --apply.');
    return;
  }
  for (const action of actions) {
    if (action.type === 'remove-root-agent' || action.type === 'remove-retired') fs.rmSync(path.join(template, action.relative), { recursive: true, force: true });
    else if (action.type === 'write-lock') {
      const lockTarget = path.join(template, action.relative);
      ensure(path.dirname(lockTarget));
      fs.writeFileSync(lockTarget, `${JSON.stringify(runtimeLockFromToolkit(), null, 2)}\n`, 'utf8');
    } else copy(action.source, action.target);
  }
  console.log('\nTemplate atualizado. A versão da aplicação no ficheiro raiz VERSION foi preservada.');
}

/** Cria uma extensão WELLS sem a ativar implicitamente. */
function addExtension(project, args, doApply) {
  const type = String(args.type || '').toLowerCase();
  const name = slugify(args.name);
  const description = String(args.description || '').trim();
  if (!['skill', 'hook', 'plugin'].includes(type)) throw new Error('Usa --type skill, hook ou plugin.');
  if (!description) throw new Error('Indica --description.');

  let files = [];
  if (type === 'skill') {
    files = [{
      relative: `.agents/skills/${name}/SKILL.md`,
      content: `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n## Objetivo\n\n${description}\n\n## Processo\n\n1. Confirmar o âmbito e o contexto necessário.\n2. Aplicar a alteração mínima coerente com o projeto.\n3. Validar com evidência real.\n4. Comunicar resultado, limitações e próximo passo.\n`
    }];
  } else if (type === 'hook') {
    const events = String(args.event || 'PostToolUse').split(',').map(value => value.trim()).filter(Boolean);
    files = [
      {
        relative: `.agents/extensions/hooks/${name}/hook.json`,
        content: `${JSON.stringify({
          name,
          description,
          enabled: false,
          events,
          matcher: String(args.matcher || ''),
          handler: 'handler.mjs',
          priority: 100,
          timeoutMs: 5000,
          failureMode: 'warn'
        }, null, 2)}\n`
      },
      {
        relative: `.agents/extensions/hooks/${name}/handler.mjs`,
        content: `#!/usr/bin/env node\n/** ${description} */\n\nlet input = '';\nfor await (const chunk of process.stdin) input += chunk;\nconst event = input ? JSON.parse(input) : {};\n// Implementar e testar antes de ativar. Não produzir output quando não há decisão/contexto.\nvoid event;\n`
      }
    ];
  } else {
    files = [
      {
        relative: `.agents/extensions/plugins/${name}/manifest.json`,
        content: `${JSON.stringify({ name, description, version: '0.1.0', enabled: false }, null, 2)}\n`
      },
      {
        relative: `.agents/extensions/plugins/${name}/README.md`,
        content: `# ${name}\n\n${description}\n\nA extensão começa desativada. Rever permissões, dependências e impacto de contexto antes de ativar.\n`
      }
    ];
  }

  console.log(doApply ? '\nEXTENSÃO — plano a aplicar\n' : '\nSIMULAÇÃO DE EXTENSÃO — nada foi alterado\n');
  for (const file of files) console.log(`CRIAR: ${file.relative}`);
  if (!doApply) {
    console.log('\nPara aplicar, repete com --apply.');
    return;
  }
  for (const file of files) {
    const target = path.join(project, file.relative);
    if (fs.existsSync(target)) throw new Error(`Já existe: ${file.relative}`);
    ensure(path.dirname(target));
    fs.writeFileSync(target, file.content, 'utf8');
  }
  if (type === 'skill') rebuildSkillsInventory(project);
  console.log('\nExtensão criada. Atualiza `.agents/INDEX.md` apenas se a nova capacidade tiver routing próprio.');
}

/** Ativa ou desativa hooks/plugins explicitamente, com simulação por defeito. */
function setExtensionState(project, args, enabled, doApply) {
  const type = String(args.type || '').toLowerCase();
  const name = slugify(args.name);
  if (!['hook', 'plugin'].includes(type)) throw new Error('Usa --type hook ou plugin.');
  const relative = type === 'hook'
    ? `.agents/extensions/hooks/${name}/hook.json`
    : `.agents/extensions/plugins/${name}/manifest.json`;
  const target = path.join(project, relative);
  if (!fs.existsSync(target)) throw new Error(`Extensão inexistente: ${relative}`);
  const action = enabled ? 'ATIVAR' : 'DESATIVAR';
  console.log(`\n${doApply ? action : `SIMULAR ${action}`}: ${relative}`);
  if (!doApply) {
    console.log('Para aplicar, repete com --apply.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  data.enabled = enabled;
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Extensão ${enabled ? 'ativada' : 'desativada'}.`);
}

/** Executa um comando Claude no perfil pessoal indicado. */
function runClaude(argumentsList) {
  const executable = String(process.env.WELLS_CLAUDE_BIN || 'claude');
  const result = spawnSync(executable, argumentsList, {
    encoding: 'utf8',
    env: { ...process.env, HOME: USER_HOME, USERPROFILE: USER_HOME }
  });
  if (result.error?.code === 'ENOENT') return { available: false, status: null, stdout: '', stderr: result.error.message };
  return { available: true, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** Gera uma marketplace Claude local e versionada no perfil pessoal. */
function prepareClaudeMarketplace() {
  const marketplace = path.join(USER_HOME, '.wells-ai', 'claude-marketplace');
  const pluginTarget = path.join(marketplace, 'plugins', 'wells-runtime');
  copyTree(path.join(TOOLKIT_ROOT, '.agents', 'adapters', 'claude', 'plugin'), pluginTarget, true);
  ensure(path.join(marketplace, '.claude-plugin'));
  const manifest = {
    name: 'wells-ai',
    owner: { name: 'Emanuel Ferreira (@emanuwells)' },
    description: 'Integração pessoal WELLS para Claude Code.',
    version: VERSION,
    plugins: [{
      name: 'wells-runtime',
      source: './plugins/wells-runtime',
      description: 'Routing, output profiles, guards e hooks WELLS.',
      version: VERSION,
      license: 'SEE LICENSE IN PROJECT'
    }]
  };
  fs.writeFileSync(path.join(marketplace, '.claude-plugin', 'marketplace.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return marketplace;
}

/** Instala o plugin pessoal do Claude e configura ponteiros globais opcionais. */
function configure(args, doApply) {
  const agent = String(args.agent || 'claude').toLowerCase();
  if (!['claude', 'codex', 'gemini', 'all'].includes(agent)) throw new Error('Usa --agent claude, codex, gemini ou all.');

  const plans = [];
  if (agent === 'claude' || agent === 'all') {
    plans.push({ type: 'marketplace', name: 'Claude Code — marketplace/plugin WELLS', target: path.join(USER_HOME, '.wells-ai', 'claude-marketplace') });
    const personalSkillsRoot = path.join(TOOLKIT_ROOT, '.agents', 'adapters', 'claude', 'user-skills');
    for (const entry of fs.readdirSync(personalSkillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      plans.push({
        type: 'personal-skill',
        name: `Claude Code — /${entry.name}`,
        source: path.join(personalSkillsRoot, entry.name),
        target: path.join(USER_HOME, '.claude', 'skills', entry.name)
      });
    }
  }
  const globalBlock = `${START}\n# WELLS\n\nQuando o repositório tiver \`.agents/AGENTS.md\`, lê esse ficheiro como contrato canónico antes de tarefas de desenvolvimento. Segue o routing seletivo, aplica \`.agents/core/MODEL_ROUTING.md\` quando a plataforma permitir escolha/escalada de modelo e não carregues toda a biblioteca ou o repositório por defeito.\n${END}`;
  if (agent === 'codex' || agent === 'all') plans.push({ type: 'block', name: 'Codex', target: path.join(USER_HOME, '.codex', 'AGENTS.md'), content: globalBlock });
  if (agent === 'gemini' || agent === 'all') plans.push({ type: 'block', name: 'Gemini CLI', target: path.join(USER_HOME, '.gemini', 'GEMINI.md'), content: globalBlock });

  console.log(doApply ? '\nCONFIGURAÇÃO PESSOAL — plano a aplicar\n' : '\nSIMULAÇÃO DE CONFIGURAÇÃO PESSOAL — nada foi alterado\n');
  for (const plan of plans) console.log(`${plan.type === 'marketplace' ? 'PREPARAR/INSTALAR PLUGIN' : plan.type === 'personal-skill' ? 'INSTALAR SKILL' : 'ATUALIZAR REGRA'}: ${plan.name} -> ${plan.target}`);
  if (!doApply) {
    console.log('\nPara aplicar, repete com --apply.');
    return;
  }

  const id = stamp();
  for (const plan of plans) {
    if (plan.type === 'marketplace') {
      const marketplace = prepareClaudeMarketplace();
      const validate = runClaude(['plugin', 'validate', marketplace]);
      if (validate.available && validate.status !== 0) throw new Error(`Validação oficial do plugin Claude falhou: ${validate.stderr || validate.stdout}`);
      const add = runClaude(['plugin', 'marketplace', 'add', marketplace, '--scope', 'user']);
      if (!add.available) {
        console.log(`PREPARADO: ${marketplace}`);
        console.log(`Claude CLI não encontrado. Executa depois:\n  claude plugin validate "${marketplace}"\n  claude plugin marketplace add "${marketplace}" --scope user\n  claude plugin install wells-runtime@wells-ai`);
      } else {
        if (add.status !== 0 && !/already|exists|registered/i.test(`${add.stdout}\n${add.stderr}`)) throw new Error(`Falha ao adicionar marketplace Claude: ${add.stderr || add.stdout}`);
        const install = runClaude(['plugin', 'install', 'wells-runtime@wells-ai']);
        if (install.status !== 0 && !/already|installed|enabled/i.test(`${install.stdout}\n${install.stderr}`)) throw new Error(`Falha ao instalar plugin Claude: ${install.stderr || install.stdout}`);
        console.log('CONFIGURADO: Claude Code — plugin wells-runtime@wells-ai');
      }
    } else if (plan.type === 'personal-skill') {
      if (fs.existsSync(plan.target)) copyTree(plan.target, path.join(USER_HOME, '.wells-ai', 'backups', id, 'claude', 'skills', path.basename(plan.target)), true);
      copyTree(plan.source, plan.target, true);
      console.log(`CONFIGURADO: ${plan.name}`);
    } else {
      upsertBlock(plan.target, plan.content);
      console.log(`CONFIGURADO: ${plan.name}`);
    }
  }
  console.log('Cursor: usa o prompt universal ou copia `.agents/setup/CURSOR_USER_RULE.txt` para as User Rules.');
  console.log('Reinicia/recarrega os plugins do agente para aplicar a configuração.');
}

/** Entrada principal. */
function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command === 'configure') return configure(args, Boolean(args.apply));
  if (command === 'refresh-template') return refreshTemplate(path.resolve(args.template || ''), Boolean(args.apply));

  const project = args.project ? path.resolve(args.project) : null;
  if (!project || !fs.existsSync(project)) throw new Error('Projeto inválido ou não indicado com --project.');
  const template = findTemplate(args.template);

  if (command === 'apply') return applyCommand(project, 'apply', template, Boolean(args.apply));
  if (command === 'sync') return applyCommand(project, 'sync', template, Boolean(args.apply));
  if (command === 'migrate') return migrate(project, template, Boolean(args.apply));
  if (command === 'audit') return audit(project);
  if (command === 'knowledge') return knowledgeCommand(project, args, Boolean(args.apply));
  if (command === 'integrations') return integrationsCommand(project, args, Boolean(args.apply));
  if (command === 'github') return githubCommand(project, args, Boolean(args.apply));
  if (command === 'add') return addExtension(project, args, Boolean(args.apply));
  if (command === 'enable') return setExtensionState(project, args, true, Boolean(args.apply));
  if (command === 'disable') return setExtensionState(project, args, false, Boolean(args.apply));
  throw new Error('Usa configure, apply, sync, migrate, audit, knowledge, integrations, github, add, enable, disable ou refresh-template.');
}

try {
  main();
} catch (error) {
  console.error(`ERRO: ${error.message}`);
  process.exitCode = 1;
}
