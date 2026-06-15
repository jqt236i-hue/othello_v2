const TargetResolver = require('../game/cards/target-resolver');

describe('card target resolver taboo reverse picker', () => {
  test('returns inactive result when no taboo reverse candidates exist', () => {
    const result = TargetResolver.pickTabooReverseFlips({}, {}, 'black', 2, 3, null, {
      getTabooReverseCandidates: () => []
    });

    expect(result).toEqual({
      applied: false,
      flips: [],
      direction: null,
      score: 0
    });
  });

  test('chooses the highest scoring candidate without consuming random for a single best direction', () => {
    const resolveDeterministicRandomIndex = jest.fn(() => 0);
    const result = TargetResolver.pickTabooReverseFlips({}, {}, 'black', 2, 3, null, {
      getTabooReverseCandidates: () => [
        { score: 1, direction: [1, 0], flips: [{ row: 3, col: 3 }] },
        { score: 2, direction: [0, 1], flips: [{ row: 2, col: 4 }, { row: 2, col: 5 }] }
      ],
      resolveDeterministicRandomIndex
    });

    expect(result).toEqual({
      applied: true,
      flips: [{ row: 2, col: 4 }, { row: 2, col: 5 }],
      direction: [0, 1],
      score: 2
    });
    expect(resolveDeterministicRandomIndex).not.toHaveBeenCalled();
  });

  test('uses deterministic tie-breaker with the same fallback random source priority as cards facade', () => {
    const prng = { random: () => 0.9 };
    const boardOpsRandomSource = { random: () => 0.1 };
    const actionRandomSource = { random: () => 0.2 };
    const defaultRandomSource = { random: () => 0.3 };
    const resolveDeterministicRandomIndex = jest.fn(() => 1);
    const cardState = {
      _boardOpsRandomSource: boardOpsRandomSource,
      _currentActionMeta: { randomSource: actionRandomSource },
      _defaultRandomSource: defaultRandomSource
    };

    const result = TargetResolver.pickTabooReverseFlips(cardState, {}, 'black', 2, 3, prng, {
      getTabooReverseCandidates: () => [
        { score: 2, direction: [0, 1], flips: [{ row: 2, col: 4 }, { row: 2, col: 5 }] },
        { score: 2, direction: [1, 0], flips: [{ row: 3, col: 3 }, { row: 4, col: 3 }] }
      ],
      resolveDeterministicRandomIndex
    });

    expect(resolveDeterministicRandomIndex).toHaveBeenCalledWith(
      2,
      prng,
      boardOpsRandomSource,
      'CardLogic.applyChainChoice'
    );
    expect(result).toEqual({
      applied: true,
      flips: [{ row: 3, col: 3 }, { row: 4, col: 3 }],
      direction: [1, 0],
      score: 2
    });
  });

  test('fallback trap targets keep excluding bomb and own trap markers', () => {
    jest.resetModules();
    jest.doMock('../game/logic/cards/selectors', () => ({}));
    jest.doMock('../game/logic/cards/targets', () => ({}));
    const resolver = require('../game/cards/target-resolver');
    const gameState = {
      board: [
        [1, 1, 1],
        [0, 0, 0],
        [0, 0, 0]
      ]
    };
    const cardState = {
      markers: [
        { id: 'bomb', kind: 'bomb', row: 0, col: 0, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb' } },
        { id: 'trap', kind: 'specialStone', row: 0, col: 1, owner: 'black', data: { type: 'TRAP' } }
      ]
    };

    expect(resolver.getTrapTargets(cardState, gameState, 'black')).toEqual([
      { row: 0, col: 2 }
    ]);
    jest.dontMock('../game/logic/cards/selectors');
    jest.dontMock('../game/logic/cards/targets');
  });
});
