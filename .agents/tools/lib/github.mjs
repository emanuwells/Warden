import fs from 'node:fs';
import path from 'node:path';

const GENERATED = '# WELLS-GENERATED:';
const CHECKOUT = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';
const SETUP_NODE = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0';
const SETUP_PYTHON = 'actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0';
const SETUP_DOTNET = 'actions/setup-dotnet@a98b56852c35b8e3190ac28c8c2271da59106c68 # v6.0.0';
const SETUP_PHP = 'shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # v2.37.2';
const SETUP_UV = 'astral-sh/setup-uv@c771a70e6277c0a99b617c7a806ffedaca235ff9 # v9.0.0';

function exists(project, relative) {
  return fs.existsSync(path.join(project, relative));
}

function readText(project, relative) {
  const target = path.join(project, relative);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
}

function readJson(project, relative) {
  try { return JSON.parse(readText(project, relative)); }
  catch { return null; }
}

function safeStamp() {
  return new Date().toISOString().replaceAll(':', '-');
}

function ensure(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function yamlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function detectNode(project) {
  const pkg = readJson(project, 'package.json');
  if (!pkg) return null;
  let manager = 'npm';
  if (exists(project, 'pnpm-lock.yaml') || String(pkg.packageManager || '').startsWith('pnpm@')) manager = 'pnpm';
  else if (exists(project, 'yarn.lock') || String(pkg.packageManager || '').startsWith('yarn@')) manager = 'yarn';

  const hasLock = manager === 'npm'
    ? exists(project, 'package-lock.json') || exists(project, 'npm-shrinkwrap.json')
    : manager === 'pnpm' ? exists(project, 'pnpm-lock.yaml') : exists(project, 'yarn.lock');

  const scripts = pkg.scripts || {};
  const dependencyCount = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .reduce((total, key) => total + Object.keys(pkg[key] || {}).length, 0);
  const selected = [];
  for (const candidate of ['lint', 'typecheck', 'type-check', 'check-types', 'test', 'build']) {
    if (!scripts[candidate]) continue;
    if (candidate === 'test' && /no test specified/i.test(String(scripts[candidate]))) continue;
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  let install = null;
  if (dependencyCount === 0) install = null;
  else if (manager === 'pnpm') install = `pnpm install${hasLock ? ' --frozen-lockfile' : ''}`;
  else if (manager === 'yarn') {
    const match = String(pkg.packageManager || '').match(/^yarn@(\d+)/);
    const modern = match && Number(match[1]) >= 2;
    install = `yarn install${hasLock ? (modern ? ' --immutable' : ' --frozen-lockfile') : ''}`;
  } else install = hasLock ? 'npm ci' : 'npm install';

  const run = name => manager === 'npm' ? `npm run ${name}` : manager === 'pnpm' ? `pnpm run ${name}` : `yarn ${name}`;
  return {
    manager,
    hasLock,
    useVersionFile: Boolean(pkg.engines?.node || pkg.volta?.node || pkg.devEngines?.runtime),
    install,
    preInstall: manager === 'npm' ? [] : ['corepack enable'],
    commands: selected.map(run),
    reproducibilityWarning: dependencyCount > 0 && !hasLock ? 'Node: sem lockfile; CI usa instalação não totalmente reprodutível.' : null
  };
}

function detectPython(project) {
  const pyproject = readText(project, 'pyproject.toml');
  const present = Boolean(pyproject) || exists(project, 'requirements.txt') || exists(project, 'uv.lock') || exists(project, 'poetry.lock');
  if (!present) return null;

  const mode = exists(project, 'uv.lock') ? 'uv' : exists(project, 'poetry.lock') ? 'poetry' : 'pip';
  let install = null;
  let cache = null;
  if (mode === 'uv') install = ['uv sync --frozen'];
  else if (mode === 'poetry') {
    install = ['poetry install --no-interaction --no-root'];
    cache = 'poetry';
  } else if (exists(project, 'requirements.txt')) {
    install = ['python -m pip install --upgrade pip', 'python -m pip install -r requirements.txt'];
    cache = 'pip';
  } else if (/\[project\]/.test(pyproject)) {
    install = ['python -m pip install --upgrade pip', 'python -m pip install -e .'];
    cache = 'pip';
  } else {
    install = ['python -m pip install --upgrade pip'];
  }

  const run = command => mode === 'uv' ? `uv run ${command}` : mode === 'poetry' ? `poetry run ${command}` : `python -m ${command}`;
  const commands = [];
  if (exists(project, 'ruff.toml') || exists(project, '.ruff.toml') || /\[tool\.ruff[.\]]/.test(pyproject)) commands.push(run('ruff check .'));
  if (exists(project, 'mypy.ini') || exists(project, '.mypy.ini') || /\[tool\.mypy\]/.test(pyproject)) commands.push(run('mypy .'));
  if (exists(project, 'pytest.ini') || exists(project, 'conftest.py') || exists(project, 'tests') || /\[tool\.pytest\./.test(pyproject)) commands.push(run('pytest'));
  return {
    mode,
    install,
    commands,
    cache,
    setupUv: mode === 'uv',
    versionFile: exists(project, '.python-version') ? '.python-version' : null,
    reproducibilityWarning: mode === 'poetry' && !/requires-poetry\s*=/.test(pyproject)
      ? 'Python/Poetry: poetry.lock detetado sem requires-poetry; recomenda-se fixar a versão da ferramenta Poetry no pyproject.toml.'
      : mode === 'uv' && !/required-version\s*=/.test(pyproject) && !exists(project, 'uv.toml')
        ? 'Python/uv: uv.lock detetado sem required-version/uv.toml; setup-uv usará a versão estável atual. Fixa required-version para máxima reprodutibilidade.'
        : null
  };
}

function detectPhp(project) {
  const composer = readJson(project, 'composer.json');
  if (!composer) return null;
  const scripts = composer.scripts || {};
  const commands = ['composer validate --strict'];
  commands.push('composer install --no-interaction --prefer-dist --no-progress');
  commands.push(exists(project, 'composer.lock') ? 'composer audit --locked --no-interaction' : 'composer audit --no-interaction');
  for (const candidate of ['lint', 'analyse', 'analyze', 'test']) {
    if (scripts[candidate]) commands.push(`composer run ${candidate}`);
  }
  const phpVersion = typeof composer.config?.platform?.php === 'string' ? composer.config.platform.php : null;
  return { commands, hasLock: exists(project, 'composer.lock'), phpVersion };
}

function findDotnet(project) {
  const files = [];
  const visit = (directory, depth = 0) => {
    if (depth > 2 || !fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'vendor', 'bin', 'obj'].includes(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target, depth + 1);
      else if (entry.isFile() && (entry.name.endsWith('.sln') || entry.name.endsWith('.csproj'))) files.push(target);
    }
  };
  visit(project);
  if (!files.length && !exists(project, 'global.json')) return null;
  const hasTests = files.some(file => /test/i.test(path.basename(file)) || /test/i.test(path.dirname(file)));
  return { hasTests, hasGlobalJson: exists(project, 'global.json') };
}

function detectStacks(project) {
  const node = detectNode(project);
  const python = detectPython(project);
  const php = detectPhp(project);
  const dotnet = findDotnet(project);
  const docker = exists(project, 'Dockerfile') || exists(project, 'compose.yml') || exists(project, 'docker-compose.yml');
  const wells = exists(project, '.agents/manifest.json');
  return { node, python, php, dotnet, docker, wells };
}

function header(name) {
  return `${GENERATED} ${name}\n# Regenerar: node .agents/tools/wells-toolkit.mjs github --project . --apply\n`;
}

function workflowPreamble(name, generatedName) {
  return `${header(generatedName)}name: ${name}\n\non:\n  push:\n    branches:\n      - main\n  pull_request:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: ${generatedName}-\${{ github.workflow }}-\${{ github.ref }}\n  cancel-in-progress: true\n\n`;
}

function checkoutStep(indent = '      ') {
  return `${indent}- name: Checkout\n${indent}  uses: ${CHECKOUT}\n${indent}  with:\n${indent}    persist-credentials: false\n`;
}

function generateWellsWorkflow() {
  return `${workflowPreamble('WELLS Runtime', 'wells-runtime')}jobs:\n  runtime:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n${checkoutStep('      ')}      - name: Setup Node.js\n        uses: ${SETUP_NODE}\n        with:\n          node-version: '24'\n          package-manager-cache: false\n      - name: Validate project structure\n        run: node .agents/tools/validate-project.mjs\n      - name: Audit WELLS runtime\n        run: node .agents/tools/wells-toolkit.mjs audit --project .\n      - name: Validate Claude plugin\n        run: node .agents/tools/validate-claude-plugin.mjs\n      - name: Lint knowledge graph\n        run: node .agents/tools/wells-toolkit.mjs knowledge lint --project .\n`;
}

function generateNodeJob(node) {
  const lines = [
    '  node:',
    '    name: Node',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 20',
    '    steps:',
    ...checkoutStep('      ').trimEnd().split('\n'),
    '      - name: Setup Node.js',
    `        uses: ${SETUP_NODE}`,
    '        with:'
  ];
  if (node.useVersionFile) lines.push("          node-version-file: 'package.json'");
  else lines.push("          node-version: '24'");
  if (node.manager === 'npm' && node.hasLock) lines.push("          cache: 'npm'");
  else lines.push('          package-manager-cache: false');
  if (node.preInstall.length) {
    lines.push('      - name: Enable package manager', '        run: |');
    for (const command of node.preInstall) lines.push(`          ${command}`);
  }
  if (node.install) lines.push('      - name: Install dependencies', `        run: ${node.install}`);
  for (const command of node.commands) {
    const label = command.replace(/^npm run |^pnpm run |^yarn /, '');
    lines.push(`      - name: ${label}`, `        run: ${command}`);
  }
  return `${lines.join('\n')}\n`;
}

function generatePythonJob(python) {
  const lines = [
    '  python:',
    `    name: Python${python.mode === 'uv' ? ' / uv' : python.mode === 'poetry' ? ' / Poetry' : ''}`,
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 20',
    '    steps:',
    ...checkoutStep('      ').trimEnd().split('\n')
  ];
  if (python.mode === 'poetry') lines.push('      - name: Install Poetry', '        run: pipx install poetry');
  lines.push(
    '      - name: Setup Python',
    `        uses: ${SETUP_PYTHON}`,
    '        with:'
  );
  if (python.versionFile) lines.push(`          python-version-file: ${yamlQuote(python.versionFile)}`);
  else lines.push("          python-version: '3.12'");
  if (python.cache) lines.push(`          cache: ${yamlQuote(python.cache)}`);
  if (python.setupUv) {
    lines.push(
      '      - name: Setup uv',
      `        uses: ${SETUP_UV}`,
      '        with:',
      '          enable-cache: true'
    );
  }
  lines.push('      - name: Install dependencies', '        run: |');
  for (const command of python.install) lines.push(`          ${command}`);
  for (const command of python.commands) {
    const label = command.includes('ruff') ? 'Lint' : command.includes('mypy') ? 'Type check' : 'Tests';
    lines.push(`      - name: ${label}`, `        run: ${command}`);
  }
  return `${lines.join('\n')}\n`;
}

function generatePhpJob(php) {
  const lines = [
    '  php:',
    '    name: PHP / Composer',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 20',
    '    steps:',
    ...checkoutStep('      ').trimEnd().split('\n')
  ];
  if (php.phpVersion) {
    lines.push(
      '      - name: Setup PHP',
      `        uses: ${SETUP_PHP}`,
      '        with:',
      `          php-version: ${yamlQuote(php.phpVersion)}`,
      "          tools: 'composer:v2'",
      "          coverage: 'none'"
    );
  }
  lines.push(
    '      - name: Runtime versions',
    '        run: |',
    '          php --version',
    '          composer --version'
  );
  for (const [index, command] of php.commands.entries()) {
    const label = index === 0 ? 'Validate Composer manifest' : index === 1 ? 'Install dependencies' : index === 2 ? 'Audit dependencies' : `Composer check ${index - 2}`;
    lines.push(`      - name: ${label}`, `        run: ${command}`);
  }
  return `${lines.join('\n')}\n`;
}

function generateDotnetJob(dotnet) {
  const lines = [
    '  dotnet:',
    '    name: .NET',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 25',
    '    steps:',
    ...checkoutStep('      ').trimEnd().split('\n'),
    '      - name: Setup .NET SDK',
    `        uses: ${SETUP_DOTNET}`,
    '      - name: SDK info',
    '        run: dotnet --info',
    '      - name: Restore',
    '        run: dotnet restore',
    '      - name: Build',
    '        run: dotnet build --configuration Release --no-restore'
  ];
  if (dotnet.hasTests) lines.push('      - name: Tests', '        run: dotnet test --configuration Release --no-build');
  return `${lines.join('\n')}\n`;
}

function generateCi(stacks) {
  const jobs = [];
  if (stacks.node) jobs.push(generateNodeJob(stacks.node));
  if (stacks.python) jobs.push(generatePythonJob(stacks.python));
  if (stacks.php) jobs.push(generatePhpJob(stacks.php));
  if (stacks.dotnet) jobs.push(generateDotnetJob(stacks.dotnet));
  if (!jobs.length) return null;
  return `${workflowPreamble('CI', 'ci')}jobs:\n${jobs.join('')}`;
}

function dependabotEntry(ecosystem) {
  const groupName = ecosystem.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `  - package-ecosystem: ${yamlQuote(ecosystem)}\n    directory: '/'\n    schedule:\n      interval: 'weekly'\n      day: 'monday'\n    open-pull-requests-limit: 5\n    groups:\n      ${groupName}-routine:\n        patterns:\n          - '*'\n        update-types:\n          - 'minor'\n          - 'patch'\n`;
}

function generateDependabot(stacks) {
  const ecosystems = ['github-actions'];
  if (stacks.node) ecosystems.push('npm');
  if (stacks.python) ecosystems.push('pip');
  if (stacks.php) ecosystems.push('composer');
  if (stacks.dotnet) ecosystems.push('nuget');
  if (stacks.docker) ecosystems.push('docker');
  return `${header('dependabot')}version: 2\nupdates:\n${ecosystems.map(dependabotEntry).join('')}`;
}

function template(project, name) {
  const file = path.join(project, '.agents', 'templates', 'github', name);
  if (!fs.existsSync(file)) throw new Error(`Template GitHub em falta: ${name}`);
  return fs.readFileSync(file, 'utf8');
}

function planFiles(project, stacks, args) {
  const files = [];
  const retiredMirror = '.github/workflows/mirror.yml';
  const retiredMirrorText = readText(project, retiredMirror);
  if (retiredMirrorText.startsWith(`${GENERATED} mirror`)) files.push({ relative: retiredMirror, retire: true });
  if (stacks.wells) files.push({ relative: '.github/workflows/wells-runtime.yml', content: generateWellsWorkflow() });
  const ci = generateCi(stacks);
  if (ci) files.push({ relative: '.github/workflows/ci.yml', content: ci });
  files.push({ relative: '.github/dependabot.yml', content: generateDependabot(stacks) });
  if (args['dependency-review']) files.push({ relative: '.github/workflows/dependency-review.yml', content: template(project, 'dependency-review.yml') });
  if (args.release) files.push({ relative: '.github/workflows/release-check.yml', content: template(project, 'release-check.yml') });
  return files;
}

function classify(project, item) {
  const target = path.join(project, item.relative);
  if (item.retire) return { ...item, action: fs.existsSync(target) ? 'remove' : 'keep' };
  if (!fs.existsSync(target)) return { ...item, action: 'create' };
  const current = fs.readFileSync(target, 'utf8');
  if (current === item.content) return { ...item, action: 'keep' };
  if (current.startsWith(GENERATED)) return { ...item, action: 'update' };
  return { ...item, action: 'candidate' };
}

function applyPlan(project, plan) {
  const stamp = safeStamp();
  for (const item of plan) {
    if (item.action === 'keep') continue;
    if (item.action === 'remove') {
      fs.rmSync(path.join(project, item.relative), { recursive: true, force: true });
      continue;
    }
    if (item.action === 'candidate') {
      const candidate = path.join(project, '.agents', 'migration', 'candidates', stamp, item.relative);
      ensure(path.dirname(candidate));
      fs.writeFileSync(candidate, item.content, 'utf8');
      continue;
    }
    const target = path.join(project, item.relative);
    ensure(path.dirname(target));
    fs.writeFileSync(target, item.content, 'utf8');
  }
}

function auditWorkflows(project) {
  const root = path.join(project, '.github', 'workflows');
  const issues = [];
  const warnings = [];
  if (!fs.existsSync(root)) return { issues, warnings };
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
    const relative = `.github/workflows/${entry.name}`;
    const text = fs.readFileSync(path.join(root, entry.name), 'utf8');
    if (/^\s*pull_request_target\s*:/m.test(text)) issues.push(`${relative}: pull_request_target exige revisão de segurança explícita.`);
    if (/^\s*permissions\s*:\s*write-all\s*$/m.test(text)) issues.push(`${relative}: permissions write-all é demasiado amplo.`);
    if (/^\s*persist-credentials\s*:\s*true\s*$/m.test(text)) issues.push(`${relative}: checkout preserva credenciais Git sem necessidade explícita.`);
    if (/^\s*secrets\s*:\s*inherit\s*$/m.test(text)) warnings.push(`${relative}: secrets: inherit amplia a superfície de segredos.`);
    for (const match of text.matchAll(/^\s*(?:-\s*)?uses\s*:\s*([^\s#]+).*$/gm)) {
      const ref = match[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      const at = ref.lastIndexOf('@');
      const version = at >= 0 ? ref.slice(at + 1) : '';
      if (!/^[0-9a-f]{40}$/i.test(version)) issues.push(`${relative}: Action não fixada a SHA completo: ${ref}`);
    }
  }
  return { issues: [...new Set(issues)], warnings: [...new Set(warnings)] };
}

function stackSummary(stacks) {
  return {
    wells: stacks.wells,
    node: stacks.node ? { manager: stacks.node.manager, lockfile: stacks.node.hasLock, checks: stacks.node.commands } : null,
    python: stacks.python ? { mode: stacks.python.mode, checks: stacks.python.commands } : null,
    php: stacks.php ? { lockfile: stacks.php.hasLock, version: stacks.php.phpVersion } : null,
    dotnet: Boolean(stacks.dotnet),
    docker: stacks.docker
  };
}

export function githubCommand(project, args, doApply) {
  if (args.mirror) throw new Error('O mirror WELLS foi removido em 1.3.0. Usa um fork nativo do GitHub e Sync fork manual.');
  const stacks = detectStacks(project);
  const warnings = [];
  if (stacks.node?.reproducibilityWarning) warnings.push(stacks.node.reproducibilityWarning);
  if (stacks.python?.reproducibilityWarning) warnings.push(stacks.python.reproducibilityWarning);
  if (stacks.php && !stacks.php.hasLock) warnings.push('PHP: composer.lock ausente; resolução de dependências não é totalmente reprodutível.');
  if (stacks.php && !stacks.php.phpVersion) warnings.push('PHP: config.platform.php não está fixado; CI usa o PHP fornecido pelo runner GitHub.');
  if (stacks.dotnet && !stacks.dotnet.hasGlobalJson) warnings.push('.NET: sem global.json; o SDK depende do runner GitHub.');
  if (stacks.docker) warnings.push('Docker detetado; build/deploy não é gerado automaticamente sem contrato explícito.');
  const externalMirror = readText(project, '.github/workflows/mirror.yml');
  if (externalMirror && !externalMirror.startsWith(`${GENERATED} mirror`)) warnings.push('Workflow .github/workflows/mirror.yml externo detetado; o WELLS não o altera nem o usa para sincronização de forks.');
  if (!args['dependency-review']) warnings.push('Dependency Review não foi ativado: usa --dependency-review apenas quando o plano GitHub do repo o suporta.');
  warnings.push('CodeQL Default setup, secret scanning/push protection e rulesets são configurações GitHub e devem ser ativados no repositório/organização quando aplicável.');

  const plan = planFiles(project, stacks, args).map(item => classify(project, item));
  if (doApply) applyPlan(project, plan);
  const workflowAudit = auditWorkflows(project);
  const recommendedRulesetChecks = [];
  if (stacks.wells) recommendedRulesetChecks.push('WELLS Runtime / runtime');
  if (stacks.node) recommendedRulesetChecks.push('CI / Node');
  if (stacks.python) recommendedRulesetChecks.push('CI / Python');
  if (stacks.php) recommendedRulesetChecks.push('CI / PHP / Composer');
  if (stacks.dotnet) recommendedRulesetChecks.push('CI / .NET');
  if (args['dependency-review']) recommendedRulesetChecks.push('Dependency Review / dependency-review');
  const report = {
    ok: workflowAudit.issues.length === 0,
    applied: doApply,
    stacks: stackSummary(stacks),
    plan: plan.map(({ relative, action }) => ({ relative, action })),
    recommendedRulesetChecks,
    issues: workflowAudit.issues,
    warnings: [...warnings, ...workflowAudit.warnings]
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('\nGITHUB AUTOMATION\n');
    console.log(`Stacks: ${JSON.stringify(report.stacks)}`);
    for (const item of report.plan) console.log(`${item.action.toUpperCase()}: ${item.relative}`);
    if (report.recommendedRulesetChecks.length) console.log(`Ruleset sugerido: ${report.recommendedRulesetChecks.join(', ')}`);
    for (const warning of report.warnings) console.log(`AVISO: ${warning}`);
    for (const issue of report.issues) console.log(`ERRO: ${issue}`);
    if (!doApply) console.log('\nSimulação apenas. Para aplicar, repete com --apply.');
  }
  if (args.strict && report.issues.length) process.exitCode = 1;
  return report;
}
