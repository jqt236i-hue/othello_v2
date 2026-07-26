import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__RATED_RESULT_WORKER_RESULT__';
const BLACK_ID = 'p_aaaaaaaaaaaaaaaaaaaaaaaaaa';
const WHITE_ID = 'p_bbbbbbbbbbbbbbbbbbbbbbbbbb';

function runRatedResultScenario(runnerSource: string) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'rated result worker runner failed');
  }
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'rated result marker missing');
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runDirectFinalizeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  function makeState() {",
    "    const storage = new Map();",
    "    return { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async (value) => storage.set('__alarm__', value), deleteAlarm: async () => storage.delete('__alarm__') } };",
    "  }",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    "  room.room = {",
    "    roomId: 'RATED1',",
    "    matchType: 'rated',",
    "    ratedMatch: { enabled: true, pool: 'card_ranked_v1', systemVersion: 1, matchId: 'rated_direct_1', ratingStatus: 'pending' },",
    `    seatPlayerIds: { black: '${BLACK_ID}', white: '${WHITE_ID}' },`,
    "    snapshot: { gameState: { board: Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => (row * 8 + col < 33 ? 1 : -1))), boardExpansion: { cells: [] } }, cardState: { markers: [] } }",
    "  };",
    "  await room.saveRoom();",
    "  const first = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    "  const second = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    `  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=${BLACK_ID}'));`,
    `  const whiteResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=${WHITE_ID}'));`,
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ first, second, black: await blackResponse.json(), white: await whiteResponse.json(), ratedMatch: room.room.ratedMatch }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  return runRatedResultScenario(runner);
}

function runCasualFinalizeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const makeState = () => ({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    `  room.room = { roomId: 'CASUAL1', matchType: '', seatPlayerIds: { black: '${BLACK_ID}', white: '${WHITE_ID}' } };`,
    "  const finalizeResult = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    `  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=${BLACK_ID}'));`,
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ finalizeResult, black: await blackResponse.json() }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  return runRatedResultScenario(runner);
}

function runExpansionRatedResultScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } };",
    "  const room = new MatchRoomDurableObject(state, {});",
    "  room.isSnapshotGameOver = async () => true;",
    "  room.room = {",
    "    roomId: 'RATED_EXPANSION',",
    "    matchType: 'rated',",
    "    ratedMatch: { enabled: true, matchId: 'rated_expansion_1', ratingStatus: 'pending' },",
    "    snapshot: {",
    "      gameState: {",
    "        board: [[1,1,1,1],[1,1,1,1],[1,-1,-1,-1],[-1,-1,-1,-1]],",
    "        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },",
    "        boardExpansion: { cells: [{ row: -1, col: 0, side: 'top', owner: -1 }, { row: -1, col: 1, side: 'top', owner: -1 }, { row: -1, col: 2, side: 'top', owner: -1 }] }",
    "      },",
    "      cardState: { markers: [] },",
    "      _meta: { boardContractVersion: 2 }",
    "    }",
    "  };",
    "  const result = await room.resolveRatedNormalResult();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ result }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  return runRatedResultScenario(runner);
}

function runDisconnectOrResignScenario(mode: 'resign' | 'black_disconnect' | 'both_disconnect') {
  const runner = [
    "(async () => {",
    "  const mode = process.argv[2];",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  function makeState() {",
    "    const storage = new Map();",
    "    return { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async (value) => storage.set('__alarm__', value), deleteAlarm: async () => storage.delete('__alarm__') } };",
    "  }",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    "  room.room = {",
    "    roomId: 'RATED_DISC1',",
    "    matchType: 'rated',",
    "    ratedMatch: { enabled: true, pool: 'card_ranked_v1', systemVersion: 1, matchId: 'rated_disconnect_1_' + mode, ratingStatus: 'pending' },",
    "    ratedPresence: { blackDisconnectedAt: 0, whiteDisconnectedAt: 0, disconnectGraceMs: 120000 },",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    `    seatPlayerIds: { black: '${BLACK_ID}', white: '${WHITE_ID}' }`,
    "  };",
    "  let actionResult = null;",
    "  if (mode === 'resign') {",
    "    const response = await room.handleResign({ seatKey: 'black', seatToken: 'token_black' });",
    "    actionResult = await response.json();",
    "  } else if (mode === 'black_disconnect') {",
    "    room.room.ratedPresence.blackDisconnectedAt = 1;",
    "    actionResult = await room.finalizeRatedDisconnectIfExpired(120001);",
    "  } else {",
    "    room.room.ratedPresence.blackDisconnectedAt = 1;",
    "    room.room.ratedPresence.whiteDisconnectedAt = 1;",
    "    actionResult = await room.finalizeRatedDisconnectIfExpired(120001);",
    "  }",
    `  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=${BLACK_ID}'));`,
    `  const whiteResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=${WHITE_ID}'));`,
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ actionResult, ratedMatch: room.room.ratedMatch, black: await blackResponse.json(), white: await whiteResponse.json() }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, mode], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'disconnect scenario failed');
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'disconnect marker missing');
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

describe('rated match result finalization', () => {
  test('normal rated game over updates both ratings once', () => {
    const result = runDirectFinalizeScenario();

    expect(result.first.ok).toBe(true);
    expect(result.ratedMatch.ratingStatus).toBe('applied');
    expect(result.ratedMatch.finalResult).toBe('BLACK_WIN');
    expect(result.black.rating.ratedGames).toBe(1);
    expect(result.white.rating.ratedGames).toBe(1);
    expect(result.black.displayRating).toBe(1662);
    expect(result.white.displayRating).toBe(1338);
  });

  test('expanded discs are included when resolving the rated winner', () => {
    expect(runExpansionRatedResultScenario().result).toBe('WHITE_WIN');
  });

  test('casual network game over does not update rating', () => {
    const result = runCasualFinalizeScenario();

    expect(result.finalizeResult).toBe(null);
    expect(result.black.rating.ratedGames).toBe(0);
    expect(result.black.displayRating).toBe(1500);
  });

  test('replayed finalization does not double update rating', () => {
    const result = runDirectFinalizeScenario();

    expect(result.second.ok).toBe(true);
    expect(result.black.rating.ratedGames).toBe(1);
    expect(result.white.rating.ratedGames).toBe(1);
  });

  test('explicit resign counts as a rated loss', () => {
    const result = runDisconnectOrResignScenario('resign');

    expect(result.actionResult.ok).toBe(true);
    expect(result.ratedMatch.finalResult).toBe('WHITE_WIN');
    expect(result.black.displayRating).toBe(1338);
    expect(result.white.displayRating).toBe(1662);
  });

  test('single-player disconnect beyond grace counts as a rated loss', () => {
    const result = runDisconnectOrResignScenario('black_disconnect');

    expect(result.actionResult).toBe(true);
    expect(result.ratedMatch.finalResult).toBe('WHITE_WIN');
    expect(result.black.rating.ratedGames).toBe(1);
    expect(result.white.rating.ratedGames).toBe(1);
  });

  test('both players disconnected beyond grace is no contest', () => {
    const result = runDisconnectOrResignScenario('both_disconnect');

    expect(result.actionResult).toBe(true);
    expect(result.ratedMatch.ratingStatus).toBe('no_contest');
    expect(result.black.rating.ratedGames).toBe(0);
    expect(result.white.rating.ratedGames).toBe(0);
  });
});
