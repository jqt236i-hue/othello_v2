import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function getProjectedTrapStateForSeat(seatKey: 'black' | 'white') {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const seatKey = process.argv[2];",
    "  const seatToken = seatKey === 'black' ? 'token_black' : 'token_white';",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[2][2] = 1;",
    "  const room = {",
    "    roomId: 'TRAP1', stateVersion: 4, updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    snapshot: {",
    "      gameState: { currentPlayer: -1, board, turnNumber: 6 },",
    "      cardState: {",
    "        hands: { black: [], white: [] },",
    "        discard: [],",
    "        pendingEffectByPlayer: { black: null, white: null },",
    "        markers: [{",
    "          id: 101, kind: 'specialStone', row: 2, col: 2, owner: 'black',",
    "          data: { type: 'TRAP', hidden: true, armedForPlayer: 'white', remainingOwnerTurns: 1 }",
    "        }],",
    "        specialStones: [{ row: 2, col: 2, owner: 'black', type: 'TRAP', remainingOwnerTurns: 1 }]",
    "      }",
    "    }",
    "  };",
    "  const storage = new Map(); storage.set('match_room_state_v1', room);",
    "  const durableObject = new MatchRoomDurableObject({ storage: {",
    "    get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value),",
    "    delete: async (key) => storage.delete(key)",
    "  } });",
    "  const response = await durableObject.handleState(new URL(`https://room/api/match/state?seatKey=${seatKey}&seatToken=${seatToken}`));",
    "  const payload = await response.json();",
    "  process.stdout.write(JSON.stringify({",
    "    markers: payload.snapshot.cardState.markers || [],",
    "    specialStones: payload.snapshot.cardState.specialStones || [],",
    "    boardValue: payload.snapshot.gameState.board[2][2]",
    "  }));",
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, seatKey], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker trap visibility projection check failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

describe('match worker trap visibility projection', () => {
  test('keeps hidden trap details visible to the owner seat', () => {
    const projected = getProjectedTrapStateForSeat('black');

    expect(projected.boardValue).toBe(1);
    expect(projected.markers).toEqual([
      expect.objectContaining({
        row: 2,
        col: 2,
        owner: 'black',
        data: expect.objectContaining({ type: 'TRAP', hidden: true })
      })
    ]);
    expect(projected.specialStones).toEqual([
      expect.objectContaining({ row: 2, col: 2, owner: 'black', type: 'TRAP' })
    ]);
  });

  test('hides hidden trap marker details from the opposing seat', () => {
    const projected = getProjectedTrapStateForSeat('white');

    expect(projected.boardValue).toBe(1);
    expect(projected.markers).toEqual([]);
    expect(projected.specialStones).toEqual([]);
  });
});
