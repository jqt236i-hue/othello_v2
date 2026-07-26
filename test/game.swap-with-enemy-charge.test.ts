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

  test('swaps and captures through an expansion cell via the canonical board kernel', () => {
    const cardState = {
      markers: [],
      pendingEffectByPlayer: { black: { type: 'SWAP_WITH_ENEMY' }, white: null },
      charge: { black: 0, white: 0 },
      presentationEvents: []
    };
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(SharedConstants.EMPTY)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        active: false,
        side: null,
        row: null,
        owner: SharedConstants.EMPTY,
        usedByPlayer: { black: false, white: false },
        cells: [{ side: 'left', row: 1, col: -1, owner: SharedConstants.WHITE }]
      }
    };
    gameState.board[1][0] = SharedConstants.WHITE;
    gameState.board[1][1] = SharedConstants.BLACK;

    const result = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, 'black', 1, -1);

    expect(result).toMatchObject({
      swapped: true,
      flipped: [{ row: 1, col: 0 }]
    });
    expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.BLACK);
    expect(gameState.board[1][0]).toBe(SharedConstants.BLACK);
  });

  test('does not overwrite an expansion coordinate masked by a meteor hole', () => {
    const cardState = {
      markers: [{
        kind: 'specialStone',
        row: 1,
        col: -1,
        data: { type: 'METEOR_HOLE' }
      }],
      pendingEffectByPlayer: { black: { type: 'SWAP_WITH_ENEMY' }, white: null },
      charge: { black: 0, white: 0 }
    };
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(SharedConstants.EMPTY)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: [{ side: 'left', row: 1, col: -1, owner: SharedConstants.WHITE }]
      }
    };

    const result = SwapWithEnemy.applySwapWithEnemy(cardState, gameState, 'black', 1, -1);

    expect(result).toEqual({ swapped: false });
    expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.WHITE);
  });
});
