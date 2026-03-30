const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function getProjectedOpponentHandForSeat(seatKey) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const seatKey = process.argv[2];",
    "  const seatToken = seatKey === 'black' ? 'token_black' : 'token_white';",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMTEST',",
    "    stateVersion: 4,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['reveal_hand_01'], white: ['gold_stone', 'silver_stone'] },",
    "        discard: [],",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        _nextCardCopySeq: 10,",
    "        _handCopyIdsByPlayer: { black: [1], white: [2, 3] },",
    "        _deckCopyIdsByPlayer: { black: [], white: [] },",
    "        _discardCopyIds: [],",
    "        _revealedHandCopyIdsByViewer: { black: [2], white: [] }",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const response = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=${seatKey}&seatToken=${seatToken}`));",
    "  const payload = await response.json();",
    "  process.stdout.write(JSON.stringify(payload.snapshot.cardState.hands.white));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, seatKey], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker reveal-hand projection check failed');
  }

  return JSON.parse(String(result.stdout || '[]'));
}

describe('match worker reveal-hand visibility projection', () => {
  test('shows only revealed opponent copies to the effect owner seat', () => {
    expect(getProjectedOpponentHandForSeat('black')).toEqual(['gold_stone', '__hidden_hand__:white:1']);
  });

  test('keeps the owner seat hand fully visible for the owning player', () => {
    expect(getProjectedOpponentHandForSeat('white')).toEqual(['gold_stone', 'silver_stone']);
  });
});
