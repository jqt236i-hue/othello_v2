const http = require('http');
const SharedConstants = require('../shared-constants');
const DeckSpecHelpers = require('../shared/deck-spec');
const DeckCodecModule = require('../shared/deck-codec');
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
  const blackDeckIds = blackEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
  const whiteDeckIds = whiteEnabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
  const blackDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(blackDeckIds);
  const whiteDeckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(whiteDeckIds);
  return {
    blackDeckCode: DeckCodecModule.encodeDeckSpec(blackDeckSpec),
    whiteDeckCode: DeckCodecModule.encodeDeckSpec(whiteDeckSpec),
    blackMarkerId: blackEnabledIds[0],
    whiteMarkerId: whiteEnabledIds[0]
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

describe('local match server room deck', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('timeout turn-start reconcile keeps per-player custom decks in rebuilt baseline cardState', async () => {
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
      expect(state.data.roomDeck.deckCodeByPlayer.black).toBe(deckInfo.blackDeckCode);
      expect(state.data.roomDeck.deckCodeByPlayer.white).toBe(deckInfo.whiteDeckCode);
      expect(state.data.stateVersion).toBe(2);
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
});
