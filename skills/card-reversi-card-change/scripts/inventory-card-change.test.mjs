import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(scriptDir, 'inventory-card-change.mjs');
const repoRoot = resolve(scriptDir, '..', '..', '..');

function runInventory(args) {
  const result = spawnSync(process.execPath, [scriptPath, '--repo', repoRoot, ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function runRaw(args) {
  return spawnSync(process.execPath, [scriptPath, '--repo', repoRoot, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true
  });
}

test('matches a catalog card and separates canonical catalog data from generated projections', () => {
  const catalog = JSON.parse(readFileSync(resolve(repoRoot, 'cards', 'catalog.json'), 'utf8'));
  const card = catalog.cards[0];
  const result = runInventory(['--card', card.type]);
  const categoryByFile = new Map(result.hits.map((hit) => [hit.file.replaceAll('\\', '/'), hit.category]));

  assert.equal(result.card.id, card.id);
  assert.equal(categoryByFile.get('cards/catalog.json'), 'catalog-and-card-ui');
  assert.equal(categoryByFile.get('cards/catalog.generated.js'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/catalog.js'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/catalog.ts'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('cards/card-art-map.generated.ts'), 'generated-or-mirror');
  assert.equal(categoryByFile.get('worker-public/cards/catalog.json'), 'generated-or-mirror');
  assert.deepEqual(result.skipped, []);
});

test('accepts repeatable aliases and handles an unregistered new card query', () => {
  const nonce = `${process.pid}_${Date.now()}`;
  const query = `UNREGISTERED_CARD_${nonce}`;
  const aliasOne = `LEGACY_ALIAS_ONE_${nonce}`;
  const aliasTwo = `LEGACY_ALIAS_TWO_${nonce}`;
  const result = runInventory(['--card', query, '--term', aliasOne, '--term', aliasTwo]);

  assert.equal(result.card, null);
  assert.deepEqual(result.terms, [query, aliasOne, aliasTwo]);
  assert.deepEqual(result.hits, []);
  assert.deepEqual(result.skipped, []);
});

test('rejects an option whose value is missing instead of consuming the next flag', () => {
  const result = runRaw(['--card', '--json']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--card requires a value/u);
});
