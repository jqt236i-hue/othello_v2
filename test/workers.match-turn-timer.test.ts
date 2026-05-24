import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'turn timer runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runJoinTimerScenario() {
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
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'TMR1',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 0",
    "      },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    create: {",
    "      turnTimer: createPayload.turnTimer,",
    "      serverTime: createPayload.serverTime",
    "    },",
    "    join: {",
    "      turnTimer: joinPayload.turnTimer,",
    "      serverTime: joinPayload.serverTime",
    "    }",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTimeoutPassScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "  const room = {",
    "    roomId: 'TMR2',",
    "    seed: 1,",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'くろ', white: 'しろ' },",
    "    roomDeck: null,",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    turnTimer: {",
    "      limitSeconds: 120,",
    "      active: true,",
    "      turnSeatKey: 'black',",
    "      turnStartedAt: Date.now() - 300000,",
    "      turnDeadlineAt: Date.now() - 10",
    "    },",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 9,",
    "        __resultShown: true",
    "      },",
    "      cardState: {",
    "        hands: { black: ['b0'], white: [] },",
    "        decks: { black: [], white: ['wdraw'] },",
    "        discard: [],",
    "        turnIndex: 10,",
    "        lastTurnStartedFor: 'black',",
    "        turnCountByPlayer: { black: 3, white: 2 },",
    "        selectedCardId: 'timeout_card',",
    "        selectedCardOwnerKey: 'black',",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: true },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        pendingEffectByPlayer: { black: { type: 'PERMA_PROTECT_NEXT_STONE' }, white: null },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 },",
    "        charge: { black: 0, white: 0 },",
    "        chargeGainedTotal: { black: 0, white: 0 },",
    "        breedingSproutByOwner: { black: [], white: [] },",
    "        _breedingSproutClearedTokenByOwner: { black: null, white: null },",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: [],",
    "        markers: []",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const stateResponse = await durableObject.handleState(new URL('https://room/api/match/state?seatKey=black&seatToken=token_black'));",
    "  const statePayload = await stateResponse.json();",
    "  await durableObject.loadRoom();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    statePayload,",
    "    status: stateResponse.status,",
    "    internalSnapshot: durableObject.room.snapshot",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runAlarmScheduleScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "  const storage = new Map();",
    "  let scheduledAlarmAt = null;",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key),",
    "      setAlarm: async (when) => { scheduledAlarmAt = when; },",
    "      deleteAlarm: async () => { scheduledAlarmAt = null; }",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'TMR3',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    snapshot: {",
    "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const joinResponse = await durableObject.handleJoin({ seatKey: 'white', playerName: 'しろ' });",
    "  const joinPayload = await joinResponse.json();",
    "  process.stdout.write(JSON.stringify({ scheduledAlarmAt, joinPayload }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runAlarmTimeoutScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "  const room = {",
    "    roomId: 'TMR4',",
    "    seed: 1,",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'くろ', white: 'しろ' },",
    "    roomDeck: null,",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    sseEventBuffer: [],",
    "    authorityLog: [],",
    "    turnTimer: {",
    "      limitSeconds: 120,",
    "      active: true,",
    "      turnSeatKey: 'black',",
    "      turnStartedAt: Date.now() - 300000,",
    "      turnDeadlineAt: Date.now() - 10",
    "    },",
    "    snapshot: {",
    "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 9, __resultShown: true },",
    "      cardState: {",
    "        hands: { black: ['b0'], white: [] },",
    "        decks: { black: [], white: ['wdraw'] },",
    "        discard: [],",
    "        turnIndex: 10,",
    "        lastTurnStartedFor: 'black',",
    "        turnCountByPlayer: { black: 3, white: 2 },",
    "        selectedCardId: 'timeout_card',",
    "        selectedCardOwnerKey: 'black',",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: true },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        pendingEffectByPlayer: { black: { type: 'PERMA_PROTECT_NEXT_STONE' }, white: null },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 },",
    "        charge: { black: 0, white: 0 },",
    "        chargeGainedTotal: { black: 0, white: 0 },",
    "        breedingSproutByOwner: { black: [], white: [] },",
    "        _breedingSproutClearedTokenByOwner: { black: null, white: null },",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: [],",
    "        markers: []",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key),",
    "      setAlarm: async () => {},",
    "      deleteAlarm: async () => {}",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  await durableObject.alarm();",
    "  await durableObject.loadRoom();",
    "  process.stdout.write(JSON.stringify({ snapshot: durableObject.room.snapshot, stateVersion: durableObject.room.stateVersion }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker turn timer', () => {
  test('2人そろうと120秒手番タイマーが有効化される', () => {
    const result = runJoinTimerScenario();

    expect(result.create.turnTimer.active).toBe(false);

    expect(result.join.turnTimer.active).toBe(true);
    expect(result.join.turnTimer.limitSeconds).toBe(120);
    expect(result.join.turnTimer.turnSeatKey).toBe('black');
    expect(Number(result.join.turnTimer.turnDeadlineAt)).toBeGreaterThan(Number(result.join.serverTime));
  });

  test('手番期限切れ時はサーバー側で自動的に手番が進む', () => {
    const result = runTimeoutPassScenario();
    const internalSnapshot = result.internalSnapshot;

    expect(result.status).toBe(200);
    expect(result.statePayload && result.statePayload.ok).toBe(true);
    expect(result.statePayload.stateVersion).toBe(5);
    expect(internalSnapshot.gameState.currentPlayer).toBe(-1);
    expect(internalSnapshot.gameState.consecutivePasses).toBe(1);
    expect(internalSnapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(internalSnapshot.cardState.selectedCardId).toBeNull();
    expect(internalSnapshot.cardState.selectedCardOwnerKey).toBeNull();
    expect(internalSnapshot.gameState.__resultShown).toBeUndefined();
    expect(internalSnapshot.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    expect(internalSnapshot.cardState.hands.white).toEqual(['wdraw']);
    expect(internalSnapshot.cardState.decks.white).toEqual([]);
    expect(internalSnapshot.cardState.turnIndex).toBe(11);
    expect(internalSnapshot.cardState.lastTurnStartedFor).toBe('white');
    expect(internalSnapshot.cardState.turnCountByPlayer.white).toBe(3);

    const timer = result.statePayload.turnTimer;
    expect(timer.active).toBe(true);
    expect(timer.limitSeconds).toBe(120);
    expect(timer.turnSeatKey).toBe('white');
    expect(Number(timer.turnDeadlineAt)).toBeGreaterThan(Number(result.statePayload.serverTime));
  });

  test('2人そろってタイマーが有効になったら Durable Object alarm を次の期限へ張る', () => {
    const result = runAlarmScheduleScenario();

    expect(Number(result.scheduledAlarmAt)).toBeGreaterThan(0);
    expect(Number(result.scheduledAlarmAt)).toBe(Number(result.joinPayload.turnTimer.turnDeadlineAt));
  });

  test('alarm 発火だけでも期限切れ手番を進められる', () => {
    const result = runAlarmTimeoutScenario();

    expect(result.stateVersion).toBe(5);
    expect(result.snapshot.gameState.currentPlayer).toBe(-1);
    expect(result.snapshot.gameState.__resultShown).toBeUndefined();
    expect(result.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.snapshot.cardState.selectedCardId).toBeNull();
  });
});
