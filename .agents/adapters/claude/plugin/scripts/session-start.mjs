#!/usr/bin/env node
/**
 * Injeta apenas um ponteiro curto para o router WELLS quando o projeto o contém.
 * O corpo do router continua fora do contexto até Claude o ler para uma tarefa.
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
    const router = path.join(current, '.agents', 'AGENTS.md');
    if (fs.existsSync(router)) return { root: current, router };
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

const input = await readStdin();
const project = findProject(input.cwd);
if (!project) process.exit(0);

const context = [
  'Projeto WELLS detetado.',
  'Antes de executar tarefas de desenvolvimento, lê `.agents/AGENTS.md` como contrato canónico.',
  'Segue o routing progressivo e não carregues INDEX, todas as skills, workflows, políticas ou o repositório inteiro por defeito.'
].join(' ');

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context
  }
}));
