const CardChain = require('../game/logic/cards/chain');
const SharedBoardUtils = require('../shared/shared-board-utils');

function createBoardViewForCard(cardState, gameState) {
  const context = SharedBoardUtils.createBoardContext(gameState, cardState);
  return SharedBoardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
    strict: false
  });
}

function setBoardCellForCard(cardState, gameState, row, col, value) {
  return SharedBoardUtils.setCellValue(
    SharedBoardUtils.createBoardContext(gameState, cardState),
    row,
    col,
    value
  );
}

function createDeps(overrides = {}) {
  return {
    readCardPendingEffect: () => ({ type: 'DOUBLE_CHAIN_WILL' }),
    getChainWillConfig: () => ({ maxLinks: 2 }),
    blackValue: 1,
    whiteValue: -1,
    getCardContext: () => ({}),
    defaultPrng: { random: () => 0 },
    resolveChainWillMaxLinks: () => 2,
    createBoardViewForCard,
    setBoardCellForCard,
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

  test('findChainChoice reads expansion sources and treats meteor holes as unavailable', () => {
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardExpansion: {
        cells: [{ side: 'right', row: 0, col: 4, owner: 1 }]
      }
    };
    gameState.board[0][2] = 1;
    gameState.board[0][3] = -1;
    const cardState = { markers: [] };

    const choice = CardChain.findChainChoice(
      gameState,
      [{ row: 0, col: 4 }],
      1,
      { cardState, boardView: createBoardViewForCard(cardState, gameState) },
      { random: () => 0 }
    );

    expect(choice).toMatchObject({
      applied: true,
      flips: [{ row: 0, col: 3 }]
    });

    cardState.markers.push({
      kind: 'specialStone',
      row: 0,
      col: 4,
      data: { type: 'METEOR_HOLE' }
    });
    expect(CardChain.findChainChoice(
      gameState,
      [{ row: 0, col: 4 }],
      1,
      { cardState, boardView: createBoardViewForCard(cardState, gameState) },
      { random: () => 0 }
    )).toEqual({ applied: false, flips: [], chosen: null });
  });
});
