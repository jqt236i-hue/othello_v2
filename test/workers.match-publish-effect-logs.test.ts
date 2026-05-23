import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker publish effect logs', () => {
  test('use_card accepted response includes network effect logs', () => {
    const runner = [
      "(async () => {",
      "  const modulePath = process.argv[1];",
      "  const { MatchRoomDurableObject } = await import(modulePath);",
      "  const cardsModulePath = new URL('../game/logic/cards.js', modulePath).href;",
      "  const prngModulePath = new URL('../game/schema/prng.js', modulePath).href;",
      "  const cardLogicModule = await import(cardsModulePath);",
      "  const prngModule = await import(prngModulePath);",
      "  const CardLogic = cardLogicModule.default || cardLogicModule;",
      "  const SeededPRNG = prngModule.default || prngModule;",
      "  const storage = new Map();",
      "  const state = {",
      "    storage: {",
      "      get: async (key) => storage.get(key),",
      "      put: async (key, value) => storage.set(key, value),",
      "      delete: async (key) => storage.delete(key)",
      "    }",
      "  };",
      "  const durableObject = new MatchRoomDurableObject(state);",
      "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
      "  board[3][3] = -1;",
      "  board[3][4] = 1;",
      "  board[4][3] = 1;",
      "  board[4][4] = -1;",
      "  const baseCardState = CardLogic.createCardState(SeededPRNG.createPRNG(1), {});",
      "  baseCardState.hands = { black: ['chest_01'], white: [] };",
      "  baseCardState.charge = { black: 20, white: 20 };",
      "  baseCardState.pendingEffectByPlayer = { black: null, white: null };",
      "  baseCardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };",
      "  baseCardState.lastUsedCardByPlayer = { black: null, white: null };",
      "  baseCardState.markers = [];",
      "  baseCardState.discard = [];",
      "  baseCardState.turnIndex = 1;",
      "  baseCardState.selectedCardId = null;",
      "  baseCardState.selectedCardOwnerKey = null;",
      "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
      "    roomId: 'EFF',",
      "    playerName: 'くろ',",
      "    seed: 1,",
      "    snapshot: {",
      "      gameState: {",
      "        board,",
      "        currentPlayer: 1,",
      "        consecutivePasses: 0,",
      "        turnNumber: 1",
      "      },",
      "      cardState: baseCardState",
      "    }",
      "  });",
      "  const createPayload = await createResponse.json();",
      "  const publishResponse = await durableObject.handlePublish({",
      "    roomId: 'EFF',",
      "    seatKey: 'black',",
      "    seatToken: createPayload.seatToken,",
      "    playerKey: 'black',",
      "    baseVersion: createPayload.stateVersion,",
      "    operationId: 'op_use_card_1',",
      "    actionType: 'use_card',",
      "    actor: 'black',",
      "    turnIndex: 1,",
      "    action: {",
      "      type: 'use_card',",
      "      playerKey: 'black',",
      "      useCardId: 'chest_01',",
      "      useCardOwnerKey: 'black',",
      "      turnIndex: 1",
      "    }",
      "  });",
      "  const publishPayload = await publishResponse.json();",
      "  process.stdout.write(JSON.stringify({ status: publishResponse.status, payload: publishPayload }));",
      "})().catch((error) => {",
      "  console.error(error && error.stack ? error.stack : String(error));",
      "  process.exit(1);",
      "});"
    ].join('\n');

    const result = runScenario(runner);

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      playbackEvents: expect.any(Array),
      effectLogs: expect.any(Array)
    }));
    expect(result.payload.effectLogs).toContain('黒がカードを使用: 宝箱');
  });
});
