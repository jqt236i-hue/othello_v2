import { createCpuDecisionPendingActions } from '../game/cpu-decision-pending-actions';

function createController(overrides?: Record<string, any>) {
  const cardState = {
    pendingEffectByPlayer: {
      white: { type: 'STRONG_WIND_WILL', stage: 'selectTarget' },
      black: null
    }
  } as any;
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0))
  } as any;
  const cardLogic = {
    getSelectableTargets: jest.fn(() => [{ row: 2, col: 3 }]),
    applyStrongWindWill: jest.fn(() => ({ applied: true }))
  } as any;
  const runCpuPendingSelectionViaPipeline = jest.fn(() => null);
  const emitCpuSelectionStateChange = jest.fn();
  const clearCpuPendingEffect = jest.fn((playerKey: any) => {
    cardState.pendingEffectByPlayer[playerKey] = null;
  });

  if (overrides) {
    if (overrides.cardLogic) Object.assign(cardLogic, overrides.cardLogic);
    if (overrides.cardState) Object.assign(cardState, overrides.cardState);
    if (overrides.gameState) Object.assign(gameState, overrides.gameState);
  }

  const controller = createCpuDecisionPendingActions({
    choosePendingTargetWithPolicyAsync: jest.fn(async (_playerKey, _pendingType, targets) => targets[0]),
    clearCpuPendingEffect,
    cpuDebugLog: jest.fn(),
    emitCpuSelectionStateChange,
    getCardLogic: () => cardLogic,
    getCardState: () => cardState,
    getCpuRng: () => ({ random: () => 0 }),
    getGameState: () => gameState,
    handOffSelectionTurnInGameState: jest.fn(),
    maybeContinueCpuSelectionTurnHandoff: jest.fn(),
    readCpuPendingEffect: (playerKey: any) => cardState.pendingEffectByPlayer[playerKey],
    runCpuPendingSelectionViaPipeline
  });

  return {
    controller,
    cardState,
    gameState,
    cardLogic,
    runCpuPendingSelectionViaPipeline,
    emitCpuSelectionStateChange,
    clearCpuPendingEffect
  };
}

describe('cpu decision pending actions controller', () => {
  test('target action does not fall back after pending pipeline success', async () => {
    const ctx = createController();
    ctx.runCpuPendingSelectionViaPipeline.mockResolvedValueOnce({
      ok: true,
      res: { ok: true }
    });

    await ctx.controller.cpuSelectStrongWindWillWithPolicy('white');

    expect(ctx.cardLogic.applyStrongWindWill).not.toHaveBeenCalled();
    expect(ctx.emitCpuSelectionStateChange).not.toHaveBeenCalled();
    expect(ctx.clearCpuPendingEffect).not.toHaveBeenCalled();
  });

  test('target action falls back to direct apply when pending pipeline rejects', async () => {
    const ctx = createController();
    ctx.runCpuPendingSelectionViaPipeline.mockResolvedValueOnce({
      ok: false,
      res: { reason: 'stale_turn' }
    });

    await ctx.controller.cpuSelectStrongWindWillWithPolicy('white');

    expect(ctx.runCpuPendingSelectionViaPipeline).toHaveBeenCalledWith(
      'white',
      { strongWindTarget: { row: 2, col: 3 }, deferNetworkPublish: true },
      'STRONG_WIND_WILL'
    );
    expect(ctx.cardLogic.applyStrongWindWill).toHaveBeenCalledWith(
      ctx.cardState,
      ctx.gameState,
      'white',
      2,
      3,
      { random: expect.any(Function) }
    );
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.clearCpuPendingEffect).not.toHaveBeenCalled();
  });

  test('target action falls back to direct apply when pending pipeline returns malformed truthy result', async () => {
    const ctx = createController();
    ctx.runCpuPendingSelectionViaPipeline.mockResolvedValueOnce({
      res: { ok: true }
    });

    await ctx.controller.cpuSelectStrongWindWillWithPolicy('white');

    expect(ctx.cardLogic.applyStrongWindWill).toHaveBeenCalledTimes(1);
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
  });
});
