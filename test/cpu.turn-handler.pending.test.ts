import * as path from 'path';
const cpuHandler = require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));
const PendingCoordinator = require(path.resolve(__dirname, '..', 'game', 'turn', 'pending-coordinator.js'));

function waitTick() { return Promise.resolve(); }

function resolveGlobalRuntimeFunction(name: string) {
  const candidate = (global as any)[name];
  return typeof candidate === 'function' ? candidate : null;
}

function resolveGlobalRuntimeValue(name: string) {
  return Object.prototype.hasOwnProperty.call(global, name)
    ? (global as any)[name]
    : undefined;
}

describe('cpu turn handler pending selection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.cardState = { hasUsedCardThisTurnByPlayer: { white: false }, pendingEffectByPlayer: { white: null } };
    global.gameState = { currentPlayer: 'white' };
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.BLACK = 1; global.WHITE = -1;
    global.isDebugLogAvailable = () => false;
    global.playHandAnimation = (player, r, c, cb) => cb();
    global.executeMove = jest.fn();
    global.processPassTurn = jest.fn();
    global.generateMovesForPlayer = jest.fn(() => [{ row: 1, col: 2, flips: [] }]);
    cpuHandler.setCpuUIImpl({
      resolveRuntimeFunction: resolveGlobalRuntimeFunction,
      resolveRuntimeValue: resolveGlobalRuntimeValue,
      resolveExecuteMove: () => global.executeMove,
      resolveProcessPassTurn: () => global.processPassTurn
    });
    PendingCoordinator.clearPendingSelectionActionCache();
  });

  afterEach(() => {
    PendingCoordinator.clearPendingSelectionActionCache();
    cpuHandler.resetCpuTurnHandlerState();
    cpuHandler.setTimers(null);
    cpuHandler.setCpuUIImpl({});
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('DESTROY_ONE_STONE invokes cpuSelectDestroyWithPolicy', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectDestroyWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' };

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

  test('SWAP_WITH_ENEMY clears cached pending action when function absent', async () => {
    delete global.cpuSelectSwapWithEnemyWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };
    PendingCoordinator.storePendingSelectionAction(
      'white',
      { type: 'pending_selection', cardId: 'swap-card', turnIndex: 0 },
      'SWAP_WITH_ENEMY'
    );

    cpuHandler.processCpuTurn();
    await waitTick();

    expect(cardState.pendingEffectByPlayer.white).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('white')).toBeNull();
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

  test('CAPTURE_WILL invokes cpuSelectCaptureWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectCaptureWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'CAPTURE_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('CAPTURE_WILL clears pending when function absent', async () => {
    delete global.cpuSelectCaptureWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'CAPTURE_WILL', stage: 'selectTarget' };

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

  test('BOARD_SHRINK_WILL invokes cpuSelectBoardShrinkWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectBoardShrinkWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_SHRINK_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('BOARD_SHRINK_GOD invokes cpuSelectBoardShrinkWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectBoardShrinkWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_SHRINK_GOD', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('BOARD_SHRINK_GOD clears pending when function absent', async () => {
    delete global.cpuSelectBoardShrinkWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'BOARD_SHRINK_GOD', stage: 'selectTarget' };

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

  test('SEED_WILL invokes cpuSelectSeedWillWithPolicy when available', async () => {
    const mock = jest.fn(async (playerKey) => { cardState.pendingEffectByPlayer[playerKey] = null; });
    global.cpuSelectSeedWillWithPolicy = mock;
    cardState.pendingEffectByPlayer.white = { type: 'SEED_WILL', stage: 'selectTarget' };

    cpuHandler.processCpuTurn();
    await waitTick();
    expect(mock).toHaveBeenCalledWith('white');
  });

  test('SEED_WILL clears pending when function absent', async () => {
    delete global.cpuSelectSeedWillWithPolicy;
    cardState.pendingEffectByPlayer.white = { type: 'SEED_WILL', stage: 'selectTarget' };

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
