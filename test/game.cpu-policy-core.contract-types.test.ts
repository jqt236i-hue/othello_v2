import type {
  CpuPolicyCardDefinitionResolver,
  CpuPolicyCardCostResolver,
  CpuPolicyCardSelection,
  CpuPolicyCoreApi,
  CpuPolicyMove
} from '../game/ai/cpu-policy-core-types';

const core: CpuPolicyCoreApi = require('../game/ai/cpu-policy-core');

describe('cpu-policy-core public contract types', () => {
  test('exposes typed card and move policy helpers', () => {
    const getCardCost: CpuPolicyCardCostResolver = (cardId) => (cardId === 'expensive' ? 8 : 1);
    const getCardDef: CpuPolicyCardDefinitionResolver = (cardId) => ({
      id: cardId,
      type: cardId === 'guard' ? 'GUARD_WILL' : 'FREE_PLACEMENT'
    });

    const selectedCard: CpuPolicyCardSelection | null = core.chooseHighestCostCard(
      ['cheap', 'expensive'],
      getCardCost,
      getCardDef
    );
    expect(selectedCard && selectedCard.cardId).toBe('expensive');

    const selectedMove: CpuPolicyMove | null = core.chooseMove(
      [
        { row: 2, col: 3, flips: [[2, 4]] },
        { row: 4, col: 5, flips: [] }
      ],
      1,
      { random: () => 0 }
    );
    expect(selectedMove && typeof selectedMove.row).toBe('number');
  });

  test('rejects function RNG because runtime consumes rng.random', () => {
    const selectedMove: CpuPolicyMove | null = core.chooseMove(
      [
        { row: 2, col: 3, flips: [] },
        { row: 4, col: 5, flips: [] }
      ],
      1,
      { random: () => 0.99 }
    );
    expect(selectedMove && selectedMove.row).toBe(4);
  });
});
