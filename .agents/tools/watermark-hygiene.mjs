#!/usr/bin/env node
/**
 * WELLS safe output hygiene.
 * Removes a deliberately conservative set of invisible, non-semantic codepoints
 * from text files. It does NOT strip metadata, C2PA or visual watermarks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const out = { changed: false, all: false, apply: false, quiet: false, json: false, project: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--changed') out.changed = true;
    else if (arg === '--all') out.all = true;
    else if (arg === '--apply') out.apply = true;
    else if (arg === '--quiet') out.quiet = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--project' && argv[i + 1]) out.project = argv[++i];
  }
  if (!out.changed && !out.all) out.changed = true;
  return out;
}

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: null });
  if (result.error || result.status !== 0) return null;
  return result.stdout || Buffer.alloc(0);
}

function nulList(buffer) {
  if (!buffer) return [];
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function changedFiles(root) {
  if (!git(root, ['rev-parse', '--is-inside-work-tree'])) return [];
  const files = new Set();
  for (const args of [
    ['diff', '--name-only', '-z', '--diff-filter=ACMR'],
    ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
    ['ls-files', '--others', '--exclude-standard', '-z']
  ]) {
    for (const file of nulList(git(root, args))) files.add(file);
  }
  return [...files];
}

function walk(root) {
  const output = [];
  const skip = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', '.next', 'coverage', '.playwright-cli']);
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) output.push(path.relative(root, target));
    }
  }
  visit(root);
  return output;
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function looksText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return !sample.includes(0);
}

const RULES = [
  { name: 'zero-width-space', re: /\u200B/g },
  { name: 'word-joiner', re: /\u2060/g },
  { name: 'soft-hyphen', re: /\u00AD/g },
  { name: 'unicode-tags', re: /[\u{E0000}-\u{E007F}]/gu }
];

function sanitize(text) {
  const counts = {};
  let output = text;
  for (const rule of RULES) {
    let count = 0;
    output = output.replace(rule.re, () => { count += 1; return ''; });
    if (count) counts[rule.name] = count;
  }
  let bomCount = 0;
  output = output.replace(/\uFEFF/g, (match, offset) => {
    if (offset === 0) return match;
    bomCount += 1;
    return '';
  });
  if (bomCount) counts['mid-file-bom'] = bomCount;
  return { output, counts };
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.project);
const candidates = args.all ? walk(root) : changedFiles(root);
const report = {
  ok: true,
  mode: args.all ? 'all' : 'changed',
  applied: args.apply,
  project: root,
  scanned: 0,
  changedFiles: 0,
  removed: 0,
  files: [],
  skipped: { missing: 0, outside: 0, large: 0, binary: 0 },
  note: 'Safe text hygiene only; metadata/C2PA/visual watermark removal is excluded.'
};

for (const relative of candidates) {
  const target = path.resolve(root, relative);
  if (!isInside(root, target)) { report.skipped.outside += 1; continue; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { report.skipped.missing += 1; continue; }
  const stat = fs.statSync(target);
  if (stat.size > 5 * 1024 * 1024) { report.skipped.large += 1; continue; }
  const buffer = fs.readFileSync(target);
  if (!looksText(buffer)) { report.skipped.binary += 1; continue; }
  report.scanned += 1;
  const original = buffer.toString('utf8');
  const { output, counts } = sanitize(original);
  const removed = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!removed || output === original) continue;
  if (args.apply) fs.writeFileSync(target, output, 'utf8');
  report.changedFiles += 1;
  report.removed += removed;
  report.files.push({ file: relative.replaceAll('\\', '/'), removed, counts });
}

if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else if (!args.quiet) {
  if (report.changedFiles) console.log(`WELLS hygiene: ${report.changedFiles} ficheiro(s), ${report.removed} carácter(es) ${args.apply ? 'removidos' : 'detetados'}.`);
  else console.log(`WELLS hygiene: sem alterações (${report.scanned} ficheiro(s) analisados).`);
}
