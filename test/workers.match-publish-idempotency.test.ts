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
    expect(result.replay.payload.stateVersion).toBe(3);
    expect(result.replay.payload.publishMeta).toEqual(expect.objectContaining({
      kind: 'idempotent_replay',
      operationId: 'op_history_black_1',
      replayedStateVersion: 1
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
});
