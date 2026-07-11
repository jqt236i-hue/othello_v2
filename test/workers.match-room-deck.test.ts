import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import * as DeckSpecHelpers from '../shared/deck-spec.js';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__ROOM_DECK_RESULT__';

function runScenario(runnerSource, action) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath, action], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'room deck runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'room deck runner did not emit result marker');
  }

  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runRoomDeckScenario(action) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const action = process.argv[2];",
    "  const SharedConstants = require('./shared-constants');",
    "  const DeckSpecHelpers = require('./shared/deck-spec');",
    "  const DeckCodecModule = require('./shared/deck-codec');",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "",
    "  const enabledIds = (SharedConstants.CARD_DEFS || [])",
    "    .filter((card) => card && card.enabled !== false && card.id)",
    "    .map((card) => card.id);",
    "  const blackEnabledIds = enabledIds.slice(0, 10);",
    "  const whiteEnabledIds = enabledIds.slice(10, 20);",
    "  const updatedBlackEnabledIds = enabledIds.slice(20, 30);",
    "  const blackDeckIds = blackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);",
    "  const whiteDeckIds = whiteEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);",
    "  const updatedBlackDeckIds = updatedBlackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);",
    "  const blackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(blackDeckIds);",
    "  const whiteDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(whiteDeckIds);",
    "  const updatedBlackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(updatedBlackDeckIds);",
    "  const blackDeckCode = DeckCodecModule.encodeDeckSpec(blackDeckSpec);",
    "  const whiteDeckCode = DeckCodecModule.encodeDeckSpec(whiteDeckSpec);",
    "  const updatedBlackDeckCode = DeckCodecModule.encodeDeckSpec(updatedBlackDeckSpec);",
    "  const roomBoardConfig = { rows: 10, cols: 10, shape: 'circle' };",
    "",
    "  function createStateStore() {",
    "    const storage = new Map();",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, value),",
    "        delete: async (key) => storage.delete(key)",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => roomId,",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));",
    "        }",
    "        return { fetch: (request) => rooms.get(roomId).fetch(request) };",
    "      }",
    "    }",
    "  };",
    "",
    "  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: 'くろ', deckCode: blackDeckCode, roomBoardConfig, networkDebugEnabled: true })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ', deckCode: whiteDeckCode })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  const stateResponse = await worker.fetch(new Request(`https://worker/api/match/state?roomId=${encodeURIComponent(createPayload.roomId)}&seatKey=black&seatToken=${encodeURIComponent(createPayload.seatToken || '')}`), env);",
    "  const statePayload = await stateResponse.json();",
    "",
    "  const room = rooms.get(createPayload.roomId);",
    "  await room.loadRoom();",
    "",
    "  let deckUpdatePayload = null;",
    "  let deckUpdateStatus = null;",
    "  if (action === 'update-reset') {",
    "    const deckUpdateResponse = await worker.fetch(new Request('https://worker/api/match/deck', {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json' },",
    "      body: JSON.stringify({",
    "        roomId: createPayload.roomId,",
    "        seatKey: 'black',",
    "        seatToken: createPayload.seatToken,",
    "        deckCode: updatedBlackDeckCode",
    "      })",
    "    }), env);",
    "    deckUpdateStatus = deckUpdateResponse.status;",
    "    deckUpdatePayload = await deckUpdateResponse.json();",
    "    await room.loadRoom();",
    "  }",
    "",
    "  let publishPayload = null;",
    "  let publishStatus = null;",
    "  let internalPublishCardState = null;",
    "  if (action === 'reset' || action === 'update-reset') {",
    "    const terminalBoard = Array.from({ length: 8 }, () => Array(8).fill(1));",
    "    const requestedResetBoard = Array.from({ length: 8 }, () => Array(8).fill(-1));",
    "    room.room.stateVersion = 5;",
    "    room.room.snapshot = {",
    "      gameState: {",
    "        board: terminalBoard,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 60",
    "      },",
    "      cardState: {}",
    "    };",
    "    room.room.updatedAt = Date.now();",
    "    await room.saveRoom();",
    "",
    "    const publishResponse = await worker.fetch(new Request('https://worker/api/match/publish', {",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json' },",
    "      body: JSON.stringify({",
    "        roomId: createPayload.roomId,",
    "        seatKey: 'white',",
    "        playerKey: 'white',",
    "        seatToken: joinPayload.seatToken,",
    "        operationId: 'worker-room-deck-reset',",
    "        baseVersion: 5,",
    "        actionType: 'reset_game',",
    "        snapshot: {",
    "          gameState: {",
    "            board: requestedResetBoard,",
    "            currentPlayer: 1,",
    "            consecutivePasses: 0,",
    "            turnNumber: 0",
    "          },",
    "          cardState: {}",
    "        }",
    "      })",
    "    }), env);",
    "    publishStatus = publishResponse.status;",
    "    publishPayload = await publishResponse.json();",
    "    await room.loadRoom();",
    "    internalPublishCardState = room.room && room.room.snapshot ? room.room.snapshot.cardState : null;",
    "  }",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload,",
    "    stateStatus: stateResponse.status,",
    "    statePayload,",
    "    deckUpdateStatus,",
    "    deckUpdatePayload,",
    "    publishStatus,",
    "    publishPayload,",
    "    internalPublishCardState,",
    "    blackDeckCode,",
    "    whiteDeckCode,",
    "    updatedBlackDeckCode,",
    "    blackMarkerId: blackEnabledIds[0],",
    "    whiteMarkerId: whiteEnabledIds[0],",
    "    updatedBlackMarkerId: updatedBlackEnabledIds[0],",
    "    roomBoardConfig",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner, action);
}

function runDefaultRoomDeckScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "  const roomBoardConfig = { rows: 7, cols: 9 };",
    "",
    "  function createStateStore() {",
    "    const storage = new Map();",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, value),",
    "        delete: async (key) => storage.delete(key)",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => roomId,",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));",
    "        }",
    "        return { fetch: (request) => rooms.get(roomId).fetch(request) };",
    "      }",
    "    }",
    "  };",
    "",
    "  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: 'くろ', roomBoardConfig })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ' })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  const stateResponse = await worker.fetch(new Request(`https://worker/api/match/state?roomId=${encodeURIComponent(createPayload.roomId)}&seatKey=black&seatToken=${encodeURIComponent(createPayload.seatToken || '')}`), env);",
    "  const statePayload = await stateResponse.json();",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload,",
    "    stateStatus: stateResponse.status,",
    "    statePayload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner, '');
}

function runAllCardsDeckScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "  const DeckSpecHelpers = require('./shared/deck-spec');",
    "  const DeckCodecModule = require('./shared/deck-codec');",
    "  const allCardsDeckIds = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();",
    "  const ignoredDeckCode = DeckCodecModule.encodeDeckSpec(DeckSpecHelpers.createDeckSpecFromCardIds(allCardsDeckIds.slice(0, 30)));",
    "",
    "  function createStateStore() {",
    "    const storage = new Map();",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, value),",
    "        delete: async (key) => storage.delete(key)",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => roomId,",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));",
    "        }",
    "        return { fetch: (request) => rooms.get(roomId).fetch(request) };",
    "      }",
    "    }",
    "  };",
    "",
    "  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: 'くろ', deckCode: ignoredDeckCode, allCardsDeckEnabled: true })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "",
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ', deckCode: ignoredDeckCode })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  const stateResponse = await worker.fetch(new Request(`https://worker/api/match/state?roomId=${encodeURIComponent(createPayload.roomId)}&seatKey=black&seatToken=${encodeURIComponent(createPayload.seatToken || '')}`), env);",
    "  const statePayload = await stateResponse.json();",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload,",
    "    stateStatus: stateResponse.status,",
    "    statePayload,",
    "    allCardsDeckIds",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner, '');
}

function countPlayerCopies(cardState, playerKey, cardId) {
  const decks = (cardState && cardState.decks && Array.isArray(cardState.decks[playerKey]))
    ? cardState.decks[playerKey]
    : [];
  const hands = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
    ? cardState.hands[playerKey]
    : [];
  return decks.concat(hands).filter((one) => one === cardId).length;
}

function listPlayerCards(cardState, playerKey) {
  const decks = (cardState && cardState.decks && Array.isArray(cardState.decks[playerKey]))
    ? cardState.decks[playerKey]
    : [];
  const hands = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
    ? cardState.hands[playerKey]
    : [];
  return hands.concat(decks);
}

function sortedCards(cards) {
  return cards.slice().sort((left, right) => String(left).localeCompare(String(right), 'en'));
}

describe('match worker room deck', () => {
  test('両者デフォルト時は同じ30種を共有しつつ山札順だけ黒白で別になる', () => {
    const result = runDefaultRoomDeckScenario();
    const cardState = result.statePayload.snapshot.cardState;
    const blackCards = listPlayerCards(cardState, 'black');
    const whiteCards = listPlayerCards(cardState, 'white');

    expect(result.createStatus).toBe(200);
    expect(result.joinStatus).toBe(200);
    expect(result.stateStatus).toBe(200);
    expect(result.createPayload.roomDeck).toMatchObject({
      mode: 'shared',
      deckCode: '',
      deckSize: DeckSpecHelpers.getDefaultDeckSize()
    });
    expect(result.joinPayload.roomDeck).toMatchObject({
      mode: 'shared',
      deckCode: '',
      deckSize: DeckSpecHelpers.getDefaultDeckSize()
    });
    expect(result.statePayload.roomDeck).toMatchObject({
      mode: 'shared',
      deckCode: '',
      deckSize: DeckSpecHelpers.getDefaultDeckSize()
    });
    expect(blackCards).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
    expect(whiteCards).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
    expect(new Set(blackCards).size).toBe(DeckSpecHelpers.getDefaultDeckSize());
    expect(new Set(whiteCards).size).toBe(DeckSpecHelpers.getDefaultDeckSize());
    expect(blackCards.slice().sort()).toEqual(whiteCards.slice().sort());
    expect(blackCards).not.toEqual(whiteCards);
  });

  test('両者全カードデッキ設定は黒白両方へLv9全カードデッキを強制する', () => {
    const result = runAllCardsDeckScenario();
    const cardState = result.statePayload.snapshot.cardState;

    expect(result.createStatus).toBe(200);
    expect(result.joinStatus).toBe(200);
    expect(result.stateStatus).toBe(200);
    expect(result.createPayload.roomDeck).toMatchObject({
      mode: 'shared',
      source: 'allCards',
      deckCode: '',
      deckSize: result.allCardsDeckIds.length
    });
    expect(result.joinPayload.roomDeck).toMatchObject({
      mode: 'shared',
      source: 'allCards',
      deckSize: result.allCardsDeckIds.length
    });
    expect(result.statePayload.roomDeck).toMatchObject({
      mode: 'shared',
      source: 'allCards',
      deckSize: result.allCardsDeckIds.length
    });
    expect(cardState.initialDeckSizeByPlayer.black).toBe(result.allCardsDeckIds.length);
    expect(cardState.initialDeckSizeByPlayer.white).toBe(result.allCardsDeckIds.length);
    expect(sortedCards(listPlayerCards(cardState, 'black'))).toEqual(sortedCards(result.allCardsDeckIds));
    expect(sortedCards(listPlayerCards(cardState, 'white'))).toEqual(sortedCards(result.allCardsDeckIds));
    expect(listPlayerCards(cardState, 'black')).toContain('observer_will_01');
    expect(listPlayerCards(cardState, 'black')).toContain('board_executor_01');
    expect(listPlayerCards(cardState, 'black')).toContain('theory_incarnation_01');
  });

  test('公開 create/join/state が黒白別の roomDeck を返す', () => {
    const result = runRoomDeckScenario('state');
    const cardState = result.statePayload.snapshot.cardState;

    expect(result.createStatus).toBe(200);
    expect(result.joinStatus).toBe(200);
    expect(result.stateStatus).toBe(200);
    expect(result.createPayload.ok).toBe(true);
    expect(result.createPayload.networkDebugEnabled).toBe(false);
    expect(result.createPayload.roomBoardConfig).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(result.createPayload.roomDeck.mode).toBe('perPlayer');
    expect(result.createPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
    expect(result.createPayload.roomDeck.deckCodeByPlayer.white).toBe('');
    expect(result.joinPayload.networkDebugEnabled).toBe(false);
    expect(result.joinPayload.roomBoardConfig).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(result.joinPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
    expect(result.joinPayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
    expect(result.statePayload.networkDebugEnabled).toBe(false);
    expect(result.statePayload.roomBoardConfig).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(result.statePayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
    expect(result.statePayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
    expect(result.statePayload.snapshot.gameState.board).toHaveLength(10);
    expect(result.statePayload.snapshot.gameState.board[0]).toHaveLength(10);
    expect(result.statePayload.snapshot.gameState.boardConfig).toMatchObject({ shape: 'circle' });
    expect(result.statePayload.snapshot.cardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(result.statePayload.snapshot.cardState.initialDeckSizeByPlayer.white).toBe(30);
    expect(countPlayerCopies(cardState, 'black', result.blackMarkerId)).toBe(3);
    expect(countPlayerCopies(cardState, 'white', result.blackMarkerId)).toBe(0);
    expect(countPlayerCopies(cardState, 'white', result.whiteMarkerId)).toBe(3);
    expect(countPlayerCopies(cardState, 'black', result.whiteMarkerId)).toBe(0);
  });

  test('reset_game 後も黒白別 roomDeck と各30枚デッキを維持する', () => {
    const result = runRoomDeckScenario('reset');
    const blackCardState = result.publishPayload.snapshot.cardState;
    const internalBlackCardState = result.internalPublishCardState;
    const blackTotalCards = blackCardState.decks.black.length + blackCardState.hands.black.length;
    const whiteTotalCards = blackCardState.decks.white.length + blackCardState.hands.white.length;

    expect(result.publishStatus).toBe(200);
    expect(result.publishPayload.ok).toBe(true);
    expect(result.publishPayload.roomBoardConfig).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(result.publishPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
    expect(result.publishPayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
    expect(result.publishPayload.snapshot.gameState.board).toHaveLength(10);
    expect(result.publishPayload.snapshot.gameState.board[0]).toHaveLength(10);
    expect(result.publishPayload.snapshot.gameState.boardConfig).toMatchObject({ shape: 'circle' });
    expect(result.publishPayload.snapshot.cardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(result.publishPayload.snapshot.cardState.initialDeckSizeByPlayer.white).toBe(30);
    expect(blackTotalCards).toBe(30);
    expect(whiteTotalCards).toBe(30);
    expect(internalBlackCardState).toBeTruthy();
    expect(countPlayerCopies(internalBlackCardState, 'black', result.blackMarkerId)).toBe(3);
    expect(countPlayerCopies(internalBlackCardState, 'white', result.whiteMarkerId)).toBe(3);
    expect(blackCardState.hands.black).toHaveLength(1);
  });

  test('デッキ変更後の再戦 reset_game は変更後の黒 deck を使う', () => {
    const result = runRoomDeckScenario('update-reset');
    const publicCardState = result.publishPayload.snapshot.cardState;
    const internalCardState = result.internalPublishCardState;

    expect(result.deckUpdateStatus).toBe(200);
    expect(result.deckUpdatePayload.ok).toBe(true);
    expect(result.deckUpdatePayload.roomDeck.deckCodeByPlayer.black).toBe(result.updatedBlackDeckCode);
    expect(result.deckUpdatePayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
    expect(result.publishStatus).toBe(200);
    expect(result.publishPayload.ok).toBe(true);
    expect(result.publishPayload.roomDeck.deckCodeByPlayer.black).toBe(result.updatedBlackDeckCode);
    expect(result.publishPayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
    expect(publicCardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(publicCardState.initialDeckSizeByPlayer.white).toBe(30);
    expect(countPlayerCopies(internalCardState, 'black', result.updatedBlackMarkerId)).toBe(3);
    expect(countPlayerCopies(internalCardState, 'black', result.blackMarkerId)).toBe(0);
    expect(countPlayerCopies(internalCardState, 'white', result.whiteMarkerId)).toBe(3);
  });
});
