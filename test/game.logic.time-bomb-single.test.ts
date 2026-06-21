import * as CardTimeBomb from '../game/logic/cards/time_bomb.js';
import * as BoardOps from '../game/logic/board_ops.js';

describe('CardTimeBomb.tickBombAt', () => {
  test('uses TIME_BOMB destroy cause when BoardOps is available', () => {
    const cardState = {
      turnIndex: 10,
      markers: [
        { id: 1, kind: 'specialStone', row: 3, col: 3, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 5 } }
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
        { id: 1, kind: 'specialStone', row: 3, col: 0, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 5 } }
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

  test('includes top expansion cell in explosion range', () => {
    const cardState = {
      turnIndex: 10,
      markers: [
        { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 5 } }
      ]
    };
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: true, white: false },
        cells: [{ side: 'top', row: -1, col: 0, owner: -1 }]
      }
    };
    const bomb = cardState.markers[0];

    const calls = [];
    const BoardOps = {
      destroyAt: (cs, gs, r, c, cause, reason) => {
        calls.push({ r, c, cause, reason });
        return { destroyed: true };
      },
      getExpansionDescriptors: require('../game/logic/board_ops').getExpansionDescriptors,
      getCellValue: require('../game/logic/board_ops').getCellValue,
      setCellValue: require('../game/logic/board_ops').setCellValue
    };

    const res = CardTimeBomb.tickBombAt(cardState, gameState, bomb, 'black', { BoardOps });
    expect(res.removed).toBe(true);
    expect(calls.some(c => c.r === -1 && c.c === 0)).toBe(true);
    expect(calls.every(c => c.cause === 'TIME_BOMB' && c.reason === 'bomb_explosion')).toBe(true);
  });

  test('makes destroy evade skip all blast cells from the same explosion', () => {
    const cardState = {
      turnIndex: 10,
      _defaultRandomSource: { random: () => 0 },
      markers: [
        { id: 1, kind: 'specialStone', row: 3, col: 3, owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1, placedTurn: 5 } },
        {
          id: 2,
          kind: 'specialStone',
          row: 3,
          col: 4,
          owner: 'white',
          createdSeq: 2,
          data: {
            type: 'WILL_HUNTER_KING',
            remainingOwnerTurns: 8,
            flipEvadeRemaining: 2,
            destroyEvadeRemaining: 1
          }
        }
      ]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(1)) };
    gameState.board[3][4] = -1;
    gameState.board[4][4] = 0;
    gameState.board[7][7] = 0;

    const bomb = cardState.markers[0];
    const res = CardTimeBomb.tickBombAt(cardState, gameState, bomb, 'black', { BoardOps });

    expect(res.removed).toBe(true);
    expect(gameState.board[3][4]).toBe(0);
    expect(gameState.board[4][4]).toBe(0);
    expect(gameState.board[7][7]).toBe(-1);
    const movedMarker = cardState.markers.find((m) => m && m.id === 2);
    expect(movedMarker).toBeTruthy();
    expect(movedMarker.row).toBe(7);
    expect(movedMarker.col).toBe(7);
    expect(movedMarker.data.destroyEvadeRemaining).toBe(0);
  });
});
