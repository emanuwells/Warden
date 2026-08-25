#!/usr/bin/env node
/**
 * Compressor local WELLS inspirado no padrão Headroom.
 * Preserva erros e contexto de fronteira; nunca modifica o ficheiro original.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((v,i,a) => v.startsWith('--') ? [v.slice(2), a[i+1] && !a[i+1].startsWith('--') ? a[i+1] : true] : []).filter(Boolean));
let input = '';
for await (const chunk of process.stdin) input += chunk;
if (!input.trim()) process.exit(0);
const lines = input.split(/\r?\n/);
const error = /(error|failed|failure|exception|traceback|fatal|denied|warning|warn)/i;
const selected = new Set();
for (let i=0;i<Math.min(12,lines.length);i++) selected.add(i);
for (let i=Math.max(0,lines.length-12);i<lines.length;i++) selected.add(i);
for (let i=0;i<lines.length;i++) if (error.test(lines[i])) {
  for (let j=Math.max(0,i-2);j<=Math.min(lines.length-1,i+4);j++) selected.add(j);
}
if (args.query) {
  const terms = String(args.query).toLowerCase().split(/\s+/).filter(Boolean);
  for (let i=0;i<lines.length;i++) if (terms.some(t => lines[i].toLowerCase().includes(t))) selected.add(i);
}
const ordered = [...selected].sort((a,b)=>a-b);
const output=[]; let previous=-2;
for (const index of ordered) {
  if (index > previous+1) output.push(`… ${index-previous-1} linhas omitidas …`);
  output.push(lines[index]); previous=index;
}
if (lines.length > 80) {
  const sha=crypto.createHash('sha256').update(input).digest('hex');
  const cache=path.resolve(args.cache || '.agents/cache/headroom');
  fs.mkdirSync(cache,{recursive:true});
  fs.writeFileSync(path.join(cache,`${sha}.txt`),input,'utf8');
  output.unshift(`[Headroom: ${lines.length} linhas → ${ordered.length}; original ${sha}]`);
}
process.stdout.write(output.join('\n'));
