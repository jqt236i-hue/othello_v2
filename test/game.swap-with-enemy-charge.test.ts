import * as SharedConstants from '../shared-constants.js';
import * as SwapWithEnemy from '../game/logic/effects/swap_with_enemy.js';

describe('SWAP_WITH_ENEMY charge gain', () => {
  test('swap flip gain uses generated charge multiplier', () => {
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: { type: 'SWAP_WITH_ENEMY' }, white: null },
      charge: { black: 0, white: 0 },
      chargeGainMultiplierByPlayer: { black: 2, white: 1 },
      presentationEvents: []
    };
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY))
    };
    gameState.board[3][3] = SharedConstants.WHITE;

    const result = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, 'black', 3, 3, {
      Core: {
        getFlipsWithContext: () => [[3, 4], [3, 5]]
      },
      emitPresentationEvent: (state, event) => state.presentationEvents.push(event)
    });

    expect(result.swapped).toBe(true);
    expect(cardState.charge.black).toBe(6);
    expect(cardState.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'CHARGE_BUBBLE',
        player: 'black',
        gained: 6
      })
    ]));
  });
});
