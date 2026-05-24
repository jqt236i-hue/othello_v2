import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(config: Record<string, unknown>) {
  const runner = [
    "(async () => {",
    `  const config = ${JSON.stringify(config)};`,
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[config.source.row][config.source.col] = 1;",
    "  if (config.blocker) board[config.blocker.row][config.blocker.col] = -1;",
    "  const actionTarget = config.actionTarget || config.source;",
    "  const params = {",
    "    player: 'black',",
    "    pendingSelectionState: {",
    "      type: config.pendingType,",
    "      stage: 'selectTarget',",
    "      cardId: config.cardId,",
    "      sourceHandIndex: 0,",
    "      pendingEffectId: 'pending_move_1'",
    "    }",
    "  };",
    "  if (config.pendingFirstTarget) params.pendingSelectionState.firstTarget = { row: config.pendingFirstTarget.row, col: config.pendingFirstTarget.col };",
    "  params[config.actionKey] = { row: actionTarget.row, col: actionTarget.col };",
    "  const action = Object.assign({",
    "    type: 'place',",
    "    player: 'black',",
    "    deferNetworkPublish: true,",
    "    pendingSelectionState: params.pendingSelectionState,",
    "    turnIndex: 1",
    "  }, { [config.actionKey]: { row: actionTarget.row, col: actionTarget.col } });",
    "  const room = {",
    "    roomId: 'MOVE1',",
    "    seed: 1,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatNames: { black: 'くろ', white: 'しろ' },",
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
    "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 1, roundNumber: 1, roundCompletionByPlayer: { black: false, white: false }, pendingRoundBonus: null },",
    "      cardState: {",
    "        deck: [], decks: { black: [], white: [] }, initialDeckSize: 0, initialDeckSizeByPlayer: { black: 0, white: 0 },",
    "        hands: { black: [], white: [] }, charge: { black: 80, white: 0 }, chargeGainedTotal: { black: 0, white: 0 }, chargeDeltaEvents: [],",
    "        turnCountByPlayer: { black: 1, white: 0 },",
    "        pendingEffectByPlayer: { black: Object.assign({ type: config.pendingType, stage: 'selectTarget', cardId: config.cardId, sourceHandIndex: 0, pendingEffectId: 'pending_move_1' }, config.pendingFirstTarget ? { firstTarget: { row: config.pendingFirstTarget.row, col: config.pendingFirstTarget.col } } : {}), white: null },",
    "        activeEffectsByPlayer: { black: [], white: [] }, hasUsedCardThisTurnByPlayer: { black: true, white: false }, hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 }, infinitePlaceActiveByPlayer: { black: false, white: false }, multiPlaceSourceTypeByPlayer: { black: null, white: null },",
    "        breedingSproutByOwner: { black: [], white: [] }, _breedingSproutClearedTokenByOwner: { black: null, white: null }, riboRepaymentsByPlayer: { black: [], white: [] }, prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },",
    "        lastUsedCardByPlayer: { black: config.cardId, white: null }, markers: [], presentationEvents: [], _presentationEventsPersist: [],",
    "        _handCopyIdsByPlayer: { black: [], white: [] }, _deckCopyIdsByPlayer: { black: [], white: [] }, _discardCopyIds: [], _revealedHandCopyIdsByViewer: { black: [], white: [] },",
    "        discard: [config.cardId], turnIndex: 1",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const response = await durableObject.fetch(new Request('https://room/api/match/publish', {",
    "    method: 'POST', headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: 'MOVE1', seatKey: 'black', playerKey: 'black', seatToken: 'token_black', baseVersion: 0, operationId: `op_${config.cardId}_move_1`, actionType: 'place', actor: 'black', params, action, turnIndex: 1 })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  const moveEvent = (payload.playbackEvents || []).find((event) => event && event.type === 'move');",
    "  process.stdout.write(JSON.stringify({",
    "    status: response.status,",
    "    payload,",
    "    sourceValue: storedRoom.snapshot.gameState.board[config.source.row][config.source.col],",
    "    blockerValue: config.blocker ? storedRoom.snapshot.gameState.board[config.blocker.row][config.blocker.col] : null,",
    "    destinationValue: storedRoom.snapshot.gameState.board[config.destination.row][config.destination.col],",
    "    storedPending: storedRoom.snapshot.cardState.pendingEffectByPlayer.black,",
    "    moveEvent",
    "  }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker movement selection runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

describe('worker movement pending selection publish', () => {
  test.each([
    {
      cardId: 'strong_wind_01',
      pendingType: 'STRONG_WIND_WILL',
      actionKey: 'strongWindTarget',
      source: { row: 3, col: 3 },
      destination: { row: 3, col: 7 },
      moveIntent: 'wind_move'
    },
    {
      cardId: 'super_gravity_01',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionKey: 'superGravityTarget',
      source: { row: 1, col: 4 },
      destination: { row: 7, col: 4 },
      moveIntent: 'crush_move'
    },
    {
      cardId: 'super_buoyancy_01',
      pendingType: 'SUPER_BUOYANCY_WILL',
      actionKey: 'superBuoyancyTarget',
      source: { row: 6, col: 4 },
      destination: { row: 0, col: 4 },
      moveIntent: 'crush_move'
    },
    {
      cardId: 'buoyancy_01',
      pendingType: 'BUOYANCY_WILL',
      actionKey: 'buoyancyTarget',
      source: { row: 5, col: 2 },
      destination: { row: 0, col: 2 },
      moveIntent: 'crush_move'
    },
    {
      cardId: 'gravity_01',
      pendingType: 'GRAVITY_WILL',
      actionKey: 'gravityTarget',
      source: { row: 2, col: 5 },
      destination: { row: 7, col: 5 },
      moveIntent: 'crush_move'
    },
    {
      cardId: 'super_attraction_01',
      pendingType: 'SUPER_ATTRACTION_WILL',
      actionKey: 'superAttractionTarget',
      source: { row: 2, col: 2 },
      pendingFirstTarget: { row: 2, col: 2 },
      actionTarget: { row: 5, col: 5 },
      blocker: { row: 4, col: 4 },
      destination: { row: 5, col: 5 },
      moveIntent: 'crush_move'
    }
  ])('$pendingType mutates authoritative board and emits move playback', (config) => {
    const result = runScenario(config);

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.sourceValue).toBe(0);
    if (config.blocker) expect(result.blockerValue).toBe(0);
    expect(result.destinationValue).toBe(1);
    expect(result.storedPending).toBeNull();
    expect(result.moveEvent).toEqual(expect.objectContaining({
      type: 'move',
      meta: expect.objectContaining({
        moveIntent: config.moveIntent
      })
    }));
    expect(result.moveEvent.targets[0]).toEqual(expect.objectContaining({
      cause: config.pendingType,
      from: { r: config.source.row, col: config.source.col },
      to: { r: config.destination.row, col: config.destination.col },
      meta: expect.objectContaining({
        moveIntent: config.moveIntent
      })
    }));
  });
});
