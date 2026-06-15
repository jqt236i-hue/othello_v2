import * as CardRegen from '../game/logic/cards/regen.js';
import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

const SpecialStoneRegistry = require('../shared/special-stone-registry.js');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.5
  };
}

function registryFlipProtectedTypes(): string[] {
  return Object.entries(SpecialStoneRegistry.SPECIAL_STONE_REGISTRY || {})
    .filter(([, info]: any) => info && info.flipProtected === true)
    .map(([type]) => String(type));
}

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

  test('allocates stable marker ids across repeated direct placements', () => {
    const cardState = { markers: [] };

    CardRegen.applyRegenWill(cardState, 'black', 2, 4);
    CardRegen.applyRegenWill(cardState, 'white', 3, 4);

    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, createdSeq: 1, row: 2, col: 4, owner: 'black' }),
      expect.objectContaining({ id: 2, createdSeq: 2, row: 3, col: 4, owner: 'white' })
    ]));
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

  test('white regen recovery writes white ownership back to the board', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[4][4] = Core.BLACK;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'REGEN', regenRemaining: 2 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };

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
      [{ row: 4, col: 4 }],
      'black',
      false,
      { BoardOps, removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], blockedCells: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toEqual([{ row: 4, col: 4 }]);
    expect(gameState.board[4][4]).toBe(Core.WHITE);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'white',
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 1 })
      })
    ]));
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

  test('regen on 10x10 right expansion cell can capture back across the board edge', () => {
    const board = Array(10).fill(null).map(() => Array(10).fill(0));
    board[0][9] = -1;
    board[0][8] = 1;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 0, col: 10, owner: 'black', data: { type: 'REGEN', regenRemaining: 1 } }
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
        cells: [{ side: 'right', row: 0, col: 10, owner: -1 }]
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
      [{ row: 0, col: 10 }],
      'white',
      false,
      { removeMarkersAt, getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }), clearBombAt: () => {} }
    );

    expect(res.regened).toEqual([{ row: 0, col: 10 }]);
    expect(res.captureFlips).toEqual(expect.arrayContaining([{ row: 0, col: 9 }]));
    expect(gameState.board[0][9]).toBe(1);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === 10).owner).toBe(1);
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

  test('destroy trigger consumes one revive, forces regen presentation, and flips captured line', () => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = 1;
    board[3][4] = -1;
    board[3][5] = 1;

    const cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'REGEN', regenRemaining: 2 } }
      ],
      presentationEvents: []
    };
    const gameState = { board };
    const changeCalls = [];

    const res = CardRegen.applyRegenAfterDestroy(
      cardState,
      gameState,
      3,
      3,
      { destroyCause: 'DESTROY_ONE_STONE', destroyReason: 'destroy_selected' },
      {
        BoardOps: {
          changeAt: (...args) => {
            changeCalls.push(args);
            const [, gs, r, c, ownerKey] = args;
            gs.board[r][c] = ownerKey === 'black' ? 1 : -1;
            return { changed: true, presented: true };
          },
          emitPresentationEvent: (cs, ev) => {
            cs.presentationEvents.push(ev);
          }
        },
        removeMarkersAt: (cs, r, c, criteria) => {
          cs.markers = (cs.markers || []).filter(m => !(
            m &&
            m.kind === criteria.kind &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === criteria.type
          ));
        },
        getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
        clearBombAt: () => {}
      }
    );

    expect(res).toMatchObject({
      regenerated: true,
      regened: [{ row: 3, col: 3 }],
      captureFlips: [{ row: 3, col: 4 }],
      owner: 'black',
      remaining: 1
    });
    expect(gameState.board[3][3]).toBe(1);
    expect(gameState.board[3][4]).toBe(1);
    expect(changeCalls[0][7]).toMatchObject({ forcePresentation: true });
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 3,
        col: 3,
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 1 })
      })
    ]));
  });

  test.each(registryFlipProtectedTypes())('destroy-triggered regen capture does not flip through %s', (specialType) => {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    board[3][3] = Core.BLACK;
    board[3][4] = Core.WHITE;
    board[3][5] = Core.BLACK;

    const cardState = CardLogic.createCardState(createPrng());
    cardState.markers.push(
      {
        id: 'regen-direct',
        row: 3,
        col: 3,
        kind: 'specialStone',
        owner: 'black',
        createdSeq: 1,
        data: { type: 'REGEN', regenRemaining: 2, ownerColor: Core.BLACK }
      },
      {
        id: `${specialType}-protected`,
        row: 3,
        col: 4,
        kind: 'specialStone',
        owner: 'white',
        createdSeq: 2,
        data: { type: specialType, remainingOwnerTurns: 6 }
      }
    );

    const destroyed = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');

    expect(destroyed).toMatchObject({
      kind: 'regenerated',
      regenerated: true,
      captureFlips: []
    });
    expect(board[3][3]).toBe(Core.BLACK);
    expect(board[3][4]).toBe(Core.WHITE);
  });

  test('BoardOps.destroyAt returns regenerated outcome and keeps expansion regen stone in place', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 5,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'left', row: 5, col: -1, owner: Core.WHITE }]
    };
    cardState.markers.push({
      id: 'regen-expansion-direct',
      row: 5,
      col: -1,
      kind: 'specialStone',
      owner: 'white',
      createdSeq: 1,
      data: { type: 'REGEN', regenRemaining: 3, ownerColor: Core.WHITE }
    });

    const destroyed = BoardOps.destroyAt(cardState, gameState, 5, -1, 'DESTROY_ONE_STONE', 'destroy_selected');

    expect(destroyed).toMatchObject({
      kind: 'regenerated',
      destroyed: false,
      regenerated: true,
      remaining: 2
    });
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 5, col: -1, owner: Core.WHITE })
    ]));
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 5,
        col: -1,
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 2 })
      })
    ]));
    expect(cardState.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'DESTROY',
        row: 5,
        col: -1,
        meta: expect.objectContaining({ regenerated: true })
      }),
      expect.objectContaining({
        type: 'CHANGE',
        row: 5,
        col: -1,
        reason: 'regen_triggered'
      })
    ]));
  });
});
