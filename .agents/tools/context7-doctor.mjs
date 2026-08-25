#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function exists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [command], { encoding: 'utf8' }).status === 0;
}

const available = exists('ctx7');
let version = null;
if (available) {
  const result = spawnSync('ctx7', ['--version'], { encoding: 'utf8' });
  version = String(result.stdout || result.stderr || '').trim() || null;
}
console.log(JSON.stringify({
  ok: true,
  node: process.version,
  node18Plus: Number(process.versions.node.split('.')[0]) >= 18,
  ctx7: available,
  version,
  testedCli: '0.5.7',
  note: available ? 'Context7 CLI disponível.' : 'Opcional: usar npx ctx7@0.5.7 ou instalar explicitamente; não é requisito do runtime.'
}, null, 2));
