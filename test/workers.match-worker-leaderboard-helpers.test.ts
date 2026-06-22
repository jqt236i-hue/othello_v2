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
  test('総合とモード別で自己ベストを分けて保持する', () => {
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
    expect(second.payload.updated).toBe(true);
    expect(second.payload.bestScore).toBe(6800);
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

    const allEntries = helpers.listEntries(third.store, 10, 'all');
    const cpuEntries = helpers.listEntries(third.store, 10, 'cpu');
    const networkEntries = helpers.listEntries(third.store, 10, 'network');

    expect(allEntries).toHaveLength(2);
    expect(allEntries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100
    });
    expect(allEntries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });

    expect(cpuEntries).toHaveLength(1);
    expect(cpuEntries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      bestScore: 7200,
      mode: 'cpu',
      cpuLevel: 3
    });

    expect(networkEntries).toHaveLength(2);
    expect(networkEntries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100,
      mode: 'network'
    });
    expect(networkEntries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 6800,
      mode: 'network',
      cpuLevel: null
    });
  });

  test('CPUランキングはレベル別の自己ベストを保持して絞り込める', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const lv1 = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7200,
      mode: 'cpu',
      cpuLevel: 1
    });
    expect(lv1.ok).toBe(true);
    if (!lv1.ok) return;
    store = lv1.store;

    const lv6 = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 6800,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(lv6.ok).toBe(true);
    if (!lv6.ok) return;
    store = lv6.store;

    const betaLv6 = helpers.applySubmit(store, {
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 8100,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(betaLv6.ok).toBe(true);
    if (!betaLv6.ok) return;

    const cpuEntries = helpers.listEntries(betaLv6.store, 10, 'cpu');
    const lv1Entries = helpers.listEntries(betaLv6.store, 10, 'cpu', 1);
    const lv6Entries = helpers.listEntries(betaLv6.store, 10, 'cpu', 6);

    expect(cpuEntries[0]).toMatchObject({
      playerName: 'ベータ',
      bestScore: 8100,
      cpuLevel: 6
    });
    expect(cpuEntries[1]).toMatchObject({
      playerName: 'アルファ',
      bestScore: 7200,
      cpuLevel: 1
    });

    expect(lv1Entries).toHaveLength(1);
    expect(lv1Entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      bestScore: 7200,
      cpuLevel: 1
    });

    expect(lv6Entries).toHaveLength(2);
    expect(lv6Entries[0]).toMatchObject({
      rank: 1,
      playerName: 'ベータ',
      bestScore: 8100,
      cpuLevel: 6
    });
    expect(lv6Entries[1]).toMatchObject({
      rank: 2,
      playerName: 'アルファ',
      bestScore: 6800,
      cpuLevel: 6
    });
  });

  test('タイムアタックは短い自己ベストだけを保存して短い順に並ぶ', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const alphaSlow = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 240000,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaSlow.ok).toBe(true);
    if (!alphaSlow.ok) return;
    store = alphaSlow.store;

    const alphaFast = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 180500,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaFast.ok).toBe(true);
    if (!alphaFast.ok) return;
    expect(alphaFast.payload.updated).toBe(true);
    expect(alphaFast.payload.bestTimeMs).toBe(180500);
    store = alphaFast.store;

    const beta = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      elapsedMs: 200000,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(beta.ok).toBe(true);
    if (!beta.ok) return;

    const entries = helpers.listEntries(beta.store, 10, 'cpu', 6, 'timeAttack');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      bestTimeMs: 180500,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'timeAttack'
    });
    expect(entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      bestTimeMs: 200000
    });
  });

  test('タイムディフェンスは長い自己ベストだけを保存して長い順に並ぶ', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const alphaShort = helpers.applySubmit(store, {
      category: 'timeDefense',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 42,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaShort.ok).toBe(true);
    if (!alphaShort.ok) return;
    store = alphaShort.store;

    const alphaLong = helpers.applySubmit(store, {
      category: 'timeDefense',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 58,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaLong.ok).toBe(true);
    if (!alphaLong.ok) return;
    expect(alphaLong.payload.updated).toBe(true);
    expect(alphaLong.payload.bestTurnCount).toBe(58);
    store = alphaLong.store;

    const beta = helpers.applySubmit(store, {
      category: 'timeDefense',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      turnCount: 51,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(beta.ok).toBe(true);
    if (!beta.ok) return;

    const entries = helpers.listEntries(beta.store, 10, 'cpu', 6, 'timeDefense');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      turnCount: 58,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'timeDefense'
    });
    expect(entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      turnCount: 51
    });
  });

  test('最短手数は短い自己ベストだけを保存して短い順に並ぶ', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const alphaSlow = helpers.applySubmit(store, {
      category: 'shortestTurns',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 42,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaSlow.ok).toBe(true);
    if (!alphaSlow.ok) return;
    store = alphaSlow.store;

    const alphaFast = helpers.applySubmit(store, {
      category: 'shortestTurns',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 37,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(alphaFast.ok).toBe(true);
    if (!alphaFast.ok) return;
    expect(alphaFast.payload.updated).toBe(true);
    expect(alphaFast.payload.bestTurnCount).toBe(37);
    store = alphaFast.store;

    const beta = helpers.applySubmit(store, {
      category: 'shortestTurns',
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      turnCount: 40,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(beta.ok).toBe(true);
    if (!beta.ok) return;

    const entries = helpers.listEntries(beta.store, 10, 'cpu', 6, 'shortestTurns');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      rank: 1,
      playerName: 'アルファ',
      turnCount: 37,
      mode: 'cpu',
      cpuLevel: 6,
      category: 'shortestTurns'
    });
    expect(entries[1]).toMatchObject({
      rank: 2,
      playerName: 'ベータ',
      turnCount: 40
    });
  });

  test('タイムアタックは900秒超過とデバッグ記録を保存しない', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();

    const tooSlow = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 900001,
      mode: 'cpu',
      cpuLevel: 1
    });
    expect(tooSlow).toEqual({
      ok: false,
      reason: 'TIME_ATTACK_INELIGIBLE'
    });

    const debug = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 120000,
      mode: 'cpu',
      cpuLevel: 1,
      debug: true
    });
    expect(debug).toEqual({
      ok: false,
      reason: 'TIME_ATTACK_INELIGIBLE'
    });
  });

  test('タイムアタックはnetworkモードの送信を保存しない', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();

    const result = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 120000,
      mode: 'network'
    });

    expect(result).toEqual({
      ok: false,
      reason: 'TIME_ATTACK_INELIGIBLE'
    });
    expect(helpers.listEntries(store, 10, 'network', null, 'timeAttack')).toHaveLength(0);
  });

  test('タイムディフェンスはnetworkモードとデバッグ記録を保存しない', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();

    const network = helpers.applySubmit(store, {
      category: 'timeDefense',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 58,
      mode: 'network'
    });
    expect(network).toEqual({
      ok: false,
      reason: 'TIME_DEFENSE_INELIGIBLE'
    });

    const debug = helpers.applySubmit(store, {
      category: 'timeDefense',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 58,
      mode: 'cpu',
      cpuLevel: 1,
      debug: true
    });
    expect(debug).toEqual({
      ok: false,
      reason: 'TIME_DEFENSE_INELIGIBLE'
    });
  });

  test('最短手数はnetworkモードとデバッグ記録を保存しない', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();

    const network = helpers.applySubmit(store, {
      category: 'shortestTurns',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 37,
      mode: 'network'
    });
    expect(network).toEqual({
      ok: false,
      reason: 'SHORTEST_TURNS_INELIGIBLE'
    });

    const debug = helpers.applySubmit(store, {
      category: 'shortestTurns',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      turnCount: 37,
      mode: 'cpu',
      cpuLevel: 1,
      debug: true
    });
    expect(debug).toEqual({
      ok: false,
      reason: 'SHORTEST_TURNS_INELIGIBLE'
    });
  });

  test('8x8以外の盤面ではスコアとタイムアタックを保存しない', () => {
    const helpers = createHelpers();
    const store = helpers.createEmptyStore();

    const scoreResult = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 9000,
      mode: 'cpu',
      cpuLevel: 1,
      boardConfig: { rows: 6, cols: 6, standard8x8: false }
    });
    expect(scoreResult).toEqual({
      ok: false,
      reason: 'BOARD_NOT_ELIGIBLE'
    });

    const timeResult = helpers.applySubmit(store, {
      category: 'timeAttack',
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      elapsedMs: 120000,
      mode: 'cpu',
      cpuLevel: 1,
      boardConfig: { rows: 6, cols: 6, standard8x8: false }
    });
    expect(timeResult).toEqual({
      ok: false,
      reason: 'BOARD_NOT_ELIGIBLE'
    });
  });

  test('スコア未更新時は自己ベストのメタデータを保持する', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const first = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 9000,
      scoreVersion: 5,
      turnCount: 24,
      mode: 'cpu',
      cpuLevel: 9
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    store = first.store;

    const second = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 8000,
      scoreVersion: 99,
      turnCount: 80,
      mode: 'cpu',
      cpuLevel: 9
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const entries = helpers.listEntries(second.store, 10, 'cpu', 9);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      bestScore: 9000,
      scoreVersion: 5,
      turnCount: 24,
      cpuLevel: 9
    });
  });

  test('Lv9とLv6はCPUレベル別ランキングで混在しない', () => {
    const helpers = createHelpers();
    let store = helpers.createEmptyStore();

    const lv6 = helpers.applySubmit(store, {
      playerId: 'player_alpha_0001',
      playerName: 'アルファ',
      score: 7000,
      mode: 'cpu',
      cpuLevel: 6
    });
    expect(lv6.ok).toBe(true);
    if (!lv6.ok) return;
    store = lv6.store;

    const lv9 = helpers.applySubmit(store, {
      playerId: 'player_beta_0002',
      playerName: 'ベータ',
      score: 9000,
      mode: 'cpu',
      cpuLevel: 9
    });
    expect(lv9.ok).toBe(true);
    if (!lv9.ok) return;

    expect(helpers.listEntries(lv9.store, 10, 'cpu', 6)).toHaveLength(1);
    expect(helpers.listEntries(lv9.store, 10, 'cpu', 9)).toHaveLength(1);
    expect(helpers.listEntries(lv9.store, 10, 'cpu', 9)[0]).toMatchObject({
      playerName: 'ベータ',
      cpuLevel: 9
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
