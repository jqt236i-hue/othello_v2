import { createCpuDecisionPendingActions } from '../game/cpu-decision-pending-actions';
const SharedBoardUtils = require('../shared/shared-board-utils');

function createController(overrides?: Record<string, any>) {
  const cardState = {
    pendingEffectByPlayer: {
      white: { type: 'STRONG_WIND_WILL', stage: 'selectTarget' },
      black: null
    }
  } as any;
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    boardConfig: { rows: 8, cols: 8, shape: 'rectangle' }
  } as any;
  const cardLogic = {
    getSelectableTargets: jest.fn(() => [{ row: 2, col: 3 }]),
    applyStrongWindWill: jest.fn(() => ({ applied: true }))
  } as any;
  const runCpuPendingSelectionViaPipeline = jest.fn(() => null);
  const choosePendingTargetWithPolicyAsync = jest.fn(async (_playerKey, _pendingType, targets) => targets[0]);
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
    buildCardUseDecisionContext: jest.fn(() => ({})),
    choosePendingTargetWithPolicyAsync,
    clearCpuPendingEffect,
    cpuDebugLog: jest.fn(),
    emitCpuEffectLog: jest.fn(),
    emitCpuSelectionStateChange,
    filterCloneTargetsForLv6: jest.fn((_playerKey, targets) => targets),
    getActiveProtectionForPlayer: jest.fn(() => []),
    getBoardCellValueSafe: SharedBoardUtils.getCellValue,
    getCardLogic: () => cardLogic,
    getCardState: () => cardState,
    getCpuPolicyCore: jest.fn(() => null),
    getCpuRng: () => ({ random: () => 0 }),
    getCurrentCpuBoard: () => SharedBoardUtils.createBoardContext(gameState, cardState),
    getFlipBlockers: jest.fn(() => []),
    getGameState: () => gameState,
    getLegalMoves: jest.fn(() => []),
    handOffSelectionTurnInGameState: jest.fn(),
    isCornerCell: SharedBoardUtils.isCornerCell,
    maybeContinueCpuSelectionTurnHandoff: jest.fn(),
    readCpuPendingEffect: (playerKey: any) => cardState.pendingEffectByPlayer[playerKey],
    resolveCpuDecisionLevelForPlayer: jest.fn(() => 6),
    resolveCpuCardPolicyLevelForPlayer: jest.fn(() => 6),
    resolvePlayerValue: (playerKey: any) => playerKey === 'black' ? 1 : -1,
    resolveSharedBoardUtilsModule: () => SharedBoardUtils,
    runCpuPendingSelectionViaPipeline
  });

  return {
    controller,
    cardState,
    gameState,
    cardLogic,
    choosePendingTargetWithPolicyAsync,
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

  test('destroy fallback includes occupied expansion cells and excludes METEOR_HOLE cells', async () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[0][0] = 1;
    const ctx = createController({
      gameState: {
        board,
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: {
          cells: [{ side: 'right', row: 0, col: 4, owner: -1 }]
        }
      },
      cardState: {
        pendingEffectByPlayer: {
          white: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
          black: null
        },
        markers: [{
          kind: 'specialStone',
          row: 0,
          col: 0,
          data: { type: 'METEOR_HOLE' }
        }]
      },
      cardLogic: {
        getSelectableTargets: jest.fn(() => [])
      }
    });

    await ctx.controller.cpuSelectDestroyWithPolicy('white');

    expect(ctx.choosePendingTargetWithPolicyAsync).toHaveBeenCalledWith(
      'white',
      'DESTROY_ONE_STONE',
      [{ row: 0, col: 4 }],
      null
    );
    expect(ctx.runCpuPendingSelectionViaPipeline).toHaveBeenCalledWith(
      'white',
      { destroyTarget: { row: 0, col: 4 } },
      'DESTROY_ONE_STONE'
    );
  });

  test('board expansion targeting recognizes an opponent stone on an effective expansion corner', async () => {
    const ctx = createController({
      gameState: {
        board: Array.from({ length: 4 }, () => Array(4).fill(0)),
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: {
          cells: Array.from({ length: 4 }, (_unused, row) => ({
            side: 'right',
            row,
            col: 4,
            owner: row === 0 ? 1 : 0
          }))
        }
      },
      cardState: {
        pendingEffectByPlayer: {
          white: { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' },
          black: null
        }
      },
      cardLogic: {
        getSelectableTargets: jest.fn(() => [
          { row: 1, col: 1, directionKey: 'right' },
          { row: 0, col: 4, directionKey: 'right' }
        ])
      }
    });

    await ctx.controller.cpuSelectBoardExpansionWillWithPolicy('white');

    expect(ctx.choosePendingTargetWithPolicyAsync).toHaveBeenCalledWith(
      'white',
      'BOARD_EXPANSION_WILL',
      [{ row: 0, col: 4, directionKey: 'right' }],
      expect.objectContaining({ type: 'BOARD_EXPANSION_WILL' })
    );
  });
});
