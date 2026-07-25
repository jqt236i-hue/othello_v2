import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(scriptDir, 'inventory-card-change.mjs');

function findRepoRoot() {
  const start = process.env.CARD_REVERSI_REPO || process.cwd();
  const result = spawnSync('git', ['-C', start, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  const root = resolve(result.stdout.trim());
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.name, 'card-reversi', `not the Card Reversi repository: ${root}`);
  return root;
}

const repoRoot = findRepoRoot();
const catalog = JSON.parse(readFileSync(resolve(repoRoot, 'cards', 'catalog.json'), 'utf8'));

function findCardWithArtwork() {
  const listed = spawnSync('git', [
    '-C',
    repoRoot,
    '-c',
    'core.quotePath=false',
    'ls-files',
    'assets/images/card'
  ], {
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(listed.status, 0, listed.stderr);
  const paths = listed.stdout.split(/\r?\n/u).filter(Boolean);
  const card = catalog.cards.find(
    (candidate) => candidate && candidate.name_ja && paths.some((path) => path.includes(candidate.name_ja))
  );
  assert.ok(card, 'expected at least one catalog card with a Japanese artwork filename');
  return card;
}

function runRaw(args, repoArgument = repoRoot) {
  return spawnSync(process.execPath, [scriptPath, '--repo', repoArgument, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  });
}

function runInventory(args, repoArgument = repoRoot) {
  const result = runRaw([...args, '--json'], repoArgument);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('matches an existing card and separates canonical catalog data from generated projections', () => {
  const card = catalog.cards[0];
  const result = runInventory(['--mode', 'change', '--card', card.type]);
  const categoryByFile = new Map(result.hits.map((hit) => [hit.file, hit.category]));

  assert.equal(result.schemaVersion, 2);
  assert.equal(result.repoRoot, repoRoot);
  assert.equal(result.card.id, card.id);
  assert.equal(result.catalogMatchKind, 'exact');
  assert.equal(categoryByFile.get('cards/catalog.json'), 'canonical-catalog');
  assert.equal(categoryByFile.get('cards/catalog.generated.js'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/catalog.js'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/catalog.ts'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/card-art-map.generated.ts'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('worker-public/cards/catalog.json'), 'generated-or-mirror');
  assert.ok(result.governingAgentFiles.includes('AGENTS.md'));
  assert.ok(result.governingAgentFiles.includes('cards/AGENTS.md'));
  const catalogHit = result.hits.find((hit) => hit.file === 'cards/catalog.json');
  assert.ok(catalogHit.matchedTerms.includes(card.type));
  assert.ok(catalogHit.matchKinds.includes('content'));
  assert.deepEqual(result.catalogIssues, []);
  assert.deepEqual(result.skippedCanonical, []);
});

test('allows a new identity only in add or audit mode', () => {
  const nonce = `${process.pid}_${Date.now()}`;
  const query = `UNREGISTERED_CARD_${nonce}`;
  const alias = `LEGACY_ALIAS_${nonce}`;
  const added = runInventory(['--mode', 'add', '--card', query, '--old-term', alias]);

  assert.equal(added.card, null);
  assert.deepEqual(added.oldTerms, [query, alias]);
  assert.deepEqual(added.hits, []);

  const change = runRaw(['--mode', 'change', '--card', query, '--json']);
  assert.notEqual(change.status, 0);
  assert.match(change.stderr, /requires one exact catalog match/u);
});

test('finds Japanese card artwork by path as well as text content', () => {
  const card = findCardWithArtwork();
  const result = runInventory(['--mode', 'audit', '--card', card.name_ja]);
  const artworkHit = result.hits.find(
    (hit) => hit.category === 'card-assets' && hit.file.includes(card.name_ja)
  );

  assert.ok(artworkHit);
  assert.deepEqual(artworkHit.matchKinds, ['path']);
  assert.ok(artworkHit.pathMatchedTerms.includes(card.name_ja));
  assert.equal(result.coverage.assetPath, true);
});

test('expected-absent terms fail on active paths but ignore a nonexistent term', () => {
  const card = catalog.cards[0];
  const existing = runRaw([
    '--mode',
    'audit',
    '--card',
    card.type,
    '--expect-absent',
    card.type,
    '--json'
  ]);
  assert.equal(existing.status, 2, existing.stderr);
  const existingResult = JSON.parse(existing.stdout);
  assert.ok(existingResult.absenceViolations.length > 0);

  const nonce = `ABSENT_${process.pid}_${Date.now()}`;
  const absent = runInventory([
    '--mode',
    'audit',
    '--card',
    nonce,
    '--expect-absent',
    nonce
  ]);
  assert.deepEqual(absent.absenceViolations, []);
});

test('resolves the repository root from a nested --repo path', () => {
  const card = catalog.cards[0];
  const result = runInventory(
    ['--mode', 'audit', '--card', card.id],
    resolve(repoRoot, 'game', 'logic')
  );

  assert.equal(result.repoRoot, repoRoot);
});

test('rejects missing values and incomplete rename mode', () => {
  const missingValue = runRaw(['--card', '--json']);
  assert.notEqual(missingValue.status, 0);
  assert.match(missingValue.stderr, /--card requires a value/u);

  const rename = runRaw(['--mode', 'rename', '--card', catalog.cards[0].type]);
  assert.notEqual(rename.status, 0);
  assert.match(rename.stderr, /requires at least one --new-term/u);
});
