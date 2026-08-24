import { createCpuDecisionPendingPipeline } from '../game/cpu-decision-pending-pipeline';

function createController(overrides?: Record<string, unknown>) {
  let cardState = {
    turnIndex: 7
  } as any;
  let gameState = {
    currentPlayer: -1
  } as any;
  const runtimeModules = {
    TurnPipelineUIAdapter: null,
    TurnPipeline: null
  } as any;
  let localAdapter = {
    runTurnWithAdapter: jest.fn()
  } as any;
  let localPipeline = { id: 'pipeline' } as any;
  const pendingSelectionFlow = {
    createPendingSelectionAction: jest.fn((playerKey, pendingType, payload, options) => ({
      type: 'place',
      playerKey,
      pendingType,
      payload,
      turnIndex: options && options.cardState ? options.cardState.turnIndex : undefined
    }))
  } as any;
  const emitPresentationEventForCpu = jest.fn();
  const emitCpuSelectionStateChange = jest.fn();
  const finalizeCpuPendingSelectionFlow = jest.fn(() => Promise.resolve());
  const createPlaceAction = jest.fn((playerKey, payload) => Object.assign({ type: 'place', playerKey }, payload));
  const resolveModuleReference = jest.fn((currentValue, options) => {
    if (currentValue) return currentValue;
    return options && typeof options.readLocal === 'function' ? options.readLocal() : null;
  });

  const controller = createCpuDecisionPendingPipeline({
    readRuntimeModule: (moduleKey) => runtimeModules[moduleKey] || null,
    resolveModuleReference,
    readTurnPipelineAdapterLocal: () => localAdapter,
    readTurnPipelineLocal: () => localPipeline,
    resolvePendingSelectionFlow: () => pendingSelectionFlow,
    createPlaceAction,
    getCardState: () => cardState,
    getGameState: () => gameState,
    setCardState: (nextCardState) => { cardState = nextCardState; },
    setGameState: (nextGameState) => { gameState = nextGameState; },
    emitPresentationEventForCpu,
    emitCpuSelectionStateChange,
    finalizeCpuPendingSelectionFlow
  });

  if (overrides && overrides.runtimeModules) Object.assign(runtimeModules, overrides.runtimeModules);
  if (overrides && overrides.adapter) Object.assign(localAdapter, overrides.adapter);
  if (overrides && overrides.pipeline) Object.assign(localPipeline, overrides.pipeline);
  if (overrides && overrides.pendingSelectionFlow) Object.assign(pendingSelectionFlow, overrides.pendingSelectionFlow);
  if (overrides && overrides.cardState) Object.assign(cardState, overrides.cardState);
  if (overrides && overrides.gameState) Object.assign(gameState, overrides.gameState);

  return {
    controller,
    adapter: localAdapter,
    pipeline: localPipeline,
    pendingSelectionFlow,
    emitPresentationEventForCpu,
    emitCpuSelectionStateChange,
    finalizeCpuPendingSelectionFlow,
    createPlaceAction,
    resolveModuleReference,
    setLocalAdapter: (nextAdapter: any) => { localAdapter = nextAdapter; },
    setLocalPipeline: (nextPipeline: any) => { localPipeline = nextPipeline; },
    getCardState: () => cardState,
    getGameState: () => gameState
  };
}

describe('cpu decision pending pipeline controller', () => {
  test('resolveTurnPipelineAdapter prefers runtime module when available', () => {
    const runtimeAdapter = { runTurnWithAdapter: jest.fn() };
    const ctx = createController({ runtimeModules: { TurnPipelineUIAdapter: runtimeAdapter } });

    expect(ctx.controller.resolveTurnPipelineAdapter()).toBe(runtimeAdapter);
    expect(ctx.resolveModuleReference).not.toHaveBeenCalled();
  });

  test('resolveTurnPipelineAdapter refreshes local adapter after the global adapter object changes', () => {
    const ctx = createController();
    const firstAdapter = ctx.controller.resolveTurnPipelineAdapter();
    const nextAdapter = { runTurnWithAdapter: jest.fn() };

    ctx.setLocalAdapter(nextAdapter);

    expect(firstAdapter).not.toBe(nextAdapter);
    expect(ctx.controller.resolveTurnPipelineAdapter()).toBe(nextAdapter);
  });

  test('runCpuPendingSelectionViaPipeline uses pending selection action factory and finalizes on success', async () => {
    const nextCardState = { turnIndex: 8 } as any;
    const nextGameState = { currentPlayer: 1 } as any;
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          nextCardState,
          nextGameState,
          playbackEvents: [{ type: 'move' }]
        }))
      }
    });

    const result = await ctx.controller.runCpuPendingSelectionViaPipeline('white', { trapTarget: { row: 2, col: 3 } }, 'TRAP_WILL');

    expect(result).toMatchObject({ ok: true });
    expect(ctx.pendingSelectionFlow.createPendingSelectionAction).toHaveBeenCalledWith(
      'white',
      'TRAP_WILL',
      { trapTarget: { row: 2, col: 3 }, deferNetworkPublish: true },
      { cardState: expect.any(Object) }
    );
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'white', expect.objectContaining({
      type: 'place',
      deferNetworkPublish: true
    }), ctx.pipeline);
    expect(ctx.emitPresentationEventForCpu).toHaveBeenCalledWith({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move' }],
      meta: { source: 'cpu_pending_selection', pendingType: 'TRAP_WILL' }
    });
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.finalizeCpuPendingSelectionFlow).toHaveBeenCalledWith('white', 'TRAP_WILL', [{ type: 'move' }], expect.objectContaining({
      type: 'place',
      deferNetworkPublish: true
    }));
    expect(ctx.getCardState()).toBe(nextCardState);
    expect(ctx.getGameState()).toBe(nextGameState);
  });

  test('runCpuPendingSelectionViaPipeline falls back to ActionManager-style place action and copies turnIndex', async () => {
    const ctx = createController({
      pendingSelectionFlow: {
        createPendingSelectionAction: undefined
      },
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({ ok: true, playbackEvents: [] }))
      }
    });

    await ctx.controller.runCpuPendingSelectionViaPipeline('black', { guardTarget: { row: 1, col: 2 } }, 'GUARD_WILL');

    expect(ctx.createPlaceAction).toHaveBeenCalledWith('black', {
      guardTarget: { row: 1, col: 2 },
      deferNetworkPublish: true
    });
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'black', expect.objectContaining({
      type: 'place',
      playerKey: 'black',
      turnIndex: 7,
      deferNetworkPublish: true
    }), ctx.pipeline);
  });

  test('treats ordinary finalization failure as terminally handled after the pipeline already applied', async () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          nextCardState: { turnIndex: 8 },
          nextGameState: { currentPlayer: 1 },
          playbackEvents: []
        }))
      }
    });
    ctx.finalizeCpuPendingSelectionFlow.mockResolvedValue(false);

    const result = await ctx.controller.runCpuPendingSelectionViaPipeline(
      'white',
      { trapTarget: { row: 2, col: 3 } },
      'TRAP_WILL'
    );

    expect(result).toMatchObject({
      ok: false,
      handled: true,
      reason: 'finalization_failed'
    });
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(ctx.finalizeCpuPendingSelectionFlow).toHaveBeenCalledTimes(1);
  });

  test('treats adapter runtime-unavailable rejection as terminal before any state or presentation writes', async () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: false,
          rejectedReason: 'RUNTIME_UNAVAILABLE',
          events: []
        }))
      }
    });
    const originalCardState = ctx.getCardState();

    const result = await ctx.controller.runCpuPendingSelectionViaPipeline(
      'white',
      { trapTarget: { row: 2, col: 3 } },
      'TRAP_WILL'
    );

    expect(result).toMatchObject({
      ok: false,
      handled: true,
      reason: 'runtime_unavailable'
    });
    expect(ctx.getCardState()).toBe(originalCardState);
    expect(ctx.emitPresentationEventForCpu).not.toHaveBeenCalled();
    expect(ctx.emitCpuSelectionStateChange).not.toHaveBeenCalled();
    expect(ctx.finalizeCpuPendingSelectionFlow).not.toHaveBeenCalled();
  });

  test('runCpuPendingSelectionViaPipeline returns null when adapter contract is unavailable', async () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: undefined
      }
    });

    const result = await ctx.controller.runCpuPendingSelectionViaPipeline('white', { temptTarget: { row: 4, col: 4 } }, 'TEMPT_WILL');

    expect(result).toBeNull();
  });

  test('runCpuPendingSelectionViaPipeline returns failure payload when adapter rejects the turn', async () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({ ok: false, reason: 'bad_action' }))
      }
    });

    const result = await ctx.controller.runCpuPendingSelectionViaPipeline('white', { temptTarget: { row: 4, col: 4 } }, 'TEMPT_WILL');

    expect(result).toEqual({
      ok: false,
      res: { ok: false, reason: 'bad_action' }
    });
    expect(ctx.finalizeCpuPendingSelectionFlow).not.toHaveBeenCalled();
    expect(ctx.emitCpuSelectionStateChange).not.toHaveBeenCalled();
  });
});
