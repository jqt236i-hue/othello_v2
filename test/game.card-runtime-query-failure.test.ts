import { createCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';

describe('dependency-sensitive card query failure', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).cardState = {
      hands: { black: [], white: ['work_01'] },
      charge: { black: 0, white: 99 }
    };
    (global as any).gameState = { currentPlayer: -1, board: [] };
    (global as any).cpuSmartness = { black: 2, white: 2 };
    (global as any).CardLogic = null;
  });

  afterEach(() => {
    delete (global as any).cardState;
    delete (global as any).gameState;
    delete (global as any).cpuSmartness;
    delete (global as any).CardLogic;
  });

  test('tagged CPU analysis failure does not fall through to another query or candidate', () => {
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const getUsableCardIds = jest.fn(() => ['work_01']);
    (global as any).CardLogic = {
      analyzeCardUsability: jest.fn(() => { throw unavailable; }),
      getUsableCardIds,
      hasUsableCard: jest.fn(() => true),
      canUseCard: jest.fn(() => true),
      getCardDef: jest.fn(() => ({ type: 'WORK_WILL' }))
    };
    const CpuDecision = require('../game/cpu-decision');

    expect(() => CpuDecision.prepareCpuTurnCardUsabilityAnalysis('white')).toThrow(unavailable);
    expect(getUsableCardIds).not.toHaveBeenCalled();
    expect((global as any).CardLogic.hasUsableCard).not.toHaveBeenCalled();
    expect((global as any).CardLogic.canUseCard).not.toHaveBeenCalled();
  });

  test('untagged analysis exception retains the existing fallback order', () => {
    const getUsableCardIds = jest.fn(() => ['work_01']);
    (global as any).CardLogic = {
      analyzeCardUsability: jest.fn(() => { throw new Error('legacy query failure'); }),
      getUsableCardIds,
      getCardDef: jest.fn(() => ({ type: 'WORK_WILL' }))
    };
    const CpuDecision = require('../game/cpu-decision');

    const result = CpuDecision.prepareCpuTurnCardUsabilityAnalysis('white');
    expect(result.cardUsability.usableCardIds).toEqual(['work_01']);
    expect(getUsableCardIds).toHaveBeenCalledTimes(1);
  });
});
