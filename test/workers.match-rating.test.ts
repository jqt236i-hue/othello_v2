import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { createMatchWorkerRatingHelpers } from '../workers/match-worker-rating';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__RATING_WORKER_RESULT__';

function runRatingWorkerScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "  const initialResponse = await durableObject.fetch(new Request('https://rating/api/rating/me?playerId=player_12345678'));",
    "  const finalizeResponse = await durableObject.fetch(new Request('https://rating/internal/rating/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId: 'm1', pool: 'card_ranked_v1', blackPlayerId: 'player_12345678', whitePlayerId: 'player_87654321', result: 'BLACK_WIN', rulesetVersion: 'card-ranked-v1', catalogVersion: 'catalog-test' }) }));",
    "  const listResponse = await durableObject.fetch(new Request('https://rating/api/rating/leaderboard?limit=10'));",
    "  const historyResponse = await durableObject.fetch(new Request('https://rating/api/rating/history?playerId=player_12345678&limit=10'));",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ initial: { status: initialResponse.status, body: await initialResponse.json() }, finalize: { status: finalizeResponse.status, body: await finalizeResponse.json() }, list: { status: listResponse.status, body: await listResponse.json() }, history: { status: historyResponse.status, body: await historyResponse.json() } }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'rating worker scenario failed');
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'rating worker marker missing');
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

describe('match worker rating helpers', () => {
  const nowIso = '2026-06-25T00:00:00.000Z';

  test('applies first rated result to both players from before states', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const store = helpers.createEmptyStore();

    const result = helpers.applyRatedResult(store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(result.ok).toBe(true);
    expect(Math.round(result.payload.black.after.rating)).toBe(1662);
    expect(Math.round(result.payload.white.after.rating)).toBe(1338);
    expect(result.store.players['black-player'].wins).toBe(1);
    expect(result.store.players['white-player'].losses).toBe(1);
  });

  test('does not update twice for the same matchId', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const first = helpers.applyRatedResult(helpers.createEmptyStore(), {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });
    const second = helpers.applyRatedResult(first.store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'WHITE_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(second.ok).toBe(true);
    expect(second.idempotentReplay).toBe(true);
    expect(second.store.players['black-player'].wins).toBe(1);
    expect(second.store.players['black-player'].losses).toBe(0);
  });

  test('NO_CONTEST changes no ratings and creates no match record', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const store = helpers.createEmptyStore();
    const result = helpers.applyRatedResult(store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'NO_CONTEST',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(result.ok).toBe(true);
    expect(Object.keys(result.store.matches)).toHaveLength(0);
    expect(result.store.players['black-player']).toBeUndefined();
  });

  test('leaderboard orders by internal rating then RD then games then playerId', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    let store = helpers.createEmptyStore();
    store = helpers.applyRatedResult(store, {
      matchId: 'm1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'a-player',
      whitePlayerId: 'b-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    }).store;

    const list = helpers.listLeaderboard(store, { limit: 10 });

    expect(list.entries[0].playerId).toBe('a-player');
    expect(list.entries[0].displayRating).toBe(1662);
    expect(list.entries[0].ratedGames).toBe(1);
  });

  test('player history returns the latest rated matches with result and display delta', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    let store = helpers.createEmptyStore();
    for (let index = 0; index < 11; index += 1) {
      const result = index % 3 === 0 ? 'DRAW' : index % 2 === 0 ? 'BLACK_WIN' : 'WHITE_WIN';
      store = helpers.applyRatedResult(store, {
        matchId: `history-${String(index).padStart(2, '0')}`,
        pool: 'card_ranked_v1',
        blackPlayerId: 'player-main',
        whitePlayerId: `opponent-${String(index).padStart(2, '0')}`,
        result,
        rulesetVersion: 'card-ranked-v1',
        catalogVersion: 'catalog-test'
      }).store;
    }

    const history = helpers.listPlayerHistory(store, { playerId: 'player-main', limit: 10 });

    expect(history.ok).toBe(true);
    expect(history.entries).toHaveLength(10);
    expect(history.entries[0]).toEqual(expect.objectContaining({
      matchId: 'history-10',
      playerId: 'player-main',
      opponentPlayerId: 'opponent-10',
      result: 'WIN'
    }));
    expect(history.entries.some((entry) => entry.result === 'LOSS')).toBe(true);
    expect(history.entries.some((entry) => entry.result === 'DRAW')).toBe(true);
    expect(Number.isFinite(history.entries[0].displayDelta)).toBe(true);
  });

  test('active rated match lock blocks another match for either player', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const first = helpers.claimActiveRatedMatch(helpers.createEmptyStore(), {
      matchId: 'm1',
      roomId: 'AAA',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      startedAt: nowIso
    });
    const second = helpers.claimActiveRatedMatch(first.store, {
      matchId: 'm2',
      roomId: 'BBB',
      blackPlayerId: 'black-player',
      whitePlayerId: 'other-player',
      startedAt: nowIso
    });
    const released = helpers.releaseActiveRatedMatch(first.store, 'm1');
    const third = helpers.claimActiveRatedMatch(released.store, {
      matchId: 'm2',
      roomId: 'BBB',
      blackPlayerId: 'black-player',
      whitePlayerId: 'other-player',
      startedAt: nowIso
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('PLAYER_ALREADY_IN_RATED_MATCH');
    expect(third.ok).toBe(true);
  });

  test('rated leaderboard exposes public names and profile fields from active match claim', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const claimed = helpers.claimActiveRatedMatch(helpers.createEmptyStore(), {
      matchId: 'm-profile',
      roomId: 'AAA',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      blackPlayerName: '黒名',
      whitePlayerName: '白名',
      blackAvatarStoneType: 'LIGHTNING',
      whiteAvatarStoneType: 'GHOST',
      blackBio: 'よろしく',
      whiteBio: '勝負',
      startedAt: nowIso
    });
    const applied = helpers.applyRatedResult(claimed.store, {
      matchId: 'm-profile',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });
    const list = helpers.listLeaderboard(applied.store, { limit: 10 });

    expect(list.entries[0]).toEqual(expect.objectContaining({
      playerId: 'black-player',
      playerName: '黒名',
      avatarStoneType: 'LIGHTNING',
      bio: 'よろしく',
      displayRating: 1662
    }));
  });

  test('rating durable object API returns initial rating and rated leaderboard', () => {
    const result = runRatingWorkerScenario();

    expect(result.initial.status).toBe(200);
    expect(result.initial.body.displayRating).toBe(1500);
    expect(result.initial.body.rating.ratedGames).toBe(0);
    expect(result.finalize.status).toBe(200);
    expect(result.finalize.body.black.display).toEqual({ before: 1500, after: 1662, delta: 162 });
    expect(result.list.status).toBe(200);
    expect(result.list.body.entries[0]).toEqual(expect.objectContaining({
      playerId: 'player_12345678',
      displayRating: 1662,
      ratedGames: 1,
      wins: 1
    }));
    expect(result.history.status).toBe(200);
    expect(result.history.body.entries[0]).toEqual(expect.objectContaining({
      matchId: 'm1',
      playerId: 'player_12345678',
      opponentPlayerId: 'player_87654321',
      result: 'WIN',
      displayDelta: 162
    }));
  });
});
