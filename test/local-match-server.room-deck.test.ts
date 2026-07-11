import * as http from 'http';
import * as SharedConstants from '../shared-constants.js';
import * as DeckSpecHelpers from '../shared/deck-spec.js';
import * as DeckCodecModule from '../shared/deck-codec.js';
const {
  createLocalMatchServer,
  resetRoomsForTests,
  patchRoomSnapshotForTests
} = require('../scripts/local-match-server');

function requestJson(port, method, path, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(() => resolve()));
}

function buildDistinctDeckCodes() {
  const enabledIds = (SharedConstants.CARD_DEFS || [])
    .filter((card) => card && card.enabled !== false && card.id)
    .map((card) => card.id);
  const blackEnabledIds = enabledIds.slice(0, 10);
  const whiteEnabledIds = enabledIds.slice(10, 20);
  const updatedBlackEnabledIds = enabledIds.slice(20, 30);
  const blackDeckIds = blackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
  const whiteDeckIds = whiteEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
  const updatedBlackDeckIds = updatedBlackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
  const blackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(blackDeckIds);
  const whiteDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(whiteDeckIds);
  const updatedBlackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(updatedBlackDeckIds);
  return {
    blackDeckCode: DeckCodecModule.encodeDeckSpec(blackDeckSpec),
    whiteDeckCode: DeckCodecModule.encodeDeckSpec(whiteDeckSpec),
    updatedBlackDeckCode: DeckCodecModule.encodeDeckSpec(updatedBlackDeckSpec),
    blackMarkerId: blackEnabledIds[0],
    whiteMarkerId: whiteEnabledIds[0],
    updatedBlackMarkerId: updatedBlackEnabledIds[0]
  };
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

describe('local match server room deck', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('両者デフォルト時は同じ30種を共有しつつ山札順だけ黒白で別になる', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ'
      });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ'
      });

      expect(created.status).toBe(200);
      expect(joined.status).toBe(200);
      expect(joined.data.roomDeck).toMatchObject({
        mode: 'shared',
        deckCode: '',
        deckSize: DeckSpecHelpers.getDefaultDeckSize()
      });

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackSeatToken)}`
      );

      let internalCardState = null;
      const captured = patchRoomSnapshotForTests(roomId, (room) => {
        internalCardState = JSON.parse(JSON.stringify(room && room.snapshot && room.snapshot.cardState ? room.snapshot.cardState : null));
      });
      expect(captured).toBe(true);
      expect(state.status).toBe(200);
      expect(state.data.roomDeck).toMatchObject({
        mode: 'shared',
        deckCode: '',
        deckSize: DeckSpecHelpers.getDefaultDeckSize()
      });

      const blackCards = listPlayerCards(internalCardState, 'black');
      const whiteCards = listPlayerCards(internalCardState, 'white');

      expect(blackCards).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
      expect(whiteCards).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
      expect(new Set(blackCards).size).toBe(DeckSpecHelpers.getDefaultDeckSize());
      expect(new Set(whiteCards).size).toBe(DeckSpecHelpers.getDefaultDeckSize());
      expect(blackCards.slice().sort()).toEqual(whiteCards.slice().sort());
      expect(blackCards).not.toEqual(whiteCards);
    } finally {
      await closeServer(server);
    }
  });

  test('両者全カードデッキ設定は黒白両方へLv9全カードデッキを強制する', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    const deckInfo = buildDistinctDeckCodes();
    const expectedAllCardsDeck = DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds();

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        deckCode: deckInfo.blackDeckCode,
        allCardsDeckEnabled: true
      });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ',
        deckCode: deckInfo.whiteDeckCode
      });

      expect(created.status).toBe(200);
      expect(joined.status).toBe(200);
      expect(created.data.roomDeck).toMatchObject({
        mode: 'shared',
        source: 'allCards',
        deckCode: '',
        deckSize: expectedAllCardsDeck.length
      });
      expect(joined.data.roomDeck).toMatchObject({
        mode: 'shared',
        source: 'allCards',
        deckCode: '',
        deckSize: expectedAllCardsDeck.length
      });

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackSeatToken)}`
      );

      let internalCardState = null;
      const captured = patchRoomSnapshotForTests(roomId, (room) => {
        internalCardState = JSON.parse(JSON.stringify(room && room.snapshot && room.snapshot.cardState ? room.snapshot.cardState : null));
      });
      expect(captured).toBe(true);
      expect(state.status).toBe(200);
      expect(state.data.roomDeck).toMatchObject({
        mode: 'shared',
        source: 'allCards',
        deckSize: expectedAllCardsDeck.length
      });
      expect(internalCardState.initialDeckSizeByPlayer.black).toBe(expectedAllCardsDeck.length);
      expect(internalCardState.initialDeckSizeByPlayer.white).toBe(expectedAllCardsDeck.length);
      expect(sortedCards(listPlayerCards(internalCardState, 'black'))).toEqual(sortedCards(expectedAllCardsDeck));
      expect(sortedCards(listPlayerCards(internalCardState, 'white'))).toEqual(sortedCards(expectedAllCardsDeck));
      expect(listPlayerCards(internalCardState, 'black')).toContain('observer_will_01');
      expect(listPlayerCards(internalCardState, 'black')).toContain('board_executor_01');
      expect(listPlayerCards(internalCardState, 'black')).toContain('theory_incarnation_01');
    } finally {
      await closeServer(server);
    }
  });

  test('timeout turn-start reconcile keeps per-player custom decks in rebuilt baseline cardState', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    const deckInfo = buildDistinctDeckCodes();
    const roomBoardConfig = { rows: 10, cols: 10, shape: 'circle' };

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        deckCode: deckInfo.blackDeckCode,
        roomBoardConfig
      });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ',
        deckCode: deckInfo.whiteDeckCode
      });

      expect(created.status).toBe(200);
      expect(joined.status).toBe(200);

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        const turnIndex = room && room.snapshot && room.snapshot.cardState && Number.isFinite(Number(room.snapshot.cardState.turnIndex))
          ? Number(room.snapshot.cardState.turnIndex)
          : 1;
        room.turnTimer = {
          limitSeconds: 120,
          active: true,
          turnSeatKey: 'black',
          turnStartedAt: 0,
          turnDeadlineAt: 0
        };
        room.snapshot = Object.assign({}, room.snapshot, {
          cardState: { turnIndex }
        });
      });
      expect(patched).toBe(true);

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackSeatToken)}`
      );

      let internalCardState = null;
      const captured = patchRoomSnapshotForTests(roomId, (room) => {
        internalCardState = JSON.parse(JSON.stringify(room && room.snapshot && room.snapshot.cardState ? room.snapshot.cardState : null));
      });
      expect(captured).toBe(true);

      expect(state.status).toBe(200);
      expect(state.data.ok).toBe(true);
      expect(created.data.roomBoardConfig).toMatchObject({
        rows: 10,
        cols: 10,
        shape: 'circle',
        standard8x8: false
      });
      expect(joined.data.roomBoardConfig).toMatchObject({
        rows: 10,
        cols: 10,
        shape: 'circle',
        standard8x8: false
      });
      expect(state.data.roomBoardConfig).toMatchObject({
        rows: 10,
        cols: 10,
        shape: 'circle',
        standard8x8: false
      });
      expect(state.data.roomDeck.deckCodeByPlayer.black).toBe(deckInfo.blackDeckCode);
      expect(state.data.roomDeck.deckCodeByPlayer.white).toBe(deckInfo.whiteDeckCode);
      expect(state.data.stateVersion).toBe(2);
      expect(Array.isArray(state.data.snapshot.gameState.board)).toBe(true);
      expect(state.data.snapshot.gameState.board).toHaveLength(10);
      expect(state.data.snapshot.gameState.board[0]).toHaveLength(10);
      expect(state.data.snapshot.gameState.boardConfig).toMatchObject({ shape: 'circle' });
      expect(internalCardState).toBeTruthy();
      expect(internalCardState.initialDeckSizeByPlayer.black).toBe(30);
      expect(internalCardState.initialDeckSizeByPlayer.white).toBe(30);
      expect(countPlayerCopies(internalCardState, 'black', deckInfo.blackMarkerId)).toBe(3);
      expect(countPlayerCopies(internalCardState, 'white', deckInfo.blackMarkerId)).toBe(0);
      expect(countPlayerCopies(internalCardState, 'white', deckInfo.whiteMarkerId)).toBe(3);
      expect(countPlayerCopies(internalCardState, 'black', deckInfo.whiteMarkerId)).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  test('デッキ変更後の再戦 reset_game は変更後の黒 deck を使う', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    const deckInfo = buildDistinctDeckCodes();

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        deckCode: deckInfo.blackDeckCode
      });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ',
        deckCode: deckInfo.whiteDeckCode
      });
      expect(created.status).toBe(200);
      expect(joined.status).toBe(200);

      const updated = await requestJson(port, 'POST', '/api/match/deck', {
        roomId,
        seatKey: 'black',
        seatToken: blackSeatToken,
        deckCode: deckInfo.updatedBlackDeckCode
      });

      expect(updated.status).toBe(200);
      expect(updated.data.ok).toBe(true);
      expect(updated.data.roomDeck.deckCodeByPlayer.black).toBe(deckInfo.updatedBlackDeckCode);
      expect(updated.data.roomDeck.deckCodeByPlayer.white).toBe(deckInfo.whiteDeckCode);

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        room.stateVersion = 5;
        room.snapshot = {
          gameState: {
            board: Array.from({ length: 8 }, () => Array(8).fill(1)),
            currentPlayer: 1,
            consecutivePasses: 0,
            turnNumber: 60
          },
          cardState: {}
        };
        room.updatedAt = Date.now();
      });
      expect(patched).toBe(true);

      const reset = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: joined.data.seatToken,
        operationId: 'local-room-deck-update-reset',
        baseVersion: 5,
        actionType: 'reset_game',
        snapshot: {
          gameState: {
            board: Array.from({ length: 8 }, () => Array(8).fill(-1)),
            currentPlayer: 1,
            consecutivePasses: 0,
            turnNumber: 0
          },
          cardState: {}
        }
      });

      let internalCardState = null;
      const captured = patchRoomSnapshotForTests(roomId, (room) => {
        internalCardState = JSON.parse(JSON.stringify(room && room.snapshot && room.snapshot.cardState ? room.snapshot.cardState : null));
      });
      expect(captured).toBe(true);
      expect(reset.status).toBe(200);
      expect(reset.data.ok).toBe(true);
      expect(reset.data.roomDeck.deckCodeByPlayer.black).toBe(deckInfo.updatedBlackDeckCode);
      expect(reset.data.roomDeck.deckCodeByPlayer.white).toBe(deckInfo.whiteDeckCode);
      expect(reset.data.snapshot.cardState.initialDeckSizeByPlayer.black).toBe(30);
      expect(reset.data.snapshot.cardState.initialDeckSizeByPlayer.white).toBe(30);
      expect(countPlayerCopies(internalCardState, 'black', deckInfo.updatedBlackMarkerId)).toBe(3);
      expect(countPlayerCopies(internalCardState, 'black', deckInfo.blackMarkerId)).toBe(0);
      expect(countPlayerCopies(internalCardState, 'white', deckInfo.whiteMarkerId)).toBe(3);
    } finally {
      await closeServer(server);
    }
  });
});
