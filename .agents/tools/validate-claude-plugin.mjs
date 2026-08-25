#!/usr/bin/env node
/**
 * Validador local do plugin Claude WELLS.
 * Valida estrutura, JSON, scripts e frontmatter sem depender do executável Claude.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');
const plugin = process.argv[2] ? path.resolve(process.argv[2]) : path.join(project, '.agents', 'adapters', 'claude', 'plugin');
const issues = [];

function required(relative) {
  const target = path.join(plugin, relative);
  if (!fs.existsSync(target)) issues.push(`Em falta: ${relative}`);
  return target;
}
function json(relative) {
  const target = required(relative);
  if (!fs.existsSync(target)) return null;
  try { return JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch (error) { issues.push(`JSON inválido ${relative}: ${error.message}`); return null; }
}
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith('---\n') || text.indexOf('\n---\n', 4) < 0) issues.push(`Frontmatter inválido: ${path.relative(plugin, file)}`);
}

const manifest = json('.claude-plugin/plugin.json');
const hooks = json('hooks/hooks.json');
if (manifest && manifest.name !== 'wells-runtime') issues.push('Nome do plugin deve ser wells-runtime.');
if (hooks) {
  for (const [event, groups] of Object.entries(hooks.hooks || {})) {
    if (!Array.isArray(groups)) issues.push(`Hooks inválidos em ${event}`);
    for (const group of groups || []) for (const hook of group.hooks || []) {
      const match = String(hook.command || '').match(/scripts\/([^" ]+)/);
      if (hook.type === 'command' && match) required(`scripts/${match[1]}`);
    }
  }
}
for (const relative of ['scripts/session-start.mjs', 'scripts/safety-guard.mjs', 'scripts/project-hooks.mjs', 'scripts/output-profile.mjs', 'agents/wells-reviewer.md']) required(relative);
const skillsRoot = path.join(plugin, 'skills');
if (fs.existsSync(skillsRoot)) for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const file = required(`skills/${entry.name}/SKILL.md`);
    if (fs.existsSync(file)) frontmatter(file);
  }
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, plugin, version: manifest?.version, hooks: Object.keys(hooks?.hooks || {}) }, null, 2));
