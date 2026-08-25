#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32', timeout: 5000 });
}

const localBin = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'playwright-cli.cmd' : 'playwright-cli');
const candidates = [
  ['playwright-cli', ['--version']],
  ...(fs.existsSync(localBin) ? [[localBin, ['--version']]] : [])
];

let found = null;
for (const [command, args] of candidates) {
  const result = run(command, args);
  if (result.status === 0) {
    found = { command: `${command} ${args.join(' ')}`, version: (result.stdout || result.stderr).trim() };
    break;
  }
}

if (!found) {
  console.error(JSON.stringify({
    ok: false,
    installed: false,
    expected: '@playwright/cli 0.1.18',
    install: 'npm install -g @playwright/cli@0.1.18 && playwright-cli install-browser'
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, installed: true, ...found }, null, 2));
