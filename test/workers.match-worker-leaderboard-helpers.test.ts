import { createMatchWorkerLeaderboardHelpers } from '../workers/match-worker-leaderboard';

function createHelpers() {
  let currentTime = 1000;
  return createMatchWorkerLeaderboardHelpers({
    storageVersion: 3,
    playerNameMax: 7,
    playerIdPattern: /^[A-Za-z0-9_-]{8,80}$/,
    defaultLimit: 10,
    maxLimit: 100,
    maxStoredPlayers: 200,
    now: () => currentTime++
  });
}

describe('match worker leaderboard helpers', () => {
  test('自己ベストを保持しつつランキング順を返す', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const first = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    store = first.store;

    const second = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 6800,
      mode: 'network'
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.payload.updated).toBe(false);
    expect(second.payload.bestScore).toBe(7200);
    expect(second.payload.score).toBe(6800);
    store = second.store;

    const third = helpers.applySubmit(store, {
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 8100,
      mode: 'network'
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;

    const entries = third.payload.entries as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100
    });
    expect(entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });
  });

  test('playerId未指定は拒否する', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();
    const result = helpers.applySubmit(store, {
      playerName: '匿名',
      score: 1000
    });

    expect(result).toEqual({
      ok: false,
      reason: 'PLAYER_ID_REQUIRED'
    });
  });
});
