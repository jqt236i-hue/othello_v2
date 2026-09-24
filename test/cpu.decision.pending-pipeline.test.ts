import { createCpuDecisionPendingPipeline } from '../game/cpu-decision-pending-pipeline';
import { createCpuTurnPendingPhase } from '../game/cpu-turn-pending-phase';
import { buildCpuTurnAnalysisSeed, createCpuTurnAnalysisInvocation } from '../game/cpu-turn-analysis';
import {
  createCpuTurnPerformanceScope,
  readActiveCpuPendingSelectionPerformanceScope,
  setActiveCpuPendingSelectionPerformanceScope
} from '../game/cpu-turn-performance';

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
  test('times the post-policy canonical commit for the registered pending scope only', async () => {
    const entries: any[] = [];
    let now = 100;
    const scope = createCpuTurnPerformanceScope({
      recorder: (entry: any) => entries.push(entry), correlationId: 'cpu-pending-1', runId: 3,
      playerKey: 'white', level: 1, readNowMs: () => ++now
    });
    const ctx = createController({ adapter: { runTurnWithAdapter: jest.fn(() => ({
      ok: true, nextCardState: { turnIndex: 8 }, nextGameState: { currentPlayer: 1 }, playbackEvents: []
    })) } });

    await ctx.controller.runCpuPendingSelectionViaPipeline('white', { trapTarget: { row: 2, col: 3 } }, 'TRAP_WILL');
    expect(entries).toEqual([]);

    setActiveCpuPendingSelectionPerformanceScope('white', scope);
    try {
      await ctx.controller.runCpuPendingSelectionViaPipeline('black', { trapTarget: { row: 2, col: 3 } }, 'TRAP_WILL');
      expect(entries).toEqual([]);
      await ctx.controller.runCpuPendingSelectionViaPipeline('white', { trapTarget: { row: 2, col: 3 } }, 'TRAP_WILL');
    } finally {
      setActiveCpuPendingSelectionPerformanceScope('white', null);
    }
    expect(entries.map((entry) => [entry.stage, entry.kind, entry.correlationId])).toEqual([
      ['canonical-commit', 'sync', 'cpu-pending-1'],
      ['canonical-commit', 'sync', 'cpu-pending-1']
    ]);
    expect(ctx.getCardState()).toEqual({ turnIndex: 8 });
  });

  test('card_targeted commentary reuses the turn-start metrics snapshot of the same invocation', async () => {
    const buildMetrics = jest.fn(() => ({ phase: 'middle', advantage: 'even' }));
    const invocation = createCpuTurnAnalysisInvocation(buildCpuTurnAnalysisSeed({ identity: { runId: 1, playerKey: 'white' } }), {
      commentary: { 'turn-start': { buildMetrics } }
    } as any);
    const emitted: any[] = [];
    const emitCpuCommentary = jest.fn((eventType: any, playerKey: any, extra: any, analysisOptions?: any) => {
      emitted.push(analysisOptions ? analysisOptions.invocation.deriveCommentaryAnalysis(analysisOptions.snapshotMoment).metrics : null);
    });
    const phase = createCpuTurnPendingPhase({
      clearCpuPendingSelection: jest.fn(), emitCpuCommentary, emitCpuDebugLog: jest.fn(),
      getAnimationRetryDelayMs: () => 0, getCurrentPlayerKeySafe: () => 'black',
      getPendingDispatchHandlers: () => ({ trap: jest.fn(async () => undefined) }), isCpuDebugLogAvailable: () => false,
      isUiAnimationBusy: () => false, readCpuPendingSelection: () => null, resetPendingSelectRetryState: jest.fn(),
      resolvePendingSelectionDispatchKeyForCpu: () => 'trap', scheduleRunCpuTurn: jest.fn(), setCpuProcessing: jest.fn(),
      shouldAbortCpuForHumanMode: () => false, shouldAbortStuckPendingSelection: () => false
    });
    const turnStart = invocation.deriveCommentaryAnalysis('turn-start').metrics;

    await phase.runCpuTurnPendingPhase({ playerKey: 'white', level: 1,
      pending: { stage: 'selectTarget', type: 'TRAP_WILL' },
      commentaryAnalysis: { invocation, snapshotMoment: 'turn-start' } });
    await phase.runCpuTurnPendingPhase({ playerKey: 'white', level: 1,
      pending: { stage: 'selectTarget', type: 'TRAP_WILL' } });

    expect(emitCpuCommentary.mock.calls.map((call) => call[0])).toEqual(['card_targeted', 'card_targeted']);
    expect(emitted).toEqual([turnStart, null]);
    expect(buildMetrics).toHaveBeenCalledTimes(1);
  });

  test('the pending phase labels the synchronous prefix as target choice and scopes the commit to the handler', async () => {
    const entries: any[] = [];
    let now = 0;
    const scope = createCpuTurnPerformanceScope({
      recorder: (entry: any) => entries.push(entry), correlationId: 'cpu-pending-2', runId: 4,
      playerKey: 'white', level: 1, readNowMs: () => ++now
    });
    const seenScopes: any[] = [];
    const handler = jest.fn(async () => {
      seenScopes.push(readActiveCpuPendingSelectionPerformanceScope('white'));
      await Promise.resolve();
      seenScopes.push(readActiveCpuPendingSelectionPerformanceScope('white'));
    });
    const phase = createCpuTurnPendingPhase({
      clearCpuPendingSelection: jest.fn(), emitCpuCommentary: jest.fn(), emitCpuDebugLog: jest.fn(),
      getAnimationRetryDelayMs: () => 0, getCurrentPlayerKeySafe: () => 'black',
      getPendingDispatchHandlers: () => ({ trap: handler }), isCpuDebugLogAvailable: () => false,
      isUiAnimationBusy: () => false, readCpuPendingSelection: () => null, resetPendingSelectRetryState: jest.fn(),
      resolvePendingSelectionDispatchKeyForCpu: () => 'trap', scheduleRunCpuTurn: jest.fn(), setCpuProcessing: jest.fn(),
      shouldAbortCpuForHumanMode: () => false, shouldAbortStuckPendingSelection: () => false
    });

    await phase.runCpuTurnPendingPhase({ playerKey: 'white', level: 1, performanceScope: scope,
      pending: { stage: 'selectTarget', type: 'TRAP_WILL' } });

    expect(seenScopes).toEqual([scope, scope]);
    expect(readActiveCpuPendingSelectionPerformanceScope('white')).toBeNull();
    expect(entries.filter((entry) => entry.kind === 'sync').map((entry) => entry.stage))
      .toEqual(['commentary-context', 'pending-target-choice']);
  });

  test('a cancellation keeps its canonical action type and completes the ordinary UI handoff', async () => {
    const ctx = createController({ adapter: { runTurnWithAdapter: jest.fn(() => ({
      ok: true, nextCardState: { turnIndex: 7, pendingEffectByPlayer: { white: null } },
      nextGameState: { currentPlayer: -1 }, playbackEvents: []
    })) } });
    const result = await ctx.controller.runCpuPendingSelectionViaPipeline('white', { type: 'cancel_card' }, 'STRONG_WIND_WILL');
    expect(result.ok).toBe(true);
    expect(ctx.pendingSelectionFlow.createPendingSelectionAction).not.toHaveBeenCalled();
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'white',
      { type: 'cancel_card', turnIndex: 7, deferNetworkPublish: true }, ctx.pipeline);
    expect(ctx.finalizeCpuPendingSelectionFlow).toHaveBeenCalledWith('white', 'STRONG_WIND_WILL', [],
      expect.objectContaining({ type: 'cancel_card' }));
  });

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
