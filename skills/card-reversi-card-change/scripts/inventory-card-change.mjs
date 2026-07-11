#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`inventory-card-change: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { repo: process.cwd(), card: '', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      options.repo = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--card') {
      options.card = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: inventory-card-change.mjs --card <id|type|Japanese name> [--repo <path>] [--json]');
      process.exit(0);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  if (!options.repo) fail('--repo requires a path');
  if (!options.card.trim()) fail('--card is required');
  return options;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('ja-JP');
}

function loadCatalog(repoRoot) {
  const catalogPath = resolve(repoRoot, 'cards', 'catalog.json');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${catalogPath}: ${error.message}`);
  }
  if (!parsed || !Array.isArray(parsed.cards)) {
    fail('cards/catalog.json does not contain a cards array');
  }
  return parsed.cards;
}

function selectCard(cards, query) {
  const needle = normalize(query);
  const keys = (card) => [card.id, card.type, card.name_ja].map(normalize).filter(Boolean);
  const exact = cards.filter((card) => keys(card).includes(needle));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) fail(`ambiguous exact match: ${exact.map((card) => card.id).join(', ')}`);

  const partial = cards.filter((card) => keys(card).some((value) => value.includes(needle)));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    fail(`ambiguous partial match: ${partial.slice(0, 12).map((card) => `${card.id} (${card.name_ja})`).join(', ')}`);
  }
  return null;
}

function listCandidateFiles(repoRoot) {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: repoRoot, encoding: 'utf8', windowsHide: true }
  );
  if (result.status !== 0) {
    fail(`git ls-files failed: ${(result.stderr || '').trim()}`);
  }
  const textExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.css',
    '.yaml', '.yml', '.py', '.ps1', '.bat'
  ]);
  return result.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((file) => textExtensions.has(extname(file).toLocaleLowerCase('en-US')));
}

function classify(file) {
  const path = file.replaceAll('\\', '/');
  if (path === '01-rulebook.md' || path.startsWith('正本/')) return 'player-spec';
  if (path.startsWith('worker-public/') || path.startsWith('dist/') || path === 'public/module-registry.js') {
    return 'generated-or-mirror';
  }
  if (path.startsWith('test/') || path.startsWith('tests/') || path.includes('/__tests__/')) return 'tests';
  if (path.startsWith('cards/')) return 'catalog-and-card-ui';
  if (path.startsWith('game/ai/') || /(^|\/)cpu[^/]*\.(ts|js)$/u.test(path)) return 'cpu';
  if (path.startsWith('workers/') || path.startsWith('ui/network') || path.startsWith('utils/match-') || path.startsWith('scripts/local-match-server.')) {
    return 'network-authority-and-client';
  }
  if (path.startsWith('game/')) return 'headless-and-selection';
  if (path.startsWith('ui/') || path.startsWith('shared/presentation')) return 'presentation';
  if (path.startsWith('shared/') || path.startsWith('constants/') || path.startsWith('utils/')) return 'shared-contracts';
  if (path.startsWith('scripts/') || path.startsWith('assets/')) return 'tooling-and-manifests';
  if (path.startsWith('docs/')) return 'docs';
  return 'other';
}

function collectHits(repoRoot, files, terms) {
  const normalizedTerms = terms.map(normalize).filter(Boolean);
  const hits = [];
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(resolve(repoRoot, file), 'utf8');
    } catch {
      continue;
    }
    const lineNumbers = [];
    contents.split(/\r?\n/u).forEach((line, index) => {
      const normalizedLine = normalize(line);
      if (normalizedTerms.some((term) => normalizedLine.includes(term))) {
        lineNumbers.push(index + 1);
      }
    });
    if (lineNumbers.length > 0) {
      hits.push({ file, category: classify(file), lines: lineNumbers });
    }
  }
  return hits.sort((left, right) => left.file.localeCompare(right.file, 'en'));
}

function printHuman(result) {
  console.log(`Card query: ${result.query}`);
  if (result.card) {
    console.log(`Catalog match: ${result.card.id} | ${result.card.type} | ${result.card.name_ja}`);
  } else {
    console.log('Catalog match: none (expected when adding a new card)');
  }
  console.log(`Search terms: ${result.terms.join(' | ')}`);
  console.log(`Matched files: ${result.hits.length}`);

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
      console.log(`- ${hit.file}:${shown}${suffix}`);
    }
  }
  if (categories.has('generated-or-mirror')) {
    console.log('\nWarning: generated-or-mirror matches are evidence only; edit canonical root sources first.');
  }
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = resolve(options.repo);
const packagePath = resolve(repoRoot, 'package.json');
try {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (packageJson.name !== 'card-reversi') fail(`${relative(process.cwd(), repoRoot) || '.'} is not the card-reversi repository`);
} catch (error) {
  fail(`cannot validate repository root: ${error.message}`);
}

const cards = loadCatalog(repoRoot);
const card = selectCard(cards, options.card);
const terms = [...new Set([options.card, card?.id, card?.type, card?.name_ja].filter(Boolean))];
const hits = collectHits(repoRoot, listCandidateFiles(repoRoot), terms);
const result = {
  query: options.card,
  card: card ? { id: card.id, type: card.type, name_ja: card.name_ja, enabled: card.enabled !== false } : null,
  terms,
  hits
};

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHuman(result);
}
