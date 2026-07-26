import { createCardAvailability } from '../game/logic/cards-internal/card-availability.js';

const SharedBoardUtils = require('../shared/shared-board-utils');

function createBoard(rows = 4, cols = 4, fill = 0) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function createBoardViewForCard(cardState: any, gameState: any) {
  const context = SharedBoardUtils.createBoardContext(gameState, cardState);
  return SharedBoardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
    strict: false
  });
}

function createAvailability(overrides: any = {}) {
  return createCardAvailability({
    constants: { BLACK: 1, WHITE: -1 },
    createBoardViewForCard,
    ...overrides
  });
}

describe('card availability module', () => {
  test('counts base and expansion discs while excluding meteor holes', () => {
    const availability = createAvailability();
    const gameState = {
      board: createBoard(),
      boardExpansion: {
        cells: [
          { side: 'top', row: -1, col: 0, owner: 1 },
          { side: 'right', row: 0, col: 4, owner: -1 },
          { side: 'right', row: 1, col: 4, owner: 1 }
        ]
      }
    };
    gameState.board[0][0] = 1;
    gameState.board[0][1] = -1;
    gameState.board[0][2] = 1;
    const cardState = {
      markers: [
        { kind: 'specialStone', row: 0, col: 2, data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 1, col: 4, data: { type: 'METEOR_HOLE' } }
      ]
    };

    expect(availability.countDiscsForCardComparison(cardState, gameState)).toEqual({
      black: 2,
      white: 2
    });
  });

  test('applies last resort threshold and equality charge condition with canonical counts', () => {
    const availability = createAvailability({
      hasStandardLegalMoveForPlayer: jest.fn((_cardState, _gameState, playerKey) => playerKey === 'white')
    });
    const gameState = { board: createBoard() };
    gameState.board[0][0] = 1;
    gameState.board[1][0] = -1;
    gameState.board[1][1] = -1;
    const cardState = { charge: { black: 1, white: 25 }, markers: [] };

    expect(availability.canUseLastResortForPlayer(cardState, gameState, 'black')).toBe(true);
    expect(availability.canUseLastResortForPlayer(cardState, gameState, 'white')).toBe(false);
    expect(availability.canUseEqualityWillForPlayer(cardState, gameState, 'black')).toBe(false);
    expect(availability.canUseEqualityWillForPlayer(
      { charge: { black: 0, white: 25 }, markers: [] },
      gameState,
      'black'
    )).toBe(true);
    expect(availability.getEqualityWillChargeState(cardState, 'black')).toEqual({ own: 1, opponent: 25 });
  });

  test('forwards reinforcement target counts and disc disadvantage helpers', () => {
    const getTargets = jest.fn(() => [{}, {}, {}]);
    const availability = createAvailability({
      getReinforcementWillTargets: getTargets
    });
    const gameState = { board: createBoard() };
    gameState.board[0][0] = 1;
    gameState.board[0][1] = 1;
    gameState.board[1][0] = -1;
    const cardState = { markers: [] };

    expect(availability.getDiscDisadvantageForPlayer(cardState, gameState, 'white')).toBe(1);
    expect(availability.getEqualityWillBoardCounts(cardState, gameState)).toEqual({ black: 2, white: 1 });
    expect(availability.hasFewerDiscsThanOpponentForPlayer(cardState, gameState, 'white')).toBe(true);
    expect(availability.getReinforcementWillTargetCount(cardState, gameState, 'black')).toBe(3);
    expect(availability.getSupportTroopsWillTargetCount(cardState, gameState, 'black')).toBe(3);
    expect(getTargets).toHaveBeenCalledWith(cardState, gameState, 'black');
  });

  test('fails fast instead of falling back to a dense board count', () => {
    const availability = createCardAvailability({
      constants: { BLACK: 1, WHITE: -1 }
    });

    expect(() => availability.countDiscsForCardComparison({}, { board: createBoard() }))
      .toThrow('createBoardViewForCard is required');
  });
});
