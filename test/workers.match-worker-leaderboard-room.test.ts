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
    defaultLimit: 10,
    helpers,
    jsonResponse: createJsonResponse,
    now: () => currentTime++
  });

  return { controller, storage };
}

describe('match worker leaderboard room controller', () => {
  test('submit persists store and list returns ranked entries', async () => {
    const { controller, storage } = createController();

    const submitAlpha = await controller.handleLeaderboardSubmit({
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
    expect(submitAlpha.status).toBe(200);

    const submitBeta = await controller.handleLeaderboardSubmit({
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 8100,
      mode: 'network'
    });
    expect(submitBeta.status).toBe(200);
    expect(storage.has('global_score_leaderboard_v3')).toBe(true);

    const listResponse = await controller.handleLeaderboardList(new URL('https://room/api/leaderboard/list?limit=10'));
    expect(listResponse.status).toBe(200);
    const payload = await listResponse.json();
    expect(payload).toMatchObject({
      ok: true,
      version: 3,
      limit: 10
    });
    expect(Array.isArray(payload.entries)).toBe(true);
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100
    });
    expect(payload.entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
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
