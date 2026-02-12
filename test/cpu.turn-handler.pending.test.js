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

  test('SACRIFICE_WILL invokes cpuSelectSacrificeWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSacrificeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SACRIFICE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('STRONG_WIND_WILL invokes cpuSelectStrongWindWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectStrongWindWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'STRONG_WIND_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SELL_CARD_WILL invokes cpuSelectSellCardWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSellCardWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SELL_CARD_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('HEAVEN_BLESSING invokes cpuSelectHeavenBlessingWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectHeavenBlessingWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['gold_stone'] };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('CONDEMN_WILL invokes cpuSelectCondemnWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectCondemnWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'CONDEMN_WILL', stage: 'selectTarget', offers: [{ handIndex: 0, cardId: 'gold_stone' }] };

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

  test('POSITION_SWAP_WILL invokes cpuSelectPositionSwapWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectPositionSwapWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('POSITION_SWAP_WILL clears pending when function absent', async () => {
    delete global.cpuSelectPositionSwapWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('TRAP_WILL invokes cpuSelectTrapWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectTrapWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'TRAP_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('TRAP_WILL clears pending when function absent', async () => {
    delete global.cpuSelectTrapWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'TRAP_WILL', stage: 'selectTarget' };

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

  test('SACRIFICE_WILL with remaining pending does not attempt pass/move immediately', async () => {
    const mock = jest.fn(async () => {
      // Keep pending as selectTarget to emulate multi-step selection flow.
    });
    global.cpuSelectSacrificeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SACRIFICE_WILL', stage: 'selectTarget', selectedCount: 1, maxSelections: 3 };
    global.processPassTurn = jest.fn();
    global.generateMovesForPlayer = jest.fn(() => []);

    cpuHandler.processCpuTurn();
    await waitTick();

    expect(mock).toHaveBeenCalledWith('white');
    expect(global.processPassTurn).not.toHaveBeenCalled();
    expect(global.generateMovesForPlayer).not.toHaveBeenCalled();
  });
});
