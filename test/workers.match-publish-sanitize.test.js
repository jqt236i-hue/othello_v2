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
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
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
    "    broadcastMeta,",
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
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
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
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(13);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.hands = { black: ['b0'], white: [] };",
    "  cardState.decks = { black: [], white: ['wdraw'] };",
    "  cardState.discard = [];",
    "  cardState.turnIndex = 10;",
    "  cardState.lastTurnStartedFor = 'black';",
    "  cardState.turnCountByPlayer = { black: 3, white: 2 };",
    "  cardState.hasUsedCardThisTurnByPlayer = { black: true, white: true };",
    "  cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };",
    "  cardState.pendingEffectByPlayer = { black: null, white: null };",
    "  cardState.extraPlaceRemainingByPlayer = { black: 0, white: 0 };",
    "  cardState.charge = { black: 0, white: 0 };",
    "  cardState.chargeGainedTotal = { black: 0, white: 0 };",
    "  cardState.breedingSproutByOwner = { black: [], white: [] };",
    "  cardState._breedingSproutClearedTokenByOwner = { black: null, white: null };",
    "  cardState.presentationEvents = [];",
    "  cardState._presentationEventsPersist = [];",
    "  cardState.markers = [];",
    "  const room = {",
    "    roomId: 'ROOMZ',",
    "    seed: 13,",
    "    stateVersion: 8,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: { gameState, cardState, stateVersion: 8, updatedAt: Date.now() }",
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
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMZ',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 8,",
    "    operationId: 'op_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 10,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 10 }",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    broadcastMeta,",
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

function runCommandPublishPlaceScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(7);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  const room = {",
    "    roomId: 'ROOMC',",
    "    seed: 7,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: { gameState, cardState, stateVersion: 0, updatedAt: Date.now() }",
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
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMC',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 0,",
    "    operationId: 'op_command_place_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 1,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    broadcastMeta,",
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

function runCommandPublishPendingPlaceScenario(pendingType) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    `  const pendingType = ${JSON.stringify(pendingType)};`,
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(7);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.charge = { black: 5, white: 4 };",
    "  cardState.pendingEffectByPlayer.black = { type: pendingType, stage: null };",
    "  cardState.hasUsedCardThisTurnByPlayer.black = true;",
    "  const turnIndex = typeof cardState.turnIndex === 'number' ? cardState.turnIndex : 1;",
    "  const room = {",
    "    roomId: 'ROOMP',",
    "    seed: 7,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: { gameState, cardState, stateVersion: 0, updatedAt: Date.now() }",
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
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMP',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 0,",
    "    operationId: `op_${pendingType.toLowerCase()}_1`,",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex }",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    pendingType,",
    "    status: response.status,",
    "    payload,",
    "    broadcastMeta,",
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
  test('legacy client snapshot publishを拒否し authoritative state を変更しない', () => {
    const result = runPublishSanitizeScenario();
    const cardState = result.internalCardState;

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('COMMAND_REQUIRED');
    expect(cardState.hands.white).toEqual(['gold_stone', 'silver_stone']);
    expect(cardState.discard).toEqual([]);
    expect(cardState.selectedCardId).toBeUndefined();
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.presentationEvents).toEqual([]);
    expect(cardState._presentationEventsPersist).toEqual([]);
    expect(result.broadcastMeta).toBeNull();
  });

  test('legacy snapshot で相手手札を見せる payload も command 必須で拒否する', () => {
    const result = runPublishRejectOpponentHandScenario();

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('COMMAND_REQUIRED');
    expect(result.internalCardState.hands.white).toEqual(['gold_stone', 'silver_stone']);
  });

  test('command publishでも missed turn-start bookkeeping を補完して永続化する', () => {
    const result = runPublishTurnStartReconcileScenario();
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.payload.stateVersion).toBe(9);
    expect(result.internalGameState.currentPlayer).toBe(-1);
    expect(cardState.hands.white).toEqual(['wdraw']);
    expect(cardState.decks.white).toEqual([]);
    expect(cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    expect(cardState.turnIndex).toBeGreaterThan(10);
    expect(cardState.lastTurnStartedFor).toBe('white');
    expect(cardState.turnCountByPlayer.white).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'hand_add' })
    ]));
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'HAND_ADD' }),
      expect.objectContaining({ type: 'CHANGE' }),
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('accepts command publish payload without snapshot fallback', () => {
    const result = runCommandPublishPlaceScenario();

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.payload.stateVersion).toBe(1);
    expect(result.internalGameState.board[2][3]).toBe(1);
    expect(result.internalGameState.currentPlayer).toBe(-1);
    expect(result.internalCardState.turnIndex).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'SPAWN' }),
      expect.objectContaining({ type: 'CHANGE' }),
      expect.objectContaining({ type: 'CARD_USED' }),
      expect.objectContaining({ type: 'HAND_REMOVE' }),
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('command publish with PLUNDER_WILL preserves stolen charge and clears pending effect', () => {
    const result = runCommandPublishPendingPlaceScenario('PLUNDER_WILL');
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.internalGameState.board[2][3]).toBe(1);
    expect(cardState.charge.black).toBe(7);
    expect(cardState.charge.white).toBe(3);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'PLUNDER_WILL' }),
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('command publish with RAINBOW_STONE emits destroy playback and leaves source empty', () => {
    const result = runCommandPublishPendingPlaceScenario('RAINBOW_STONE');
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.internalGameState.board[2][3]).toBe(0);
    expect(cardState.charge.black).toBe(11);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            reason: 'rainbow_stone_sacrifice'
          })
        ])
      })
    ]));
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('command publish with BREEDING_WILL keeps breeding spawn playback in authority stream', () => {
    const result = runCommandPublishPendingPlaceScenario('BREEDING_WILL');
    const cardState = result.internalCardState;
    const board = result.internalGameState.board;
    const blackCount = board.flat().filter((cell) => cell === 1).length;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(blackCount).toBeGreaterThan(4);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({ type: 'BREEDING' })
      })
    ]));
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spawn',
        targets: expect.arrayContaining([
          expect.objectContaining({
            cause: 'BREEDING',
            reason: expect.stringMatching(/^breeding_spawn/)
          })
        ])
      })
    ]));
  });

  test('command publish with SNIPER_WILL keeps sniper destroy playback in authority stream', () => {
    const result = runCommandPublishPendingPlaceScenario('SNIPER_WILL');
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.internalGameState.board[2][3]).toBe(1);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: expect.objectContaining({ type: 'SNIPER' })
      })
    ]));
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            reason: 'sniper_shot'
          })
        ])
      })
    ]));
  });
});
