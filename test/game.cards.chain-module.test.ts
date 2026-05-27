const CardChain = require('../game/logic/cards/chain');

function createDeps(overrides = {}) {
  return {
    readCardPendingEffect: () => ({ type: 'DOUBLE_CHAIN_WILL' }),
    getChainWillConfig: () => ({ maxLinks: 2 }),
    blackValue: 1,
    whiteValue: -1,
    getCardContext: () => ({}),
    defaultPrng: { random: () => 0 },
    resolveChainWillMaxLinks: () => 2,
    findChainChoice: jest.fn()
      .mockReturnValueOnce({
        applied: true,
        flips: [{ row: 1, col: 1 }],
        chosen: { id: 'first' }
      })
      .mockReturnValueOnce({
        applied: true,
        flips: [{ row: 1, col: 2 }],
        chosen: { id: 'second' }
      }),
    BoardOpsModule: null,
    eventCause: 'CHAIN_WILL',
    clearBombAt: jest.fn(),
    clearHyperactiveAtPositions: jest.fn(),
    ...overrides
  };
}

describe('card chain module', () => {
  test('applyChainWillAfterMove applies each link sequentially and clears per-link side effects', () => {
    const gameState = { board: Array.from({ length: 4 }, () => Array(4).fill(0)) };
    const cardState = {};
    const deps = createDeps();

    const result = CardChain.applyChainWillAfterMove(
      cardState,
      gameState,
      'black',
      [{ row: 0, col: 0 }],
      null,
      deps
    );

    expect(result).toMatchObject({
      applied: true,
      flips: [{ row: 1, col: 1 }, { row: 1, col: 2 }],
      chosen: { id: 'second' }
    });
    expect(gameState.board[1][1]).toBe(1);
    expect(gameState.board[1][2]).toBe(1);
    expect(deps.clearBombAt).toHaveBeenCalledTimes(2);
    expect(deps.clearHyperactiveAtPositions).toHaveBeenCalledWith(cardState, [{ row: 1, col: 1 }]);
    expect(deps.clearHyperactiveAtPositions).toHaveBeenCalledWith(cardState, [{ row: 1, col: 2 }]);
  });

  test('applyChainWillAfterMove uses BoardOps change metadata when available', () => {
    const gameState = { board: Array.from({ length: 4 }, () => Array(4).fill(0)) };
    const cardState = {};
    const changeAt = jest.fn(() => ({ changed: true }));
    const deps = createDeps({
      resolveChainWillMaxLinks: () => 1,
      BoardOpsModule: { changeAt }
    });

    CardChain.applyChainWillAfterMove(cardState, gameState, 'black', [{ row: 0, col: 0 }], null, deps);

    expect(changeAt).toHaveBeenCalledWith(
      cardState,
      gameState,
      1,
      1,
      'black',
      'CHAIN_WILL',
      'chain_flip',
      { chainLink: 1 }
    );
  });

  test('applyChainWillAfterMove returns inactive result without pending chain config', () => {
    const deps = createDeps({
      readCardPendingEffect: () => null
    });

    expect(CardChain.applyChainWillAfterMove({}, { board: [] }, 'black', [], null, deps)).toEqual({
      applied: false,
      flips: [],
      chosen: null
    });
  });
});
