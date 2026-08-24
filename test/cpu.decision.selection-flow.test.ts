import { createCpuDecisionSelectionFlow } from '../game/cpu-decision-selection-flow';

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createSelectionFlow(overrides?: Record<string, unknown>) {
  const runtime = {
    publishSnapshot: jest.fn(),
    isNetworkPublishActive: jest.fn(() => true),
    waitForPlaybackIdle: jest.fn(() => Promise.resolve()),
    readMatchMode: jest.fn(() => null),
    getCurrentMatchMode: jest.fn(() => null),
    readHumanVsHumanMode: jest.fn(() => false),
    isCardRuntimeIntegrityBlocked: jest.fn(() => false),
    processCpuTurn: jest.fn()
  } as any;
  const networkTurnHandoff = {
    publishNetworkSnapshot: jest.fn(),
    waitForPlaybackIdleIfNeeded: jest.fn(() => Promise.resolve()),
    finalizeNetworkTurnHandoff: jest.fn(() => Promise.resolve())
  } as any;
  const timerService = {
    setTimeout: jest.fn((callback) => {
      const handle = { callback, unref: jest.fn() };
      return handle;
    })
  } as any;
  const gameState = {
    currentPlayer: -1,
    turnNumber: 7
  } as any;
  const cardState = {
    pendingEffectByPlayer: { white: null, black: null }
  } as any;
  const emitBoardUpdate = jest.fn();
  const pendingSelectionFlow = {
    finalizePendingSelectionFlow: jest.fn(() => Promise.resolve())
  } as any;
  const legacyProcessCpuTurn = jest.fn();

  const controller = createCpuDecisionSelectionFlow({
    getRuntime: () => runtime,
    getNetworkTurnHandoff: () => networkTurnHandoff,
    getTimerService: () => timerService,
    getGameState: () => gameState,
    getCardState: () => cardState,
    resolvePlayerKeyFromTurnValue: (value: any) => {
      if (value === 1 || value === '1' || value === 'black') return 'black';
      if (value === -1 || value === '-1' || value === 'white') return 'white';
      return null;
    },
    isSelectionOnlyEndTurnPendingType: (pendingType: any) => pendingType === 'SWAP_WITH_ENEMY' || pendingType === 'TRAP_WILL',
    resolvePendingSelectionFlow: () => pendingSelectionFlow,
    readLegacyProcessCpuTurn: () => legacyProcessCpuTurn,
    emitBoardUpdate
  });

  Object.assign(runtime, overrides && overrides.runtime);
  Object.assign(networkTurnHandoff, overrides && overrides.networkTurnHandoff);
  Object.assign(timerService, overrides && overrides.timerService);
  Object.assign(gameState, overrides && overrides.gameState);
  Object.assign(cardState, overrides && overrides.cardState);
  if (overrides && overrides.pendingSelectionFlow) {
    Object.assign(pendingSelectionFlow, overrides.pendingSelectionFlow);
  }

  return {
    controller,
    runtime,
    networkTurnHandoff,
    timerService,
    gameState,
    cardState,
    emitBoardUpdate,
    pendingSelectionFlow,
    legacyProcessCpuTurn
  };
}

describe('cpu decision selection flow controller', () => {
  test('publishCpuSelectionNetworkSnapshot uses runtime publish when network publish is active', () => {
    const ctx = createSelectionFlow();

    ctx.controller.publishCpuSelectionNetworkSnapshot('white', { type: 'place' }, [{ type: 'move' }]);

    expect(ctx.runtime.publishSnapshot).toHaveBeenCalledWith({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'move' }],
      action: { type: 'place' }
    });
    expect(ctx.networkTurnHandoff.publishNetworkSnapshot).not.toHaveBeenCalled();
  });

  test('publishCpuSelectionNetworkSnapshot does not fallback when runtime network publish is inactive', () => {
    const ctx = createSelectionFlow();
    ctx.runtime.isNetworkPublishActive.mockReturnValue(false);

    const result = ctx.controller.publishCpuSelectionNetworkSnapshot('white', { type: 'place' }, [{ type: 'move' }]);

    expect(result).toBeUndefined();
    expect(ctx.runtime.publishSnapshot).not.toHaveBeenCalled();
    expect(ctx.networkTurnHandoff.publishNetworkSnapshot).not.toHaveBeenCalled();
  });

  test('scheduleCpuSelectionWhiteTurn only runs CPU turn when white is still active on the expected turn', () => {
    const ctx = createSelectionFlow();

    ctx.controller.scheduleCpuSelectionWhiteTurn(15, 7);
    const handle = ctx.timerService.setTimeout.mock.results[0].value;

    handle.callback();

    expect(ctx.runtime.processCpuTurn).toHaveBeenCalledTimes(1);
    expect(handle.unref).toHaveBeenCalledTimes(1);

    ctx.runtime.processCpuTurn.mockClear();
    ctx.gameState.currentPlayer = 1;
    handle.callback();
    expect(ctx.runtime.processCpuTurn).not.toHaveBeenCalled();
  });

  test('a reserved CPU selection callback stays inert after the integrity latch', () => {
    const ctx = createSelectionFlow();

    ctx.controller.scheduleCpuSelectionWhiteTurn(15, 7);
    const handle = ctx.timerService.setTimeout.mock.results[0].value;
    ctx.runtime.isCardRuntimeIntegrityBlocked.mockReturnValue(true);
    handle.callback();

    expect(ctx.runtime.processCpuTurn).not.toHaveBeenCalled();
  });

  test('maybeContinueCpuSelectionTurnHandoff finalizes only after the turn is handed to the opponent', async () => {
    const ctx = createSelectionFlow({ gameState: { currentPlayer: 1, turnNumber: 8 } });

    ctx.controller.maybeContinueCpuSelectionTurnHandoff('white', 'SWAP_WITH_ENEMY', [{ type: 'move' }], { type: 'place' });
    await flushPromises();

    expect(ctx.networkTurnHandoff.finalizeNetworkTurnHandoff).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'move' }],
      humanMode: false
    }));
  });

  test('finalizeCpuPendingSelectionFlow falls back to handoff for selection-only pending types on finalize failure', async () => {
    const ctx = createSelectionFlow({
      gameState: { currentPlayer: 1, turnNumber: 8 },
      pendingSelectionFlow: {
        finalizePendingSelectionFlow: jest.fn(() => Promise.reject(new Error('boom')))
      }
    });

    await ctx.controller.finalizeCpuPendingSelectionFlow('white', 'TRAP_WILL', [{ type: 'move' }], { type: 'place' });
    await flushPromises();

    expect(ctx.networkTurnHandoff.finalizeNetworkTurnHandoff).toHaveBeenCalledTimes(1);
    expect(ctx.runtime.publishSnapshot).not.toHaveBeenCalled();
  });

  test('finalizer rejection after the integrity latch cannot resume CPU handoff, playback, publish, or rendering', async () => {
    let blocked = false;
    const ctx = createSelectionFlow({
      runtime: {
        isCardRuntimeIntegrityBlocked: jest.fn(() => blocked)
      },
      gameState: { currentPlayer: 1, turnNumber: 8 },
      pendingSelectionFlow: {
        finalizePendingSelectionFlow: jest.fn(() => {
          blocked = true;
          return Promise.reject(new Error('runtime unavailable'));
        })
      }
    });

    await ctx.controller.finalizeCpuPendingSelectionFlow('white', 'TRAP_WILL', [{ type: 'move' }], { type: 'place' });
    await flushPromises();

    expect(ctx.networkTurnHandoff.finalizeNetworkTurnHandoff).not.toHaveBeenCalled();
    expect(ctx.networkTurnHandoff.waitForPlaybackIdleIfNeeded).not.toHaveBeenCalled();
    expect(ctx.runtime.publishSnapshot).not.toHaveBeenCalled();
    expect(ctx.emitBoardUpdate).not.toHaveBeenCalled();
    expect(ctx.runtime.processCpuTurn).not.toHaveBeenCalled();
  });

  test('explicit finalizer runtime-unavailable report becomes a terminal structured result', async () => {
    const ctx = createSelectionFlow({
      gameState: { currentPlayer: 1, turnNumber: 8 },
      pendingSelectionFlow: {
        finalizePendingSelectionFlow: jest.fn((options: any) => {
          options.onRuntimeUnavailable({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
          return Promise.resolve(false);
        })
      }
    });

    const result = await ctx.controller.finalizeCpuPendingSelectionFlow(
      'white',
      'TRAP_WILL',
      [{ type: 'move' }],
      { type: 'place' }
    );

    expect(result).toEqual({ ok: false, reason: 'runtime_unavailable' });
    expect(ctx.networkTurnHandoff.finalizeNetworkTurnHandoff).not.toHaveBeenCalled();
    expect(ctx.networkTurnHandoff.waitForPlaybackIdleIfNeeded).not.toHaveBeenCalled();
    expect(ctx.runtime.publishSnapshot).not.toHaveBeenCalled();
    expect(ctx.emitBoardUpdate).not.toHaveBeenCalled();
  });

  test('finalizeCpuPendingSelectionFlow waits for playback and publishes snapshot for non-selection-only pending types', async () => {
    const ctx = createSelectionFlow({
      pendingSelectionFlow: {
        finalizePendingSelectionFlow: undefined
      }
    });

    await ctx.controller.finalizeCpuPendingSelectionFlow('white', 'TEMPT_WILL', [{ type: 'move' }], { type: 'place' });

    expect(ctx.networkTurnHandoff.waitForPlaybackIdleIfNeeded).toHaveBeenCalledWith([{ type: 'move' }]);
    expect(ctx.runtime.publishSnapshot).toHaveBeenCalledWith({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'move' }],
      action: { type: 'place' }
    });
  });
});
