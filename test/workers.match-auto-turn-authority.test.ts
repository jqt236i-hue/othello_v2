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
    "",
    "  async function createScenario(roomId, networkAutoEnabled, mutateSnapshot) {",
    "    const storage = new Map();",
    "    const durableObject = new MatchRoomDurableObject({ storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key),",
    "      setAlarm: async () => {},",
    "      deleteAlarm: async () => {}",
    "    } });",
    "    durableObject.broadcastSnapshot = async () => {};",
    "    const prng = SeededPRNG.createPRNG(31);",
    "    const gameState = Core.createGameState();",
    "    const cardState = CardLogic.createCardState(prng);",
    "    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "    if (typeof mutateSnapshot === 'function') mutateSnapshot({ gameState, cardState });",
    "    const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "      roomId, playerName: 'くろ', seed: 31, networkAutoEnabled, snapshot: { gameState, cardState }",
    "    });",
    "    const createPayload = await createResponse.json();",
    "    return { durableObject, storage, createPayload };",
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
    "    const added = CardLogic.addCardToHand(cardState, 'black', 'hard_01');",
    "    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');",
    "  });",
    "  const canonicalCardResult = await publishAuto(",
    "    canonicalCard, 'op_worker_auto_card_1', 'pass',",
    "    { type: 'pass', playerKey: 'black', autoNoActionPass: true }",
    "  );",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    enabled: enabledResult,",
    "    disabled: disabledResult,",
    "    terminal: terminalResult,",
    "    canonicalCard: canonicalCardResult",
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
    expect(result.canonicalCard.payload.snapshot.cardState.discard).toContain('hard_01');
    expect(result.canonicalCard.payload.snapshot.cardState.lastUsedCardByPlayer.black).toBe('hard_01');
    expect(result.canonicalCard.payload.snapshot.cardState.hands.black).toEqual(['hard_01']);
  });
});
