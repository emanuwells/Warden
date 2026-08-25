#!/usr/bin/env node
/** Optional deterministic security gate. Does not install tools. */
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const out = { project: process.cwd(), mode: 'quick', strict: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project' && argv[i + 1]) out.project = argv[++i];
    else if (arg === '--mode' && argv[i + 1]) out.mode = argv[++i];
    else if (arg.startsWith('--mode=')) out.mode = arg.split('=')[1];
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--json') out.json = true;
  }
  if (!['quick', 'deep'].includes(out.mode)) throw new Error('Usa --mode quick ou --mode deep.');
  return out;
}

function exists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [command], { encoding: 'utf8' }).status === 0;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000 });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    ok: result.status === 0,
    stdout: String(result.stdout || '').slice(-12000),
    stderr: String(result.stderr || '').slice(-12000)
  };
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.project);
const checks = [];
const unavailable = [];

if (exists('gitleaks')) checks.push({ id: 'gitleaks', ...run('gitleaks', ['dir', '.', '--redact', '--no-banner'], root) });
else unavailable.push('gitleaks');

if (exists('trivy')) checks.push({ id: 'trivy', ...run('trivy', ['fs', '--scanners', 'vuln,misconfig,secret', '--severity', 'HIGH,CRITICAL', '--exit-code', '1', '--quiet', '.'], root) });
else unavailable.push('trivy');

if (args.mode === 'deep') {
  if (exists('semgrep')) checks.push({ id: 'semgrep', ...run('semgrep', ['scan', '--config', 'auto', '--error', '--quiet', '.'], root) });
  else unavailable.push('semgrep');
}

const report = {
  ok: checks.every(check => check.ok) && (!args.strict || unavailable.length === 0),
  complete: unavailable.length === 0,
  mode: args.mode,
  project: root,
  checks,
  unavailable,
  note: unavailable.length ? 'Cobertura incompleta: ferramenta(s) ausente(s); ausência não equivale a scan limpo.' : 'Toolchain pedida executada.'
};

if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else {
  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.command}`);
  if (unavailable.length) console.log(`SKIP: ${unavailable.join(', ')} não instalado(s).`);
  console.log(report.note);
}
if (!report.ok) process.exitCode = 1;
