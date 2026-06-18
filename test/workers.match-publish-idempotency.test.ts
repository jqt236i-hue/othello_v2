import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'publish idempotency runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runPublishIdempotencyScenario() {
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
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(11);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'IDP1',",
    "    playerName: 'くろ',",
    "    seed: 11,",
    "    snapshot: {",
    "      gameState,",
    "      cardState,",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const operationId = 'op_retry_fixed_1';",
    "  const publishBody = {",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId,",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 1",
    "  };",
    "",
    "  const firstResponse = await durableObject.handlePublish(publishBody);",
    "  const firstPayload = await firstResponse.json();",
    "",
    "  const secondResponse = await durableObject.handlePublish(publishBody);",
    "  const secondPayload = await secondResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    first: { status: firstResponse.status, payload: firstPayload },",
    "    second: { status: secondResponse.status, payload: secondPayload },",
    "    finalStateVersion: durableObject.room ? durableObject.room.stateVersion : null,",
    "    finalBoard: durableObject.room && durableObject.room.snapshot && durableObject.room.snapshot.gameState",
    "      ? durableObject.room.snapshot.gameState.board",
    "      : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runCommandPublishIdempotencyScenario() {
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
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(11);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'IDC1',",
    "    playerName: 'くろ',",
    "    seed: 11,",
    "    snapshot: {",
    "      gameState,",
    "      cardState,",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const operationId = 'op_command_retry_fixed_1';",
    "  const publishBody = {",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId,",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: 1,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 1 }",
    "  };",
    "",
    "  const firstResponse = await durableObject.handlePublish(publishBody);",
    "  const firstPayload = await firstResponse.json();",
    "",
    "  const secondResponse = await durableObject.handlePublish(publishBody);",
    "  const secondPayload = await secondResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    first: { status: firstResponse.status, payload: firstPayload },",
    "    second: { status: secondResponse.status, payload: secondPayload },",
    "    finalStateVersion: durableObject.room ? durableObject.room.stateVersion : null,",
    "    finalBoard: durableObject.room && durableObject.room.snapshot && durableObject.room.snapshot.gameState",
    "      ? durableObject.room.snapshot.gameState.board",
    "      : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runAutoPassIdempotencyScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const gameState = Core.createGameState();",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  gameState.currentPlayer = 1;",
    "  gameState.consecutivePasses = 0;",
    "  const prng = SeededPRNG.createPRNG(17);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  cardState.turnIndex = 5;",
    "  cardState.hands = { black: [], white: [] };",
    "  cardState.decks = { black: [], white: [] };",
    "  cardState.deck = [];",
    "  cardState._deckCopyIdsByPlayer = { black: [], white: [] };",
    "  cardState.charge = { black: 0, white: 0 };",
    "  cardState.pendingEffectByPlayer = { black: null, white: null };",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'IDP4',",
    "    playerName: 'くろ',",
    "    seed: 17,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishBody = {",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_worker_auto_pass_replay_1',",
    "    actionType: 'pass',",
    "    actor: 'black',",
    "    params: { autoNoActionPass: true },",
    "    turnIndex: 5,",
    "    action: {",
    "      type: 'pass',",
    "      playerKey: 'black',",
    "      turnIndex: 5,",
    "      autoNoActionPass: true",
    "    }",
    "  };",
    "  const firstResponse = await durableObject.handlePublish(publishBody);",
    "  const firstPayload = await firstResponse.json();",
    "  const secondResponse = await durableObject.handlePublish(publishBody);",
    "  const secondPayload = await secondResponse.json();",
    "  process.stdout.write(JSON.stringify({",
    "    first: { status: firstResponse.status, payload: firstPayload },",
    "    second: { status: secondResponse.status, payload: secondPayload }",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runHistoricalReplayScenario() {
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
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(11);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'IDH1',",
    "    playerName: 'くろ',",
    "    seed: 11,",
    "    snapshot: {",
    "      gameState,",
    "      cardState,",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  await durableObject.loadRoom();",
    "  durableObject.room.seats.white = true;",
    "  durableObject.room.seatNames.white = 'しろ';",
    "  durableObject.room.seatTokens.white = 'token_white';",
    "  await durableObject.saveRoom();",
    "",
    "  const getPlayer = (seatKey) => seatKey === 'white' ? -1 : 1;",
    "  const buildBody = (snapshot, seatKey, seatToken, operationId) => {",
    "    const legalMoves = Core.getLegalMoves(snapshot.gameState, getPlayer(seatKey));",
    "    if (!Array.isArray(legalMoves) || legalMoves.length === 0) {",
    "      throw new Error(`no legal moves for ${seatKey}`);",
    "    }",
    "    const move = legalMoves[0];",
    "    return {",
    "      seatKey,",
    "      playerKey: seatKey,",
    "      seatToken,",
    "      baseVersion: durableObject.room.stateVersion,",
    "      operationId,",
    "      actionType: 'place',",
    "      actor: seatKey,",
    "      params: { row: move.row, col: move.col },",
    "      turnIndex: snapshot && snapshot.cardState ? snapshot.cardState.turnIndex : 0",
    "    };",
    "  };",
    "",
    "  const firstBlackBody = buildBody(durableObject.room.snapshot, 'black', createPayload.seatToken, 'op_history_black_1');",
    "  const firstBlackResponse = await durableObject.handlePublish(firstBlackBody);",
    "  const firstBlackPayload = await firstBlackResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "  const whiteBody = buildBody(durableObject.room.snapshot, 'white', 'token_white', 'op_history_white_1');",
    "  const whiteResponse = await durableObject.handlePublish(whiteBody);",
    "  const whitePayload = await whiteResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "  const secondBlackBody = buildBody(durableObject.room.snapshot, 'black', createPayload.seatToken, 'op_history_black_2');",
    "  const secondBlackResponse = await durableObject.handlePublish(secondBlackBody);",
    "  const secondBlackPayload = await secondBlackResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "  const replayResponse = await durableObject.handlePublish(firstBlackBody);",
    "  const replayPayload = await replayResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "  process.stdout.write(JSON.stringify({",
    "    firstBlack: { status: firstBlackResponse.status, payload: firstBlackPayload },",
    "    white: { status: whiteResponse.status, payload: whitePayload },",
    "    secondBlack: { status: secondBlackResponse.status, payload: secondBlackPayload },",
    "    replay: { status: replayResponse.status, payload: replayPayload },",
    "    finalStateVersion: durableObject.room ? durableObject.room.stateVersion : null,",
    "    acceptedOperationHistoryBySeat: durableObject.room ? durableObject.room.acceptedOperationHistoryBySeat : null,",
    "    lastAcceptedOperationBySeat: durableObject.room ? durableObject.room.lastAcceptedOperationBySeat : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartDurationEndScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(17);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  cardState.markers.push({ id: 'freeze_expire_1', kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 1 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'DUR1',",
    "    playerName: 'くろ',",
    "    seed: 17,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_freeze_duration_end_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const markers = durableObject.room && durableObject.room.snapshot && durableObject.room.snapshot.cardState ? durableObject.room.snapshot.cardState.markers || [] : [];",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    remainingFreezeMarkers: markers.filter((marker) => marker && marker.data && marker.data.type === 'FREEZE'),",
    "    finalBoard: durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartWorkIncomeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(19);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  cardState.charge.black = 0;",
    "  cardState.markers.push({ id: 'work_income_1', kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'WORK', ownerColor: 'black', workStage: 2, remainingOwnerTurns: 3 } });",
    "  cardState.workAnchorPosByPlayer = { black: { row: 3, col: 4 }, white: null };",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'WORK1',",
    "    playerName: 'くろ',",
    "    seed: 19,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_work_income_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedCardState = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot.cardState : null;",
    "  const workMarker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((marker) => marker && marker.id === 'work_income_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    chargeBlack: storedCardState && storedCardState.charge ? storedCardState.charge.black : null,",
    "    workMarker,",
    "    finalBoard: durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartDestroyDragonScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(29);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[5][5] = Core.BLACK;",
    "  gameState.board[5][6] = Core.WHITE;",
    "  cardState.markers.push({ id: 'destroy_dragon_1', kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'DDG1',",
    "    playerName: 'くろ',",
    "    seed: 29,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_destroy_dragon_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'destroy_dragon_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartLightningScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(31);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[4][3] = Core.BLACK;",
    "  gameState.board[2][5] = Core.BLACK;",
    "  gameState.board[5][5] = Core.BLACK;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[2][4] = Core.WHITE;",
    "  gameState.board[5][6] = Core.WHITE;",
    "  cardState.markers.push({ id: 'lightning_1', kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'LIGHTNING', remainingOwnerTurns: 6 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'LTN1',",
    "    playerName: 'くろ',",
    "    seed: 31,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_lightning_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'lightning_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartGluttonousScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(37);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[6][6] = Core.BLACK;",
    "  gameState.board[6][7] = Core.WHITE;",
    "  cardState.markers.push({ id: 'gluttonous_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'GLT1',",
    "    playerName: 'くろ',",
    "    seed: 37,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_gluttonous_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'gluttonous_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartWillHunterKingScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(41);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[6][6] = Core.BLACK;",
    "  gameState.board[6][7] = Core.WHITE;",
    "  cardState.markers.push(",
    "    { id: 'will_hunter_king_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'WILL_HUNTER_KING', remainingOwnerTurns: 8, flipEvadeRemaining: 2, destroyEvadeRemaining: 2 } },",
    "    { id: 'lightning_target_1', kind: 'specialStone', row: 6, col: 7, owner: 'white', data: { type: 'LIGHTNING', remainingOwnerTurns: 3 } }",
    "  );",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'WHK1',",
    "    playerName: 'くろ',",
    "    seed: 41,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_will_hunter_king_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'will_hunter_king_1') : null;",
    "  const lightningMarker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'lightning_target_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    lightningMarker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartSniperScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(43);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[6][6] = Core.BLACK;",
    "  gameState.board[6][7] = Core.WHITE;",
    "  cardState.markers.push({ id: 'sniper_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'SNIPER', remainingOwnerTurns: 6 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'SNP1',",
    "    playerName: 'くろ',",
    "    seed: 43,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_sniper_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'sniper_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartRobotVacuumScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(47);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[4][3] = Core.BLACK;",
    "  gameState.board[2][5] = Core.BLACK;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[2][4] = Core.WHITE;",
    "  gameState.board[6][6] = Core.BLACK;",
    "  gameState.board[6][7] = Core.WHITE;",
    "  cardState.markers.push({ id: 'robot_vacuum_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'RVC1',",
    "    playerName: 'くろ',",
    "    seed: 47,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_robot_vacuum_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'robot_vacuum_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartUltimateHyperactiveScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(53);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[2][3] = Core.EMPTY;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[6][0] = Core.BLACK;",
    "  gameState.board[6][2] = Core.WHITE;",
    "  gameState.board[6][3] = Core.EMPTY;",
    "  cardState.markers.push({ id: 'ultimate_hyperactive_1', kind: 'specialStone', row: 6, col: 0, owner: 'black', data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 5, destroyEvadeRemaining: 2 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'UHA1',",
    "    playerName: 'くろ',",
    "    seed: 53,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_ultimate_hyperactive_turn_start_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'ultimate_hyperactive_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartEscapeHyperactiveExplosionScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(59);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[4][3] = Core.BLACK;",
    "  gameState.board[2][5] = Core.BLACK;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[2][4] = Core.WHITE;",
    "  for (let row = 5; row <= 7; row += 1) {",
    "    for (let col = 5; col <= 7; col += 1) {",
    "      gameState.board[row][col] = row === 6 && col === 6 ? Core.BLACK : Core.WHITE;",
    "    }",
    "  }",
    "  cardState.markers.push({ id: 'escape_hyperactive_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'EHE1',",
    "    playerName: 'くろ',",
    "    seed: 59,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_escape_hyperactive_explosion_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'escape_hyperactive_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartExtremeHyperactiveForcedSwapScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(61);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[2][3] = Core.EMPTY;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[6][6] = Core.BLACK;",
    "  gameState.board[5][5] = Core.WHITE;",
    "  for (const [row, col] of [[7, 7], [4, 4], [3, 3], [2, 2], [1, 1], [0, 0]]) {",
    "    gameState.board[row][col] = Core.WHITE;",
    "  }",
    "  cardState.markers.push({ id: 'extreme_hyperactive_1', kind: 'specialStone', row: 6, col: 6, owner: 'black', data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'EHW1',",
    "    playerName: 'くろ',",
    "    seed: 61,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_extreme_hyperactive_forced_swap_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'extreme_hyperactive_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runTurnStartHyperactiveMoveFlipScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const storage = new Map();",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(67);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));",
    "  gameState.currentPlayer = Core.BLACK;",
    "  gameState.turnNumber = 1;",
    "  gameState.board[2][3] = Core.EMPTY;",
    "  gameState.board[3][3] = Core.WHITE;",
    "  gameState.board[6][0] = Core.BLACK;",
    "  gameState.board[6][1] = Core.EMPTY;",
    "  gameState.board[6][2] = Core.WHITE;",
    "  gameState.board[6][3] = Core.BLACK;",
    "  cardState.markers.push({ id: 'hyperactive_1', kind: 'specialStone', row: 6, col: 0, owner: 'black', data: { type: 'HYPERACTIVE', remainingOwnerTurns: 5 } });",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'HPA1',",
    "    playerName: 'くろ',",
    "    seed: 67,",
    "    snapshot: { gameState, cardState }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const publishResponse = await durableObject.handlePublish({",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId: 'op_hyperactive_move_flip_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex: cardState.turnIndex || 0",
    "  });",
    "  const payload = await publishResponse.json();",
    "  await durableObject.loadRoom();",
    "  const storedSnapshot = durableObject.room && durableObject.room.snapshot ? durableObject.room.snapshot : null;",
    "  const storedCardState = storedSnapshot ? storedSnapshot.cardState : null;",
    "  const marker = storedCardState && Array.isArray(storedCardState.markers) ? storedCardState.markers.find((item) => item && item.id === 'hyperactive_1') : null;",
    "  process.stdout.write(JSON.stringify({",
    "    status: publishResponse.status,",
    "    payload,",
    "    marker,",
    "    finalBoard: storedSnapshot ? storedSnapshot.gameState.board : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker publish idempotency', () => {
  test('serialized command payloadの再送は重複適用せず成功応答する', () => {
    const result = runPublishIdempotencyScenario();

    expect(result.first.status).toBe(200);
    expect(result.first.payload && result.first.payload.ok).toBe(true);
    expect(result.first.payload.stateVersion).toBe(1);
    expect(Array.isArray(result.first.payload.playbackEvents)).toBe(true);
    expect(result.first.payload.playbackEvents.length).toBeGreaterThan(0);

    expect(result.second.status).toBe(200);
    expect(result.second.payload && result.second.payload.ok).toBe(true);
    expect(result.second.payload.stateVersion).toBe(1);
    expect(result.second.payload.idempotentReplay).toBe(true);

    expect(result.finalStateVersion).toBe(1);
    expect(Array.isArray(result.finalBoard)).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
  });

  test('command payloadでも同一operationIdの再送は重複適用しない', () => {
    const result = runCommandPublishIdempotencyScenario();

    expect(result.first.status).toBe(200);
    expect(result.first.payload && result.first.payload.ok).toBe(true);
    expect(result.first.payload.stateVersion).toBe(1);
    expect(Array.isArray(result.first.payload.playbackEvents)).toBe(true);
    expect(result.first.payload.playbackEvents.length).toBeGreaterThan(0);

    expect(result.second.status).toBe(200);
    expect(result.second.payload && result.second.payload.ok).toBe(true);
    expect(result.second.payload.stateVersion).toBe(1);
    expect(result.second.payload.idempotentReplay).toBe(true);

    expect(result.finalStateVersion).toBe(1);
    expect(Array.isArray(result.finalBoard)).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
  });

  test('auto pass idempotent replay response preserves auto pass notice metadata', () => {
    const result = runAutoPassIdempotencyScenario();

    expect(result.first.status).toBe(200);
    expect(result.first.payload && result.first.payload.ok).toBe(true);
    expect(result.first.payload.autoPassNotice).toEqual({
      playerKey: 'black',
      reason: 'no_legal_moves_or_usable_cards'
    });

    expect(result.second.status).toBe(200);
    expect(result.second.payload && result.second.payload.ok).toBe(true);
    expect(result.second.payload.idempotentReplay).toBe(true);
    expect(result.second.payload.autoPassNotice).toEqual({
      playerKey: 'black',
      reason: 'no_legal_moves_or_usable_cards'
    });
  });

  test('older accepted operationIdも履歴内ならidempotent replayとして扱う', () => {
    const result = runHistoricalReplayScenario();

    expect(result.firstBlack.status).toBe(200);
    expect(result.firstBlack.payload && result.firstBlack.payload.ok).toBe(true);
    expect(result.firstBlack.payload.stateVersion).toBe(1);

    expect(result.white.status).toBe(200);
    expect(result.white.payload && result.white.payload.ok).toBe(true);
    expect(result.white.payload.stateVersion).toBe(2);

    expect(result.secondBlack.status).toBe(200);
    expect(result.secondBlack.payload && result.secondBlack.payload.ok).toBe(true);
    expect(result.secondBlack.payload.stateVersion).toBe(3);

    expect(result.replay.status).toBe(200);
    expect(result.replay.payload && result.replay.payload.ok).toBe(true);
    expect(result.replay.payload.idempotentReplay).toBe(true);
    expect(result.replay.payload).toEqual(expect.objectContaining({
      ok: true,
      roomId: 'IDH1',
      idempotentReplay: true,
      stateVersion: 3,
      snapshot: expect.any(Object),
      seats: expect.any(Object),
      seatNames: expect.any(Object),
      turnTimer: expect.any(Object),
      publishMeta: expect.objectContaining({
        kind: 'idempotent_replay',
        operationId: 'op_history_black_1',
        actionType: 'place',
        authoritativeStateVersion: 3,
        replayedStateVersion: 1
      })
    }));

    expect(result.finalStateVersion).toBe(3);
    expect(result.acceptedOperationHistoryBySeat.black.map((entry) => entry.operationId)).toEqual([
      'op_history_black_1',
      'op_history_black_2'
    ]);
    expect(result.lastAcceptedOperationBySeat.black).toEqual(expect.objectContaining({
      operationId: 'op_history_black_2',
      stateVersion: 3
    }));
  });

  test('turn-start duration end removes authoritative marker and emits status_removed playback', () => {
    const result = runTurnStartDurationEndScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.remainingFreezeMarkers).toEqual([]);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'status_removed',
        rawType: 'STATUS_REMOVED',
        meta: expect.objectContaining({
          special: 'FREEZE',
          reason: 'duration_end'
        })
      })
    ]));
  });

  test('turn-start work income updates authoritative charge, marker timer, and playback', () => {
    const result = runTurnStartWorkIncomeScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.chargeBlack).toBe(5);
    expect(result.workMarker).toEqual(expect.objectContaining({
      row: 3,
      col: 4,
      owner: 'black',
      data: expect.objectContaining({
        type: 'WORK',
        workStage: 3,
        remainingOwnerTurns: 2
      })
    }));
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'observer_bubble',
        rawType: 'WORK_BUBBLE',
        targets: expect.arrayContaining([
          expect.objectContaining({
            owner: 'black',
            gained: 4,
            incomeStep: 3
          })
        ])
      }),
      expect.objectContaining({
        type: 'log',
        rawType: 'WORK_INCOME',
        meta: expect.objectContaining({ incomeStep: 3 })
      }),
      expect.objectContaining({
        type: 'status_applied',
        rawType: 'STATUS_TICK',
        meta: expect.objectContaining({
          special: 'WORK',
          timer: 2,
          owner: 'black'
        })
      })
    ]));
  });

  test('turn-start destroy dragon destroys adjacent enemy and emits destroy playback', () => {
    const result = runTurnStartDestroyDragonScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[5][6]).toBe(0);
    expect(result.marker).toEqual(expect.objectContaining({
      row: 5,
      col: 5,
      owner: 'black',
      data: expect.objectContaining({
        type: 'DESTROY_DRAGON',
        remainingOwnerTurns: 2
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 5,
            col: 6,
            cause: 'DESTROY_DRAGON_WILL',
            reason: 'destroy_dragon_breath'
          })
        ])
      })
    ]));
  });

  test('turn-start lightning destroys an enemy and emits lightning playback', () => {
    const result = runTurnStartLightningScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.marker).toEqual(expect.objectContaining({
      row: 5,
      col: 5,
      owner: 'black',
      data: expect.objectContaining({
        type: 'LIGHTNING',
        remainingOwnerTurns: 5
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            cause: 'LIGHTNING_WILL',
            reason: 'lightning_destroyed'
          })
        ])
      })
    ]));
  });

  test('turn-start gluttonous eats adjacent enemy, moves, and emits paired playback', () => {
    const result = runTurnStartGluttonousScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.marker).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        type: 'GLUTTONOUS'
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 7,
            cause: 'GLUTTONOUS_WILL',
            reason: 'gluttonous_eat'
          })
        ])
      }),
      expect.objectContaining({
        type: 'move',
        targets: expect.arrayContaining([
          expect.objectContaining({
            to: expect.objectContaining({ r: 6, col: 7 }),
            from: expect.objectContaining({ r: 6, col: 6 }),
            cause: 'GLUTTONOUS_WILL',
            reason: 'gluttonous_eat_move'
          })
        ])
      })
    ]));
  });

  test('turn-start will hunter king prioritizes special enemy, moves, and emits paired playback', () => {
    const result = runTurnStartWillHunterKingScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.finalBoard[6][6]).toBe(0);
    expect(result.finalBoard[6][7]).toBe(1);
    expect(result.lightningMarker).toBeFalsy();
    expect(result.marker).toEqual(expect.objectContaining({
      row: 6,
      col: 7,
      owner: 'black',
      data: expect.objectContaining({
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 7,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 7,
            cause: 'WILL_HUNTER_KING',
            reason: 'will_hunter_king_slash'
          })
        ])
      }),
      expect.objectContaining({
        type: 'move',
        targets: expect.arrayContaining([
          expect.objectContaining({
            to: expect.objectContaining({ r: 6, col: 7 }),
            from: expect.objectContaining({ r: 6, col: 6 }),
            cause: 'WILL_HUNTER_KING',
            reason: 'will_hunter_king_slash_move'
          })
        ])
      })
    ]));
  });

  test('turn-start sniper destroys nearest enemy and emits shot playback metadata', () => {
    const result = runTurnStartSniperScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.finalBoard[6][6]).toBe(1);
    expect(result.finalBoard[6][7]).toBe(0);
    expect(result.marker).toEqual(expect.objectContaining({
      row: 6,
      col: 6,
      owner: 'black',
      data: expect.objectContaining({
        type: 'SNIPER',
        remainingOwnerTurns: 5
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 7,
            cause: 'SNIPER_WILL',
            reason: 'sniper_shot',
            sourceRow: 6,
            sourceCol: 6
          })
        ])
      })
    ]));
  });

  test('turn-start robot vacuum moves, sucks one enemy, and emits suction playback', () => {
    const result = runTurnStartRobotVacuumScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.finalBoard[6][7]).toBe(0);
    expect(result.marker).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        type: 'ROBOT_VACUUM',
        remainingOwnerTurns: 5
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'move',
        targets: expect.arrayContaining([
          expect.objectContaining({
            from: expect.objectContaining({ r: 6, col: 6 }),
            cause: 'ROBOT_VACUUM',
            reason: 'robot_vacuum_move'
          })
        ])
      }),
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 7,
            cause: 'ROBOT_VACUUM',
            reason: 'robot_vacuum_suck'
          })
        ])
      })
    ]));
  });

  test('turn-start ultimate hyperactive jumps, flips, and emits move/flip playback', () => {
    const result = runTurnStartUltimateHyperactiveScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.finalBoard[6][2]).toBe(1);
    expect(result.marker).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        type: 'ULTIMATE_HYPERACTIVE',
        remainingOwnerTurns: 11,
        flipEvadeRemaining: 5,
        destroyEvadeRemaining: 2
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'move',
        targets: expect.arrayContaining([
          expect.objectContaining({
            from: expect.objectContaining({ r: 6, col: 0 }),
            to: expect.objectContaining({ r: 6, col: 3 }),
            cause: 'ULTIMATE_HYPERACTIVE_GOD',
            reason: 'ultimate_hyperactive_step_move'
          })
        ])
      }),
      expect.objectContaining({
        type: 'flip',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 2,
            ownerBefore: 'white',
            ownerAfter: 'black',
            cause: 'ULTIMATE_HYPERACTIVE_GOD',
            reason: 'ultimate_hyperactive_flip'
          })
        ])
      })
    ]));
  });

  test('turn-start escape hyperactive explosion removes 3x3 area in one playback phase', () => {
    const result = runTurnStartEscapeHyperactiveExplosionScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.marker).toBeFalsy();

    for (let row = 5; row <= 7; row += 1) {
      for (let col = 5; col <= 7; col += 1) {
        expect(result.finalBoard[row][col]).toBe(0);
      }
    }

    const escapeDestroyEvents = (result.payload.playbackEvents || []).filter((event) => (
      event &&
      event.type === 'destroy' &&
      Array.isArray(event.targets) &&
      event.targets.some((target) => (
        target &&
        target.cause === 'ESCAPE_HYPERACTIVE' &&
        target.reason === 'escape_no_candidates_explosion'
      ))
    ));
    const escapeDestroyTargets = escapeDestroyEvents.flatMap((event) => (
      (event.targets || []).filter((target) => (
        target &&
        target.cause === 'ESCAPE_HYPERACTIVE' &&
        target.reason === 'escape_no_candidates_explosion'
      ))
    ));

    expect(escapeDestroyTargets).toHaveLength(9);
    expect(new Set(escapeDestroyEvents.map((event) => event.phase)).size).toBe(1);
    expect(escapeDestroyTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ r: 6, col: 6 }),
      expect.objectContaining({ r: 5, col: 5 }),
      expect.objectContaining({ r: 7, col: 7 })
    ]));
  });

  test('turn-start extreme hyperactive forced swap is bundled into one playback move', () => {
    const result = runTurnStartExtremeHyperactiveForcedSwapScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.marker).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        type: 'EXTREME_HYPERACTIVE',
        flipEvadeRemaining: 5,
        destroyEvadeRemaining: 5
      })
    }));

    const forcedSwap = (result.payload.playbackEvents || []).find((event) => (
      event &&
      event.type === 'move' &&
      event.meta &&
      event.meta.sequence === 'extreme_hyperactive_forced_swap'
    ));

    expect(forcedSwap).toBeTruthy();
    expect(forcedSwap.targets).toHaveLength(2);
    expect(forcedSwap.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        extremeForcedSwapRole: 'lead',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        ownerBefore: 'black',
        ownerAfter: 'black',
        after: expect.objectContaining({
          special: 'EXTREME_HYPERACTIVE',
          owner: 'black',
          destroyEvadeRemaining: 5
        })
      }),
      expect.objectContaining({
        extremeForcedSwapRole: 'follow',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        ownerBefore: expect.any(String),
        ownerAfter: expect.any(String)
      })
    ]));
  });

  test('turn-start hyperactive moves, flips, and emits move/flip playback', () => {
    const result = runTurnStartHyperactiveMoveFlipScenario();

    expect(result.status).toBe(200);
    expect(result.payload && result.payload.ok).toBe(true);
    expect(result.finalBoard[2][3]).toBe(1);
    expect(result.marker).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({
        type: 'HYPERACTIVE'
      })
    }));
    expect(result.payload.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'move',
        targets: expect.arrayContaining([
          expect.objectContaining({
            from: expect.objectContaining({ r: 6, col: 0 }),
            to: expect.objectContaining({ r: 6, col: 1 }),
            cause: 'HYPERACTIVE',
            reason: 'hyperactive_move'
          })
        ])
      }),
      expect.objectContaining({
        type: 'flip',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 6,
            col: 2,
            ownerBefore: 'white',
            ownerAfter: 'black',
            cause: 'HYPERACTIVE',
            reason: 'hyperactive_flip'
          })
        ])
      })
    ]));
  });

});
