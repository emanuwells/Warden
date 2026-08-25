/**
 * Operações do grafo de conhecimento WELLS.
 * Sem dependências externas: fontes, proveniência, staleness, índice e grafo determinístico.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TYPES = new Set(['architecture', 'component', 'integration', 'decision', 'incident', 'lesson', 'operation']);
const STATUSES = new Set(['active', 'draft', 'deprecated', 'superseded', 'resolved']);
const FOLDERS = {
  architecture: 'architecture', component: 'components', integration: 'integrations',
  decision: 'decisions', incident: 'incidents', lesson: 'lessons', operation: 'operations'
};
const SOURCE_TYPES = new Set(['code', 'document', 'specification', 'issue', 'log', 'test', 'database', 'external']);
const HASH_EXCLUDES = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.next', 'coverage']);

function ensure(directory) { fs.mkdirSync(directory, { recursive: true }); }
function walk(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() && HASH_EXCLUDES.has(entry.name)) continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}
function slug(value) {
  const result = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!result || result.length > 96) throw new Error('ID de conhecimento inválido.');
  return result;
}
function today() { return new Date().toISOString().slice(0, 10); }
function hashText(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value) { return JSON.stringify(value, Object.keys(value).sort()); }

function sourceHash(project, sourcePath) {
  if (!sourcePath || /^(https?:|git:|issue:|external:)/i.test(sourcePath)) return '';
  const target = path.resolve(project, sourcePath);
  if (!fs.existsSync(target)) return '';
  if (fs.statSync(target).isFile()) return `sha256:${hashText(fs.readFileSync(target))}`;
  const digest = crypto.createHash('sha256');
  for (const file of walk(target)) {
    const relative = path.relative(target, file).replaceAll('\\', '/');
    if (relative.startsWith('.agents/knowledge/') && /(?:GRAPH\.json|INDEX\.md|LOG\.md)$/.test(relative)) continue;
    digest.update(relative).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  return `sha256:${digest.digest('hex')}`;
}

/** Lê frontmatter YAML restrito, incluindo listas simples. */
function parsePage(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { file, text, metadata: null };
  const metadata = {};
  let listKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    const list = raw.match(/^\s+-\s+(.+)$/);
    if (list && listKey) {
      metadata[listKey].push(list[1].trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    const scalar = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!scalar) continue;
    const [, key, value] = scalar;
    if (!value.trim()) {
      metadata[key] = [];
      listKey = key;
    } else {
      const cleaned = value.trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = cleaned === '[]' ? [] : cleaned;
      listKey = null;
    }
  }
  for (const key of ['related', 'sources', 'supersedes']) {
    if (!Array.isArray(metadata[key])) metadata[key] = metadata[key] ? [metadata[key]] : [];
  }
  return { file, text, metadata };
}

/** Parser YAML mínimo e determinístico para SOURCES.yml. */
function parseSources(file) {
  const output = { version: 1, sources: [] };
  if (!fs.existsSync(file)) return output;
  let current = null;
  let listKey = null;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const version = raw.match(/^version:\s*(\d+)/);
    if (version) output.version = Number(version[1]);
    const start = raw.match(/^\s{2}-\s+id:\s*(.+)$/);
    if (start) {
      current = { id: start[1].trim().replace(/^['"]|['"]$/g, ''), derived_pages: [] };
      output.sources.push(current);
      listKey = null;
      continue;
    }
    if (!current) continue;
    const list = raw.match(/^\s{6}-\s+(.+)$/);
    if (list && listKey) {
      current[listKey].push(list[1].trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    const item = raw.match(/^\s{4}([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!item) continue;
    const key = item[1];
    const rawValue = item[2].trim();
    if (!rawValue) {
      current[key] = [];
      listKey = key;
    } else {
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      current[key] = value === 'true' ? true : value === 'false' ? false : value === '[]' ? [] : value;
      listKey = null;
    }
  }
  return output;
}

function yamlValue(value) {
  const text = String(value ?? '');
  return /^[A-Za-z0-9_./:@+-]+$/.test(text) ? text : JSON.stringify(text);
}

function renderSources(data) {
  const lines = [`version: ${data.version || 1}`, 'sources:'];
  for (const source of [...data.sources].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`  - id: ${yamlValue(source.id)}`);
    for (const key of ['type', 'path', 'mutable', 'hash', 'verified_at', 'notes']) {
      if (source[key] === undefined || source[key] === '') continue;
      lines.push(`    ${key}: ${typeof source[key] === 'boolean' ? source[key] : yamlValue(source[key])}`);
    }
    const pages = Array.isArray(source.derived_pages) ? [...new Set(source.derived_pages)].sort() : [];
    lines.push('    derived_pages:');
    for (const page of pages) lines.push(`      - ${yamlValue(page)}`);
  }
  if (!data.sources.length) lines[1] = 'sources: []';
  return `${lines.join('\n')}\n`;
}

function collect(project) {
  const base = path.join(project, '.agents', 'knowledge');
  const pageRoot = path.join(base, 'pages');
  const pages = walk(pageRoot)
    .filter(file => file.endsWith('.md') && path.basename(file).toLowerCase() !== 'readme.md')
    .map(parsePage);
  const sourceData = parseSources(path.join(base, 'SOURCES.yml'));
  const sources = new Map(sourceData.sources.map(source => [source.id, source]));
  return { base, pageRoot, pages, sourceData, sources };
}

function validate(project) {
  const { pages, sourceData, sources } = collect(project);
  const issues = [];
  const warnings = [];
  const stale = [];
  const byId = new Map();
  const activeDecisionTopics = new Map();

  for (const page of pages) {
    const relative = path.relative(project, page.file).replaceAll('\\', '/');
    const m = page.metadata;
    if (!m) { issues.push(`FRONTMATTER EM FALTA: ${relative}`); continue; }
    for (const key of ['id', 'title', 'type', 'status', 'updated']) if (!m[key]) issues.push(`METADADO ${key} EM FALTA: ${relative}`);
    if (m.id) {
      if (byId.has(m.id)) issues.push(`ID DUPLICADO: ${m.id}`);
      else byId.set(m.id, page);
      if (slug(m.id) !== m.id) issues.push(`ID NÃO CANÓNICO: ${m.id}`);
    }
    if (m.type && !TYPES.has(m.type)) issues.push(`TYPE INVÁLIDO: ${m.type} em ${relative}`);
    if (m.status && !STATUSES.has(m.status)) issues.push(`STATUS INVÁLIDO: ${m.status} em ${relative}`);
    if (m.updated && !/^\d{4}-\d{2}-\d{2}$/.test(m.updated)) issues.push(`DATA INVÁLIDA: ${m.updated} em ${relative}`);
    if (m.status !== 'draft' && (!m.sources || m.sources.length === 0)) warnings.push(`PÁGINA SEM PROVENIÊNCIA: ${m.id || relative}`);
    if (m.type === 'decision' && m.status === 'active' && m.topic) {
      const values = activeDecisionTopics.get(m.topic) || [];
      values.push(m.id);
      activeDecisionTopics.set(m.topic, values);
    }
    if (m.type === 'decision' && m.status === 'superseded' && !m.superseded_by) issues.push(`DECISÃO SUPERSEDED SEM superseded_by: ${m.id}`);
    if (m.type === 'decision' && m.status === 'active' && m.superseded_by) issues.push(`DECISÃO ATIVA COM superseded_by: ${m.id}`);
  }

  for (const [topic, ids] of activeDecisionTopics) if (ids.length > 1) warnings.push(`POSSÍVEL CONTRADIÇÃO NO TÓPICO ${topic}: ${ids.join(', ')}`);

  for (const page of pages) {
    const m = page.metadata;
    if (!m?.id) continue;
    for (const related of m.related) if (!byId.has(related)) issues.push(`RELAÇÃO INVÁLIDA: ${m.id} -> ${related}`);
    for (const source of m.sources) if (!sources.has(source)) issues.push(`FONTE NÃO REGISTADA: ${m.id} -> ${source}`);
    if (m.superseded_by && !byId.has(m.superseded_by)) issues.push(`DECISÃO SUBSTITUTA INEXISTENTE: ${m.id} -> ${m.superseded_by}`);
    for (const previous of m.supersedes || []) if (!byId.has(previous)) issues.push(`DECISÃO SUPERADA INEXISTENTE: ${m.id} -> ${previous}`);
  }

  for (const source of sourceData.sources) {
    if (!source.id || slug(source.id) !== source.id) issues.push(`ID DE FONTE INVÁLIDO: ${source.id || '<vazio>'}`);
    if (!source.type || !SOURCE_TYPES.has(source.type)) issues.push(`TIPO DE FONTE INVÁLIDO: ${source.id}`);
    if (!source.path) issues.push(`PATH DE FONTE EM FALTA: ${source.id}`);
    const local = source.path && !/^(https?:|git:|issue:|external:)/i.test(source.path);
    if (local) {
      const target = path.resolve(project, source.path);
      if (!fs.existsSync(target)) warnings.push(`FONTE LOCAL INEXISTENTE: ${source.id} -> ${source.path}`);
      else if (source.hash) {
        const currentHash = sourceHash(project, source.path);
        if (currentHash && currentHash !== source.hash) {
          stale.push({ id: source.id, path: source.path, expected: source.hash, actual: currentHash });
          warnings.push(`FONTE ALTERADA DESDE A VERIFICAÇÃO: ${source.id}`);
        }
      } else warnings.push(`FONTE LOCAL SEM HASH: ${source.id}`);
    }
    for (const pageId of source.derived_pages || []) if (!byId.has(pageId)) warnings.push(`DERIVAÇÃO PARA PÁGINA INEXISTENTE: ${source.id} -> ${pageId}`);
  }

  for (const page of pages) {
    if (!page.metadata?.id) continue;
    for (const sourceId of page.metadata.sources || []) {
      const source = sources.get(sourceId);
      if (source && !(source.derived_pages || []).includes(page.metadata.id)) warnings.push(`DERIVAÇÃO NÃO SINCRONIZADA: ${sourceId} -> ${page.metadata.id}`);
    }
  }

  const inbound = new Map([...byId.keys()].map(id => [id, 0]));
  for (const page of pages) for (const related of page.metadata?.related || []) if (inbound.has(related)) inbound.set(related, inbound.get(related) + 1);
  for (const [id, count] of inbound) {
    const page = byId.get(id);
    if (count === 0 && (page.metadata.related || []).length === 0 && pages.length > 1) warnings.push(`PÁGINA ÓRFÃ: ${id}`);
  }
  return { pages, sourceData, sources, byId, issues, warnings: [...new Set(warnings)], stale };
}

function renderIndex(project, validation) {
  const rows = validation.pages
    .filter(page => page.metadata?.id)
    .sort((a, b) => a.metadata.type.localeCompare(b.metadata.type) || a.metadata.title.localeCompare(b.metadata.title))
    .map(page => {
      const m = page.metadata;
      const rel = path.relative(path.join(project, '.agents', 'knowledge'), page.file).replaceAll('\\', '/');
      return `| [${m.title}](${rel}) | \`${m.type}\` | \`${m.status}\` | ${m.updated} | ${(m.related || []).map(x => `\`${x}\``).join(', ') || '—'} |`;
    });
  return ['# Índice de conhecimento', '', '_Gerado automaticamente. Não editar manualmente._', '',
    '| Página | Tipo | Estado | Atualizada | Relações |', '|---|---|---|---|---|', ...rows, '', `Total: ${rows.length} páginas.`, ''].join('\n');
}

function semanticGraph(project, validation) {
  const nodes = validation.pages.filter(page => page.metadata?.id).map(page => ({
    id: page.metadata.id, title: page.metadata.title, type: page.metadata.type,
    status: page.metadata.status, updated: page.metadata.updated,
    path: path.relative(project, page.file).replaceAll('\\', '/'),
    sources: [...(page.metadata.sources || [])].sort()
  })).sort((a, b) => a.id.localeCompare(b.id));
  const edges = [];
  for (const page of validation.pages) {
    const m = page.metadata;
    if (!m?.id) continue;
    for (const target of m.related || []) edges.push({ source: m.id, target, relation: 'related' });
    for (const target of m.sources || []) edges.push({ source: m.id, target, relation: 'derived-from', targetType: 'source' });
    if (m.superseded_by) edges.push({ source: m.id, target: m.superseded_by, relation: 'superseded-by' });
    for (const target of m.supersedes || []) edges.push({ source: m.id, target, relation: 'supersedes' });
  }
  edges.sort((a, b) => `${a.source}:${a.relation}:${a.target}`.localeCompare(`${b.source}:${b.relation}:${b.target}`));
  return { schemaVersion: 2, nodes, edges };
}

function renderGraph(project, validation, currentText) {
  const semantic = semanticGraph(project, validation);
  let generatedAt = new Date().toISOString();
  try {
    const current = JSON.parse(currentText || '{}');
    const currentSemantic = { schemaVersion: current.schemaVersion, nodes: current.nodes || [], edges: current.edges || [] };
    if (JSON.stringify(currentSemantic) === JSON.stringify(semantic) && current.generatedAt) generatedAt = current.generatedAt;
  } catch {}
  return `${JSON.stringify({ ...semantic, generatedAt }, null, 2)}\n`;
}

function appendLog(base, line) {
  const file = path.join(base, 'LOG.md');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Log do conhecimento\n\n';
  const headingEnd = current.indexOf('\n\n');
  const entry = `- ${new Date().toISOString()} | ${line}\n`;
  fs.writeFileSync(file, `${current.slice(0, headingEnd + 2)}${entry}${current.slice(headingEnd + 2)}`, 'utf8');
}

function build(project, apply) {
  const result = validate(project);
  if (result.issues.length) throw new Error(`Grafo inválido:\n${result.issues.join('\n')}`);
  const index = renderIndex(project, result);
  const graphTarget = path.join(project, '.agents', 'knowledge', 'GRAPH.json');
  const currentGraph = fs.existsSync(graphTarget) ? fs.readFileSync(graphTarget, 'utf8') : '';
  const graph = renderGraph(project, result, currentGraph);
  const targets = [['.agents/knowledge/INDEX.md', index], ['.agents/knowledge/GRAPH.json', graph]];
  let changed = false;
  console.log(apply ? '\nKNOWLEDGE BUILD — a aplicar\n' : '\nKNOWLEDGE BUILD — simulação\n');
  for (const [relative, content] of targets) {
    const target = path.join(project, relative);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    const different = current !== content;
    changed ||= different;
    console.log(`${different ? 'ATUALIZAR' : 'MANTER'}: ${relative}`);
    if (apply && different) { ensure(path.dirname(target)); fs.writeFileSync(target, content, 'utf8'); }
  }
  if (apply && changed) appendLog(path.join(project, '.agents', 'knowledge'), `build | ${result.pages.length} páginas | ${result.warnings.length} warnings`);
  if (apply && !changed) console.log('\nSem alterações semânticas; LOG.md não foi modificado.');
  if (result.warnings.length) console.log(`\nWarnings:\n${result.warnings.join('\n')}`);
  if (!apply) console.log('\nPara aplicar, repete com --apply.');
  return { changed, ...result };
}

function lint(project) {
  const result = validate(project);
  const output = { ok: result.issues.length === 0, pages: result.pages.length, sources: result.sources.size, stale: result.stale.length, issues: result.issues, warnings: result.warnings };
  console.log(JSON.stringify(output, null, 2));
  if (result.issues.length) process.exitCode = 1;
  return output;
}

function coverage(project) {
  const result = validate(project);
  const withSources = result.pages.filter(page => (page.metadata?.sources || []).length > 0).length;
  const sourceCoverage = result.pages.length ? Math.round((withSources / result.pages.length) * 100) : 100;
  const output = {
    pages: result.pages.length,
    pagesWithSources: withSources,
    sourceCoveragePercent: sourceCoverage,
    registeredSources: result.sources.size,
    staleSources: result.stale.length,
    warnings: result.warnings.length,
    status: result.pages.length === 0 ? 'empty-template' : sourceCoverage === 100 && result.stale.length === 0 ? 'healthy' : 'attention'
  };
  console.log(JSON.stringify(output, null, 2));
  return output;
}

function stale(project) {
  const result = validate(project);
  console.log(JSON.stringify({ ok: result.stale.length === 0, stale: result.stale }, null, 2));
  if (result.stale.length) process.exitCode = 2;
  return result.stale;
}

function addPage(project, args, apply) {
  const type = String(args.type || '').toLowerCase();
  if (!TYPES.has(type)) throw new Error(`Tipo inválido. Usa: ${[...TYPES].join(', ')}.`);
  const id = slug(args.id || args.title);
  const title = String(args.title || '').trim();
  if (!title) throw new Error('Indica --title.');
  const status = String(args.status || 'draft');
  if (!STATUSES.has(status)) throw new Error('Status inválido.');
  const folder = FOLDERS[type];
  const relative = `.agents/knowledge/pages/${folder}/${id}.md`;
  const target = path.join(project, relative);
  if (fs.existsSync(target)) throw new Error(`Já existe: ${relative}`);
  const topic = args.topic ? `topic: ${slug(args.topic)}\n` : '';
  const content = `---\nid: ${id}\ntitle: ${title}\ntype: ${type}\nstatus: ${status}\nupdated: ${today()}\n${topic}related: []\nsources: []\nsupersedes: []\n---\n\n# ${title}\n\n## Síntese\n\nPreencher apenas com conhecimento confirmado e durável.\n\n## Evidência\n\n- Registar fontes em \`SOURCES.yml\` e associá-las no frontmatter.\n`;
  console.log(`\n${apply ? 'CRIAR' : 'SIMULAR CRIAÇÃO'}: ${relative}`);
  if (!apply) return console.log('Para aplicar, repete com --apply.');
  ensure(path.dirname(target));
  fs.writeFileSync(target, content, 'utf8');
  appendLog(path.join(project, '.agents', 'knowledge'), `add-page | ${type} | ${id}`);
  console.log('Página criada em draft. Regista fontes antes de a marcar como active.');
}

function sourceAdd(project, args, apply) {
  const dataFile = path.join(project, '.agents', 'knowledge', 'SOURCES.yml');
  const data = parseSources(dataFile);
  const id = slug(args.id);
  const sourcePath = String(args.path || '').trim().replaceAll('\\', '/');
  const type = String(args['source-type'] || args.type || 'document').toLowerCase();
  if (!sourcePath) throw new Error('Indica --path.');
  if (!SOURCE_TYPES.has(type)) throw new Error(`Tipo de fonte inválido. Usa: ${[...SOURCE_TYPES].join(', ')}.`);
  if (data.sources.some(source => source.id === id)) throw new Error(`Fonte já existe: ${id}`);
  const source = { id, type, path: sourcePath, mutable: String(args.mutable ?? 'true') !== 'false', derived_pages: [] };
  const calculated = sourceHash(project, sourcePath);
  if (calculated) { source.hash = calculated; source.verified_at = today(); }
  data.sources.push(source);
  console.log(`\n${apply ? 'CRIAR FONTE' : 'SIMULAR FONTE'}: ${id} -> ${sourcePath}`);
  if (!apply) return console.log('Para aplicar, repete com --apply.');
  fs.writeFileSync(dataFile, renderSources(data), 'utf8');
  appendLog(path.join(project, '.agents', 'knowledge'), `add-source | ${id}`);
}

function sourceVerify(project, args, apply) {
  const dataFile = path.join(project, '.agents', 'knowledge', 'SOURCES.yml');
  const data = parseSources(dataFile);
  const pageResult = collect(project);
  const targetId = args.id ? slug(args.id) : null;
  let changed = false;
  const updates = [];
  for (const source of data.sources) {
    if (targetId && source.id !== targetId) continue;
    const calculated = sourceHash(project, source.path);
    if (!calculated) { updates.push({ id: source.id, status: 'unavailable' }); continue; }
    const derived = pageResult.pages.filter(page => (page.metadata?.sources || []).includes(source.id)).map(page => page.metadata.id).sort();
    if (source.hash !== calculated || source.verified_at !== today() || JSON.stringify(source.derived_pages || []) !== JSON.stringify(derived)) changed = true;
    source.hash = calculated;
    source.verified_at = today();
    source.derived_pages = derived;
    updates.push({ id: source.id, status: 'verified', hash: calculated, derivedPages: derived.length });
  }
  if (targetId && !updates.length) throw new Error(`Fonte inexistente: ${targetId}`);
  console.log(JSON.stringify({ apply, changed, updates }, null, 2));
  if (!apply) return;
  if (changed) {
    fs.writeFileSync(dataFile, renderSources(data), 'utf8');
    appendLog(path.join(project, '.agents', 'knowledge'), `verify-sources | ${updates.filter(item => item.status === 'verified').length}`);
  }
}

/** Entrada dos subcomandos knowledge. */
export function knowledgeCommand(project, args, apply) {
  const action = args._?.[0] || 'lint';
  const subaction = args._?.[1] || '';
  if (action === 'build') return build(project, apply);
  if (action === 'lint') return lint(project);
  if (action === 'coverage') return coverage(project);
  if (action === 'stale') return stale(project);
  if (action === 'add') return addPage(project, args, apply);
  if (action === 'source' && subaction === 'add') return sourceAdd(project, args, apply);
  if (action === 'source' && subaction === 'verify') return sourceVerify(project, args, apply);
  throw new Error('Usa knowledge build|lint|coverage|stale|add ou knowledge source add|verify.');
}

/** Auditoria reutilizável pelo comando principal. */
export function auditKnowledge(project) { return validate(project); }
