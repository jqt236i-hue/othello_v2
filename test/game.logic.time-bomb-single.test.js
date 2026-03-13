const CardTimeBomb = require('../game/logic/cards/time_bomb');

describe('CardTimeBomb.tickBombAt', () => {
  test('uses TIME_BOMB destroy cause when BoardOps is available', () => {
    const cardState = {
      turnIndex: 10,
      markers: [
        { id: 1, kind: 'bomb', row: 3, col: 3, owner: 'black', createdSeq: 1, data: { remainingTurns: 1, placedTurn: 5 } }
      ]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(1)) };
    const bomb = cardState.markers[0];

    const calls = [];
    const BoardOps = {
      destroyAt: (cs, gs, r, c, cause, reason) => {
        calls.push({ r, c, cause, reason });
        return { destroyed: true };
      }
    };

    const res = CardTimeBomb.tickBombAt(cardState, gameState, bomb, 'black', { BoardOps });
    expect(res.removed).toBe(true);
    expect(res.exploded).toEqual([{ row: 3, col: 3 }]);
    expect(res.destroyed.length).toBe(9);
    expect(calls.length).toBe(9);
    expect(calls.every(c => c.cause === 'TIME_BOMB' && c.reason === 'bomb_explosion')).toBe(true);
  });

  test('includes adjacent expansion cell in explosion range', () => {
    const cardState = {
      turnIndex: 10,
      markers: [
        { id: 1, kind: 'bomb', row: 3, col: 0, owner: 'black', createdSeq: 1, data: { remainingTurns: 1, placedTurn: 5 } }
      ]
    };
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      boardExpansion: {
        active: true,
        side: 'left',
        row: 3,
        owner: -1,
        usedByPlayer: { black: true, white: false }
      }
    };
    const bomb = cardState.markers[0];

    const calls = [];
    const BoardOps = {
      destroyAt: (cs, gs, r, c, cause, reason) => {
        calls.push({ r, c, cause, reason });
        return { destroyed: true };
      }
    };

    const res = CardTimeBomb.tickBombAt(cardState, gameState, bomb, 'black', { BoardOps });
    expect(res.removed).toBe(true);
    expect(calls.some(c => c.r === 3 && c.c === -1)).toBe(true);
    expect(calls.every(c => c.cause === 'TIME_BOMB' && c.reason === 'bomb_explosion')).toBe(true);
  });
});

