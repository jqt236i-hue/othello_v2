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
    "    const response = await durableObject.fetch(new Request('https://room/internal/leaderboard/submit', {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json' },",
    "      body: JSON.stringify({ ...payload, category: 'score', mode: 'network', authorityVerified: true, authoritySource: 'match_room' })",
    "    }));",
    "    return response.json();",
    "  };",
    "",
    "  await submit({ playerId: 'player_alpha_0001', playerName: 'アルファ', score: 7200 });",
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

function runLegacyRecoveryFlow() {
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
    "  const legacyEntry = { playerId: 'player_legacy_0001', playerName: '旧記録', bestScore: 9100, mode: 'cpu', cpuLevel: 6 };",
    "  storage.set('global_score_leaderboard_v3', {",
    "    version: 3,",
    "    players: { [legacyEntry.playerId]: legacyEntry },",
    "    playerModes: { [legacyEntry.playerId]: { cpu: legacyEntry } },",
    "    playerCpuLevels: { [legacyEntry.playerId]: { '6': legacyEntry } },",
    "    updatedAt: 700",
    "  });",
    "  const legacyBefore = JSON.stringify(storage.get('global_score_leaderboard_v3'));",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  await durableObject.fetch(new Request('https://room/internal/leaderboard/submit', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerId: 'player_current_0001', playerName: '現行記録', score: 5200, category: 'score', mode: 'network', era: 'legacy', authorityVerified: true, authoritySource: 'match_room' })",
    "  }));",
    "  const legacyResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10&mode=all&category=score&era=legacy'));",
    "  const currentResponse = await durableObject.fetch(new Request('https://room/api/leaderboard/list?limit=10&mode=all&category=score'));",
    "  const legacyPayload = await legacyResponse.json();",
    "  const currentPayload = await currentResponse.json();",
    "  process.stdout.write(JSON.stringify({ legacyPayload, currentPayload, legacyUnchanged: legacyBefore === JSON.stringify(storage.get('global_score_leaderboard_v3')) }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker shared leaderboard', () => {
  test('サーバー証明済み対人スコアの自己ベストを降順で返す', () => {
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
    expect(payload.allPayload.entries[1].mode).toBe('network');

    expect(payload.networkPayload.entries).toHaveLength(2);
    expect(payload.networkPayload.entries[0]).toMatchObject({
      playerName: 'ベータ',
      bestScore: 8100,
      rank: 1,
      mode: 'network'
    });
    expect(payload.networkPayload.entries[1]).toMatchObject({
      playerName: 'アルファ',
      bestScore: 7200,
      rank: 2,
      mode: 'network',
      cpuLevel: null
    });

    expect(payload.cpuPayload.entries).toHaveLength(0);
  });

  test('公開Durable Object経路への直接送信は証明不足として拒否する', () => {
    const result = runInvalidSubmit();
    expect(result.status).toBe(403);
    expect(result.payload && result.payload.ok).toBe(false);
    expect(result.payload && result.payload.reason).toBe('LEADERBOARD_RESULT_PROOF_REQUIRED');
  });

  test('旧保存キーを現行のサーバー検証済み順位へ混在させず読み取り専用で公開する', () => {
    const payload = runLegacyRecoveryFlow();
    expect(payload.legacyPayload).toMatchObject({
      ok: true,
      era: 'legacy',
      entries: [{ playerName: '旧記録', bestScore: 9100, mode: 'cpu' }]
    });
    expect(payload.currentPayload).toMatchObject({
      ok: true,
      era: 'current',
      entries: [{ playerName: '現行記録', bestScore: 5200, mode: 'network' }]
    });
    expect(payload.currentPayload.entries.map((entry: { playerName: string }) => entry.playerName)).not.toContain('旧記録');
    expect(payload.legacyUnchanged).toBe(true);
  });
});
