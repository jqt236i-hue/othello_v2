import * as path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runWorkerAutoTurnScenarios() {
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
    "  const RuntimeErrors = fromRoot('dist/game/logic/card-runtime-errors.js');",
    "",
    "  async function createScenario(roomId, networkAutoEnabled, mutateSnapshot) {",
    "    const storage = new Map();",
    "    const metrics = { storagePuts: 0, broadcasts: 0 };",
    "    const durableObject = new MatchRoomDurableObject({ storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => { metrics.storagePuts += 1; storage.set(key, value); },",
    "      delete: async (key) => storage.delete(key),",
    "      setAlarm: async () => {},",
    "      deleteAlarm: async () => {}",
    "    } });",
    "    durableObject.broadcastSnapshot = async () => { metrics.broadcasts += 1; };",
    "    const prng = SeededPRNG.createPRNG(31);",
    "    const gameState = Core.createGameState();",
    "    const cardState = CardLogic.createCardState(prng);",
    "    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "    if (typeof mutateSnapshot === 'function') mutateSnapshot({ gameState, cardState });",
    "    const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "      roomId, playerName: 'くろ', seed: 31, networkAutoEnabled, snapshot: { gameState, cardState }",
    "    });",
    "    const createPayload = await createResponse.json();",
    "    return { durableObject, storage, createPayload, metrics };",
    "  }",
    "",
    "  async function publishAuto(scenario, operationId, preferredActionType, preferredAction) {",
    "    const turnIndex = scenario.createPayload.snapshot.cardState.turnIndex;",
    "    const response = await scenario.durableObject.handlePublish({",
    "      roomId: scenario.createPayload.roomId,",
    "      seatKey: 'black', playerKey: 'black', seatToken: scenario.createPayload.seatToken,",
    "      baseVersion: scenario.createPayload.stateVersion, operationId,",
    "      actionType: 'auto_turn', actor: 'black', turnIndex,",
    "      action: { type: 'auto_turn', preferredActionType, preferredAction }",
    "    });",
    "    return { status: response.status, payload: await response.json() };",
    "  }",
    "",
    "  async function publishUseCard(scenario, operationId, cardId) {",
    "    const turnIndex = scenario.createPayload.snapshot.cardState.turnIndex;",
    "    const response = await scenario.durableObject.handlePublish({",
    "      roomId: scenario.createPayload.roomId,",
    "      seatKey: 'black', playerKey: 'black', seatToken: scenario.createPayload.seatToken,",
    "      baseVersion: scenario.createPayload.stateVersion, operationId,",
    "      actionType: 'use_card', actor: 'black', turnIndex,",
    "      params: { useCardId: cardId, useCardOwnerKey: 'black', useCardHandIndex: 0 },",
    "      action: {",
    "        type: 'use_card', playerKey: 'black', useCardId: cardId,",
    "        useCardOwnerKey: 'black', useCardHandIndex: 0, turnIndex",
    "      }",
    "    });",
    "    return { status: response.status, payload: await response.json() };",
    "  }",
    "",
    "  const enabled = await createScenario('AUT1', true);",
    "  const enabledResult = await publishAuto(",
    "    enabled, 'op_worker_auto_enabled_1', 'place', { type: 'place', row: 2, col: 3 }",
    "  );",
    "",
    "  const disabled = await createScenario('AUT2', false);",
    "  const disabledResult = await publishAuto(",
    "    disabled, 'op_worker_auto_disabled_1', 'place', { type: 'place', row: 2, col: 3 }",
    "  );",
    "",
    "  const terminal = await createScenario('AUT3', true, ({ gameState }) => {",
    "    gameState.consecutivePasses = 2;",
    "  });",
    "  const terminalResult = await publishAuto(",
    "    terminal, 'op_worker_auto_terminal_1', 'place', { type: 'place', row: 2, col: 3 }",
    "  );",
    "",
    "  const canonicalCard = await createScenario('AUT4', true, ({ gameState, cardState }) => {",
    "    const board = Array.from({ length: 8 }, () => Array(8).fill(-1));",
    "    board[0][0] = 0;",
    "    board[0][1] = 1;",
    "    gameState.board = board;",
    "    gameState.currentPlayer = 1;",
    "    gameState.consecutivePasses = 0;",
    "    gameState.resultShown = false;",
    "    cardState.hands.black = [];",
    "    cardState._handCopyIdsByPlayer.black = [];",
    "    cardState.cardCostOverridesByCopyId = {};",
    "    cardState.cardCostModifiersByCopyId = {};",
    "    cardState.charge.black = 0;",
    "    cardState.pendingEffectByPlayer.black = null;",
    "    cardState.hasUsedCardThisTurnByPlayer.black = false;",
    "    CardLogic.addCardToHand(cardState, 'black', 'hard_01');",
    "    // 合法手が無い黒でも使える対象選択カードを無料にして、AUTO がパスではなくカードを選ぶことを確かめる。",
    "    const added = CardLogic.addCardToHand(cardState, 'black', 'destroy_01');",
    "    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');",
    "  });",
    "  const canonicalCardResult = await publishAuto(",
    "    canonicalCard, 'op_worker_auto_card_1', 'pass',",
    "    { type: 'pass', playerKey: 'black', autoNoActionPass: true }",
    "  );",
    "",
    "  const repeatedCard = await createScenario('AUT5', true, ({ gameState, cardState }) => {",
    "    gameState.currentPlayer = 1;",
    "    gameState.consecutivePasses = 0;",
    "    gameState.resultShown = false;",
    "    cardState.lastTurnStartedFor = 'black';",
    "    cardState._activeTurnPlayer = 'black';",
    "    cardState.hands.black = [];",
    "    cardState._handCopyIdsByPlayer.black = [];",
    "    cardState.discard = [];",
    "    CardLogic.addCardToHand(cardState, 'black', 'work_01');",
    "    cardState.charge.black = 99;",
    "    cardState.hasUsedCardThisTurnByPlayer.black = true;",
    "    cardState.lastUsedCardByPlayer.black = 'hard_01';",
    "  });",
    "  const repeatedCardResult = await publishUseCard(",
    "    repeatedCard, 'op_worker_second_card_rejected_1', 'work_01'",
    "  );",
    "",
    "  const subPlacement = await createScenario('AUT6', true, ({ gameState, cardState }) => {",
    "    gameState.currentPlayer = 1;",
    "    gameState.consecutivePasses = 0;",
    "    gameState.resultShown = false;",
    "    cardState.lastTurnStartedFor = 'black';",
    "    cardState._activeTurnPlayer = 'black';",
    "    cardState.pendingEffectByPlayer.black = null;",
    "    cardState.extraPlaceRemainingByPlayer.black = 1;",
    "    cardState.infinitePlaceActiveByPlayer.black = false;",
    "    cardState.multiPlaceSourceTypeByPlayer.black = 'DOUBLE_PLACE';",
    "    cardState.hands.black = [];",
    "    cardState._handCopyIdsByPlayer.black = [];",
    "    cardState.discard = [];",
    "    CardLogic.addCardToHand(cardState, 'black', 'work_01');",
    "    cardState.charge.black = 99;",
    "    cardState.hasUsedCardThisTurnByPlayer.black = true;",
    "    cardState.lastUsedCardByPlayer.black = 'double_01';",
    "  });",
    "  const subPlacementResult = await publishAuto(",
    "    subPlacement, 'op_worker_auto_double_continuation_1', 'use_card',",
    "    {",
    "      type: 'use_card', playerKey: 'black', useCardId: 'work_01',",
    "      useCardOwnerKey: 'black', useCardHandIndex: 0",
    "    }",
    "  );",
    "",
    "  const runtimeUnavailable = await createScenario('AUT7', true);",
    "  const runtimeUnavailableBeforeRoom = JSON.stringify(runtimeUnavailable.durableObject.room);",
    "  const runtimeUnavailableBeforeStorage = JSON.stringify(runtimeUnavailable.storage.get('match_room_state_v1'));",
    "  const runtimeUnavailableBeforeMetrics = { ...runtimeUnavailable.metrics };",
    "  const runtimeUnavailableBeforeAuthority = JSON.parse(JSON.stringify({",
    "    stateVersion: runtimeUnavailable.durableObject.room.stateVersion,",
    "    prngState: runtimeUnavailable.durableObject.room.snapshot.cardState.prngState,",
    "    presentationJournal: runtimeUnavailable.durableObject.room.presentationJournal,",
    "    acceptedOperationsBySeat: runtimeUnavailable.durableObject.room.acceptedOperationsBySeat",
    "  }));",
    "  const originalHasUsableCard = CardLogic.hasUsableCard;",
    "  CardLogic.hasUsableCard = () => {",
    "    throw RuntimeErrors.createCardRuntimeUnavailableError('state.availability', 'state');",
    "  };",
    "  let runtimeUnavailableResult;",
    "  try {",
    "    runtimeUnavailableResult = await publishAuto(",
    "      runtimeUnavailable, 'op_worker_auto_runtime_unavailable_1', 'place',",
    "      { type: 'place', row: 2, col: 3 }",
    "    );",
    "  } finally {",
    "    CardLogic.hasUsableCard = originalHasUsableCard;",
    "  }",
    "  const runtimeUnavailableAfterAuthority = JSON.parse(JSON.stringify({",
    "    stateVersion: runtimeUnavailable.durableObject.room.stateVersion,",
    "    prngState: runtimeUnavailable.durableObject.room.snapshot.cardState.prngState,",
    "    presentationJournal: runtimeUnavailable.durableObject.room.presentationJournal,",
    "    acceptedOperationsBySeat: runtimeUnavailable.durableObject.room.acceptedOperationsBySeat",
    "  }));",
    "  const runtimeUnavailableEvidence = {",
    "    result: runtimeUnavailableResult,",
    "    roomUnchanged: JSON.stringify(runtimeUnavailable.durableObject.room) === runtimeUnavailableBeforeRoom,",
    "    storageUnchanged: JSON.stringify(runtimeUnavailable.storage.get('match_room_state_v1')) === runtimeUnavailableBeforeStorage,",
    "    storagePutsDelta: runtimeUnavailable.metrics.storagePuts - runtimeUnavailableBeforeMetrics.storagePuts,",
    "    broadcastsDelta: runtimeUnavailable.metrics.broadcasts - runtimeUnavailableBeforeMetrics.broadcasts,",
    "    beforeAuthority: runtimeUnavailableBeforeAuthority,",
    "    afterAuthority: runtimeUnavailableAfterAuthority",
    "  };",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    enabled: enabledResult,",
    "    disabled: disabledResult,",
    "    terminal: terminalResult,",
    "    canonicalCard: canonicalCardResult,",
    "    repeatedCard: repeatedCardResult,",
    "    subPlacement: subPlacementResult,",
    "    runtimeUnavailable: runtimeUnavailableEvidence",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker AUTO authority runner failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker AUTO authority', () => {
  test('loads the canonical planner inside the Durable Object and enforces AUTO contracts', () => {
    const result = runWorkerAutoTurnScenarios();

    expect(result.enabled.status).toBe(200);
    expect(result.enabled.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1,
      publishMeta: expect.objectContaining({
        kind: 'accepted',
        operationId: 'op_worker_auto_enabled_1',
        actionType: 'auto_turn'
      })
    }));
    expect(result.enabled.payload.snapshot.gameState.board[2][3]).toBe(1);
    expect(result.enabled.payload.snapshot.gameState.board[3][3]).toBe(1);

    expect(result.disabled.status).toBe(409);
    expect(result.disabled.payload.rejectedReason).toBe('AUTO_COMMAND_DISABLED');
    expect(result.disabled.payload.stateVersion).toBe(0);

    expect(result.terminal.status).toBe(409);
    expect(result.terminal.payload.rejectedReason).toBe('GAME_ALREADY_OVER');
    expect(result.terminal.payload.stateVersion).toBe(0);

    expect(result.canonicalCard.status).toBe(200);
    expect(result.canonicalCard.payload.ok).toBe(true);
    expect(result.canonicalCard.payload.autoPassNotice).toBeUndefined();
    expect(result.canonicalCard.payload.snapshot.cardState.discard).toContain('destroy_01');
    expect(result.canonicalCard.payload.snapshot.cardState.lastUsedCardByPlayer.black).toBe('destroy_01');
    expect(result.canonicalCard.payload.snapshot.cardState.hands.black).toEqual(['hard_01']);

    expect(result.repeatedCard.status).toBe(409);
    expect(result.repeatedCard.payload.rejectedReason).toBe('CARD_USE_FAILED');
    expect(result.repeatedCard.payload.stateVersion).toBe(0);
    expect(result.repeatedCard.payload.snapshot.cardState.hands.black).toEqual(['work_01']);
    expect(result.repeatedCard.payload.snapshot.cardState.charge.black).toBe(99);
    expect(result.repeatedCard.payload.snapshot.cardState.discard).toEqual([]);
    expect(result.repeatedCard.payload.snapshot.cardState.lastUsedCardByPlayer.black).toBe('hard_01');

    expect(result.subPlacement.status).toBe(200);
    expect(result.subPlacement.payload.ok).toBe(true);
    expect(result.subPlacement.payload.snapshot.gameState.board[2][3]).toBe(1);
    expect(result.subPlacement.payload.snapshot.cardState.hands.black).toEqual(['work_01']);
    expect(result.subPlacement.payload.snapshot.cardState.discard).toEqual([]);
    expect(result.subPlacement.payload.snapshot.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(result.subPlacement.payload.snapshot.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
    expect(result.subPlacement.payload.snapshot.gameState.currentPlayer).toBe(-1);

    expect(result.runtimeUnavailable.result.status).toBe(409);
    expect(result.runtimeUnavailable.result.payload).toEqual(expect.objectContaining({
      ok: false,
      rejectedReason: 'RUNTIME_UNAVAILABLE',
      stateVersion: 0
    }));
    expect(result.runtimeUnavailable.roomUnchanged).toBe(true);
    expect(result.runtimeUnavailable.storageUnchanged).toBe(true);
    expect(result.runtimeUnavailable.storagePutsDelta).toBe(0);
    expect(result.runtimeUnavailable.broadcastsDelta).toBe(0);
    expect(result.runtimeUnavailable.afterAuthority).toEqual(result.runtimeUnavailable.beforeAuthority);
  });
});
