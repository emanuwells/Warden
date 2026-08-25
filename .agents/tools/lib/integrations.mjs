/** Gestão declarativa, fixada e auditável das integrações externas WELLS. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function registry(project) {
  const file = path.join(project, '.agents', 'integrations', 'registry.json');
  if (!fs.existsSync(file)) throw new Error('Registo de integrações inexistente.');
  return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function selected(data, args) {
  if (args.name) {
    const item = data.integrations.find(value => value.id === args.name);
    if (!item) throw new Error(`Integração desconhecida: ${args.name}`);
    return [item];
  }
  const profile = String(args.profile || 'recommended');
  const ids = data.profiles?.[profile];
  if (!ids) throw new Error(`Perfil desconhecido: ${profile}`);
  return ids.map(id => data.integrations.find(item => item.id === id)).filter(Boolean);
}

function renderPlan(items, profile) {
  const lines = ['# Plano de integrações WELLS', '', `- Perfil: \`${profile}\``, `- Gerado: ${new Date().toISOString()}`, '', '> Nenhuma integração externa é instalada automaticamente. Rever origem, versão, licença, permissões, processos, hooks e rollback.', ''];
  for (const item of items) {
    lines.push(`## ${item.id}`, '', `- Origem: ${item.source}`, `- Versão testada: ${item.testedVersion}`, `- Referência testada: ${item.testedRef}`, `- Verificado: ${item.verifiedAt}`, `- Licença: ${item.license}`, `- Risco: **${item.risk}**`, `- Ativação: ${item.activation}`, `- Scope: ${item.scope}`, `- Atualização: ${item.updatePolicy}`, '');
    if (item.prerequisites?.length) lines.push('### Pré-requisitos', '', ...item.prerequisites.map(x => `- ${x}`), '');
    if (item.install?.length) lines.push('### Instalação', '', '```text', ...item.install, '```', '');
    if (item.verify?.length) lines.push('### Verificação', '', '```text', ...item.verify, '```', '');
    if (item.conflicts?.length) lines.push('### Conflitos', '', ...item.conflicts.map(x => `- ${x}`), '');
    if (item.notes) lines.push('### Notas', '', item.notes, '');
  }
  return `${lines.join('\n')}\n`;
}

function list(project) {
  const { data } = registry(project);
  console.log(JSON.stringify({ profiles: data.profiles, integrations: data.integrations.map(({ id, kind, risk, activation, testedVersion, testedRef, installed = false }) => ({ id, kind, risk, activation, testedVersion, testedRef, installed })) }, null, 2));
}

function plan(project, args, apply) {
  const { data } = registry(project);
  const profile = args.name ? `name:${args.name}` : String(args.profile || 'recommended');
  const items = selected(data, args);
  if (items.some(item => item.risk === 'high') && !args['accept-risk']) throw new Error('O plano contém integrações de risco elevado. Repete com --accept-risk depois de rever a política.');
  const content = renderPlan(items, profile);
  if (!apply) {
    process.stdout.write(content);
    console.log('\nPara guardar o plano, repete com --apply.');
    return;
  }
  const target = path.join(project, '.agents', 'integrations', 'INSTALL_PLAN.md');
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Plano guardado: ${target}`);
}

function lock(project, apply) {
  const { data } = registry(project);
  const content = `${JSON.stringify({ schemaVersion: 1, generatedFrom: '.agents/integrations/registry.json', verifiedAt: data.verifiedAt, integrations: data.integrations.map(item => ({ id: item.id, testedVersion: item.testedVersion, testedRef: item.testedRef, source: item.source, license: item.license, risk: item.risk })) }, null, 2)}\n`;
  if (!apply) { process.stdout.write(content); console.log('\nPara guardar, repete com --apply.'); return; }
  const target = path.join(project, '.agents', 'integrations', 'LOCK.json');
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Lock guardado: ${target}`);
}

function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [command], { encoding: 'utf8' }).status === 0;
}

function doctor(project) {
  const { data } = registry(project);
  const checks = {
    node: process.version,
    npm: commandExists('npm'),
    playwrightCli: commandExists('playwright-cli'),
    claude: commandExists('claude'),
    uv: commandExists('uv'),
    graphify: commandExists('graphify'),
    codeburn: commandExists('codeburn'),
    omniroute: commandExists('omniroute'),
    ctx7: commandExists('ctx7'),
    trivy: commandExists('trivy'),
    gitleaks: commandExists('gitleaks'),
    semgrep: commandExists('semgrep'),
    docker: commandExists('docker')
  };
  console.log(JSON.stringify({ ok: true, verifiedAt: data.verifiedAt, checks, note: 'Ausência de integração opcional não invalida o runtime.' }, null, 2));
}

export function integrationsCommand(project, args, apply) {
  const action = args._?.[0] || 'list';
  if (action === 'list') return list(project);
  if (action === 'plan') return plan(project, args, apply);
  if (action === 'lock') return lock(project, apply);
  if (action === 'doctor') return doctor(project);
  throw new Error('Usa integrations list, plan, lock ou doctor.');
}

export function auditIntegrations(project) {
  const issues = [];
  try {
    const { data } = registry(project);
    const ids = new Set();
    for (const item of data.integrations || []) {
      if (!item.id || ids.has(item.id)) issues.push(`ID de integração inválido/duplicado: ${item.id || '<vazio>'}`);
      ids.add(item.id);
      for (const key of ['kind', 'source', 'license', 'risk', 'activation', 'scope', 'testedVersion', 'testedRef', 'verifiedAt', 'updatePolicy']) if (!item[key]) issues.push(`Campo ${key} em falta: ${item.id}`);
      if (item.autoInstall === true && !item.installed) issues.push(`Instalação automática externa proibida: ${item.id}`);
    }
    for (const [profile, profileIds] of Object.entries(data.profiles || {})) for (const id of profileIds) if (!ids.has(id)) issues.push(`Integração inexistente no perfil ${profile}: ${id}`);
  } catch (error) { issues.push(error.message); }
  return issues;
}
