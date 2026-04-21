const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker pendingEffectId runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runStalePendingEffectScenario() {
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
    "    roomId: 'PEND1',",
    "    seed: 1,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: false },",
    "    seatNames: { black: 'くろ', white: '' },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null,",
    "    roomBoardConfig: null,",
    "    networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    eventSeq: 0,",
    "    sseEventBuffer: [],",
    "    authorityLog: [],",
    "    chatMessages: [],",
    "    chatSeq: 0,",
    "    snapshot: {",
    "      stateVersion: 0,",
    "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 },",
    "      cardState: {",
    "        hands: { black: [], white: [] },",
    "        charge: { black: 0, white: 0 },",
    "        pendingEffectByPlayer: { black: { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01', pendingEffectId: 'pending_0_2' }, white: null },",
    "        hasUsedCardThisTurnByPlayer: { black: false, white: false },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        lastUsedCardByPlayer: { black: null, white: null },",
    "        markers: [],",
    "        discard: [],",
    "        turnIndex: 0",
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
    "  const response = await durableObject.fetch(new Request('https://room/api/match/publish', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({",
    "      roomId: 'PEND1',",
    "      seatKey: 'black',",
    "      playerKey: 'black',",
    "      seatToken: 'token_black',",
    "      baseVersion: 0,",
    "      operationId: 'op_pending_stale_1',",
    "      actionType: 'place',",
    "      actor: 'black',",
    "      params: { row: 2, col: 3, pendingSelectionState: { type: 'TEMPT_WILL', pendingEffectId: 'pending_0_1' } },",
    "      action: { type: 'place', playerKey: 'black', row: 2, col: 3, pendingSelectionState: { type: 'TEMPT_WILL', pendingEffectId: 'pending_0_1' }, turnIndex: 0 },",
    "      turnIndex: 0",
    "    })",
    "  }));",
    "  const payload = await response.json();",
    "  process.stdout.write(JSON.stringify({ status: response.status, payload }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('worker pendingEffectId contract', () => {
  test('stale pendingEffectId publish is rejected before deferred selection is applied', () => {
    const result = runStalePendingEffectScenario();

    expect(result.status).toBe(409);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      rejectedReason: 'STALE_PENDING_SELECTION',
      publishMeta: expect.objectContaining({
        kind: 'rejected',
        operationId: 'op_pending_stale_1',
        actionType: 'place',
        rejectedReason: 'STALE_PENDING_SELECTION'
      })
    }));
  });
});
