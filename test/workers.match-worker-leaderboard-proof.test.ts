import { buildMatchWorkerLeaderboardProof } from '../workers/match-worker-leaderboard-proof';

const PLAYER_ID = 'p_ABCDEFGHIJKLMNOPQRSTUV0001';

function createTerminalRoom() {
  const board = Array.from({ length: 8 }, (_row, row) => (
    Array.from({ length: 8 }, (_cell, col) => (row * 8 + col < 44 ? 1 : -1))
  ));
  return {
    roomId: 'ROOM1234',
    stateVersion: 42,
    seats: { black: true, white: true },
    seatPlayerIds: { black: PLAYER_ID, white: 'p_ZYXWVUTSRQPONMLKJIHGFE0002' },
    snapshot: {
      gameState: {
        board,
        boardConfig: { rows: 8, cols: 8, shape: 'rectangle', standard8x8: true }
      },
      cardState: {
        turnCountByPlayer: { black: 24, white: 18 },
        totalFlipCountByPlayer: { black: 150, white: 90 }
      }
    }
  };
}

describe('match worker leaderboard proof', () => {
  test('terminal room state produces an authority-verified score payload', () => {
    const result = buildMatchWorkerLeaderboardProof(
      createTerminalRoom(),
      { playerId: PLAYER_ID, seatKey: 'black', score: 100000 },
      { terminal: true, debugEnabled: false }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      authorityVerified: true,
      authoritySource: 'match_room',
      matchId: 'ROOM1234',
      stateVersion: 42,
      playerId: PLAYER_ID,
      category: 'score',
      mode: 'network',
      score: 8818,
      scoreVersion: 5,
      turnCount: 42,
      debug: false
    });
  });

  test.each([
    [{ playerId: PLAYER_ID, seatKey: 'white' }, { terminal: true, debugEnabled: false }, 403, 'LEADERBOARD_SEAT_IDENTITY_MISMATCH'],
    [{ playerId: PLAYER_ID, seatKey: 'black' }, { terminal: false, debugEnabled: false }, 409, 'MATCH_NOT_FINISHED'],
    [{ playerId: PLAYER_ID, seatKey: 'black' }, { terminal: true, debugEnabled: true }, 400, 'SCORE_INELIGIBLE']
  ])('rejects unverified authority context %#', (body, options, status, reason) => {
    const result = buildMatchWorkerLeaderboardProof(createTerminalRoom(), body, options);
    expect(result).toEqual({ ok: false, status, reason });
  });
});
