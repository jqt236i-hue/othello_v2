const mod = require('../game/cpu-turn-handler');

describe('cpu-turn-handler error handling', () => {
  beforeEach(() => {
    // minimal globals required by runCpuTurn
    global.cardState = { hands: { white: [] }, pendingEffectByPlayer: { white: null }, hasUsedCardThisTurnByPlayer: { white: false } };
    global.gameState = { board: Array(8).fill(null).map(() => Array(8).fill(0)), currentPlayer: 'white' };
    global.emitLogAdded = jest.fn();
  });

  test('runCpuTurn resets isProcessing on error and logs', async () => {
    // force an exception in protection getter
    global.getActiveProtectionForPlayer = () => { throw new Error('boom'); };

    // ensure flags start false
    global.isCardAnimating = false;
    global.isProcessing = false;

    await mod.runCpuTurn('white');

    // After run returns, isProcessing must be false
    expect(global.isProcessing).toBe(false);
    expect(global.emitLogAdded).toHaveBeenCalled();
  });

  test('runCpuTurn aborts when called out of turn', async () => {
    global.gameState.currentPlayer = 'white';
    global.cardState = {
      hands: { white: [], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false }
    };
    global.isCardAnimating = false;
    global.isProcessing = false;

    await mod.runCpuTurn('black');

    expect(global.isProcessing).toBe(false);
  });
});
