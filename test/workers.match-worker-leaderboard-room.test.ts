import { createMatchWorkerLeaderboardHelpers } from '../workers/match-worker-leaderboard';
import { createMatchWorkerLeaderboardRoomController } from '../workers/match-worker-leaderboard-room';

function createJsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload || {}), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function createController() {
  const storage = new Map<string, unknown>();
  let currentTime = 1000;
  const helpers = createMatchWorkerLeaderboardHelpers({
    storageVersion: 3,
    playerNameMax: 7,
    playerIdPattern: /^[A-Za-z0-9_-]{8,80}$/,
    defaultLimit: 10,
    maxLimit: 100,
    maxStoredPlayers: 200,
    now: () => currentTime++
  });
  const controller = createMatchWorkerLeaderboardRoomController({
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (key: string, value: unknown) => void storage.set(key, value),
      delete: async (key: string) => storage.delete(key)
    },
    storageKey: 'global_score_leaderboard_v3',
    timeAttackStorageKey: 'global_time_attack_leaderboard_v1',
    timeDefenseStorageKey: 'global_time_defense_leaderboard_v1',
    defaultLimit: 10,
    helpers,
    jsonResponse: createJsonResponse,
    now: () => currentTime++
  });

  return { controller, storage };
}

describe('match worker leaderboard room controller', () => {
  test('submit persists store and list returns ranked entries per filter', async () => {
    const { controller, storage } = createController();

    const submitAlpha = await controller.handleLeaderboardSubmit({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
    expect(submitAlpha.status).toBe(200);

    const submitAlphaNetwork = await controller.handleLeaderboardSubmit({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 6800,
      mode: 'network'
    });
    expect(submitAlphaNetwork.status).toBe(200);

    const submitBeta = await controller.handleLeaderboardSubmit({
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 8100,
      mode: 'network'
    });
    expect(submitBeta.status).toBe(200);
    expect(storage.has('global_score_leaderboard_v3')).toBe(true);

    const allResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10'));
    expect(allResponse.status).toBe(200);
    const allPayload = await allResponse.json();
    expect(allPayload).toMatchObject({
      ok: true,
      version: 3,
      limit: 10
    });
    expect(Array.isArray(allPayload.entries)).toBe(true);
    expect(allPayload.entries).toHaveLength(2);
    expect(allPayload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100
    });
    expect(allPayload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });

    const networkResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=network'));
    const networkPayload = await networkResponse.json();
    expect(networkPayload.entries).toHaveLength(2);
    expect(networkPayload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100,
      mode: 'network'
    });
    expect(networkPayload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 6800,
      mode: 'network',
      cpuLevel: null
    });

    const cpuResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=cpu'));
    const cpuPayload = await cpuResponse.json();
    expect(cpuPayload.entries).toHaveLength(1);
    expect(cpuPayload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
  });

  test('list can filter CPU entries by level', async () => {
    const { controller } = createController();

    await controller.handleLeaderboardSubmit({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7200,
      mode: 'cpu',
      cpuLevel: 1
    });
    await controller.handleLeaderboardSubmit({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 6800,
      mode: 'cpu',
      cpuLevel: 6
    });
    await controller.handleLeaderboardSubmit({
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 8100,
      mode: 'cpu',
      cpuLevel: 6
    });

    const lv6Response = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=cpu&cpuLevel=6'));
    expect(lv6Response.status).toBe(200);
    const lv6Payload = await lv6Response.json();

    expect(lv6Payload).toMatchObject({
      ok: true,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(lv6Payload.entries).toHaveLength(2);
    expect(lv6Payload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100,
      cpuLevel: 6
    });
    expect(lv6Payload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 6800,
      cpuLevel: 6
    });
  });

  test('list can switch to time attack category', async () => {
    const { controller, storage } = createController();

    await controller.handleLeaderboardSubmit({
      playerId: 'player_score_0001',
      playerName: 'スコア',
      score: 9000,
      mode: 'cpu',
      cpuLevel: 6
    });

    await controller.handleLeaderboardSubmit({
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 180500,
      mode: 'cpu',
      cpuLevel: 6
    });
    await controller.handleLeaderboardSubmit({
      category: 'timeAttack',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      elapsedMs: 200000,
      mode: 'cpu',
      cpuLevel: 6
    });

    expect(storage.has('global_score_leaderboard_v3')).toBe(true);
    expect(storage.has('global_time_attack_leaderboard_v1')).toBe(true);
    const scoreStore = storage.get('global_score_leaderboard_v3') as Record<string, unknown>;
    expect(scoreStore).toHaveProperty('players');
    expect(scoreStore).not.toHaveProperty('timeAttackPlayers');
    const timeAttackStore = storage.get('global_time_attack_leaderboard_v1') as Record<string, unknown>;
    expect(timeAttackStore).toHaveProperty('timeAttackPlayers');
    expect(timeAttackStore).not.toHaveProperty('players');

    const response = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=cpu&cpuLevel=6&category=timeAttack'));
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: true,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'timeAttack'
    });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      bestTimeMs: 180500,
      category: 'timeAttack'
    });
    expect(payload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      bestTimeMs: 200000
    });
  });

  test('list can switch to time defense category', async () => {
    const { controller, storage } = createController();

    await controller.handleLeaderboardSubmit({
      playerId: 'player_score_0001',
      playerName: 'スコア',
      score: 9000,
      mode: 'cpu',
      cpuLevel: 6
    });

    await controller.handleLeaderboardSubmit({
      category: 'timeDefense',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 58,
      mode: 'cpu',
      cpuLevel: 6
    });
    await controller.handleLeaderboardSubmit({
      category: 'timeDefense',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      turnCount: 51,
      mode: 'cpu',
      cpuLevel: 6
    });

    expect(storage.has('global_score_leaderboard_v3')).toBe(true);
    expect(storage.has('global_time_defense_leaderboard_v1')).toBe(true);
    const scoreStore = storage.get('global_score_leaderboard_v3') as Record<string, unknown>;
    expect(scoreStore).toHaveProperty('players');
    expect(scoreStore).not.toHaveProperty('timeDefensePlayers');
    const timeDefenseStore = storage.get('global_time_defense_leaderboard_v1') as Record<string, unknown>;
    expect(timeDefenseStore).toHaveProperty('timeDefensePlayers');
    expect(timeDefenseStore).not.toHaveProperty('players');

    const response = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=cpu&cpuLevel=6&category=timeDefense'));
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: true,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'timeDefense'
    });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      turnCount: 58,
      category: 'timeDefense'
    });
    expect(payload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      turnCount: 51
    });
  });

  test('time attack category rejects network mode submissions', async () => {
    const { controller, storage } = createController();

    const response = await controller.handleLeaderboardSubmit({
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 120000,
      mode: 'network'
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: 'TIME_ATTACK_INELIGIBLE'
    });
    expect(storage.has('global_time_attack_leaderboard_v1')).toBe(false);
  });

  test('missing playerId returns 400', async () => {
    const { controller } = createController();
    const response = await controller.handleLeaderboardSubmit({
      playerName: '匿名',
      score: 1000
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: 'PLAYER_ID_REQUIRED'
    });
  });
});
