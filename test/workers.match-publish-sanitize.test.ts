import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

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

function runHandSkinUpdateScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMH',",
    "    seed: 1,",
    "    stateVersion: 1,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    seatHandSkins: { black: 'gacha__n__hand-swap', white: 'gacha__n__小鬼の手' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, turnNumber: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {}",
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
    "  durableObject.broadcastPresence = async (meta) => { broadcastMeta = meta; };",
    "  const response = await durableObject.handleHandSkin({",
    "    roomId: 'ROOMH',",
    "    seatKey: 'white',",
    "    seatToken: 'token_white',",
    "    selectedHandSkinId: 'gacha__n__hand.png'",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    broadcastMeta,",
    "    seatHandSkins: durableObject.room.seatHandSkins",
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

function runCommandPublishPendingPlaceScenario(pendingType, options = {}) {
  const row = Number.isInteger(options.row) ? options.row : 2;
  const col = Number.isInteger(options.col) ? options.col : 3;
  const roomId = typeof options.roomId === 'string' && options.roomId ? options.roomId : 'ROOMP';
  const operationId = typeof options.operationId === 'string' && options.operationId ? options.operationId : `op_${String(pendingType).toLowerCase()}_1`;
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    `  const pendingType = ${JSON.stringify(pendingType)};`,
    `  const row = ${JSON.stringify(row)};`,
    `  const col = ${JSON.stringify(col)};`,
    `  const roomId = ${JSON.stringify(roomId)};`,
    `  const operationId = ${JSON.stringify(operationId)};`,
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
    "    roomId,",
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
    "    roomId,",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 0,",
    "    operationId,",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row, col },",
    "    turnIndex,",
    "    action: { type: 'place', playerKey: 'black', row, col, turnIndex }",
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

function runCommandPublishSniperTurnStartScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(17);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));",
    "  gameState.board[0][0] = Core.BLACK;",
    "  gameState.board[0][2] = Core.WHITE;",
    "  gameState.board[3][3] = Core.BLACK;",
    "  gameState.board[3][4] = Core.WHITE;",
    "  gameState.currentPlayer = Core.WHITE;",
    "  gameState.turnNumber = 12;",
    "  gameState.consecutivePasses = 0;",
    "  cardState.turnIndex = 12;",
    "  cardState.pendingEffectByPlayer = { black: null, white: null };",
    "  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };",
    "  cardState.lastUsedCardByPlayer = { black: null, white: null };",
    "  cardState.markers = [{",
    "    id: 9001,",
    "    kind: 'specialStone',",
    "    row: 0,",
    "    col: 0,",
    "    owner: 'black',",
    "    data: { type: 'SNIPER', remainingOwnerTurns: 6 }",
    "  }];",
    "  const room = {",
    "    roomId: 'ROOMS',",
    "    seed: 17,",
    "    stateVersion: 12,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'white', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: { gameState, cardState, stateVersion: 12, updatedAt: Date.now() }",
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
    "    roomId: 'ROOMS',",
    "    seatKey: 'white',",
    "    playerKey: 'white',",
    "    seatToken: 'token_white',",
    "    baseVersion: 12,",
    "    operationId: 'op_sniper_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'white',",
    "    params: { row: 3, col: 2 },",
    "    turnIndex: 12,",
    "    action: { type: 'place', playerKey: 'white', row: 3, col: 2, turnIndex: 12 }",
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

function runCommandPublishDebugFillScenario(networkDebugEnabled, seatKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const serializedOptions = JSON.stringify(opts);
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    `  const networkDebugEnabled = ${networkDebugEnabled ? 'true' : 'false'};`,
    `  const seatKey = ${JSON.stringify(seatKey || 'white')};`,
    `  const options = ${serializedOptions};`,
    "  const nowMs = Date.now();",
    "  const initialTurnStartedAt = nowMs - 1000;",
    "  const initialTurnDeadlineAt = nowMs + 120000;",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(17);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.hands = { black: [], white: [] };",
    "  cardState.discard = [];",
    "  cardState.presentationEvents = [];",
    "  cardState._presentationEventsPersist = [];",
    "  cardState.debugHandFilled = false;",
    "  cardState.debugNoDraw = false;",
    "  const room = {",
    "    roomId: 'ROOMD',",
    "    seed: 17,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    networkDebugEnabled,",
    "    turnTimer: { limitSeconds: 120, active: true, turnSeatKey: 'black', turnStartedAt: initialTurnStartedAt, turnDeadlineAt: initialTurnDeadlineAt },",
    "    acceptedOperationsBySeat: {},",
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
    "    roomId: 'ROOMD',",
    "    seatKey,",
    "    playerKey: seatKey,",
    "    seatToken: seatKey === 'white' ? 'token_white' : 'token_black',",
    "    baseVersion: 0,",
    "    operationId: `op_debug_fill_${seatKey}` ,",
    "    actionType: 'debug_fill_hand',",
    "    actor: seatKey,",
    "    params: options.params || {},",
    "    action: Object.assign({ type: 'debug_fill_hand', playerKey: seatKey }, options.action || {})",
    "  });",
    "  const payload = await response.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    status: response.status,",
    "    payload,",
    "    broadcastMeta,",
    "    internalCardState: durableObject.room.snapshot.cardState,",
    "    internalTurnTimer: durableObject.room.turnTimer,",
    "    expectedTurnTimer: { active: true, turnSeatKey: 'black', turnStartedAt: initialTurnStartedAt, turnDeadlineAt: initialTurnDeadlineAt }",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runPublishVersionMismatchScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMM',",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    roomDeck: null,",
    "    networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: {",
    "      stateVersion: 4,",
    "      updatedAt: Date.now(),",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: { hands: { black: [], white: [] }, discard: [], pendingEffectByPlayer: { black: null, white: null }, presentationEvents: [], _presentationEventsPersist: [] }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key) } };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const response = await durableObject.handlePublish({",
    "    roomId: 'ROOMM',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 3,",
    "    operationId: 'op_vm_1',",
    "    actionType: 'place'",
    "  });",
    "  const payload = await response.json();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ status: response.status, payload }));`,
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runPublishMissingOperationIdScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMO',",
    "    stateVersion: 6,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    acceptedOperationsBySeat: {},",
    "    snapshot: {",
    "      stateVersion: 6,",
    "      gameState: { currentPlayer: 1, turnNumber: 8, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: [], white: [] },",
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
    "    roomId: 'ROOMO',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 6,",
    "    actionType: 'place'",
    "  });",
    "  const payload = await response.json();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ status: response.status, payload }));`,
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runTimeStopGuardianCommandChainScenario() {
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
    "  const prng = SeededPRNG.createPRNG(13);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.pendingEffectByPlayer.black = { type: 'GUARDIAN_GOD', stage: 'selectTarget', cardId: 'guardian_card' };",
    "  cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };",
    "  cardState.hasUsedCardThisTurnByPlayer.black = true;",
    "  const initialTurnIndex = typeof cardState.turnIndex === 'number' ? cardState.turnIndex : 1;",
    "  const room = {",
    "    roomId: 'ROOMTG',",
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
    "  const guardResponse = await durableObject.handlePublish({",
    "    roomId: 'ROOMTG',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 8,",
    "    operationId: 'op_guard_select',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { player: 'black', guardTarget: { row: 3, col: 4 } },",
    "    turnIndex: initialTurnIndex,",
    "    action: { type: 'place', playerKey: 'black', guardTarget: { row: 3, col: 4 }, turnIndex: initialTurnIndex }",
    "  });",
    "  const guardPayload = await guardResponse.json();",
    "  const afterGuard = JSON.parse(JSON.stringify({",
    "    status: guardResponse.status,",
    "    payload: guardPayload,",
    "    gameState: durableObject.room.snapshot.gameState,",
    "    cardState: durableObject.room.snapshot.cardState,",
    "    turnTimer: durableObject.room.turnTimer,",
    "    broadcastMeta",
    "  }));",
    "  broadcastMeta = null;",
    "  const placeTurnIndex = (durableObject.room.snapshot.cardState && typeof durableObject.room.snapshot.cardState.turnIndex === 'number')",
    "    ? durableObject.room.snapshot.cardState.turnIndex",
    "    : initialTurnIndex;",
    "  const placeResponse = await durableObject.handlePublish({",
    "    roomId: 'ROOMTG',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: durableObject.room.stateVersion,",
    "    operationId: 'op_final_place',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: placeTurnIndex,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: placeTurnIndex }",
    "  });",
    "  const placePayload = await placeResponse.json();",
    "  const afterPlace = JSON.parse(JSON.stringify({",
    "    status: placeResponse.status,",
    "    payload: placePayload,",
    "    gameState: durableObject.room.snapshot.gameState,",
    "    cardState: durableObject.room.snapshot.cardState,",
    "    turnTimer: durableObject.room.turnTimer,",
    "    broadcastMeta",
    "  }));",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ afterGuard, afterPlace }));`,
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

function runChargeDeltaReplayScenario() {
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
    "  const prng = SeededPRNG.createPRNG(19);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  const initialTurnIndex = typeof cardState.turnIndex === 'number' ? cardState.turnIndex : 1;",
    "  const room = {",
    "    roomId: 'ROOMQ',",
    "    seed: 19,",
    "    stateVersion: 1,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    roomDeck: null,",
    "    networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: true, turnSeatKey: 'black', turnStartedAt: Date.now(), turnDeadlineAt: Date.now() + 120000 },",
    "    acceptedOperationsBySeat: {},",
    "    snapshot: { gameState, cardState, stateVersion: 1, updatedAt: Date.now() }",
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
    "  const firstResponse = await durableObject.handlePublish({",
    "    roomId: 'ROOMQ',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 1,",
    "    operationId: 'op_charge_black_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: initialTurnIndex,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: initialTurnIndex }",
    "  });",
    "  const firstPayload = await firstResponse.json();",
    "  const afterFirst = JSON.parse(JSON.stringify({",
    "    status: firstResponse.status,",
    "    payload: firstPayload,",
    "    cardState: durableObject.room.snapshot.cardState,",
    "    broadcastMeta",
    "  }));",
    "  broadcastMeta = null;",
    "  const secondTurnIndex = (durableObject.room.snapshot.cardState && typeof durableObject.room.snapshot.cardState.turnIndex === 'number')",
    "    ? durableObject.room.snapshot.cardState.turnIndex",
    "    : initialTurnIndex;",
    "  const secondResponse = await durableObject.handlePublish({",
    "    roomId: 'ROOMQ',",
    "    seatKey: 'white',",
    "    playerKey: 'white',",
    "    seatToken: 'token_white',",
    "    baseVersion: durableObject.room.stateVersion,",
    "    operationId: 'op_charge_white_1',",
    "    actionType: 'place',",
    "    actor: 'white',",
    "    params: { row: 2, col: 4 },",
    "    turnIndex: secondTurnIndex,",
    "    action: { type: 'place', playerKey: 'white', row: 2, col: 4, turnIndex: secondTurnIndex }",
    "  });",
    "  const secondPayload = await secondResponse.json();",
    "  await durableObject.loadRoom();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    afterFirst,",
    "    afterSecond: {",
    "      status: secondResponse.status,",
    "      payload: secondPayload,",
    "      cardState: durableObject.room.snapshot.cardState,",
    "      broadcastMeta",
    "    }",
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

  test('hand skin update persists seatHandSkins and broadcasts presence meta', () => {
    const result = runHandSkinUpdateScenario();

    expect(result.status).toBe(200);
    expect(result.payload.seatHandSkins).toEqual({
      black: 'gacha__n__陽気な手',
      white: 'gacha__n__人の手'
    });
    expect(result.broadcastMeta).toEqual({
      type: 'hand_skin',
      seatKey: 'white',
      rejoined: false
    });
    expect(result.seatHandSkins).toEqual({
      black: 'gacha__n__陽気な手',
      white: 'gacha__n__人の手'
    });
  });

  test('command publishでも missed turn-start bookkeeping を補完して永続化する', () => {
    const result = runPublishTurnStartReconcileScenario();
    const cardState = result.internalCardState;
    const playbackEvents = Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)
      ? result.broadcastMeta.playbackEvents
      : [];
    const handAddEvents = playbackEvents.filter((event) => event && event.type === 'hand_add');
    const otherEvents = playbackEvents.filter((event) => event && event.type !== 'hand_add');
    const maxOtherPhase = otherEvents.reduce((maxPhase, event) => {
      const phase = Number(event && event.phase);
      return Number.isFinite(phase) && phase > maxPhase ? phase : maxPhase;
    }, 0);

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
    expect(playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'hand_add' })
    ]));
    expect(handAddEvents.length).toBeGreaterThan(0);
    expect(handAddEvents.every((event) => Number(event && event.phase) > maxOtherPhase)).toBe(true);
    expect(playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'HAND_ADD' }),
      expect.objectContaining({ type: 'CHANGE' }),
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('accepts command publish payload without snapshot fallback', () => {
    const result = runCommandPublishPlaceScenario();
    const playbackEvents = Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)
      ? result.broadcastMeta.playbackEvents
      : [];

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.payload.stateVersion).toBe(1);
    expect(result.internalGameState.board[2][3]).toBe(1);
    expect(result.internalGameState.currentPlayer).toBe(-1);
    expect(result.internalCardState.turnIndex).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spawn',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 2,
            col: 3,
            reason: 'standard_place'
          })
        ])
      }),
      expect.objectContaining({
        type: 'flip',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 3,
            col: 3,
            reason: 'standard_flip'
          })
        ])
      }),
      expect.objectContaining({
        type: 'observer_bubble',
        rawType: 'CHARGE_BUBBLE',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 2,
            col: 3,
            owner: 'black',
            gained: 1,
            bubbleKind: 'charge',
            sourceType: 'placement_flip_gain'
          })
        ])
      })
    ]));
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'CHARGE_BUBBLE' }),
      expect.objectContaining({ type: 'SPAWN' }),
      expect.objectContaining({ type: 'CHANGE' }),
      expect.objectContaining({ type: 'CARD_USED' }),
      expect.objectContaining({ type: 'HAND_REMOVE' }),
      expect.objectContaining({ type: 'DESTROY' })
    ]));
  });

  test('second worker publish snapshot does not replay stale charge delta events from the previous turn', () => {
    const result = runChargeDeltaReplayScenario();

    expect(result.afterFirst.status).toBe(200);
    expect(result.afterFirst.payload.snapshot.cardState.chargeDeltaEvents).toEqual([
      expect.objectContaining({ player: 'black', delta: 1 })
    ]);

    expect(result.afterSecond.status).toBe(200);
    expect(result.afterSecond.payload.snapshot.cardState.chargeDeltaEvents).toHaveLength(1);
    expect(result.afterSecond.payload.snapshot.cardState.chargeDeltaEvents).toEqual([
      expect.objectContaining({ player: 'white', delta: 1 })
    ]);
    expect(result.afterSecond.cardState.chargeDeltaEvents).toEqual([]);
  });

function runTimeStopDeityScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(43);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  cardState.markers = [{",
    "    id: 9301,",
    "    kind: 'specialStone',",
    "    row: 3,",
    "    col: 4,",
    "    owner: 'black',",
    "    data: { type: 'TIME_STOP_DEITY', remainingOwnerTurns: 1 }",
    "  }];",
    "  cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 4, white: 0 };",
    "  cardState.presentationEvents = [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }];",
    "  cardState._presentationEventsPersist = [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }];",
    "  cardState.hands = { black: ['b1'], white: ['__hidden_hand__:white:0'] };",
    "  cardState.discard = ['__hidden_hand__:white:0'];",
    "  const room = {",
    "    roomId: 'ROOMTD',",
    "    seed: 43,",
    "    stateVersion: 5,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    snapshot: { gameState, cardState, stateVersion: 5, updatedAt: Date.now() }",
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
    "    roomId: 'ROOMTD',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 5,",
    "    operationId: 'op_td_sanitize',",
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
    "    internalCardState: durableObject.room.snapshot.cardState",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

  test('time stop extra turn survives guardian selection and hands off to white after the follow-up place', () => {
    const result = runTimeStopGuardianCommandChainScenario();

    expect(result.afterGuard.status).toBe(200);
    expect(result.afterGuard.payload.ok).toBe(true);
    expect(result.afterGuard.gameState.currentPlayer).toBe(1);
    expect(result.afterGuard.gameState.turnNumber).toBe(0);
    expect(result.afterGuard.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.afterGuard.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
    expect(result.afterGuard.cardState.lastTurnStartedFor).toBe('black');
    expect(result.afterGuard.turnTimer.turnSeatKey).toBe('black');

    expect(result.afterPlace.status).toBe(200);
    expect(result.afterPlace.payload.ok).toBe(true);
    expect(result.afterPlace.gameState.currentPlayer).toBe(-1);
    expect(result.afterPlace.gameState.turnNumber).toBe(1);
    expect(result.afterPlace.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 0, white: 0 });
    expect(result.afterPlace.cardState.lastTurnStartedFor).toBe('white');
    expect(result.afterPlace.turnTimer.turnSeatKey).toBe('white');
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

  test('command publish with FREE_PLACEMENT accepts zero-flip placement in authority stream', () => {
    const result = runCommandPublishPendingPlaceScenario('FREE_PLACEMENT', {
      row: 0,
      col: 0,
      roomId: 'ROOMF',
      operationId: 'op_free_placement_1'
    });
    const cardState = result.internalCardState;

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.internalGameState.board[0][0]).toBe(1);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'place_hand_animation',
        targets: expect.arrayContaining([
          expect.objectContaining({ r: 0, col: 0, player: 'black', owner: 'black' })
        ])
      })
    ]));
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ type: 'destroy' })
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
        data: expect.objectContaining({ type: 'BREEDING', remainingOwnerTurns: 5 })
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

  test('sniper marker survives into next owner turn and decrements in network authority flow', () => {
    const result = runCommandPublishSniperTurnStartScenario();
    const cardState = result.internalCardState;
    const sniperMarker = cardState.markers.find((marker) => marker && marker.id === 9001);

    expect(result.status).toBe(200);
    expect(result.payload.ok).toBe(true);
    expect(result.internalGameState.currentPlayer).toBe(1);
    expect(result.internalGameState.board[3][2]).toBe(-1);
    expect(result.internalGameState.board[0][2]).toBe(0);
    expect(sniperMarker).toBeTruthy();
    expect(sniperMarker.data).toMatchObject({ type: 'SNIPER', remainingOwnerTurns: 5 });
    expect(Array.isArray(result.broadcastMeta && result.broadcastMeta.playbackEvents)).toBe(true);
    expect(result.broadcastMeta.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({ r: 0, col: 2, reason: 'sniper_shot' })
        ])
      })
    ]));
  });

  test('network debug room でも debug fill hand command を公開 publish では拒否する', () => {
    const result = runCommandPublishDebugFillScenario(true, 'black');

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('NETWORK_DEBUG_DISABLED');
    expect(result.internalCardState.hands.black).toEqual([]);
    expect(result.internalCardState.hands.white).toEqual([]);
    expect(result.internalCardState.debugHandFilled).toBe(false);
    expect(result.internalCardState.debugNoDraw).toBe(false);
    expect(result.broadcastMeta).toBeNull();
    expect(result.internalTurnTimer).toMatchObject(result.expectedTurnTimer);
  });

  test('network debug room でも requested cards の debug fill hand command は状態を変更しない', () => {
    const result = runCommandPublishDebugFillScenario(true, 'black', {
      params: {
        cardIds: ['condemn_01'],
        replaceExisting: true
      },
      action: {
        cardIds: ['condemn_01'],
        replaceExisting: true
      }
    });

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('NETWORK_DEBUG_DISABLED');
    expect(result.internalCardState.hands.black).toEqual([]);
    expect(result.internalCardState.hands.white).toEqual([]);
    expect(result.internalCardState.debugHandFilled).toBe(false);
    expect(result.internalCardState.debugNoDraw).toBe(false);
  });

  test('network debug room でない場合は debug fill hand command を拒否する', () => {
    const result = runCommandPublishDebugFillScenario(false, 'black');

    expect(result.status).toBe(409);
    expect(result.payload.ok).toBe(false);
    expect(result.payload.rejectedReason).toBe('NETWORK_DEBUG_DISABLED');
    expect(result.internalCardState.hands.black).toEqual([]);
    expect(result.internalCardState.hands.white).toEqual([]);
    expect(result.broadcastMeta).toBeNull();
  });

  test('VERSION_AHEAD response keeps room context and shared publishMeta shape', () => {
    const result = runPublishVersionMismatchScenario();

    expect(result.status).toBe(409);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      roomId: 'ROOMM',
      rejectedReason: 'VERSION_AHEAD',
      roomDeck: null,
      networkDebugEnabled: false,
      snapshot: expect.any(Object),
      seats: expect.any(Object),
      seatNames: expect.any(Object),
      turnTimer: expect.any(Object),
      publishMeta: expect.objectContaining({
        kind: 'rejected',
        operationId: 'op_vm_1',
        actionType: 'place',
        receivedBaseVersion: 3,
        authoritativeStateVersion: 4,
        rejectedReason: 'VERSION_AHEAD'
      })
    }));
    expect(result.payload.snapshot._meta).toEqual(expect.objectContaining({
      authority: 'server',
      version: 4,
      projectedForSeat: 'black',
      turnStartReconciled: true
    }));
  });

  test('missing operationId publish is rejected with shared publishMeta shape', () => {
    const result = runPublishMissingOperationIdScenario();

    expect(result.status).toBe(409);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      roomId: 'ROOMO',
      rejectedReason: 'OPERATION_ID_REQUIRED',
      roomDeck: null,
      networkDebugEnabled: false,
      snapshot: expect.any(Object),
      seats: expect.any(Object),
      seatNames: expect.any(Object),
      turnTimer: expect.any(Object),
      publishMeta: expect.objectContaining({
        kind: 'rejected',
        operationId: '',
        actionType: 'place',
        receivedBaseVersion: 6,
        authoritativeStateVersion: 6,
        rejectedReason: 'OPERATION_ID_REQUIRED'
      })
    }));
    expect(result.payload.snapshot._meta).toEqual(expect.objectContaining({
      authority: 'server',
      version: 6,
      projectedForSeat: 'black',
      turnStartReconciled: true
    }));
  });

});
