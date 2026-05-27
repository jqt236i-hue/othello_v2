import { createCardAvailability } from '../game/logic/cards-internal/card-availability.js';

describe('card availability module', () => {
  test('uses core countDiscs when available and otherwise counts board plus expansions', () => {
    const withCore = createCardAvailability({
      constants: { BLACK: 1, WHITE: 2 },
      resolveCoreLogicForCards: () => ({
        countDiscs: () => ({ black: '12', white: 7 })
      }),
      getExpansionDescriptorsForCard: () => [{ owner: 1 }, { owner: 2 }]
    });

    expect(withCore.countDiscsForCardComparison({ board: [[1, 2]] })).toEqual({ black: 12, white: 7 });

    const withoutCore = createCardAvailability({
      constants: { BLACK: 1, WHITE: 2 },
      getExpansionDescriptorsForCard: () => [{ owner: 1 }, { owner: 2 }, { owner: 1 }]
    });

    expect(withoutCore.countDiscsForCardComparison({
      board: [
        [1, 2, 0],
        [2, 0, 1]
      ]
    })).toEqual({ black: 4, white: 3 });
  });

  test('applies last resort and equality thresholds with injected helpers', () => {
    const availability = createCardAvailability({
      constants: { BLACK: 1, WHITE: 2 },
      hasStandardLegalMoveForPlayer: jest.fn((_cardState, _gameState, playerKey) => playerKey === 'white')
    });
    const gameState = {
      board: [
        [1, 0],
        [2, 2]
      ]
    };

    expect(availability.canUseLastResortForPlayer({}, gameState, 'black')).toBe(true);
    expect(availability.canUseLastResortForPlayer({}, gameState, 'white')).toBe(false);
    expect(availability.canUseEqualityWillForPlayer({}, gameState, 'black')).toBe(false);
    expect(availability.canUseEqualityWillForPlayer({}, {
      board: [
        [1, 0, 0, 0],
        [2, 2, 2, 2],
        [2, 2, 2, 2],
        [2, 2, 2, 2]
      ]
    }, 'black')).toBe(true);
  });

  test('forwards reinforcement target counts and disc disadvantage helpers', () => {
    const getTargets = jest.fn(() => [{}, {}, {}]);
    const availability = createCardAvailability({
      constants: { BLACK: 1, WHITE: 2 },
      getReinforcementWillTargets: getTargets
    });
    const gameState = {
      board: [
        [1, 1],
        [2, 0]
      ]
    };

    expect(availability.getDiscDisadvantageForPlayer(gameState, 'white')).toBe(1);
    expect(availability.getEqualityWillBoardCounts(gameState)).toEqual({ black: 2, white: 1 });
    expect(availability.hasFewerDiscsThanOpponentForPlayer(gameState, 'white')).toBe(true);
    expect(availability.getReinforcementWillTargetCount({ state: true }, gameState, 'black')).toBe(3);
    expect(getTargets).toHaveBeenCalledWith({ state: true }, gameState, 'black');
  });
});
