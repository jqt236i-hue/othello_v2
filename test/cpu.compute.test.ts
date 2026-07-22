import * as path from 'path';
const cpuDecision = require(path.resolve(__dirname, '..', 'game', 'cpu-decision.js'));

describe('computeCpuAction', () => {
  test('returns move when legal moves exist', () => {
    // stub getLegalMoves
    global.gameState = {};
    global.getLegalMoves = (gs) => [{ row: 2, col: 3, flips: [] }];
    global.getActiveProtectionForPlayer = () => [];
    global.BLACK = 'black';
    global.WHITE = 'white';
    global.cpuSmartness = { white: 1, black: 1 };

    const action = cpuDecision.computeCpuAction('white');
    expect(action).toBeDefined();
    expect(action.type).toBe('move');
    expect(action.move).toEqual({ row: 2, col: 3, flips: [] });
  });

  test('returns pass when an AI suggestion is not a currently usable card', () => {
    global.gameState = {};
    global.cardState = { hands: { white: ['test_card'] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.getLegalMoves = () => [];
    global.getActiveProtectionForPlayer = () => [];
    global.AISystem = {
      selectCardToUse: () => ({ cardId: 'test_card', cardDef: { name: 'Test' } })
    };
    global.CardLogic = undefined;
    global.cpuSmartness = { white: 1, black: 1 };

    const action = cpuDecision.computeCpuAction('white');
    expect(action).toEqual({ type: 'pass' });
  });

  test('returns pass when no moves and no card suggested', () => {
    global.gameState = {};
    global.cardState = { hands: { white: [] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.getLegalMoves = () => [];
    global.getActiveProtectionForPlayer = () => [];
    global.AISystem = null;
    // ensure selectCardFallback also returns null by having no CardLogic
    global.CardLogic = undefined;

    const action = cpuDecision.computeCpuAction('white');
    expect(action.type).toBe('pass');
  });
});
