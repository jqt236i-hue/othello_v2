const CardRegen = require('../game/logic/cards/regen');
const CardLogic = require('../game/logic/cards');

describe('regen consume visual event', () => {
  test('places regen marker with three remaining revives', () => {
    const cardState = { markers: [] };

    const res = CardRegen.applyRegenWill(cardState, 'black', 2, 4);

    expect(res).toEqual({ applied: true });
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        row: 2,
        col: 4,
        owner: 'black',
        kind: 'specialStone',
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 3, ownerColor: 1 })
      })
    ]);
  });

  test('removes consumed regen marker immediately and emits STATUS_REMOVED', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = -1; // flipped against black owner

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'REGEN', regenRemaining: 1 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

    const BoardOps = {
      changeAt: (cs, gs, r, c, ownerKey) => {
        gs.board[r][c] = ownerKey === 'black' ? 1 : -1;
      },
      emitPresentationEvent: (cs, ev) => {
        cs.presentationEvents.push(ev);
      }
    };

    const removeMarkersAt = (cs, r, c, criteria) => {
      cs.markers = (cs.markers || []).filter(m => !(
        m &&
        m.kind === criteria.kind &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === criteria.type
      ));
    };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 3, col: 3 }],
      'white',
      false,
      { BoardOps, removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toHaveLength(1);
    expect(gameState.board[3][3]).toBe(1);
    expect(cardState.markers.some(m => m && m.row === 3 && m.col === 3 && m.data && m.data.type === 'REGEN')).toBe(false);
    expect(cardState.presentationEvents.some(ev => ev && ev.type === 'STATUS_REMOVED' && ev.meta && ev.meta.reason === 'regen_consumed')).toBe(true);
  });

  test('keeps regen marker and skips STATUS_REMOVED until the third trigger is consumed', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = -1;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'REGEN', regenRemaining: 3 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

    const BoardOps = {
      changeAt: (cs, gs, r, c, ownerKey) => {
        gs.board[r][c] = ownerKey === 'black' ? 1 : -1;
      },
      emitPresentationEvent: (cs, ev) => {
        cs.presentationEvents.push(ev);
      }
    };

    const removeMarkersAt = (cs, r, c, criteria) => {
      cs.markers = (cs.markers || []).filter(m => !(
        m &&
        m.kind === criteria.kind &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === criteria.type
      ));
    };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 3, col: 3 }],
      'white',
      false,
      { BoardOps, removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toHaveLength(1);
    expect(gameState.board[3][3]).toBe(1);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 2 })
      })
    ]));
    expect(cardState.presentationEvents.some(ev => ev && ev.type === 'STATUS_REMOVED')).toBe(false);
  });

  test('regen on expansion cell can capture back across the board edge', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][0] = -1;
    board[3][1] = 1;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: -1, owner: 'black', data: { type: 'REGEN', regenRemaining: 1 } }
      ],
      presentationEvents: []
    };
    const gameState = {
      board,
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: [{ side: 'left', row: 3, col: -1, owner: -1 }]
      }
    };

    const removeMarkersAt = (cs, r, c, criteria) => {
      cs.markers = (cs.markers || []).filter(m => !(
        m &&
        m.kind === criteria.kind &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === criteria.type
      ));
    };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 3, col: -1 }],
      'white',
      false,
      { removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toEqual([{ row: 3, col: -1 }]);
    expect(res.captureFlips).toEqual(expect.arrayContaining([{ row: 3, col: 0 }]));
    expect(gameState.board[3][0]).toBe(1);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(1);
  });

  test('frozen own stone cannot be used as regen capture anchor', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = -1;
    board[3][4] = -1;
    board[3][5] = 1;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'REGEN', regenRemaining: 1 } },
        { kind: 'specialStone', row: 3, col: 5, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 5 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

    const BoardOps = {
      changeAt: (cs, gs, r, c, ownerKey) => {
        gs.board[r][c] = ownerKey === 'black' ? 1 : -1;
      },
      emitPresentationEvent: (cs, ev) => {
        cs.presentationEvents.push(ev);
      }
    };

    const removeMarkersAt = (cs, r, c, criteria) => {
      cs.markers = (cs.markers || []).filter(m => !(
        m &&
        m.kind === criteria.kind &&
        m.row === r &&
        m.col === c &&
        m.data &&
        m.data.type === criteria.type
      ));
    };

    const res = CardRegen.applyRegenAfterFlips(
      cardState,
      gameState,
      [{ row: 3, col: 3 }],
      'white',
      false,
      { BoardOps, removeMarkersAt, getCardContext: () => CardLogic.getCardContext(cardState), clearBombAt: () => {} }
    );

    expect(res.regened).toEqual([{ row: 3, col: 3 }]);
    expect(res.captureFlips).toEqual([]);
    expect(gameState.board[3][3]).toBe(1);
    expect(gameState.board[3][4]).toBe(-1);
  });
});
