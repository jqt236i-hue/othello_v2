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

  test('EXTEND_LIFE_WILL invokes cpuSelectExtendLifeWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectExtendLifeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('EXTEND_LIFE_WILL clears pending when function absent', async () => {
    delete global.cpuSelectExtendLifeWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('EXTEND_LIFE_GOD invokes cpuSelectExtendLifeWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectExtendLifeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'EXTEND_LIFE_GOD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('EXTEND_LIFE_GOD clears pending when function absent', async () => {
    delete global.cpuSelectExtendLifeWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'EXTEND_LIFE_GOD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CORROSION_WILL invokes cpuSelectCorrosionWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectCorrosionWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'CORROSION_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('CORROSION_WILL clears pending when function absent', async () => {
    delete global.cpuSelectCorrosionWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'CORROSION_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('BOARD_EXPANSION_WILL invokes cpuSelectBoardExpansionWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectBoardExpansionWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('BOARD_EXPANSION_WILL clears pending when function absent', async () => {
    delete global.cpuSelectBoardExpansionWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('BOARD_EXPANSION_GOD invokes cpuSelectBoardExpansionWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectBoardExpansionWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('BOARD_EXPANSION_GOD clears pending when function absent', async () => {
    delete global.cpuSelectBoardExpansionWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('BLOCKADE_WILL invokes cpuSelectBlockadeWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectBlockadeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'BLOCKADE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('BLOCKADE_WILL clears pending when function absent', async () => {
    delete global.cpuSelectBlockadeWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'BLOCKADE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('METEOR_WILL invokes cpuSelectMeteorWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectMeteorWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'METEOR_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('METEOR_WILL clears pending when function absent', async () => {
    delete global.cpuSelectMeteorWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'METEOR_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('FREEZE_WILL invokes cpuSelectFreezeWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectFreezeWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'FREEZE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('FREEZE_WILL clears pending when function absent', async () => {
    delete global.cpuSelectFreezeWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'FREEZE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CLONE_WILL invokes cpuSelectCloneWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectCloneWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'CLONE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('CLONE_WILL clears pending when function absent', async () => {
    delete global.cpuSelectCloneWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'CLONE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('TELEPORT_WILL invokes cpuSelectTeleportWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectTeleportWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'TELEPORT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('TELEPORT_WILL clears pending when function absent', async () => {
    delete global.cpuSelectTeleportWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'TELEPORT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('CELL_TELEPORT_WILL invokes cpuSelectCellTeleportWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectCellTeleportWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('CELL_TELEPORT_WILL clears pending when function absent', async () => {
    delete global.cpuSelectCellTeleportWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('SUPER_BUOYANCY_WILL invokes cpuSelectSuperBuoyancyWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSuperBuoyancyWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SUPER_BUOYANCY_WILL clears pending when function absent', async () => {
    delete global.cpuSelectSuperBuoyancyWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('SUPER_GRAVITY_WILL invokes cpuSelectSuperGravityWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSuperGravityWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SUPER_GRAVITY_WILL clears pending when function absent', async () => {
    delete global.cpuSelectSuperGravityWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' };

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

  test('unknown selectTarget pending does not immediately force pass', async () => {
    global.processPassTurn = jest.fn();
    global.generateMovesForPlayer = jest.fn(() => []);
    cardState.pendingEffectByPlayer.white = { type: 'UNHANDLED_PENDING_CARD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();

    expect(global.processPassTurn).not.toHaveBeenCalled();
    expect(global.generateMovesForPlayer).not.toHaveBeenCalled();
  });
});
