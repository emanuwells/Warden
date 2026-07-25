#!/usr/bin/env node
/** Valida a estrutura WELLS do projeto atual. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const required = ['.agents/AGENTS.md','.agents/INDEX.md','.agents/core/ORCHESTRATOR.md','.agents/state/TODO.md','.agents/state/HANDOFF.md','PROJECT_CONTEXT.md','COMMANDS.md','CHANGELOG.md'];
const forbidden = ['.ai','.claude','.codex','.cursor','.gemini','docs/ai','tools/ai-adapters','AGENTS.md','CLAUDE.md','GEMINI.md','.github/copilot-instructions.md'];
const issues = [];
for (const rel of required) if (!fs.existsSync(path.join(root,rel))) issues.push(`EM FALTA: ${rel}`);
for (const rel of forbidden) if (fs.existsSync(path.join(root,rel))) issues.push(`IA FORA DE .agents: ${rel}`);
const countDirs=(rel)=>fs.existsSync(path.join(root,rel))?fs.readdirSync(path.join(root,rel),{withFileTypes:true}).filter(e=>e.isDirectory()).length:0;
const countMd=(rel)=>fs.existsSync(path.join(root,rel))?fs.readdirSync(path.join(root,rel),{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.md')).length:0;
const counts={skills:countDirs('.agents/skills'),roles:countMd('.agents/roles'),policies:countMd('.agents/policies'),workflows:countMd('.agents/workflows')};
if(counts.skills<28)issues.push(`SKILLS INCOMPLETAS: ${counts.skills}/28`);
if(counts.roles<11)issues.push(`PAPÉIS INCOMPLETOS: ${counts.roles}/11`);
if(counts.policies<14)issues.push(`POLÍTICAS INCOMPLETAS: ${counts.policies}/14`);
if(counts.workflows<7)issues.push(`WORKFLOWS INCOMPLETOS: ${counts.workflows}/7`);
const agents=fs.existsSync(path.join(root,'.agents/AGENTS.md'))?fs.readFileSync(path.join(root,'.agents/AGENTS.md'),'utf8'):'';
const words=agents.trim().split(/\s+/).filter(Boolean).length;
if(words>800)issues.push(`AGENTS.md excessivo: ${words}/800 palavras`);
if(issues.length){console.error(issues.join('\n'));process.exit(1)}
console.log(JSON.stringify({ok:true,counts,agentsWords:words},null,2));
