"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const url_1 = require("url");
const child_process_1 = require("child_process");
const DeckSpecHelpers = __importStar(require("../shared/deck-spec.js"));
const workerModulePath = (0, url_1.pathToFileURL)(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__ROOM_DECK_RESULT__';
function runScenario(runnerSource, action) {
    const result = (0, child_process_1.spawnSync)(process.execPath, ['-e', runnerSource, workerModulePath, action], {
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
        "  const blackDeckIds = blackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);",
        "  const whiteDeckIds = whiteEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);",
        "  const blackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(blackDeckIds);",
        "  const whiteDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(whiteDeckIds);",
        "  const blackDeckCode = DeckCodecModule.encodeDeckSpec(blackDeckSpec);",
        "  const whiteDeckCode = DeckCodecModule.encodeDeckSpec(whiteDeckSpec);",
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
        "  let publishPayload = null;",
        "  let publishStatus = null;",
        "  let internalPublishCardState = null;",
        "  if (action === 'reset') {",
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
        "    publishStatus,",
        "    publishPayload,",
        "    internalPublishCardState,",
        "    blackDeckCode,",
        "    whiteDeckCode,",
        "    blackMarkerId: blackEnabledIds[0],",
        "    whiteMarkerId: whiteEnabledIds[0],",
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
    test('公開 create/join/state が黒白別の roomDeck を返す', () => {
        const result = runRoomDeckScenario('state');
        const cardState = result.statePayload.snapshot.cardState;
        expect(result.createStatus).toBe(200);
        expect(result.joinStatus).toBe(200);
        expect(result.stateStatus).toBe(200);
        expect(result.createPayload.ok).toBe(true);
        expect(result.createPayload.networkDebugEnabled).toBe(true);
        expect(result.createPayload.roomBoardConfig).toMatchObject({
            rows: 7,
            cols: 9,
            standard8x8: false
        });
        expect(result.createPayload.roomDeck.mode).toBe('perPlayer');
        expect(result.createPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
        expect(result.createPayload.roomDeck.deckCodeByPlayer.white).toBe('');
        expect(result.joinPayload.networkDebugEnabled).toBe(true);
        expect(result.joinPayload.roomBoardConfig).toMatchObject({
            rows: 7,
            cols: 9,
            standard8x8: false
        });
        expect(result.joinPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
        expect(result.joinPayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
        expect(result.statePayload.networkDebugEnabled).toBe(true);
        expect(result.statePayload.roomBoardConfig).toMatchObject({
            rows: 7,
            cols: 9,
            standard8x8: false
        });
        expect(result.statePayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
        expect(result.statePayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
        expect(result.statePayload.snapshot.gameState.board).toHaveLength(7);
        expect(result.statePayload.snapshot.gameState.board[0]).toHaveLength(9);
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
            rows: 7,
            cols: 9,
            standard8x8: false
        });
        expect(result.publishPayload.roomDeck.deckCodeByPlayer.black).toBe(result.blackDeckCode);
        expect(result.publishPayload.roomDeck.deckCodeByPlayer.white).toBe(result.whiteDeckCode);
        expect(result.publishPayload.snapshot.gameState.board).toHaveLength(7);
        expect(result.publishPayload.snapshot.gameState.board[0]).toHaveLength(9);
        expect(result.publishPayload.snapshot.cardState.initialDeckSizeByPlayer.black).toBe(30);
        expect(result.publishPayload.snapshot.cardState.initialDeckSizeByPlayer.white).toBe(30);
        expect(blackTotalCards).toBe(30);
        expect(whiteTotalCards).toBe(30);
        expect(internalBlackCardState).toBeTruthy();
        expect(countPlayerCopies(internalBlackCardState, 'black', result.blackMarkerId)).toBe(3);
        expect(countPlayerCopies(internalBlackCardState, 'white', result.whiteMarkerId)).toBe(3);
        expect(blackCardState.hands.black).toHaveLength(1);
    });
});
//# sourceMappingURL=workers.match-room-deck.test.js.map