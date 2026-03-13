const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'leaderboard runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runLeaderboardFlow() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "",
    "  const submit = async (payload) => {",
    "    const response = await durableObject.fetch(new Request('https://room/api/leaderboard/submit', {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json' },",
    "      body: JSON.stringify(payload)",
    "    }));",
    "    return response.json();",
    "  };",
    "",
    "  await submit({ playerId: 'player_alpha_0001', playerName: 'アルファ', score: 7200, mode: 'cpu', cpuLevel: 3 });",
    "  await submit({ playerId: 'player_alpha_0001', playerName: 'アルファ', score: 6800, mode: 'network' });",
    "  await submit({ playerId: 'player_beta_0002', playerName: 'ベータ', score: 8100, mode: 'network' });",
    "",
    "  const listResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10'));",
    "  const listPayload = await listResponse.json();",
    "  process.stdout.write(JSON.stringify(listPayload));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runInvalidSubmit() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const response = await durableObject.fetch(new Request('https://room/api/leaderboard/submit', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: '匿名', score: 1000 })",
    "  }));",
    "  const payload = await response.json();",
    "  process.stdout.write(JSON.stringify({ status: response.status, payload }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker shared leaderboard', () => {
  test('playerごとの自己ベストを保持して降順で返す', () => {
    const payload = runLeaderboardFlow();
    expect(payload && payload.ok).toBe(true);
    expect(Array.isArray(payload.entries)).toBe(true);
    expect(payload.entries).toHaveLength(2);

    expect(payload.entries[0].playerName).toBe('ベータ');
    expect(payload.entries[0].bestScore).toBe(8100);
    expect(payload.entries[0].rank).toBe(1);

    expect(payload.entries[1].playerName).toBe('アルファ');
    expect(payload.entries[1].bestScore).toBe(7200);
    expect(payload.entries[1].rank).toBe(2);
    expect(payload.entries[1].mode).toBe('cpu');
    expect(payload.entries[1].cpuLevel).toBe(3);
  });

  test('playerId未指定の送信は400で拒否する', () => {
    const result = runInvalidSubmit();
    expect(result.status).toBe(400);
    expect(result.payload && result.payload.ok).toBe(false);
    expect(result.payload && result.payload.reason).toBe('PLAYER_ID_REQUIRED');
  });
});
