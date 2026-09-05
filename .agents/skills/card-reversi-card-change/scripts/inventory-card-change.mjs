#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const MODES = new Set(['add', 'change', 'rename', 'enable', 'disable', 'remove', 'audit']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css',
  '.scss', '.yaml', '.yml', '.py', '.ps1', '.bat', '.txt', '.toml'
]);
const INSTRUCTION_FILENAMES = ['AGENTS.md', 'AGENTS.override.md'];

const ADD_MODE_GUIDE_DIRECTORIES = [
  'cards',
  'game/cards',
  'game/logic/cards',
  'game/logic/card-resolution',
  'game/logic/cards-internal',
  'game/card-effects',
  'game/turn',
  'game/ai',
  'shared',
  'ui',
  'ui/network',
  'utils',
  'workers',
  'test',
  'tests',
  'scripts',
  'training',
  '正本'
];
const RELEVANT_PACKAGE_SCRIPTS = [
  'generate:catalog',
  'generate:card-art-map',
  'generate:asset-manifest',
  'typecheck',
  'build:ts',
  'check:window',
  'check:board-kernel-boundary',
  'check:board-test-selectors',
  'test:match:parity',
  'test:network:parity',
  'build:browser',
  'build:vite',
  'match:pixijs-board-playback-check',
  'match:pixi-runtime-fallback-check',
  'match:cross-platform-smoke:vite',
  'worker:prepare',
  'check:worker-mirror'
];

function fail(message) {
  console.error(`inventory-card-change: ${message}`);
  process.exit(1);
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${optionName} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = {
    repo: process.cwd(),
    mode: 'audit',
    card: '',
    terms: [],
    newTerms: [],
    expectAbsent: [],
    allowPaths: [],
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      options.repo = readOptionValue(argv, index, '--repo');
      index += 1;
    } else if (arg === '--mode') {
      options.mode = readOptionValue(argv, index, '--mode').trim().toLowerCase();
      index += 1;
    } else if (arg === '--card') {
      options.card = readOptionValue(argv, index, '--card');
      index += 1;
    } else if (arg === '--term' || arg === '--old-term') {
      options.terms.push(readOptionValue(argv, index, arg));
      index += 1;
    } else if (arg === '--new-term') {
      options.newTerms.push(readOptionValue(argv, index, '--new-term'));
      index += 1;
    } else if (arg === '--expect-absent') {
      options.expectAbsent.push(readOptionValue(argv, index, '--expect-absent'));
      index += 1;
    } else if (arg === '--allow-path') {
      options.allowPaths.push(readOptionValue(argv, index, '--allow-path'));
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log([
        'Usage: inventory-card-change.mjs --mode <mode> --card <id|type|Japanese name> [options]',
        '',
        'Modes: add, change, rename, enable, disable, remove, audit',
        'Options:',
        '  --repo <path>             Repository root or a nested path (default: cwd)',
        '  --term|--old-term <text>  Repeatable current or legacy alias',
        '  --new-term <text>         Repeatable replacement alias; required for rename',
        '  --expect-absent <text>    Fail with exit 2 when the term remains outside historical docs',
        '  --allow-path <prefix>     Permit an expected-absent term under an explained path prefix',
        '  --json                     Emit structured JSON'
      ].join('\n'));
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  options.card = options.card.trim();
  options.terms = options.terms.map((value) => value.trim()).filter(Boolean);
  options.newTerms = options.newTerms.map((value) => value.trim()).filter(Boolean);
  options.expectAbsent = options.expectAbsent.map((value) => value.trim()).filter(Boolean);
  options.allowPaths = options.allowPaths.map(normalizePath).filter(Boolean);
  if (!MODES.has(options.mode)) fail(`unknown mode: ${options.mode}; expected ${[...MODES].join(', ')}`);
  if (!options.card) fail('--card is required');
  if (options.mode === 'rename' && options.newTerms.length === 0) {
    fail('--mode rename requires at least one --new-term');
  }
  return options;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('ja-JP');
}

function normalizePath(value) {
  return normalize(value).replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function uniqueTerms(values) {
  const byNormalizedValue = new Map();
  for (const value of values) {
    const original = String(value ?? '').trim();
    const normalizedValue = normalize(original);
    if (normalizedValue && !byNormalizedValue.has(normalizedValue)) {
      byNormalizedValue.set(normalizedValue, original);
    }
  }
  return [...byNormalizedValue.values()];
}

function runGit(repoRoot, args) {
  return spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    windowsHide: true
  });
}

function resolveRepoRoot(repoPath) {
  const candidate = resolve(repoPath || process.cwd());
  const result = runGit(candidate, ['rev-parse', '--show-toplevel']);
  if (result.status !== 0) {
    fail(`cannot resolve a git repository from ${candidate}: ${(result.stderr || '').trim()}`);
  }
  return resolve((result.stdout || '').trim());
}

function validateRepository(repoRoot) {
  const packagePath = resolve(repoRoot, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${packagePath}: ${error.message}`);
  }
  if (packageJson.name !== 'card-reversi') {
    fail(`${relative(process.cwd(), repoRoot) || '.'} is not the card-reversi repository`);
  }
  return packageJson;
}

function loadCatalog(repoRoot) {
  const catalogPath = resolve(repoRoot, 'cards', 'catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${catalogPath}: ${error.message}`);
  }
  if (!catalog || !Array.isArray(catalog.cards)) {
    fail('cards/catalog.json does not contain a cards array');
  }
  return catalog;
}

function validateCatalog(cards) {
  const issues = [];
  const seen = {
    id: new Map(),
    type: new Map(),
    name_ja: new Map()
  };
  cards.forEach((card, index) => {
    for (const field of ['id', 'type', 'name_ja']) {
      const value = normalize(card && card[field]);
      if (!value) {
        issues.push(`cards[${index}].${field} is required`);
        continue;
      }
      if (seen[field].has(value)) {
        issues.push(`duplicate ${field}: ${card[field]} (cards[${seen[field].get(value)}], cards[${index}])`);
      } else {
        seen[field].set(value, index);
      }
    }
  });
  return issues;
}

function cardKeys(card) {
  return [card && card.id, card && card.type, card && card.name_ja]
    .map(normalize)
    .filter(Boolean);
}

function selectCard(cards, query, mode) {
  const needle = normalize(query);
  const exact = cards.filter((card) => cardKeys(card).includes(needle));
  if (exact.length > 1) fail(`ambiguous exact match: ${exact.map((card) => card.id).join(', ')}`);
  if (exact.length === 1) return { card: exact[0], matchKind: 'exact' };

  if (mode !== 'audit') return { card: null, matchKind: 'none' };
  const partial = cards.filter((card) => cardKeys(card).some((value) => value.includes(needle)));
  if (partial.length === 1) return { card: partial[0], matchKind: 'partial' };
  if (partial.length > 1) {
    fail(`ambiguous partial match: ${partial.slice(0, 12).map((card) => `${card.id} (${card.name_ja})`).join(', ')}`);
  }
  return { card: null, matchKind: 'none' };
}

function enforceMode(mode, selected, query) {
  if (mode === 'add' && selected.card) {
    fail(`--mode add requires a new identity, but ${query} matches ${selected.card.id}`);
  }
  if (['change', 'rename', 'enable', 'disable', 'remove'].includes(mode) && !selected.card) {
    fail(`--mode ${mode} requires one exact catalog match for ${query}`);
  }
}

function listCandidateFiles(repoRoot) {
  const result = runGit(repoRoot, [
    '-c',
    'core.quotePath=false',
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard'
  ]);
  if (result.status !== 0) fail(`git ls-files failed: ${(result.stderr || '').trim()}`);
  return uniqueTerms(
    (result.stdout || '')
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean)
  ).sort((left, right) => left.localeCompare(right, 'en'));
}

function isGeneratedOrMirror(path, contents) {
  const generatedRootFiles = new Set([
    'assets/asset-manifest.json',
    'cards/card-art-map.generated.ts',
    'cards/catalog.generated.js',
    'cards/catalog.js',
    'cards/catalog.ts',
    'public/module-registry.js'
  ]);
  return path.startsWith('worker-public/')
    || path.startsWith('dist/')
    || path.startsWith('vite-dist/')
    || path.startsWith('browser-vite/generated/')
    || generatedRootFiles.has(path)
    || path.includes('.generated.')
    || /^\/\/ Auto-generated\b/u.test(contents || '');
}

function classify(file, contents = '') {
  const path = file.replaceAll('\\', '/');
  if (isGeneratedOrMirror(path, contents)) return 'generated-or-mirror';
  if (path.startsWith('docs/archive/')) return 'historical-docs';
  if (
    path === 'AGENTS.md'
    || path === 'AGENTS.override.md'
    || path.endsWith('/AGENTS.md')
    || path.endsWith('/AGENTS.override.md')
  ) return 'contract-docs';
  if (path === '01-rulebook.md' || path.startsWith('正本/')) return 'player-spec';
  if (path.startsWith('test/') || path.startsWith('tests/') || path.includes('/__tests__/')) return 'tests';
  if (path === 'cards/catalog.json') return 'canonical-catalog';
  if (path === 'src/types/card.ts') return 'card-type-contract';
  if (path.startsWith('assets/images/card/')) return 'card-assets';
  if (path.startsWith('cards/')) return 'catalog-and-card-ui';
  if (
    path.startsWith('shared/board/')
    || path === 'shared/shared-board-utils.ts'
    || path === 'utils/match-authority/board-contract.ts'
    || path === 'game/logic/cards-internal/board-shape-access.ts'
    || path === 'game/logic/card-resolution/board-view-access.ts'
    || path === 'scripts/check-board-kernel-boundary.ts'
  ) return 'board-kernel-contracts';
  if (
    path.startsWith('workers/')
    || path.startsWith('ui/network/')
    || path === 'ui/network-client.ts'
    || path.startsWith('utils/match-')
    || path.startsWith('scripts/local-match-server.')
    || path.startsWith('shared/network-')
  ) return 'network-authority-and-client';
  if (
    path.startsWith('game/ai/')
    || path.startsWith('training/')
    || path.startsWith('src/engine/')
    || /(^|\/)cpu[^/]*\.(ts|js)$/u.test(path)
    || path.startsWith('scripts/run-selfplay-')
  ) return 'cpu-and-training';
  if (path.startsWith('game/turn/pipeline-ui/') || path.startsWith('game/special-effects/')) return 'presentation';
  if (path.startsWith('game/cards/')) return 'card-usage-orchestration';
  if (path.startsWith('game/logic/')) return 'headless-rules';
  if (path.startsWith('game/card-effects/') || path.startsWith('game/turn/')) return 'pending-turn-and-selection';
  if (path.startsWith('game/')) return 'headless-rules';
  if (
    path.startsWith('ui/')
    || path.startsWith('shared/presentation')
    || path.startsWith('shared/playback')
  ) return 'presentation';
  if (path.startsWith('shared/') || path.startsWith('constants/') || path.startsWith('utils/')) return 'shared-contracts';
  if (path.startsWith('assets/')) return 'assets-and-manifests';
  if (path.startsWith('scripts/')) return 'tooling';
  if (path.startsWith('docs/')) return 'docs';
  return 'other';
}

function sourceRole(file, category, candidateSet) {
  if (category === 'generated-or-mirror') return 'generated-or-mirror';
  const path = file.replaceAll('\\', '/');
  if (path.endsWith('.js') && candidateSet.has(`${path.slice(0, -3)}.ts`)) return 'paired-js';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript-source';
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'javascript-source';
  if (category === 'card-assets') return 'asset';
  return 'data-or-doc';
}

function collectHits(repoRoot, files, terms) {
  const termRecords = terms
    .map((term) => ({ original: String(term).trim(), normalized: normalize(term) }))
    .filter((term) => term.normalized);
  const candidateSet = new Set(
    files
      .filter((file) => existsSync(resolve(repoRoot, file)))
      .map((file) => file.replaceAll('\\', '/'))
  );
  const hits = [];
  const skipped = [];
  const deletedWorkingTreeFiles = [];

  for (const file of files) {
    const filePath = resolve(repoRoot, file);
    if (!existsSync(filePath)) {
      deletedWorkingTreeFiles.push({
        file: file.replaceAll('\\', '/'),
        category: classify(file),
        reason: 'missing-from-working-tree'
      });
      continue;
    }
    const normalizedFile = normalizePath(file);
    const pathMatchedTerms = termRecords
      .filter((term) => normalizedFile.includes(term.normalized.replaceAll('\\', '/')))
      .map((term) => term.original);
    const extension = extname(file).toLocaleLowerCase('en-US');
    let contents = '';
    const lineNumbers = [];
    const contentMatchedTerms = new Set();
    const snippets = [];

    if (TEXT_EXTENSIONS.has(extension)) {
      try {
        contents = readFileSync(filePath, 'utf8');
      } catch (error) {
        const category = classify(file);
        skipped.push({
          file,
          category,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      if (contents) {
        contents.split(/\r?\n/u).forEach((line, index) => {
          const normalizedLine = normalize(line);
          const matchedOnLine = termRecords
            .filter((term) => normalizedLine.includes(term.normalized))
            .map((term) => term.original);
          if (matchedOnLine.length === 0) return;
          lineNumbers.push(index + 1);
          matchedOnLine.forEach((term) => contentMatchedTerms.add(term));
          if (snippets.length < 8) {
            snippets.push({
              line: index + 1,
              text: line.trim().slice(0, 220),
              matchedTerms: matchedOnLine
            });
          }
        });
      }
    }

    if (pathMatchedTerms.length === 0 && contentMatchedTerms.size === 0) continue;
    const category = classify(file, contents);
    hits.push({
      file: file.replaceAll('\\', '/'),
      category,
      sourceRole: sourceRole(file, category, candidateSet),
      matchKinds: [
        ...(pathMatchedTerms.length > 0 ? ['path'] : []),
        ...(contentMatchedTerms.size > 0 ? ['content'] : [])
      ],
      matchedTerms: uniqueTerms([...pathMatchedTerms, ...contentMatchedTerms]),
      pathMatchedTerms: uniqueTerms(pathMatchedTerms),
      lines: lineNumbers,
      snippets
    });
  }

  return {
    hits: hits.sort((left, right) => left.file.localeCompare(right.file, 'en')),
    skipped,
    deletedWorkingTreeFiles: deletedWorkingTreeFiles.sort((left, right) => left.file.localeCompare(right.file, 'en'))
  };
}

function readWorkingTreeStatus(repoRoot) {
  const result = runGit(repoRoot, ['status', '--short']);
  if (result.status !== 0) fail(`git status failed: ${(result.stderr || '').trim()}`);
  return (result.stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function findGoverningAgentFiles(repoRoot, files, seedDirectories = []) {
  const found = new Set();
  const addGuides = (directory) => {
    for (const guideName of INSTRUCTION_FILENAMES) {
      const guidePath = directory === '.' ? guideName : `${directory}/${guideName}`;
      if (existsSync(resolve(repoRoot, guidePath))) found.add(guidePath);
    }
  };
  addGuides('.');
  const candidateFiles = [
    ...files,
    ...seedDirectories.map((directory) => `${directory}/__inventory__`)
  ];
  for (const rawFile of candidateFiles) {
    let current = dirname(rawFile.replaceAll('\\', '/')).replaceAll('\\', '/');
    while (current && current !== '.') {
      addGuides(current);
      const parent = dirname(current).replaceAll('\\', '/');
      if (!parent || parent === current || parent === '.') break;
      current = parent;
    }
  }
  return [...found].sort((left, right) => left.localeCompare(right, 'en'));
}

function buildCategoryCounts(hits) {
  return hits.reduce((counts, hit) => {
    counts[hit.category] = (counts[hit.category] || 0) + 1;
    return counts;
  }, {});
}

function selectPackageScripts(packageJson) {
  const scripts = packageJson && packageJson.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts
    : {};
  return RELEVANT_PACKAGE_SCRIPTS
    .filter((name) => typeof scripts[name] === 'string')
    .map((name) => ({ name, command: scripts[name] }));
}

function buildCoverage(hits) {
  const has = (category) => hits.some((hit) => hit.category === category);
  return {
    catalog: has('canonical-catalog'),
    playerSpec: has('player-spec'),
    cardTypeContract: has('card-type-contract'),
    headlessRules: has('headless-rules') || has('card-usage-orchestration'),
    boardKernel: has('board-kernel-contracts'),
    pendingOrTurn: has('pending-turn-and-selection'),
    cpuOrTraining: has('cpu-and-training'),
    presentation: has('presentation') || has('catalog-and-card-ui'),
    network: has('network-authority-and-client'),
    tests: has('tests'),
    assetPath: hits.some((hit) => hit.category === 'card-assets' && hit.matchKinds.includes('path')),
    generatedOrMirror: has('generated-or-mirror')
  };
}

function pathAllowed(file, allowPaths) {
  const normalizedFile = normalizePath(file);
  return allowPaths.some((prefix) => normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`));
}

function findAbsenceViolations(hits, expectAbsent, allowPaths) {
  const absentSet = new Set(expectAbsent.map(normalize));
  return hits.filter((hit) => {
    if (hit.category === 'historical-docs') return false;
    if (pathAllowed(hit.file, allowPaths)) return false;
    return hit.matchedTerms.some((term) => absentSet.has(normalize(term)));
  });
}

function printHuman(result) {
  console.log(`Repository: ${result.repoRoot}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Card query: ${result.query}`);
  if (result.card) {
    console.log(
      `Catalog match: ${result.card.id} | ${result.card.type} | ${result.card.name_ja}`
      + ` | ${result.card.enabled ? 'enabled' : 'disabled'} | ${result.catalogMatchKind}`
    );
  } else {
    console.log(`Catalog match: none${result.mode === 'add' ? ' (expected for add)' : ''}`);
  }
  console.log(`Search terms: ${result.terms.join(' | ')}`);
  console.log(`Matched files: ${result.hits.length}`);
  console.log(`Working tree entries: ${result.workingTreeStatus.length}`);
  console.log(`Governing instructions: ${result.governingAgentFiles.join(' | ') || 'none found'}`);

  const categories = new Map();
  for (const hit of result.hits) {
    if (!categories.has(hit.category)) categories.set(hit.category, []);
    categories.get(hit.category).push(hit);
  }
  for (const [category, hits] of categories) {
    console.log(`\n[${category}] ${hits.length}`);
    for (const hit of hits) {
      const shown = hit.lines.slice(0, 8).join(',');
      const suffix = hit.lines.length > 8 ? `,+${hit.lines.length - 8}` : '';
      const location = shown ? `:${shown}${suffix}` : '';
      console.log(
        `- ${hit.file}${location} [${hit.matchKinds.join('+')}; ${hit.sourceRole}; ${hit.matchedTerms.join(' | ')}]`
      );
    }
  }
  if (result.absenceViolations.length > 0) {
    console.log(`\nFailure: ${result.absenceViolations.length} expected-absent active path(s) remain.`);
  }
  if (result.skippedCanonical.length > 0) {
    console.log(`\nFailure: ${result.skippedCanonical.length} canonical candidate file(s) could not be read.`);
  }
  if (result.deletedWorkingTreeFiles.length > 0) {
    console.log(`\nNotice: ${result.deletedWorkingTreeFiles.length} tracked candidate file(s) are deleted from the working tree; inspect the deletion through Git status and diff.`);
  }
  if (result.catalogIssues.length > 0) {
    console.log(`\nFailure: catalog integrity issues: ${result.catalogIssues.join(' | ')}`);
  }
  for (const warning of result.warnings) console.log(`\nWarning: ${warning}`);
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = resolveRepoRoot(options.repo);
const packageJson = validateRepository(repoRoot);
const catalog = loadCatalog(repoRoot);
const catalogIssues = validateCatalog(catalog.cards);
const selected = selectCard(catalog.cards, options.card, options.mode);
enforceMode(options.mode, selected, options.card);

const card = selected.card;
const terms = uniqueTerms([
  options.card,
  card && card.id,
  card && card.type,
  card && card.name_ja,
  ...options.terms,
  ...options.newTerms,
  ...options.expectAbsent
]);
const candidateFiles = listCandidateFiles(repoRoot);
const inventory = collectHits(repoRoot, candidateFiles, terms);
const skippedCanonical = inventory.skipped.filter(
  (entry) => !['generated-or-mirror', 'historical-docs'].includes(entry.category)
);
const absenceViolations = findAbsenceViolations(
  inventory.hits,
  options.expectAbsent,
  options.allowPaths
);
const warnings = [];
if (selected.matchKind === 'partial') warnings.push('audit used a unique partial catalog match; mutation modes require an exact identity');
if (options.mode === 'enable' && card && card.enabled !== false) warnings.push('the matched card is already enabled');
if (options.mode === 'disable' && card && card.enabled === false) warnings.push('the matched card is already disabled');
if (inventory.hits.some((hit) => hit.category === 'other')) warnings.push('one or more matches are unclassified; inspect them manually');
if (inventory.skipped.length > skippedCanonical.length) warnings.push('generated, mirror, or historical candidate files were unreadable');
if (inventory.deletedWorkingTreeFiles.length > 0) warnings.push('one or more tracked candidate files are deleted from the working tree; inspect their Git diff');

const result = {
  schemaVersion: 4,
  repoRoot,
  packageName: packageJson.name,
  mode: options.mode,
  query: options.card,
  catalogVersion: catalog.version ?? null,
  catalogMatchKind: selected.matchKind,
  card: card ? {
    id: card.id,
    type: card.type,
    name_ja: card.name_ja,
    cost: card.cost,
    desc_ja: card.desc_ja,
    display_type_ja: card.display_type_ja,
    enabled: card.enabled !== false
  } : null,
  terms,
  oldTerms: uniqueTerms([options.card, ...options.terms]),
  newTerms: uniqueTerms(options.newTerms),
  expectAbsent: uniqueTerms(options.expectAbsent),
  allowPaths: options.allowPaths,
  hits: inventory.hits,
  categoryCounts: buildCategoryCounts(inventory.hits),
  coverage: buildCoverage(inventory.hits),
  packageScripts: selectPackageScripts(packageJson),
  governingAgentFiles: findGoverningAgentFiles(
    repoRoot,
    [...inventory.hits, ...inventory.deletedWorkingTreeFiles].map((entry) => entry.file),
    options.mode === 'add' ? ADD_MODE_GUIDE_DIRECTORIES : []
  ),
  workingTreeStatus: readWorkingTreeStatus(repoRoot),
  catalogIssues,
  absenceViolations,
  deletedWorkingTreeFiles: inventory.deletedWorkingTreeFiles,
  skipped: inventory.skipped,
  skippedCanonical,
  warnings
};

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHuman(result);
}

if (catalogIssues.length > 0 || absenceViolations.length > 0 || skippedCanonical.length > 0) {
  process.exitCode = 2;
}
