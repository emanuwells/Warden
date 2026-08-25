#!/usr/bin/env node
/** Universal deterministic finalizer. Keep this cheap enough to run after every edit task. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const tool = path.join(here, 'watermark-hygiene.mjs');
const passthrough = process.argv.slice(2);
const hasProject = passthrough.includes('--project');
const hasScope = passthrough.includes('--changed') || passthrough.includes('--all');
const hasApply = passthrough.includes('--apply');
const args = [tool, ...(hasProject ? [] : ['--project', process.cwd()]), ...(hasScope ? [] : ['--changed']), ...(hasApply ? [] : ['--apply']), '--json', '--quiet', ...passthrough];
const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
