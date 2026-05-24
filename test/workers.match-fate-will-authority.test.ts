import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runFateWillControllerPlaceScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;",
    "  const room = {",
    "    roomId: 'FATE1', seed: 1, stateVersion: 0, updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatNames: { black: 'くろ', white: 'しろ' },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null, roomBoardConfig: null, networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'white', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    acceptedOperationHistoryBySeat: { black: [], white: [] },",
    "    eventSeq: 0, sseEventBuffer: [], authorityLog: [], chatMessages: [], chatSeq: 0,",
    "    snapshot: {",
    "      stateVersion: 0,",
    "      gameState: {",
    "        board, currentPlayer: -1, consecutivePasses: 0, turnNumber: 1, roundNumber: 1,",
    "        roundCompletionByPlayer: { black: false, white: false }, pendingRoundBonus: null",
    "      },",
    "      cardState: {",
    "        deck: [], decks: { black: [], white: [] },",
    "        hands: { black: [], white: ['guard_01'] },",
    "        charge: { black: 0, white: 0 },",
    "        chargeGainedTotal: { black: 0, white: 0 },",
    "        chargeDeltaEvents: [],",
    "        turnCountByPlayer: { black: 0, white: 1 },",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        activeEffectsByPlayer: { black: [], white: [] },",
    "        hasUsedCardThisTurnByPlayer: { black: false, white: false },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 },",
    "        infinitePlaceActiveByPlayer: { black: false, white: false },",
    "        multiPlaceSourceTypeByPlayer: { black: null, white: null },",
    "        breedingSproutByOwner: { black: [], white: [] },",
    "        _breedingSproutClearedTokenByOwner: { black: null, white: null },",
    "        riboRepaymentsByPlayer: { black: [], white: [] },",
    "        prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },",
    "        fateWillControllerByTurnOwner: { black: null, white: 'black' },",
    "        lastUsedCardByPlayer: { black: null, white: null },",
    "        markers: [], presentationEvents: [], _presentationEventsPersist: [],",
    "        discard: [], turnIndex: 0",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map(); storage.set('match_room_state_v1', room);",
    "  const durableObject = new MatchRoomDurableObject({ storage: {",
    "    get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value),",
    "    delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {}",
    "  } });",
    "  durableObject.broadcastSnapshot = async () => {};",
    "  const response = await durableObject.fetch(new Request('https://room/api/match/publish', {",
    "    method: 'POST', headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({",
    "      roomId: 'FATE1', seatKey: 'black', playerKey: 'black', seatToken: 'token_black',",
    "      baseVersion: 0, operationId: 'op_fate_controller_place_1',",
    "      actionType: 'place', actor: 'black', params: { row: 2, col: 4 }, turnIndex: 0",
    "    })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  process.stdout.write(JSON.stringify({",
    "    status: response.status, payload,",
    "    storedBoard: storedRoom.snapshot.gameState.board,",
    "    storedCurrentPlayer: storedRoom.snapshot.gameState.currentPlayer",
    "  }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker FATE_WILL authority runner failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker FATE_WILL authority', () => {
  test('controller seat can publish placement for the controlled turn owner', () => {
    const result = runFateWillControllerPlaceScenario();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.gameState.board[2][4]).toBe(-1);
    expect(result.payload.snapshot.gameState.board[3][4]).toBe(-1);
    expect(result.storedBoard[2][4]).toBe(-1);
    expect(result.storedBoard[3][4]).toBe(-1);
    expect(result.storedCurrentPlayer).toBe(1);
  });
});
