import { createCardLossEffect } from '../game/logic/cards-internal/loss-effect.js';

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

  test('uses collected removals to prune markers, emit events, restore living will, and clear pending', () => {
    const cardState = {
      markers: [
        { id: 'keep' },
        { id: 'remove-special' },
        { id: 'remove-bomb' }
      ]
    };
    const gameState = {
      board: [
        [1, 0],
        [0, -1]
      ]
    };
    const clearPending = jest.fn();
    const emitPresentationEvent = jest.fn();
    const restoreFromLivingWillSnapshot = jest.fn();
    const effect = createCardLossEffect({
      emptyValue: 0,
      readCardPendingEffect: () => ({ type: 'LOSS_WILL' }),
      clearCardPendingEffect: clearPending,
      collectLossWillRemovals: () => ({
        guardedCells: new Set(),
        removableSpecials: [cardState.markers[1]],
        removableBombs: [cardState.markers[2]],
        removed: [
          { row: 0, col: 0, owner: 'black', type: 'WORK' },
          { row: 1, col: 1, owner: 'white', type: 'TIME_BOMB' }
        ]
      }),
      getCellValueForCard: (gs, row, col) => gs.board[row][col],
      emitPresentationEvent,
      findLivingWillMarkerAt: (_cs, row, col) => ({ row, col, token: `${row},${col}` }),
      restoreFromLivingWillSnapshot,
      getLivingWillModuleContext: () => ({ ctx: true })
    });

    const result = effect.applyLossWill(cardState, gameState, 'black');

    expect(result).toEqual({
      applied: true,
      removedCount: 2,
      removed: [
        { row: 0, col: 0, owner: 'black', type: 'WORK' },
        { row: 1, col: 1, owner: 'white', type: 'TIME_BOMB' }
      ]
    });
    expect(cardState.markers).toEqual([{ id: 'keep' }]);
    expect(emitPresentationEvent).toHaveBeenCalledTimes(2);
    expect(restoreFromLivingWillSnapshot).toHaveBeenCalledTimes(2);
    expect(restoreFromLivingWillSnapshot).toHaveBeenNthCalledWith(
      1,
      cardState,
      gameState,
      { row: 0, col: 0, token: '0,0' },
      expect.objectContaining({ triggerKind: 'loss_will', cause: 'LOSS_WILL', reason: 'loss_will_reset' }),
      { ctx: true }
    );
    expect(clearPending).toHaveBeenCalledWith(cardState, 'black');
  });
});
