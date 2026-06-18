import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function getProjectedStateForViewer(viewerKey) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const viewerKey = process.argv[2];",
    "  const seatKey = viewerKey === 'spectator' ? '' : viewerKey;",
    "  const seatToken = seatKey === 'black' ? 'token_black' : 'token_white';",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMTEST',",
    "    stateVersion: 3,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    spectators: { spec_visibility: { token: 'spec-token', name: '観戦', joinedAt: 1000, lastSeenAt: 1000 } },",
    "    snapshot: {",
    "      gameState: { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },",
    "      cardState: {",
    "        hands: { black: ['condemn_will'], white: ['gold_stone', 'silver_stone'] },",
    "        pendingEffectByPlayer: {",
    "          black: {",
    "            type: 'CONDEMN_WILL',",
    "            stage: 'selectTarget',",
    "            offers: [",
    "              { handIndex: 0, cardId: '__hidden_hand__:white:0' },",
    "              { handIndex: 1, cardId: '__hidden_hand__:white:1' }",
    "            ]",
    "          },",
    "          white: null",
    "        }",
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
    "  const stateUrl = viewerKey === 'spectator'",
    "    ? 'https://room/api/match/state?viewerRole=spectator&spectatorId=spec_visibility&spectatorToken=spec-token'",
    "    : `https://room/api/match/state?seatKey=${seatKey}&seatToken=${seatToken}`;",
    "  const response = await durableObject.handleState(new URL(stateUrl));",
    "  const payload = await response.json();",
    "  process.stdout.write(JSON.stringify({",
    "    offers: payload.snapshot.cardState.pendingEffectByPlayer.black.offers,",
    "    hands: payload.snapshot.cardState.hands,",
    "    meta: payload.snapshot._meta",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, viewerKey], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker projection check failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function getProjectedOffersForSeat(seatKey) {
  return getProjectedStateForViewer(seatKey).offers;
}

describe('match worker condemn visibility projection', () => {
  test('reveals condemn offers to the effect owner seat', () => {
    const offers = getProjectedOffersForSeat('black');
    expect(Array.isArray(offers)).toBe(true);
    expect(offers).toHaveLength(2);
    expect(offers[0]).toEqual({ handIndex: 0, cardId: 'gold_stone' });
    expect(offers[1]).toEqual({ handIndex: 1, cardId: 'silver_stone' });
  });

  test('keeps condemn offers hidden for the non-owner seat', () => {
    const offers = getProjectedOffersForSeat('white');
    expect(Array.isArray(offers)).toBe(true);
    expect(offers).toHaveLength(2);
    expect(offers[0].cardId).toBe('__hidden_hand__:white:0');
    expect(offers[1].cardId).toBe('__hidden_hand__:white:1');
  });

  test('keeps condemn target offers and both hands hidden for spectators', () => {
    const projected = getProjectedStateForViewer('spectator');

    expect(projected.meta).toEqual(expect.objectContaining({ viewerRole: 'spectator' }));
    expect(projected.offers).toHaveLength(2);
    expect(projected.offers[0].cardId).toBe('__hidden_hand__:white:0');
    expect(projected.offers[1].cardId).toBe('__hidden_hand__:white:1');
    expect(projected.hands.black.every((cardId) => String(cardId).startsWith('__hidden_hand__:black:'))).toBe(true);
    expect(projected.hands.white.every((cardId) => String(cardId).startsWith('__hidden_hand__:white:'))).toBe(true);
  });
});
