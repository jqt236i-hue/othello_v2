import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

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

function runDestroySelectionScenario() {
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
    "    roomId: 'PEND2',",
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
    "        deck: [],",
    "        decks: { black: [], white: [] },",
    "        initialDeckSize: 0,",
    "        initialDeckSizeByPlayer: { black: 0, white: 0 },",
    "        hands: { black: [], white: [] },",
    "        charge: { black: 80, white: 0 },",
    "        chargeGainedTotal: { black: 0, white: 0 },",
    "        chargeDeltaEvents: [],",
    "        turnCountByPlayer: { black: 1, white: 0 },",
    "        pendingEffectByPlayer: { black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01', sourceHandIndex: 0 }, white: null },",
    "        activeEffectsByPlayer: { black: [], white: [] },",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: false },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 },",
    "        infinitePlaceActiveByPlayer: { black: false, white: false },",
    "        multiPlaceSourceTypeByPlayer: { black: null, white: null },",
    "        breedingSproutByOwner: { black: [], white: [] },",
    "        _breedingSproutClearedTokenByOwner: { black: null, white: null },",
    "        riboRepaymentsByPlayer: { black: [], white: [] },",
    "        prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },",
    "        lastUsedCardByPlayer: { black: 'destroy_01', white: null },",
    "        markers: [],",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: [],",
    "        _handCopyIdsByPlayer: { black: [], white: [] },",
    "        _deckCopyIdsByPlayer: { black: [], white: [] },",
    "        _discardCopyIds: [],",
    "        _revealedHandCopyIdsByViewer: { black: [], white: [] },",
    "        discard: ['destroy_01'],",
    "        turnIndex: 1",
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
    "      roomId: 'PEND2',",
    "      seatKey: 'black',",
    "      playerKey: 'black',",
    "      seatToken: 'token_black',",
    "      baseVersion: 0,",
    "      operationId: 'op_destroy_select_1',",
    "      actionType: 'place',",
    "      actor: 'black',",
    "      params: { destroyTarget: { row: 3, col: 3 }, player: 'black', pendingSelectionState: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01', sourceHandIndex: 0 } },",
    "      action: { type: 'place', destroyTarget: { row: 3, col: 3 }, player: 'black', deferNetworkPublish: true, pendingSelectionState: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01', sourceHandIndex: 0 }, turnIndex: 1 },",
    "      turnIndex: 1",
    "    })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  process.stdout.write(JSON.stringify({",
    "    status: response.status,",
    "    payload,",
    "    storedBoardValue: storedRoom.snapshot.gameState.board[3][3],",
    "    storedPending: storedRoom.snapshot.cardState.pendingEffectByPlayer.black",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runSwapSelectionScenario() {
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
    "    roomId: 'PEND3',",
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
    "        deck: [],",
    "        decks: { black: [], white: [] },",
    "        initialDeckSize: 0,",
    "        initialDeckSizeByPlayer: { black: 0, white: 0 },",
    "        hands: { black: [], white: [] },",
    "        charge: { black: 80, white: 0 },",
    "        chargeGainedTotal: { black: 0, white: 0 },",
    "        chargeDeltaEvents: [],",
    "        turnCountByPlayer: { black: 1, white: 0 },",
    "        pendingEffectByPlayer: { black: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01', sourceHandIndex: 0 }, white: null },",
    "        activeEffectsByPlayer: { black: [], white: [] },",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: false },",
    "        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 },",
    "        infinitePlaceActiveByPlayer: { black: false, white: false },",
    "        multiPlaceSourceTypeByPlayer: { black: null, white: null },",
    "        breedingSproutByOwner: { black: [], white: [] },",
    "        _breedingSproutClearedTokenByOwner: { black: null, white: null },",
    "        riboRepaymentsByPlayer: { black: [], white: [] },",
    "        prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },",
    "        lastUsedCardByPlayer: { black: 'swap_01', white: null },",
    "        markers: [],",
    "        presentationEvents: [],",
    "        _presentationEventsPersist: [],",
    "        _handCopyIdsByPlayer: { black: [], white: [] },",
    "        _deckCopyIdsByPlayer: { black: [], white: [] },",
    "        _discardCopyIds: [],",
    "        _revealedHandCopyIdsByViewer: { black: [], white: [] },",
    "        discard: ['swap_01'],",
    "        turnIndex: 1",
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
    "      roomId: 'PEND3',",
    "      seatKey: 'black',",
    "      playerKey: 'black',",
    "      seatToken: 'token_black',",
    "      baseVersion: 0,",
    "      operationId: 'op_swap_select_1',",
    "      actionType: 'place',",
    "      actor: 'black',",
    "      params: { swapTarget: { row: 3, col: 3 }, player: 'black', pendingSelectionState: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01', sourceHandIndex: 0 } },",
    "      action: { type: 'place', swapTarget: { row: 3, col: 3 }, player: 'black', deferNetworkPublish: true, pendingSelectionState: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget', cardId: 'swap_01', sourceHandIndex: 0 }, turnIndex: 1 },",
    "      turnIndex: 1",
    "    })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  process.stdout.write(JSON.stringify({",
    "    status: response.status,",
    "    payload,",
    "    storedBoardValue: storedRoom.snapshot.gameState.board[3][3],",
    "    storedPending: storedRoom.snapshot.cardState.pendingEffectByPlayer.black",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runStatusCellSelectionScenario(config) {
  const runner = [
    "(async () => {",
    `  const config = ${JSON.stringify(config)};`,
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "  const actionTarget = config.actionKey === 'freezeTarget' || config.actionKey === 'seedTarget' || config.actionKey === 'blockadeTarget'",
    "    ? { row: 2, col: 3 }",
    "    : { row: 3, col: 4 };",
    "  const params = { player: 'black', pendingSelectionState: { type: config.pendingType, stage: 'selectTarget', cardId: config.cardId, sourceHandIndex: 0 } };",
    "  params[config.actionKey] = actionTarget;",
    "  const action = Object.assign({ type: 'place', player: 'black', deferNetworkPublish: true, pendingSelectionState: params.pendingSelectionState, turnIndex: 1 }, { [config.actionKey]: actionTarget });",
    "  const room = {",
    "    roomId: 'PEND4',",
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
    "        pendingEffectByPlayer: { black: { type: config.pendingType, stage: 'selectTarget', cardId: config.cardId, sourceHandIndex: 0 }, white: null },",
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
    "    body: JSON.stringify({ roomId: 'PEND4', seatKey: 'black', playerKey: 'black', seatToken: 'token_black', baseVersion: 0, operationId: `op_${config.cardId}_select_1`, actionType: 'place', actor: 'black', params, action, turnIndex: 1 })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  const marker = (storedRoom.snapshot.cardState.markers || []).find((m) => m && m.row === actionTarget.row && m.col === actionTarget.col);",
    "  process.stdout.write(JSON.stringify({ status: response.status, payload, storedPending: storedRoom.snapshot.cardState.pendingEffectByPlayer.black, marker }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  return runScenario(runner);
}

function runHandFollowupScenario(config) {
  const runner = [
    "(async () => {",
    `  const config = ${JSON.stringify(config)};`,
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;",
    "  const pending = config.kind === 'heaven'",
    "    ? { type: 'HEAVEN_BLESSING', stage: 'selectTarget', cardId: 'heaven_01', sourceHandIndex: 0, offers: ['meteor_01', 'gold_stone'], pendingEffectId: 'pending_hand_1' }",
    "    : { type: 'CONDEMN_WILL', stage: 'selectTarget', cardId: 'condemn_01', sourceHandIndex: 0, offers: [{ handIndex: 0, cardId: 'meteor_01' }, { handIndex: 1, cardId: 'guard_01' }], pendingEffectId: 'pending_hand_1' };",
    "  const params = config.kind === 'heaven'",
    "    ? { heavenBlessingCardId: 'gold_stone', pendingSelectionState: { type: pending.type, stage: 'selectTarget', cardId: pending.cardId, pendingEffectId: pending.pendingEffectId }, useCardId: pending.cardId, useCardOwnerKey: 'black' }",
    "    : { condemnTargetIndex: 1, pendingSelectionState: { type: pending.type, stage: 'selectTarget', cardId: pending.cardId, pendingEffectId: pending.pendingEffectId }, useCardId: pending.cardId, useCardOwnerKey: 'black' };",
    "  const room = {",
    "    roomId: config.kind === 'heaven' ? 'PENDH' : 'PENDC',",
    "    seed: 1, stateVersion: 0, updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatNames: { black: 'くろ', white: 'しろ' },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null, roomBoardConfig: null, networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    eventSeq: 0, sseEventBuffer: [], authorityLog: [], chatMessages: [], chatSeq: 0,",
    "    snapshot: {",
    "      stateVersion: 0,",
    "      gameState: { board, currentPlayer: 1, consecutivePasses: 0, turnNumber: 12, roundNumber: 1, roundCompletionByPlayer: { black: false, white: false }, pendingRoundBonus: null },",
    "      cardState: {",
    "        deck: [], decks: { black: [], white: [] }, initialDeckSize: 0, initialDeckSizeByPlayer: { black: 0, white: 0 },",
    "        hands: config.kind === 'heaven' ? { black: ['guard_01'], white: ['meteor_01'] } : { black: [], white: ['meteor_01', 'guard_01'] },",
    "        charge: { black: 80, white: 0 }, chargeGainedTotal: { black: 0, white: 0 }, chargeDeltaEvents: [],",
    "        turnCountByPlayer: { black: 1, white: 0 }, lastTurnStartedFor: 'black',",
    "        pendingEffectByPlayer: { black: pending, white: null },",
    "        activeEffectsByPlayer: { black: [], white: [] },",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: false }, hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        extraPlaceRemainingByPlayer: { black: 0, white: 0 }, infinitePlaceActiveByPlayer: { black: false, white: false }, multiPlaceSourceTypeByPlayer: { black: null, white: null },",
    "        breedingSproutByOwner: { black: [], white: [] }, _breedingSproutClearedTokenByOwner: { black: null, white: null }, riboRepaymentsByPlayer: { black: [], white: [] }, prevOpponentTurnDestroyedStonesByPlayer: { black: [], white: [] },",
    "        lastUsedCardByPlayer: { black: pending.cardId, white: null }, markers: [], presentationEvents: [], _presentationEventsPersist: [],",
    "        _handCopyIdsByPlayer: { black: [], white: [] }, _deckCopyIdsByPlayer: { black: [], white: [] }, _discardCopyIds: [], _revealedHandCopyIdsByViewer: { black: [], white: [] },",
    "        discard: [pending.cardId], turnIndex: 12",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const response = await durableObject.fetch(new Request('https://room/api/match/publish', {",
    "    method: 'POST', headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: room.roomId, seatKey: 'black', playerKey: 'black', seatToken: 'token_black', baseVersion: 0, operationId: `op_${config.kind}_followup_1`, actionType: 'place', actor: 'black', params, turnIndex: 12 })",
    "  }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  process.stdout.write(JSON.stringify({ status: response.status, payload, internalCardState: storedRoom.snapshot.cardState }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  return runScenario(runner);
}

function runPendingRejectMatrixScenario(config) {
  const scenario = JSON.stringify(config || {});
  const runner = [
    "(async () => {",
    `  const config = ${scenario};`,
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;",
    "  const pendingSeat = config.pendingSeat || 'black';",
    "  const publishSeat = config.publishSeat || 'black';",
    "  const pending = Object.assign({ type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01', pendingEffectId: 'pending_matrix_1' }, config.pending || {});",
    "  const pendingByPlayer = { black: null, white: null }; pendingByPlayer[pendingSeat] = pending;",
    "  const room = {",
    "    roomId: 'PENDM', seed: 1, stateVersion: 0, updatedAt: Date.now(),",
    "    seats: { black: true, white: true }, seatNames: { black: 'くろ', white: 'しろ' },",
    "    seatTokens: { black: 'token_black', white: 'token_white' }, seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null, roomBoardConfig: null, networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null }, eventSeq: 0, sseEventBuffer: [], authorityLog: [], chatMessages: [], chatSeq: 0,",
    "    snapshot: { stateVersion: 0, gameState: { board, currentPlayer: publishSeat === 'white' ? -1 : 1, consecutivePasses: 0, turnNumber: 1 },",
    "      cardState: { hands: { black: [], white: [] }, charge: { black: 99, white: 99 }, pendingEffectByPlayer: pendingByPlayer,",
    "        hasUsedCardThisTurnByPlayer: { black: true, white: true }, hasDestroyedCardThisTurnByPlayer: { black: false, white: false },",
    "        lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 1 } }",
    "  };",
    "  const storage = new Map(); storage.set('match_room_state_v1', room);",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "  const pendingSelectionState = Object.assign({ type: pending.type, stage: 'selectTarget', cardId: pending.cardId, pendingEffectId: pending.pendingEffectId }, config.pendingSelectionState || {});",
    "  const response = await durableObject.fetch(new Request('https://room/api/match/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({",
    "    roomId: 'PENDM', seatKey: publishSeat, playerKey: publishSeat, seatToken: publishSeat === 'white' ? 'token_white' : 'token_black',",
    "    baseVersion: 0, operationId: config.operationId || 'op_pending_matrix_1', actionType: 'place', actor: publishSeat,",
    "    params: { destroyTarget: { row: 3, col: 3 }, player: publishSeat, pendingSelectionState },",
    "    action: { type: 'place', playerKey: publishSeat, destroyTarget: { row: 3, col: 3 }, pendingSelectionState, turnIndex: 1 }, turnIndex: 1",
    "  }) }));",
    "  const payload = await response.json();",
    "  const storedRoom = storage.get('match_room_state_v1');",
    "  process.stdout.write(JSON.stringify({ status: response.status, payload, boardValue: storedRoom.snapshot.gameState.board[3][3], pending: storedRoom.snapshot.cardState.pendingEffectByPlayer[pendingSeat] }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
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

  test('destroy pending target selection mutates authoritative board and clears pending state', () => {
    const result = runDestroySelectionScenario();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.gameState.board[3][3]).toBe(0);
    expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.storedBoardValue).toBe(0);
    expect(result.storedPending).toBeNull();
  });

  test('swap pending target selection mutates authoritative board and clears pending state', () => {
    const result = runSwapSelectionScenario();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.gameState.board[3][3]).toBe(1);
    expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.storedBoardValue).toBe(1);
    expect(result.storedPending).toBeNull();
  });

  test.each([
    ['freeze_01', 'FREEZE_WILL', 'freezeTarget', 'FREEZE'],
    ['seed_01', 'SEED_WILL', 'seedTarget', 'SEED'],
    ['blockade_01', 'BLOCKADE_WILL', 'blockadeTarget', 'BLOCKADE']
  ])('%s pending target selection applies status marker and clears pending state', (cardId, pendingType, actionKey, markerType) => {
    const result = runStatusCellSelectionScenario({ cardId, pendingType, actionKey });

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.storedPending).toBeNull();
    expect(result.marker).toEqual(expect.objectContaining({
      row: 2,
      col: 3,
      owner: 'black',
      data: expect.objectContaining({ type: markerType })
    }));
  });

  test('heaven blessing follow-up resolves authoritative hand choice in worker runtime', () => {
    const result = runHandFollowupScenario({ kind: 'heaven' });

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.payload.snapshot.cardState.hands.black).toEqual(['guard_01', 'gold_stone']);
    expect(result.internalCardState.hands.black).toEqual(['guard_01', 'gold_stone']);
    expect(result.payload.effectLogs).toEqual(expect.arrayContaining(['黒: 天の恵みでカード獲得']));
  });

  test('condemn will follow-up destroys selected opponent hand card without storing hidden token in worker runtime', () => {
    const result = runHandFollowupScenario({ kind: 'condemn' });

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 1
    }));
    expect(result.payload.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.internalCardState.hands.white).toEqual(['meteor_01']);
    expect(result.internalCardState.discard).toEqual(expect.arrayContaining(['condemn_01', 'guard_01']));
    expect(result.internalCardState.discard).not.toEqual(expect.arrayContaining(['__hidden_hand__:white:1']));
    expect(result.payload.effectLogs).toEqual(expect.arrayContaining(['黒: 断罪で相手カードを破壊']));
  });

  test.each([
    ['missing pendingEffectId', { pendingSelectionState: { pendingEffectId: null } }],
    ['different pending card id', { pendingSelectionState: { cardId: 'swap_01' } }],
    ['different pending seat', { pendingSeat: 'white', publishSeat: 'black' }]
  ])('rejects %s before authoritative pending mutation', (_label, config) => {
    const result = runPendingRejectMatrixScenario(config);

    expect(result.status).toBe(409);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      rejectedReason: 'STALE_PENDING_SELECTION'
    }));
    expect(result.boardValue).toBe(-1);
    expect(result.pending).toEqual(expect.objectContaining({
      type: 'DESTROY_ONE_STONE'
    }));
  });
});
