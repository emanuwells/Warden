#!/usr/bin/env node
/** Gera um handoff compacto para continuação noutro agente. */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const project = path.resolve(get('project') || '.');
const target = get('target') || 'next-agent';
const reason = get('reason') || 'quota-or-tooling';
const task = get('task') || 'Continuar a tarefa descrita no estado WELLS.';
const apply = args.includes('--apply');
const file = path.join(project, '.agents', 'state', 'NEXT_AGENT.md');
const content = `# Handoff para ${target}\n\n- Gerado: ${new Date().toISOString()}\n- Motivo: ${reason}\n- Tarefa: ${task}\n\n## Instruções\n\n1. Lê \`.agents/AGENTS.md\`.\n2. Confirma branch e \`git diff\`.\n3. Consulta apenas TODO, HANDOFF e evidência referenciada.\n4. Não repitas exploração já documentada.\n5. Atualiza este handoff com o resultado ou remove-o quando concluído.\n\n## Estado a preencher\n\n- Branch:\n- Ficheiros alterados:\n- Validações executadas:\n- Bloqueios:\n- Próximo passo:\n- Riscos:\n`;
if (!apply) { process.stdout.write(content); process.stderr.write('\nSimulação. Repete com --apply para guardar.\n'); }
else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); console.log(`Handoff criado: ${file}`); }
