import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

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
    "  const allResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10'));",
    "  const networkResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10&mode=network'));",
    "  const cpuResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10&mode=cpu'));",
    "  const allPayload = await allResponse.json();",
    "  const networkPayload = await networkResponse.json();",
    "  const cpuPayload = await cpuResponse.json();",
    "  process.stdout.write(JSON.stringify({ allPayload, networkPayload, cpuPayload }));",
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
  test('総合とモード別で自己ベストを分けて降順で返す', () => {
    const payload = runLeaderboardFlow();
    expect(payload && payload.allPayload && payload.allPayload.ok).toBe(true);
    expect(Array.isArray(payload.allPayload.entries)).toBe(true);
    expect(payload.allPayload.entries).toHaveLength(2);

    expect(payload.allPayload.entries[0].playerName).toBe('ベータ');
    expect(payload.allPayload.entries[0].bestScore).toBe(8100);
    expect(payload.allPayload.entries[0].rank).toBe(1);

    expect(payload.allPayload.entries[1].playerName).toBe('アルファ');
    expect(payload.allPayload.entries[1].bestScore).toBe(7200);
    expect(payload.allPayload.entries[1].rank).toBe(2);
    expect(payload.allPayload.entries[1].mode).toBe('cpu');
    expect(payload.allPayload.entries[1].cpuLevel).toBe(3);

    expect(payload.networkPayload.entries).toHaveLength(2);
    expect(payload.networkPayload.entries[0]).toMatchObject({
      playerName: 'ベータ',
      bestScore: 8100,
      rank: 1,
      mode: 'network'
    });
    expect(payload.networkPayload.entries[1]).toMatchObject({
      playerName: 'アルファ',
      bestScore: 6800,
      rank: 2,
      mode: 'network',
      cpuLevel: null
    });

    expect(payload.cpuPayload.entries).toHaveLength(1);
    expect(payload.cpuPayload.entries[0]).toMatchObject({
      playerName: 'アルファ',
      bestScore: 7200,
      rank: 1,
      mode: 'cpu',
      cpuLevel: 3
    });
  });

  test('playerId未指定の送信は400で拒否する', () => {
    const result = runInvalidSubmit();
    expect(result.status).toBe(400);
    expect(result.payload && result.payload.ok).toBe(false);
    expect(result.payload && result.payload.reason).toBe('PLAYER_ID_REQUIRED');
  });
});
