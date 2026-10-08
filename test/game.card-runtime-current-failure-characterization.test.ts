import * as path from 'path';
import * as vm from 'vm';
import {
  CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE,
  CARD_RUNTIME_FAILURE_MAPPING,
  CARD_RUNTIME_RECOVERY_MATRIX,
  compileNamedFunctionFromSource,
  createCharacterizationRuntimeUnavailableError,
  isCharacterizationRuntimeUnavailableError
} from './helpers/card-runtime-contract-fixtures';

const ROOT = path.resolve(__dirname, '..');
const EffectResolver = require('../game/cards/effect-resolver');
const CardLogic = require('../game/logic/cards');
const PendingStateManager = require('../game/logic/cards-internal/pending-state-manager');
const CpuTurnSchedulerModule = require('../game/cpu-turn-scheduler');

function makeCancelableState() {
  return {
    pendingEffectByPlayer: {
      black: { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' },
      white: null
    },
    hands: { black: [], white: [] },
    discard: ['destroy_01'],
    charge: { black: 0, white: 0 },
    hasUsedCardThisTurnByPlayer: { black: true, white: false },
    cardUseCountByPlayer: { black: 1, white: 0 }
  };
}

function makeCancellationDeps(state: any, manager?: any) {
  return {
    CardPendingStateManagerModule: manager,
    getCardDef: () => ({ id: 'destroy_01', cost: 4 }),
    addChargeValue: (target: any, playerKey: string, amount: number) => {
      target.charge[playerKey] += amount;
    },
    moveDiscardCardToHandByCardId: (target: any, playerKey: string, cardId: string) => {
      const index = target.discard.indexOf(cardId);
      if (index >= 0) target.discard.splice(index, 1);
      target.hands[playerKey].push(cardId);
      return true;
    },
    readCardPendingEffect: () => state.pendingEffectByPlayer.black,
    clearCardPendingEffect: () => { state.pendingEffectByPlayer.black = null; }
  };
}

describe('current card runtime failure and recovery characterization', () => {
  test('branded structural transport taxonomy accepts exact cross-bundle Errors and rejects unbranded/shape-only values', () => {
    const tagged = createCharacterizationRuntimeUnavailableError('target-legality', 'legality-query');
    expect(isCharacterizationRuntimeUnavailableError(tagged)).toBe(true);
    expect(tagged).toMatchObject({
      name: 'CardRuntimeUnavailableError',
      code: CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE,
      capability: 'target-legality',
      cohort: 'legality-query'
    });
    const brandKey = Reflect.ownKeys(tagged).find((key) => typeof key === 'symbol');
    expect(brandKey).toBe(Symbol.for('card-reversi.card-runtime-unavailable.characterization.v1'));
    expect(Object.getOwnPropertyDescriptor(tagged, brandKey!)).toMatchObject({
      enumerable: false, configurable: false, writable: false
    });

    const foreignCanonical = vm.runInNewContext(`(() => {
      const error = new Error('foreign canonical runtime');
      Object.defineProperties(error, {
        name: { value: 'CardRuntimeUnavailableError', configurable: true },
        code: { value: 'runtime_unavailable', enumerable: true },
        capability: { value: 'target-legality', enumerable: true },
        cohort: { value: 'legality-query', enumerable: true },
        [Symbol.for('card-reversi.card-runtime-unavailable.characterization.v1')]: {
          value: 'card-runtime-unavailable:characterization:v1',
          enumerable: false,
          configurable: false,
          writable: false
        }
      });
      return error;
    })()`);
    expect(isCharacterizationRuntimeUnavailableError(foreignCanonical)).toBe(true);
    const transportCompatibleError = new Error('independently constructed transport-compatible failure');
    Object.defineProperties(transportCompatibleError, {
      name: { value: 'CardRuntimeUnavailableError', configurable: true },
      code: { value: 'runtime_unavailable', enumerable: true },
      capability: { value: 'target-legality', enumerable: true },
      cohort: { value: 'legality-query', enumerable: true },
      [Symbol.for('card-reversi.card-runtime-unavailable.characterization.v1')]: {
        value: 'card-runtime-unavailable:characterization:v1',
        enumerable: false,
        configurable: false,
        writable: false
      }
    });
    // This is deliberately a cross-bundle transport tag, not proof that the
    // current JS object originated from one private constructor.
    expect(isCharacterizationRuntimeUnavailableError(transportCompatibleError)).toBe(true);
    expect(isCharacterizationRuntimeUnavailableError(new Error(tagged.message))).toBe(false);
    expect(isCharacterizationRuntimeUnavailableError({
      name: tagged.name,
      message: tagged.message,
      code: CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE,
      capability: 'target-legality',
      cohort: 'legality-query',
      [Symbol.for('card-reversi.card-runtime-unavailable.characterization.v1')]: 'card-runtime-unavailable:characterization:v1'
    })).toBe(false);
    expect(isCharacterizationRuntimeUnavailableError(new TypeError('runtime_unavailable'))).toBe(false);
  });

  test('Worker preload current mapping registers before load, skips an existing usable global, and propagates loader failure', () => {
    const runtimeGlobalKeys: string[] = [];
    const installed = new Map<string, unknown>();
    const loadModule = jest.fn(() => ({ ready: true }));
    const install = compileNamedFunctionFromSource(
      ROOT,
      'workers/match-worker-runtime-preload.ts',
      'installRuntimeModule',
      {
        runtimeGlobalKeys,
        hasUsableGlobalRuntimeModule: (key: string) => installed.has(key),
        unwrapModule: (value: unknown) => value,
        hasUsableRuntimeModule: (value: unknown) => !!value,
        setGlobalRuntimeModule: (key: string, value: unknown) => installed.set(key, value)
      }
    );

    install('FixtureRuntime', loadModule);
    expect(runtimeGlobalKeys).toEqual(['FixtureRuntime']);
    expect(loadModule).toHaveBeenCalledTimes(1);
    expect(installed.get('FixtureRuntime')).toEqual({ ready: true });

    const skippedLoader = jest.fn(() => ({ replacement: true }));
    install('FixtureRuntime', skippedLoader);
    expect(runtimeGlobalKeys).toEqual(['FixtureRuntime']);
    expect(skippedLoader).not.toHaveBeenCalled();
    expect(installed.get('FixtureRuntime')).toEqual({ ready: true });

    const failingKeys: string[] = [];
    const failingSetter = jest.fn();
    const installFailing = compileNamedFunctionFromSource(
      ROOT,
      'workers/match-worker-runtime-preload.ts',
      'installRuntimeModule',
      {
        runtimeGlobalKeys: failingKeys,
        hasUsableGlobalRuntimeModule: () => false,
        unwrapModule: (value: unknown) => value,
        hasUsableRuntimeModule: (value: unknown) => !!value,
        setGlobalRuntimeModule: failingSetter
      }
    );
    const loaderFailure = new TypeError('fixture preload failure');
    expect(() => installFailing('BrokenRuntime', () => { throw loaderFailure; })).toThrow(loaderFailure);
    expect(failingKeys).toEqual(['BrokenRuntime']);
    expect(failingSetter).not.toHaveBeenCalled();
    expect(CARD_RUNTIME_FAILURE_MAPPING.current.activation).toContain('aborts evaluation');
  });

  test('UI preview preserves untagged fallback but stops a tagged dependency failure', () => {
    const calls: string[] = [];
    const run = compileNamedFunctionFromSource(ROOT, 'cards/card-interaction.ts', '_isSelectedCardUsableNow', {
      cardState: { hands: { black: ['destroy_01'] } },
      gameState: { board: [] },
      _doesPlayerOwnCard: () => true,
      _isNetworkMode: () => false,
      CardLogic: {
        getUsableCardIds: () => { calls.push('getUsableCardIds'); throw new TypeError('query fault'); },
        canUseCard: () => { calls.push('canUseCard'); return false; }
      },
      _latchCardRuntimeIntegrityFailureForInteraction: () => false
    });
    expect(run('black', 'destroy_01', {})).toBe(false);
    expect(calls).toEqual(['getUsableCardIds', 'canUseCard']);

    const taggedCalls: string[] = [];
    const taggedFailure = createCharacterizationRuntimeUnavailableError('target-legality');
    const taggedRun = compileNamedFunctionFromSource(ROOT, 'cards/card-interaction.ts', '_isSelectedCardUsableNow', {
      cardState: { hands: { black: ['destroy_01'] } },
      gameState: { board: [] },
      _doesPlayerOwnCard: () => true,
      _isNetworkMode: () => false,
      CardLogic: {
        getUsableCardIds: () => { taggedCalls.push('getUsableCardIds'); throw taggedFailure; },
        canUseCard: () => { taggedCalls.push('canUseCard'); return true; }
      },
      _latchCardRuntimeIntegrityFailureForInteraction: (error: unknown) => (
        isCharacterizationRuntimeUnavailableError(error)
      )
    });
    expect(taggedRun('black', 'destroy_01', {})).toBe(false);
    expect(taggedCalls).toEqual(['getUsableCardIds']);
    expect(CARD_RUNTIME_FAILURE_MAPPING.current.uiPreview).toContain('true');
    expect(CARD_RUNTIME_FAILURE_MAPPING.target.uiPreview).toContain('no alternate query');
  });

  test('current server-authored UI lane owns its busy lock through a publish rejection and settles it', async () => {
    const trace: string[] = [];
    const handle = compileNamedFunctionFromSource(ROOT, 'cards/card-interaction.ts', '_handleServerAuthoredCardUse', {
      CardRuntimeIntegrity: { isCardRuntimeIntegrityBlocked: () => false },
      _isRuntimeUnavailablePublishResult: () => false,
      _getRunResultPublishPromise: (value: any) => value.publishPromise,
      _beginServerAuthoredCardUseClickBuffer: () => trace.push('buffer:begin'),
      _setPendingSelectionBusy: (active: boolean) => trace.push(`busy:${active}`),
      _renderCardUiSafely: () => trace.push('render'),
      _clearServerAuthoredCardUseClickBuffer: () => trace.push('buffer:clear'),
      addLog: (message: string) => trace.push(`log:${message}`),
      ensureCurrentPlayerCanActOrPass: () => trace.push('resume-input'),
      _waitForAuthoritativeVisualPlaybackDrain: () => Promise.resolve(),
      _consumeServerAuthoredCardUseClickBuffer: () => null,
      cardState: { selectedCardId: null },
      _getSelectedCardOwnerKey: () => null,
      _clearSelectedCardSelection: () => trace.push('selection:clear'),
      _requestImmediateBoardRefresh: () => trace.push('board:refresh'),
      _getUiRootRef: () => null,
      _hasBoardPendingSelectionForOwner: () => false
    });
    const publishPromise = Promise.resolve({ ok: false, reason: 'fixture-rejected' });
    expect(handle('black', 'black', 'destroy_01', { publishPromise })).toBe(true);
    expect(trace).toEqual(['buffer:begin', 'busy:true', 'render']);
    await publishPromise;
    await Promise.resolve();
    expect(trace).toEqual([
      'buffer:begin', 'busy:true', 'render', 'busy:false', 'buffer:clear',
      'log:カード使用に失敗しました (fixture-rejected)', 'render', 'resume-input'
    ]);
  });

  test('server-authored UI publish suppresses post-latch callbacks while settling accepted visuals and locks', async () => {
    const trace: string[] = [];
    let blocked = false;
    let resolvePublish: (value: any) => void = () => undefined;
    const publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    const handle = compileNamedFunctionFromSource(ROOT, 'cards/card-interaction.ts', '_handleServerAuthoredCardUse', {
      CardRuntimeIntegrity: {
        isCardRuntimeIntegrityBlocked: () => blocked
      },
      _getRunResultPublishPromise: (value: any) => value.publishPromise,
      _beginServerAuthoredCardUseClickBuffer: () => trace.push('buffer:begin'),
      _setPendingSelectionBusy: (active: boolean) => trace.push(`busy:${active}`),
      _renderCardUiSafely: () => trace.push('render'),
      _clearServerAuthoredCardUseClickBuffer: () => trace.push('buffer:clear'),
      addLog: (message: string) => trace.push(`log:${message}`),
      ensureCurrentPlayerCanActOrPass: () => trace.push('resume-input'),
      _waitForAuthoritativeVisualPlaybackDrain: () => {
        trace.push('visual:drain');
        return Promise.resolve();
      },
      _consumeServerAuthoredCardUseClickBuffer: () => ({ row: 2, col: 3 }),
      cardState: { selectedCardId: 'destroy_01' },
      _getSelectedCardOwnerKey: () => 'black',
      _clearSelectedCardSelection: () => trace.push('selection:clear'),
      _requestImmediateBoardRefresh: () => trace.push('board:refresh'),
      _getUiRootRef: () => ({ handleCellClick: () => trace.push('cell:click') }),
      _hasBoardPendingSelectionForOwner: () => false
    });

    expect(handle('black', 'black', 'destroy_01', { publishPromise })).toBe(true);
    blocked = true;
    resolvePublish({ ok: true, presentationCursor: { visualSeq: 11 } });
    await publishPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(trace).toEqual([
      'buffer:begin', 'busy:true', 'render', 'visual:drain', 'busy:false', 'buffer:clear'
    ]);
  });

  test('untagged CPU query keeps alternate APIs and leaves hasUsableCard exceptions unhandled', () => {
    const calls: string[] = [];
    const cardLogic = {
      analyzeCardUsability: () => { calls.push('analyze'); throw new TypeError('analysis fault'); },
      getUsableCardIds: () => { calls.push('ids'); throw new TypeError('id fault'); },
      hasUsableCard: () => { calls.push('has'); return true; }
    };
    const run = compileNamedFunctionFromSource(ROOT, 'game/cpu-decision.ts', 'getTargetAwareCardUsabilityAnalysis', {
      cardState: { hands: { black: ['destroy_01'] }, handCopyIds: { black: [1] } },
      gameState: { board: [] },
      resolveCardLogicForCpuDecision: () => cardLogic,
      buildFallbackCardUsabilityAnalysis: (_player: string, ids: string[]) => ({ usableCardIds: ids.slice() }),
      isCardRuntimeUnavailableError: isCharacterizationRuntimeUnavailableError
    });
    expect(run('black')).toEqual({ usableCardIds: ['destroy_01'] });
    expect(calls).toEqual(['analyze', 'ids', 'has']);

    const propagates = compileNamedFunctionFromSource(ROOT, 'game/cpu-decision.ts', 'getTargetAwareCardUsabilityAnalysis', {
      cardState: { hands: { black: ['destroy_01'] } },
      gameState: { board: [] },
      resolveCardLogicForCpuDecision: () => ({ hasUsableCard: () => { throw new TypeError('boolean fault'); } }),
      buildFallbackCardUsabilityAnalysis: (_player: string, ids: string[]) => ({ usableCardIds: ids.slice() }),
      isCardRuntimeUnavailableError: isCharacterizationRuntimeUnavailableError
    });
    expect(() => propagates('black')).toThrow('boolean fault');
  });

  test('turn context preserves untagged fallback but propagates the runtime tag before AUTO/pass logic', () => {
    const safeContext = compileNamedFunctionFromSource(ROOT, 'game/turn/turn_pipeline_phases.ts', 'resolveSafeCardContext', {
      CardContextModule: { getSafeCardContext: () => { throw new TypeError('context helper fault'); } },
      isCardRuntimeUnavailableError: isCharacterizationRuntimeUnavailableError
    });
    expect(safeContext({ getCardContext: () => { throw new TypeError('context fault'); } }, {})).toEqual({
      protectedStones: [], permaProtectedStones: [], bombs: []
    });
    const taggedContext = compileNamedFunctionFromSource(ROOT, 'game/turn/turn_pipeline_phases.ts', 'resolveSafeCardContext', {
      CardContextModule: {
        getSafeCardContext: () => { throw createCharacterizationRuntimeUnavailableError('marker.getCardContext'); }
      },
      isCardRuntimeUnavailableError: isCharacterizationRuntimeUnavailableError
    });
    expect(() => taggedContext({ getCardContext: () => ({}) }, {})).toThrow('marker.getCardContext');

    const applyPassCompletion = jest.fn();
    const pass = compileNamedFunctionFromSource(ROOT, 'game/turn/turn_pipeline_phases.ts', 'applyPassActionStage', {
      resolveSafeCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      readPendingForActionPhase: () => null,
      isPendingActionAvailableForActionPhase: () => false,
      resolvePassEndsGame: () => false,
      isOthelloModeForTurnPipelinePhases: () => true,
      applyPassCompletion
    });
    const ctx = {
      CardLogic: {},
      Core: { BLACK: 1, WHITE: -1, getLegalMoves: () => [] },
      cardState: {}, gameState: {}, playerKey: 'black', events: [], prng: { random: () => 0.5 },
      action: { autoNoActionPass: true }
    };
    pass(ctx);
    expect(applyPassCompletion).toHaveBeenCalledTimes(1);

    const throwsBeforePass = compileNamedFunctionFromSource(ROOT, 'game/turn/turn_pipeline_phases.ts', 'applyPassActionStage', {
      resolveSafeCardContext: () => ({}),
      readPendingForActionPhase: () => null,
      isPendingActionAvailableForActionPhase: () => false,
      resolvePassEndsGame: () => false,
      isOthelloModeForTurnPipelinePhases: () => true,
      applyPassCompletion
    });
    expect(() => throwsBeforePass({
      ...ctx,
      CardLogic: { hasUsableCard: () => { throw new TypeError('has fault'); } }
    })).toThrow('has fault');
    expect(applyPassCompletion).toHaveBeenCalledTimes(1);
  });

  test('actual local authority valid command is atomic when its required runtime execution throws', () => {
    const runtimeFailure = createCharacterizationRuntimeUnavailableError('target-legality', 'turn-phases');
    const applyCommandPublishToSnapshot = jest.fn(() => { throw runtimeFailure; });
    let local: any;
    jest.isolateModules(() => {
      jest.doMock('../scripts/local-match-server', () => {
        const actual = jest.requireActual('../scripts/local-match-server');
        return { ...actual, applyCommandPublishToSnapshot };
      });
      const IsolatedLocalMatchRuntime = require('../scripts/local-match-runtime');
      local = IsolatedLocalMatchRuntime.createRuntime({ seed: 41 });
    });
    try {
      const roomBefore = JSON.parse(JSON.stringify(local.getRoom()));
      const validCommand = {
        roomId: 'LOCAL',
        seatKey: 'black',
        playerKey: 'black',
        actor: 'black',
        operationId: 'fixture-runtime-failure-1',
        baseVersion: 0,
        actionType: 'place',
        action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex: 0 }
      };
      expect(() => local.applyCommand(validCommand)).toThrow(runtimeFailure);
      expect(applyCommandPublishToSnapshot).toHaveBeenCalledTimes(1);
      expect(JSON.parse(JSON.stringify(local.getRoom()))).toEqual(roomBefore);
      expect(local.getRoom()).toMatchObject({
        stateVersion: 0,
        lastAcceptedOperationBySeat: { black: null, white: null },
        acceptedOperationHistoryBySeat: { black: [], white: [] },
        authorityLog: [],
        eventSeq: 0,
        sseEventBuffer: []
      });
    } finally {
      jest.dontMock('../scripts/local-match-server');
      jest.resetModules();
    }
  });

  test('selfplay decision entry treats a non-retryable pipeline rejection as terminal without committing state', () => {
    const state = {
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: { pendingEffectByPlayer: { black: null, white: null } },
      prng: { state: 17 },
      stateVersion: 4,
      skipTurnStartForNextAction: false
    };
    const before = JSON.parse(JSON.stringify(state));
    const run = compileNamedFunctionFromSource(ROOT, 'src/engine/selfplay-runner.ts', 'applyDecisionWithRetry', {
      buildDecisionSnapshot: () => ({ turnStartStoppedAction: false }),
      decideAction: () => ({ action: { type: 'pass' }, legalMoves: [] }),
      createAction: (decision: any, gameIndex: number, actionCounter: number, turnIndex: number) => ({
        action: { ...decision.action, actionId: `sp-${gameIndex}-${actionCounter}`, turnIndex },
        actionType: decision.action.type
      }),
      applyDecisionSnapshotBaseline: () => undefined,
      applyActionSafe: () => ({
        ok: false,
        rejectedReason: 'UNKNOWN',
        errorMessage: 'runtime unavailable',
        nextStateVersion: 4
      })
    });
    expect(() => run(state, 2, 3, 'black', {}, { value: 0 })).toThrow(
      '[SELFPLAY] action rejected game=2 ply=3 action=pass reason=UNKNOWN runtime unavailable'
    );
    expect(state).toEqual(before);
  });

  test('generic CPU error recovery clears pending, releases processing, resets retry state, and schedules retry', () => {
    const trace: string[] = [];
    const pending = { type: 'DESTROY_ONE_STONE' };
    const scheduledTimers = new Map<number, () => void>();
    const clearedTimerIds: number[] = [];
    let nextTimerId = 1;
    const scheduler = CpuTurnSchedulerModule.createCpuTurnScheduler({
      debugCpuTrace: () => undefined,
      getAnimationRetryDelayMs: () => 10,
      getCurrentPlayerKeySafe: () => 'black',
      getCurrentTurnNumberSafe: () => 1,
      getTimerService: () => ({
        setTimeout: (callback: () => void) => {
          const id = nextTimerId++;
          scheduledTimers.set(id, callback);
          return id;
        },
        clearTimeout: (id: number) => {
          clearedTimerIds.push(id);
          scheduledTimers.delete(id);
        }
      }),
      getTimers: () => null,
      runCpuTurn: () => trace.push('retry-run'),
      shouldAbortCpuForHumanMode: () => false
    });
    const handle = compileNamedFunctionFromSource(ROOT, 'game/cpu-turn-handler.ts', 'handleCpuTurnError', {
      stopCpuForRuntimeIntegrityIfBlocked: () => false,
      console: { error: () => undefined },
      isCpuDebugLogAvailable: () => false,
      emitCpuDebugLog: () => undefined,
      resolveCurrentCpuCardState: () => ({ pendingEffectByPlayer: { black: pending } }),
      readCpuPendingSelection: () => pending,
      debugCpuTrace: () => undefined,
      clearCpuPendingSelection: () => trace.push('pending-cleared'),
      setCpuProcessing: (value: boolean) => trace.push(`processing:${value}`),
      emitCpuTurnLogAdded: () => trace.push('terminal-log'),
      resetPendingSelectRetryState: (playerKey: string) => {
        trace.push('retry-state-reset');
        scheduler.resetPendingSelectRetryState(playerKey);
      },
      scheduleRunCpuTurn: (playerKey: string, options: any, delayMs: number) => {
        trace.push('retry-scheduled');
        scheduler.scheduleRunCpuTurn(playerKey, options, delayMs);
      },
      getAnimationRetryDelayMs: () => 10,
      withCpuTurnPerformanceOptions: () => ({}),
      isCardRuntimeUnavailableError: isCharacterizationRuntimeUnavailableError
    });
    handle('black', 'CPU', new TypeError('turn fault'), false, null);
    expect(trace).toEqual([
      'pending-cleared', 'processing:false', 'terminal-log', 'retry-state-reset', 'retry-scheduled'
    ]);
    expect(scheduler.getCpuRetryGeneration()).toBe(0);
    expect(scheduledTimers.size).toBe(1);
    scheduler.resetCpuTurnHandlerState();
    expect(scheduler.getCpuRetryGeneration()).toBe(1);
    expect(scheduledTimers.size).toBe(0);
    expect(clearedTimerIds).toEqual([1]);
    expect(CARD_RUNTIME_FAILURE_MAPPING.current.cpuTurn).toContain('schedules retry');
  });

  test('complete manager, absent override, direct facade, and classifier-only cancellation preserve every option combination', () => {
    const optionCases = [
      {},
      { refundCost: false },
      { resetUsage: false },
      { noConsume: true },
      { refundCost: false, resetUsage: false },
      { refundCost: false, noConsume: true },
      { resetUsage: false, noConsume: true },
      { refundCost: false, resetUsage: false, noConsume: true }
    ];
    const lanes = [
      {
        name: 'complete-manager',
        refundAmount: 4,
        run: (state: any, options: any) => EffectResolver.cancelPendingSelection(
          state, 'black', options, makeCancellationDeps(state, PendingStateManager)
        )
      },
      {
        name: 'absent-override',
        refundAmount: 4,
        run: (state: any, options: any) => EffectResolver.cancelPendingSelection(
          state, 'black', options, makeCancellationDeps(state)
        )
      },
      {
        name: 'direct-facade',
        refundAmount: CardLogic.getCardCost('destroy_01'),
        run: (state: any, options: any) => CardLogic.cancelPendingSelection(state, 'black', options)
      },
      {
        name: 'classifier-only',
        refundAmount: 4,
        run: (state: any, options: any) => EffectResolver.cancelPendingSelection(
          state,
          'black',
          options,
          makeCancellationDeps(state, { isCancellablePendingType: () => true })
        )
      }
    ];

    for (const lane of lanes) {
      for (const options of optionCases) {
        const state = makeCancelableState();
        expect(lane.run(state, options)).toEqual({ canceled: true, cardId: 'destroy_01' });
        const noConsume = options.noConsume === true;
        expect(state).toMatchObject({
          pendingEffectByPlayer: { black: null },
          hands: { black: ['destroy_01'] },
          discard: [],
          charge: { black: options.refundCost === false || noConsume ? 0 : lane.refundAmount },
          hasUsedCardThisTurnByPlayer: {
            black: options.resetUsage === false || noConsume
          },
          cardUseCountByPlayer: { black: noConsume ? 1 : 0 }
        });
      }
    }
  });

  test('target recovery rows cover locks, scheduler, pending, version, PRNG, events, retry, and publish ownership', () => {
    const lanes = CARD_RUNTIME_RECOVERY_MATRIX.map((row) => row.lane);
    expect(lanes).toEqual(expect.arrayContaining([
      'headless/selfplay', 'local/worker command', 'Vite/classic boot', 'UI preview/action',
      'CPU turn/scheduler', 'AUTO/timeout/direct pass'
    ]));
    expect(CARD_RUNTIME_RECOVERY_MATRIX.every((row) => row.retry === 0 && row.publish === 0)).toBe(true);
  });
});
