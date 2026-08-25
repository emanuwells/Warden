#!/usr/bin/env node
/**
 * Valida autonomamente a estrutura WELLS do projeto atual.
 * Configurações nativas externas são reportadas como avisos, não como falhas.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  '.agents/AGENTS.md',
  '.agents/INDEX.md',
  '.agents/core/ORCHESTRATOR.md',
  '.agents/state/TODO.md',
  '.agents/state/HANDOFF.md',
  '.agents/adapters/claude/plugin/.claude-plugin/plugin.json',
  '.agents/adapters/claude/plugin/hooks/hooks.json',
  '.agents/adapters/claude/plugin/scripts/output-profile.mjs',
  '.agents/knowledge/SCHEMA.md',
  '.agents/knowledge/GRAPH.json',
  '.agents/integrations/registry.json',
  'PROJECT_CONTEXT.md',
  'COMMANDS.md',
  'CHANGELOG.md'
];
const forbidden = ['.ai', 'docs/ai', 'tools/ai-adapters'];
const rootAgentFiles = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
const providerRoots = ['.claude', '.codex', '.cursor', '.gemini'];
const issues = [];
const warnings = [];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) issues.push(`EM FALTA: ${relative}`);
}
for (const relative of forbidden) {
  if (fs.existsSync(path.join(root, relative))) issues.push(`FORA DA ARQUITETURA WELLS: ${relative}`);
}
for (const relative of rootAgentFiles) {
  if (fs.existsSync(path.join(root, relative))) warnings.push(`CONFIGURAÇÃO EXTERNA NA RAIZ: ${relative}`);
}
for (const relative of providerRoots) {
  if (fs.existsSync(path.join(root, relative))) warnings.push(`CONFIGURAÇÃO NATIVA EXTERNA PRESERVADA: ${relative}`);
}

const countDirectories = relative => fs.existsSync(path.join(root, relative))
  ? fs.readdirSync(path.join(root, relative), { withFileTypes: true }).filter(entry => entry.isDirectory()).length
  : 0;
const countMarkdown = relative => fs.existsSync(path.join(root, relative))
  ? fs.readdirSync(path.join(root, relative), { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.md')).length
  : 0;

const counts = {
  skills: countDirectories('.agents/skills'),
  roles: countMarkdown('.agents/roles'),
  policies: countMarkdown('.agents/policies'),
  workflows: countMarkdown('.agents/workflows')
};
let expected = {};
try { expected = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'manifest.json'), 'utf8')).counts || {}; }
catch (error) { issues.push(`MANIFEST INVÁLIDO: ${error.message}`); }
for (const key of ['skills', 'roles', 'policies', 'workflows']) {
  const minimum = Number(expected[key] || 0);
  if (minimum && counts[key] < minimum) issues.push(`${key.toUpperCase()} INCOMPLETOS: ${counts[key]}/${minimum}`);
}

const agentsPath = path.join(root, '.agents', 'AGENTS.md');
const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
const words = agents.trim().split(/\s+/).filter(Boolean).length;
if (words > 650) issues.push(`.agents/AGENTS.md excessivo: ${words}/650 palavras`);

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, counts, agentsWords: words, warnings }, null, 2));
