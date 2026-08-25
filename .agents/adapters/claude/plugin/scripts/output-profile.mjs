#!/usr/bin/env node
/** Injeta perfis compactos de eficiência e escrita apenas em projetos WELLS. */
import fs from 'node:fs';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw || '{}'); } catch {}

function findProject(start) {
  let current = path.resolve(start || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(current, '.agents', 'AGENTS.md'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function toolPaths(toolInput = {}) {
  const values = [];
  for (const key of ['file_path', 'path', 'notebook_path']) if (typeof toolInput[key] === 'string') values.push(toolInput[key]);
  for (const edit of Array.isArray(toolInput.edits) ? toolInput.edits : []) if (typeof edit?.file_path === 'string') values.push(edit.file_path);
  return values.map(value => value.replaceAll('\\', '/').toLowerCase());
}

if (!findProject(input.cwd)) process.exit(0);

const prompt = String(input.prompt || input.user_prompt || input.message || '').toLowerCase();
const paths = toolPaths(input.tool_input);
const writingPrompt = /(readme|documenta|relat[oó]rio|changelog|email|mensagem|texto|proposta|manual|guia|descri[cç][aã]o|copy|artigo|comunica[dç][aã]o|release notes)/i.test(prompt);
const writingPath = paths.some(value =>
  /(^|\/)(readme|changelog|contributing|security|license)(\.|$)/i.test(value) ||
  /(^|\/)(docs?|documentation|content|copy)(\/|$)/i.test(value) ||
  /\.(?:md|mdx|rst|adoc|txt)$/i.test(value)
);
const writing = writingPrompt || writingPath;

const rules = [
  'Aplica o perfil WELLS de eficiência: compreende antes de alterar, escolhe a menor solução correta, reutiliza antes de criar e evita repetição, logs completos e explicações não solicitadas.',
  'Não sacrifiques segurança, evidência, comandos, contratos, rastreabilidade, testes ou conteúdo obrigatório para reduzir output.'
];
if (writing) {
  rules.push('Para a prosa deste turno, aplica Humanizer e Stop-the-Slop numa única passagem: linguagem natural, específica e profissional, preservando factos, nomes, números, referências e terminologia técnica. Ponytail remove apenas redundância.');
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: String(input.hook_event_name || (input.tool_name ? 'PreToolUse' : 'UserPromptSubmit')),
    additionalContext: rules.join(' ')
  }
}));
