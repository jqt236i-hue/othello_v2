import { createCardLossEffect } from '../game/logic/cards-internal/loss-effect.js';

const SharedBoardUtils = require('../shared/shared-board-utils');

function createBoard(fill = 0) {
  return Array.from({ length: 4 }, () => Array(4).fill(fill));
}

function createBoardViewForCard(cardState: any, gameState: any) {
  const context = SharedBoardUtils.createBoardContext(gameState, cardState);
  return SharedBoardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
    strict: false
  });
}

describe('card loss effect module', () => {
  test('returns not_pending when the pending effect is absent or different', () => {
    const effect = createCardLossEffect({
      readCardPendingEffect: () => ({ type: 'OTHER' })
    });

    expect(effect.applyLossWill({}, {}, 'black')).toEqual({
      applied: false,
      reason: 'not_pending',
      removedCount: 0,
      removed: []
    });
  });

  test('uses canonical base/expansion cells and ignores meteor holes for restore and presentation', () => {
    const removeSpecial = { id: 'remove-special' };
    const removeBomb = { id: 'remove-bomb' };
    const meteorHole = {
      id: 'hole',
      kind: 'specialStone',
      row: 1,
      col: 1,
      data: { type: 'METEOR_HOLE' }
    };
    const cardState = {
      markers: [{ id: 'keep' }, removeSpecial, removeBomb, meteorHole]
    };
    const gameState = {
      board: createBoard(),
      boardExpansion: {
        cells: [{ side: 'top', row: -1, col: 0, owner: -1 }]
      }
    };
    gameState.board[0][0] = 1;
    gameState.board[1][1] = -1;

    const clearPending = jest.fn();
    const emitPresentationEvent = jest.fn();
    const restoreFromLivingWillSnapshot = jest.fn();
    const effect = createCardLossEffect({
      emptyValue: 0,
      readCardPendingEffect: () => ({ type: 'LOSS_WILL' }),
      clearCardPendingEffect: clearPending,
      collectLossWillRemovals: () => ({
        guardedCells: new Set(),
        removableSpecials: [removeSpecial],
        removableBombs: [removeBomb],
        removed: [
          { row: 0, col: 0, owner: 'black', type: 'WORK' },
          { row: -1, col: 0, owner: 'white', type: 'TIME_BOMB' },
          { row: 1, col: 1, owner: 'white', type: 'WORK' }
        ]
      }),
      createBoardViewForCard,
      emitPresentationEvent,
      findLivingWillMarkerAt: (_cs, row, col) => ({ row, col, token: `${row},${col}` }),
      restoreFromLivingWillSnapshot,
      getLivingWillModuleContext: () => ({ ctx: true })
    });

    const result = effect.applyLossWill(cardState, gameState, 'black');

    expect(result).toMatchObject({
      applied: true,
      removedCount: 3
    });
    expect(cardState.markers).toEqual([{ id: 'keep' }, meteorHole]);
    expect(emitPresentationEvent).toHaveBeenCalledTimes(2);
    expect(emitPresentationEvent).toHaveBeenCalledWith(
      cardState,
      expect.objectContaining({ row: -1, col: 0, type: 'STATUS_REMOVED' })
    );
    expect(emitPresentationEvent).not.toHaveBeenCalledWith(
      cardState,
      expect.objectContaining({ row: 1, col: 1 })
    );
    expect(restoreFromLivingWillSnapshot).toHaveBeenCalledTimes(2);
    expect(restoreFromLivingWillSnapshot).toHaveBeenCalledWith(
      cardState,
      gameState,
      { row: -1, col: 0, token: '-1,0' },
      expect.objectContaining({ triggerKind: 'loss_will', cause: 'LOSS_WILL', reason: 'loss_will_reset' }),
      { ctx: true }
    );
    expect(clearPending).toHaveBeenCalledWith(cardState, 'black');
  });

  test('fails fast for an active effect when BoardView is unavailable', () => {
    const effect = createCardLossEffect({
      readCardPendingEffect: () => ({ type: 'LOSS_WILL' })
    });

    expect(() => effect.applyLossWill({ markers: [] }, { board: createBoard() }, 'black'))
      .toThrow('createBoardViewForCard is required');
  });
});
