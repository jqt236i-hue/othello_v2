const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__PUBLISH_SANITIZE_RESULT__';

function runPublishScenario(runner) {
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'publish sanitize runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'publish sanitize runner did not emit result marker');
  }

  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runPublishSanitizeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMX',",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    acceptedOperationsBySeat: {},",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['condemn_will'], white: ['gold_stone', 'silver_stone'] },",
    "        discard: [],",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: []",
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
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMX',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 4,",
    "    operationId: 'op_sanitize_1',",
    "    actionType: 'use_card',",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 8, __resultShown: true, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['condemn_will'], white: ['__hidden_hand__:white:0', '__hidden_hand__:white:1'] },",
    "        discard: ['__hidden_hand__:white:1'],",
    "        selectedCardId: '__hidden_hand__:white:0',",
    "        pendingEffectByPlayer: {",
    "          black: {",
    "            type: 'CONDEMN_WILL',",
    "            stage: 'selectTarget',",
    "            offers: [{ handIndex: 0, cardId: '__hidden_hand__:white:0' }]",
    "          },",
    "          white: null",
    "        },",
    "        presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],",
    "        _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }]",
    "      }",
    "    }",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    internalCardState: durableObject.room.snapshot.cardState,",
    "    internalGameState: durableObject.room.snapshot.gameState",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runPublishRejectOpponentHandScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMY',",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['condemn_will'], white: ['gold_stone', 'silver_stone'] },",
    "        discard: [],",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: []",
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
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMY',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 4,",
    "    operationId: 'op_reject_1',",
    "    actionType: 'place',",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['condemn_will'], white: ['visible_enemy_card'] },",
    "        discard: [],",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: []",
    "      }",
    "    }",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    internalCardState: durableObject.room.snapshot.cardState",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runPublishTurnStartReconcileScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMZ',",
    "    seed: 1,",
    "    stateVersion: 8,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['b0'], white: [] },",
    "        decks: { black: [], white: ['wdraw'] },",
    "        discard: [],",
    "        turnIndex: 10,",
    "        lastTurnStartedFor: 'black',",
    "        turnCountByPlayer: { black: 3, white: 2 },",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: true },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        pendingEffectByPlayer: { black: null, white: null },",
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
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMZ',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 8,",
    "    operationId: 'op_turn_start_1',",
    "    actionType: 'place',",
    "    snapshot: {",
    "      gameState: { currentPlayer: -1, turnNumber: 9, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['b0'], white: [] },",
    "        decks: { black: [], white: ['wdraw'] },",
    "        discard: [],",
    "        turnIndex: 10,",
    "        lastTurnStartedFor: 'black',",
    "        turnCountByPlayer: { black: 3, white: 2 },",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: true },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        pendingEffectByPlayer: { black: null, white: null },",
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
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    internalCardState: durableObject.room.snapshot.cardState,",
    "    internalGameState: durableObject.room.snapshot.gameState",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

describe('match worker publish sanitize', () => {
  test('rehydrates hidden tokens and drops transient playback queues', () => {
    const result = runPublishSanitizeScenario();
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(cardState.hands.white).toEqual(['gold_stone', 'silver_stone']);
    expect(cardState.discard).toEqual(['silver_stone']);
    expect(cardState.selectedCardId).toBe('gold_stone');
    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([{ handIndex: 0, cardId: 'gold_stone' }]);
    expect(cardState.presentationEvents).toEqual([]);
    expect(cardState._presentationEventsPersist).toEqual([]);
    expect(result.internalGameState.__resultShown).toBeUndefined();
  });

  test('rejects explicit opponent hand cards from client snapshots', () => {
    const result = runPublishRejectOpponentHandScenario();

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('INVALID_OPPONENT_HAND_STATE');
    expect(result.internalCardState.hands.white).toEqual(['gold_stone', 'silver_stone']);
  });

  test('reconciles missed turn-start bookkeeping before persisting publish state', () => {
    const result = runPublishTurnStartReconcileScenario();
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.payload.stateVersion).toBe(9);
    expect(result.internalGameState.currentPlayer).toBe(-1);
    expect(cardState.hands.white).toEqual(['wdraw']);
    expect(cardState.decks.white).toEqual([]);
    expect(cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    expect(cardState.turnIndex).toBe(11);
    expect(cardState.lastTurnStartedFor).toBe('white');
    expect(cardState.turnCountByPlayer.white).toBe(3);
  });
});
