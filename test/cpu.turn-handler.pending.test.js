const path = require('path');
const cpuHandler = require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));

function waitTick() { return new Promise(resolve => setImmediate(resolve)); }

describe('cpu turn handler pending selection', () => {
  beforeEach(() => {
    global.cardState = { hasUsedCardThisTurnByPlayer: { white: false }, pendingEffectByPlayer: { white: null } };
    global.gameState = { currentPlayer: 'white' };
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.BLACK = 1; global.WHITE = -1;
    global.isDebugLogAvailable = () => false;
    global.playHandAnimation = (player, r, c, cb) => cb();
    global.executeMove = jest.fn();
    global.generateMovesForPlayer = jest.fn(() => [{ row: 1, col: 2, flips: [] }]);
  });

  test('DESTROY_ONE_STONE invokes cpuSelectDestroyWithPolicy', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectDestroyWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('INHERIT_WILL invokes cpuSelectInheritWillWithPolicy', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectInheritWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'INHERIT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SWAP_WITH_ENEMY invokes cpuSelectSwapWithEnemyWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSwapWithEnemyWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SWAP_WITH_ENEMY clears pending when function absent', async () => {
    delete global.cpuSelectSwapWithEnemyWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('TEMPT_WILL invokes cpuSelectTemptWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectTemptWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'TEMPT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('TEMPT_WILL clears pending when function absent', async () => {
    delete global.cpuSelectTemptWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'TEMPT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });
});