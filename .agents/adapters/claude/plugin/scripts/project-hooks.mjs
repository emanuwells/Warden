#!/usr/bin/env node
/**
 * Executa e agrega hooks WELLS explicitamente ativados no projeto.
 *
 * Garantias:
 * - não usa shell;
 * - restringe handlers à própria pasta;
 * - executa todos os hooks por prioridade;
 * - agrega contexto e decisões num único resultado Claude Code;
 * - uma decisão `deny` prevalece sobre `ask` e `allow`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function decisionRank(value) {
  return ({ allow: 1, ask: 2, deny: 3 })[String(value || '').toLowerCase()] || 0;
}

function parseOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return { hookSpecificOutput: { additionalContext: text } }; }
}

const input = await readStdin();
const root = findProject(input.cwd);
if (!root) process.exit(0);

const hooksRoot = path.join(root, '.agents', 'extensions', 'hooks');
if (!fs.existsSync(hooksRoot)) process.exit(0);

const candidates = [];
for (const entry of fs.readdirSync(hooksRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(hooksRoot, entry.name);
  const manifestPath = path.join(directory, 'hook.json');
  if (!fs.existsSync(manifestPath)) continue;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.enabled !== true) continue;
    if (!Array.isArray(manifest.events) || !manifest.events.includes(input.hook_event_name)) continue;
    if (manifest.matcher) {
      const subject = String(input.tool_name || input.source || input.hook_event_name || '');
      if (!(new RegExp(String(manifest.matcher), 'i')).test(subject)) continue;
    }
    candidates.push({ directory, manifest, name: manifest.name || entry.name });
  } catch (error) {
    process.stderr.write(`Hook WELLS inválido em ${entry.name}: ${error.message}\n`);
  }
}

candidates.sort((a, b) =>
  Number(a.manifest.priority || 100) - Number(b.manifest.priority || 100) ||
  String(a.name).localeCompare(String(b.name))
);

const contexts = [];
const reasons = [];
const systemMessages = [];
let permissionDecision = '';
let updatedInput = null;
let shouldContinue = true;
let suppressOutput = false;
let stopReason = '';

for (const candidate of candidates) {
  const handler = path.resolve(candidate.directory, String(candidate.manifest.handler || 'handler.mjs'));
  if (!inside(candidate.directory, handler) || !/\.(?:mjs|cjs|js)$/i.test(handler) || !fs.existsSync(handler)) {
    const reason = `Handler WELLS inválido: ${candidate.name}`;
    process.stderr.write(`${reason}\n`);
    if (candidate.manifest.failureMode === 'block') {
      permissionDecision = 'deny';
      reasons.push(reason);
    }
    continue;
  }

  const timeout = Math.min(Math.max(Number(candidate.manifest.timeoutMs || 5000), 100), 30000);
  const result = spawnSync(process.execPath, [handler], {
    cwd: root,
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout,
    env: {
      ...process.env,
      WELLS_PROJECT_ROOT: root,
      WELLS_HOOK_NAME: String(candidate.name),
      WELLS_HOOK_EVENT: String(input.hook_event_name || '')
    }
  });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || `exit ${result.status}`;
    const reason = `Hook WELLS falhou (${candidate.name}): ${String(detail).trim()}`;
    process.stderr.write(`${reason}\n`);
    if (candidate.manifest.failureMode === 'block' || result.status === 2) {
      permissionDecision = 'deny';
      reasons.push(reason);
    }
    continue;
  }

  const parsed = parseOutput(result.stdout);
  if (!parsed) continue;
  const specific = parsed.hookSpecificOutput || {};

  if (specific.additionalContext) contexts.push(`[${candidate.name}] ${String(specific.additionalContext).trim()}`);
  if (parsed.systemMessage) systemMessages.push(`[${candidate.name}] ${String(parsed.systemMessage).trim()}`);
  if (specific.permissionDecisionReason) reasons.push(`[${candidate.name}] ${String(specific.permissionDecisionReason).trim()}`);

  const nextDecision = String(specific.permissionDecision || '').toLowerCase();
  if (decisionRank(nextDecision) > decisionRank(permissionDecision)) permissionDecision = nextDecision;

  if (specific.updatedInput && typeof specific.updatedInput === 'object') {
    updatedInput = { ...(updatedInput || {}), ...specific.updatedInput };
  }
  if (parsed.continue === false) shouldContinue = false;
  if (parsed.suppressOutput === true) suppressOutput = true;
  if (parsed.stopReason) stopReason = String(parsed.stopReason);
}

const hookSpecificOutput = { hookEventName: String(input.hook_event_name || '') };
if (contexts.length) hookSpecificOutput.additionalContext = contexts.join('\n\n');
if (permissionDecision) hookSpecificOutput.permissionDecision = permissionDecision;
if (reasons.length) hookSpecificOutput.permissionDecisionReason = reasons.join(' | ');
if (updatedInput) hookSpecificOutput.updatedInput = updatedInput;

const output = {};
if (Object.keys(hookSpecificOutput).length > 1) output.hookSpecificOutput = hookSpecificOutput;
if (systemMessages.length) output.systemMessage = systemMessages.join('\n\n');
if (!shouldContinue) output.continue = false;
if (suppressOutput) output.suppressOutput = true;
if (stopReason) output.stopReason = stopReason;

if (Object.keys(output).length) process.stdout.write(JSON.stringify(output));
