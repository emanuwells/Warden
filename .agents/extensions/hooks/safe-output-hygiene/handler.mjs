#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw || '{}'); } catch { input = {}; }
const event = String(input.hook_event_name || '');
const toolName = String(input.tool_name || '');
if (event === 'PostToolUse' && !/^(?:Bash|Edit|Write|MultiEdit)$/i.test(toolName)) process.exit(0);
if (!['PostToolUse', 'Stop'].includes(event)) process.exit(0);

const root = process.env.WELLS_PROJECT_ROOT || process.cwd();
const tool = path.join(root, '.agents', 'tools', 'watermark-hygiene.mjs');
if (!fs.existsSync(tool)) process.exit(0);
const result = spawnSync(process.execPath, [tool, '--project', root, '--changed', '--apply', '--json', '--quiet'], { cwd: root, encoding: 'utf8', timeout: 12000 });
if (result.status !== 0) {
  process.stderr.write(`WELLS hygiene falhou: ${String(result.stderr || result.stdout || `exit ${result.status}`).trim()}\n`);
  process.exit(0);
}
try {
  const report = JSON.parse(result.stdout || '{}');
  if (report.changedFiles > 0) {
    process.stdout.write(JSON.stringify({ systemMessage: `WELLS safe hygiene removeu ${report.removed} carácter(es) invisível(eis) em ${report.changedFiles} ficheiro(s) após ${event}; o diff final deve refletir esta normalização.` }));
  }
} catch {
  // Falha de parsing não deve bloquear o agente.
}
