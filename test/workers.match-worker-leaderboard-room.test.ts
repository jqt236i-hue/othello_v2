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
    shortestTurnsStorageKey: 'global_shortest_turns_leaderboard_v1',
    defaultLimit: 10,
    helpers,
    jsonResponse: createJsonResponse,
    now: () => currentTime++
  });

  return { controller, storage };
}

function createRecoveryController() {
  const storage = new Map<string, unknown>();
  let currentTime = 1000;
  const helpers = createMatchWorkerLeaderboardHelpers({
    storageVersion: 4,
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
    storageKey: 'global_score_leaderboard_v4',
    timeAttackStorageKey: 'global_time_attack_leaderboard_v2',
    timeDefenseStorageKey: 'global_time_defense_leaderboard_v2',
    shortestTurnsStorageKey: 'global_shortest_turns_leaderboard_v2',
    legacyStorageKey: 'global_score_leaderboard_v3',
    legacyTimeAttackStorageKey: 'global_time_attack_leaderboard_v1',
    legacyTimeDefenseStorageKey: 'global_time_defense_leaderboard_v1',
    legacyShortestTurnsStorageKey: 'global_shortest_turns_leaderboard_v1',
    defaultLimit: 10,
    helpers,
    jsonResponse: createJsonResponse,
    now: () => currentTime++
  });

  return { controller, storage };
}

function makeLegacyStore(category: 'score' | 'timeAttack' | 'timeDefense' | 'shortestTurns', entry: Record<string, unknown>) {
  const property = category === 'timeAttack'
    ? 'timeAttackPlayers'
    : category === 'timeDefense'
    ? 'timeDefensePlayers'
    : category === 'shortestTurns'
    ? 'shortestTurnsPlayers'
    : 'players';
  return {
    version: 3,
    [property]: {
      [String(entry.playerId)]: entry
    },
    updatedAt: 777
  };
}

describe('match worker leaderboard room controller', () => {
  test('旧保存キーは読み取り専用の旧記録としてカテゴリごとに公開する', async () => {
    const { controller, storage } = createRecoveryController();
    storage.set('global_score_leaderboard_v4', makeLegacyStore('score', {
      playerId: 'player_current_0001',
      playerName: '現行',
      bestScore: 5000,
      mode: 'network'
    }));

    const legacyCases = [
      {
        category: 'score' as const,
        key: 'global_score_leaderboard_v3',
        entry: { playerId: 'player_legacy_score_0001', playerName: '旧スコア', bestScore: 9999, mode: 'cpu', cpuLevel: 6 },
        expectedValue: 9999
      },
      {
        category: 'timeAttack' as const,
        key: 'global_time_attack_leaderboard_v1',
        entry: { playerId: 'player_legacy_time_0001', playerName: '旧速攻', category: 'timeAttack', bestTimeMs: 123456, mode: 'cpu', cpuLevel: 6 },
        expectedValue: 123456
      },
      {
        category: 'timeDefense' as const,
        key: 'global_time_defense_leaderboard_v1',
        entry: { playerId: 'player_legacy_defense_0001', playerName: '旧最長', category: 'timeDefense', turnCount: 61, mode: 'cpu', cpuLevel: 6 },
        expectedValue: 61
      },
      {
        category: 'shortestTurns' as const,
        key: 'global_shortest_turns_leaderboard_v1',
        entry: { playerId: 'player_legacy_short_0001', playerName: '旧最短', category: 'shortestTurns', turnCount: 35, mode: 'cpu', cpuLevel: 6 },
        expectedValue: 35
      }
    ];
    legacyCases.forEach(({ category, key, entry }) => {
      storage.set(key, makeLegacyStore(category, entry));
    });
    const before = Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)]);

    for (const { category, entry, expectedValue } of legacyCases) {
      const response = await controller.handleLeaderboardList(new URL(`https://room/api/leaderboard/list?limit=10&mode=all&category=${category}&era=legacy`));
      const payload = await response.json();
      expect(payload).toMatchObject({ ok: true, era: 'legacy', category, entries: [{ playerName: entry.playerName }] });
      if (category === 'score') expect(payload.entries[0].bestScore).toBe(expectedValue);
      if (category === 'timeAttack') expect(payload.entries[0].bestTimeMs).toBe(expectedValue);
      if (category === 'timeDefense' || category === 'shortestTurns') expect(payload.entries[0].turnCount).toBe(expectedValue);
    }

    const currentResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=all&category=score'));
    await expect(currentResponse.json()).resolves.toMatchObject({
      era: 'current',
      entries: [{ playerName: '現行', bestScore: 5000 }]
    });
    expect(Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)])).toEqual(before);
  });

  test('通算一覧は旧記録を基準にし、上回った検証済み新記録だけを採用する', async () => {
    const { controller, storage } = createRecoveryController();
    const sharedLegacy = {
      playerId: 'player_shared_0001',
      playerName: '基準記録',
      bestScore: 9000,
      mode: 'network',
      updatedAt: 100
    };
    const lowerVerified = {
      playerId: 'player_shared_0001',
      playerName: '新記録',
      bestScore: 8800,
      mode: 'network',
      updatedAt: 900
    };
    const otherVerified = {
      playerId: 'player_verified_0002',
      playerName: '検証済み',
      bestScore: 8900,
      mode: 'network',
      updatedAt: 800
    };
    storage.set('global_score_leaderboard_v3', makeLegacyStore('score', sharedLegacy));
    storage.set('global_score_leaderboard_v4', {
      version: 4,
      players: {
        [lowerVerified.playerId]: lowerVerified,
        [otherVerified.playerId]: otherVerified
      },
      updatedAt: 900
    });
    const beforeLower = Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)]);

    const lowerResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=all&category=score&era=history'));
    const lowerPayload = await lowerResponse.json();
    expect(lowerPayload).toMatchObject({ ok: true, era: 'history' });
    expect(lowerPayload.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: sharedLegacy.playerId, bestScore: 9000, recordSource: 'legacy' }),
      expect.objectContaining({ playerId: otherVerified.playerId, bestScore: 8900, recordSource: 'verified' })
    ]));
    expect(Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)])).toEqual(beforeLower);

    const higherVerified = { ...lowerVerified, bestScore: 9200, updatedAt: 1000 };
    storage.set('global_score_leaderboard_v4', {
      version: 4,
      players: {
        [higherVerified.playerId]: higherVerified,
        [otherVerified.playerId]: otherVerified
      },
      updatedAt: 1000
    });
    const beforeHigher = Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)]);

    const higherResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=all&category=score&era=history'));
    const higherPayload = await higherResponse.json();
    expect(higherPayload.entries[0]).toMatchObject({
      playerId: sharedLegacy.playerId,
      bestScore: 9200,
      recordSource: 'verified'
    });
    expect(Array.from(storage.entries()).map(([key, value]) => [key, JSON.stringify(value)])).toEqual(beforeHigher);
  });

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

  test('list can switch to shortest turns category', async () => {
    const { controller, storage } = createController();

    await controller.handleLeaderboardSubmit({
      playerId: 'player_score_0001',
      playerName: 'スコア',
      score: 9000,
      mode: 'cpu',
      cpuLevel: 6
    });

    await controller.handleLeaderboardSubmit({
      category: 'shortestTurns',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 37,
      mode: 'cpu',
      cpuLevel: 6
    });
    await controller.handleLeaderboardSubmit({
      category: 'shortestTurns',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      turnCount: 40,
      mode: 'cpu',
      cpuLevel: 6
    });

    expect(storage.has('global_score_leaderboard_v3')).toBe(true);
    expect(storage.has('global_shortest_turns_leaderboard_v1')).toBe(true);
    const scoreStore = storage.get('global_score_leaderboard_v3') as Record<string, unknown>;
    expect(scoreStore).toHaveProperty('players');
    expect(scoreStore).not.toHaveProperty('shortestTurnsPlayers');
    const shortestTurnsStore = storage.get('global_shortest_turns_leaderboard_v1') as Record<string, unknown>;
    expect(shortestTurnsStore).toHaveProperty('shortestTurnsPlayers');
    expect(shortestTurnsStore).not.toHaveProperty('players');

    const response = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10&mode=cpu&cpuLevel=6&category=shortestTurns'));
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: true,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'shortestTurns'
    });
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      turnCount: 37,
      category: 'shortestTurns'
    });
    expect(payload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      turnCount: 40
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
