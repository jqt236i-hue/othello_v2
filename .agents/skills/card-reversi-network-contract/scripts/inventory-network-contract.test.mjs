import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(scriptDir, 'inventory-network-contract.mjs');

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

test('discovers the canonical intake and session surfaces with current anchors', () => {
  const result = runInventory(['--surface', 'intake', '--surface', 'session']);
  const files = new Set(result.hits.map((hit) => hit.file));
  const packageScripts = new Set(result.packageScripts.map((entry) => entry.name));

  assert.equal(result.schemaVersion, 2);
  assert.equal(result.repoRoot, repoRoot);
  assert.ok(files.has('ui/network/intake-envelope.ts'));
  assert.ok(files.has('ui/network/intake-coordinator.ts'));
  assert.ok(files.has('ui/network/session-lifecycle.ts'));
  assert.ok(files.has('ui/network/stream-session.ts'));
  assert.deepEqual(result.missingAnchors, []);
  assert.ok(packageScripts.has('test:network:parity'));
  assert.ok(packageScripts.has('check:board-kernel-boundary'));
  assert.ok(packageScripts.has('worker:bundle:smoke'));
  assert.ok(packageScripts.has('match:pixi-runtime-fallback-check'));
  assert.ok(result.governingAgentFiles.includes('ui/network/AGENTS.md'));
  assert.deepEqual(result.skippedCanonical, []);
});

test('maps AUTO and timeout authority instead of treating browser preference as authority', () => {
  const result = runInventory(['--surface', 'auto', '--surface', 'timeout']);
  const files = new Set(result.hits.map((hit) => hit.file));

  assert.ok(files.has('ui/network/auto-play.ts'));
  assert.ok(files.has('utils/match-auto-command.ts'));
  assert.ok(files.has('game/cpu-network-command-planner.ts'));
  assert.ok(files.has('workers/match-worker-timeout-controller.ts'));
  assert.ok(files.has('test/workers.match-auto-turn-authority.test.ts'));
  assert.deepEqual(result.missingAnchors, []);
});

test('maps the versioned board snapshot contract through the shared topology kernel', () => {
  const result = runInventory(['--surface', 'topology']);
  const files = new Set(result.hits.map((hit) => hit.file));

  assert.deepEqual(result.surfaces, ['board']);
  assert.ok(files.has('shared/board/state-kernel.ts'));
  assert.ok(files.has('shared/board/topology.ts'));
  assert.ok(files.has('utils/match-authority/board-contract.ts'));
  assert.ok(files.has('ui/network/snapshot-canonical.ts'));
  assert.deepEqual(result.missingAnchors, []);
});

test('stream, rating, and delivery surfaces exclude unrelated asset trees', () => {
  const result = runInventory([
    '--surface',
    'stream',
    '--surface',
    'rating',
    '--surface',
    'delivery'
  ]);
  const files = result.hits.map((hit) => hit.file);

  assert.ok(!files.includes('.assetsignore'));
  assert.ok(!files.some((file) => file.startsWith('assets/audio/')));
  assert.ok(!files.some((file) => /^worker-public\/assets\//u.test(file)));
});

test('all includes current room lifecycle and runtime ownership anchors', () => {
  const result = runInventory(['--surface', 'all']);
  const files = new Set(result.hits.map((hit) => hit.file));

  for (const file of [
    'ui/network-client.ts',
    'utils/match-authority.ts',
    'utils/match-join-controller.ts',
    'utils/match-leave-controller.ts',
    'utils/match-rematch-controller.ts',
    'utils/match-room-preferences-controller.ts',
    'utils/match-state-controller.ts',
    'utils/match-runtime-core.ts',
    'utils/match-runtime-ports.ts',
    'workers/match-worker-api.ts'
  ]) {
    assert.ok(files.has(file), `missing all-surface owner: ${file}`);
  }
});

test('worker runtime and delivery include deployment entry and configuration', () => {
  const result = runInventory(['--surface', 'worker-runtime', '--surface', 'delivery']);
  const files = new Set(result.hits.map((hit) => hit.file));

  for (const file of ['workers/match-worker.mjs', 'wrangler.toml', 'package.json']) {
    assert.ok(files.has(file), `missing deployment owner: ${file}`);
  }
  assert.deepEqual(result.missingAnchors, []);
});

test('snapshot and reconnect aliases cover their cross-boundary owners', () => {
  const snapshot = runInventory(['--surface', 'snapshot']);
  assert.deepEqual(snapshot.surfaces, ['intake', 'projection', 'board']);
  const snapshotFiles = new Set(snapshot.hits.map((hit) => hit.file));
  for (const file of [
    'ui/network/snapshot-canonical.ts',
    'utils/match-authority/projection.ts',
    'utils/match-authority/board-contract.ts',
    'workers/match-worker.ts',
    'scripts/local-match-server.ts'
  ]) {
    assert.ok(snapshotFiles.has(file), `missing snapshot owner: ${file}`);
  }

  const reconnect = runInventory(['--surface', 'reconnect']);
  assert.deepEqual(reconnect.surfaces, ['session', 'stream', 'intake', 'presentation']);
  const reconnectFiles = new Set(reconnect.hits.map((hit) => hit.file));
  for (const file of [
    'ui/network/reconnect-controller.ts',
    'ui/network/stream-snapshot.ts',
    'ui/network/intake-coordinator.ts',
    'ui/network/presentation-timeline.ts'
  ]) {
    assert.ok(reconnectFiles.has(file), `missing reconnect owner: ${file}`);
  }
});

test('searches an additional contract term across selected and unselected paths', () => {
  const result = runInventory(['--surface', 'session', '--term', 'sessionEpoch']);
  const termHits = result.hits.filter((hit) => hit.matchedTerms.includes('sessionEpoch'));

  assert.ok(termHits.length > 0);
  assert.ok(termHits.some((hit) => hit.matchKinds.includes('content')));
});

test('resolves the repository root from a nested path', () => {
  const result = runInventory(
    ['--surface', 'publish'],
    resolve(repoRoot, 'ui', 'network')
  );
  const files = new Set(result.hits.map((hit) => hit.file));
  assert.equal(result.repoRoot, repoRoot);
  assert.ok(files.has('utils/match-publish-controller.ts'));
  assert.ok(files.has('workers/match-worker.ts'));
  assert.ok(files.has('scripts/local-match-server.ts'));
});

test('rejects unknown or omitted surfaces', () => {
  const unknown = runRaw(['--surface', 'not-a-surface']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown surface/u);

  const omitted = runRaw([]);
  assert.notEqual(omitted.status, 0);
  assert.match(omitted.stderr, /at least one --surface or --term/u);
});
