import { createCpuTurnMovePhase } from '../game/cpu-turn-move-phase.js';

const CANDIDATES = [
  { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
  { row: 4, col: 5, flips: [{ row: 4, col: 4 }] }
];

function createConfig(overrides: Record<string, any> = {}) {
  const executeMove = jest.fn();
  const selectCpuMoveSafe = jest.fn(() => CANDIDATES[0]);
  const expectedRequest = {
    requestId: 'cpu-score-1',
    decisionEpoch: 1,
    stateVersion: 5,
    turnNumber: 12,
    playerKey: 'white'
  };
  const batch = { request: expectedRequest, response: { scores: [] } };
  const prepare = jest.fn(() => expectedRequest);
  const score = jest.fn(async () => batch);
  const config = {
    blackValue: 1,
    countOwnedBasicCornersSafe: jest.fn(() => 0),
    debugCpuTrace: jest.fn(),
    emitCpuCommentary: jest.fn(),
    emitCpuDebugLog: jest.fn(),
    getActiveProtectionSafe: jest.fn(() => []),
    getAnimationRetryDelayMs: jest.fn(() => 0),
    getCardState: jest.fn(() => ({})),
    getCurrentPlayerKeySafe: jest.fn(() => 'white'),
    getCurrentStateVersionSafe: jest.fn(() => 5),
    getCurrentTurnNumberSafe: jest.fn(() => 12),
    getFlipBlockersSafe: jest.fn(() => []),
    getGameState: jest.fn(() => ({ currentPlayer: 'white', turnNumber: 12 })),
    getPrepareCpuCandidateScoringRequestFn: jest.fn(() => prepare),
    getPrepareCpuPlacementLookaheadRequestFn: jest.fn(() => null),
    getScoreCandidatesInWorkerFn: jest.fn(() => score),
    getSearchCpuPlacementLookaheadInWorkerFn: jest.fn(() => null),
    getSelectMoveFromOnnxFn: jest.fn(() => null),
    getUseCardWithPolicyFn: jest.fn(() => null),
    handleCpuTurnError: jest.fn(),
    isCpuDebugLogAvailable: jest.fn(() => false),
    isUiAnimationBusy: jest.fn(() => false),
    readNowMs: jest.fn(() => 1000),
    resetPendingSelectRetryState: jest.fn(),
    resolveCpuCardLogic: jest.fn(() => null),
    resolveExecuteMoveFn: jest.fn(() => executeMove),
    resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => CANDIDATES)),
    resolveLv6MinThinkMs: jest.fn(() => 0),
    resolveProcessPassTurn: jest.fn(() => null),
    scheduleRetry: jest.fn(),
    scheduleRunCpuTurn: jest.fn(),
    selectCpuMoveSafe,
    setCpuProcessing: jest.fn(),
    shouldAbortCpuForHumanMode: jest.fn(() => false),
    shouldUseOnnxMoveDecision: jest.fn(() => false),
    tryApplyAnyUsableCard: jest.fn(() => false),
    whiteValue: -1,
    ...overrides
  };
  return { config, executeMove, selectCpuMoveSafe, expectedRequest, batch, prepare, score };
}

function run(phase: any, overrides: Record<string, any> = {}) {
  return phase.runCpuTurnMovePhase({
    playerKey: 'white',
    autoMode: false,
    level: 4,
    selfColor: -1,
    selfName: '白',
    othelloMode: false,
    pending: null,
    turnStartMs: 1000,
    ...overrides
  });
}

describe('CPU turn Worker candidate scoring', () => {
  test('passes only the attempt-local matched batch into the synchronous selector', async () => {
    const harness = createConfig();
    const phase = createCpuTurnMovePhase(harness.config as any);

    await expect(run(phase)).resolves.toEqual({ status: 'handled' });

    expect(harness.prepare).toHaveBeenCalledWith(CANDIDATES, 'white', {
      requestId: 'cpu-score-1',
      decisionEpoch: 1,
      stateVersion: 5,
      turnNumber: 12,
      playerKey: 'white'
    });
    expect(harness.score).toHaveBeenCalledWith(harness.expectedRequest);
    expect(harness.selectCpuMoveSafe).toHaveBeenCalledWith(CANDIDATES, 'white', {
      expectedRequest: harness.expectedRequest,
      batch: harness.batch
    }, null);
    expect(harness.executeMove).toHaveBeenCalledWith(CANDIDATES[0]);
  });

  test('falls back to the exact local selector after a Worker rejection', async () => {
    const score = jest.fn(async () => { throw new Error('Worker unavailable'); });
    const harness = createConfig({ getScoreCandidatesInWorkerFn: jest.fn(() => score) });
    const phase = createCpuTurnMovePhase(harness.config as any);

    await expect(run(phase)).resolves.toEqual({ status: 'handled' });

    expect(harness.selectCpuMoveSafe).toHaveBeenCalledWith(CANDIDATES, 'white', null, null);
    expect(harness.executeMove).toHaveBeenCalledWith(CANDIDATES[0]);
    expect(harness.config.debugCpuTrace).toHaveBeenCalledWith(
      expect.stringContaining('exact local scorer'),
      expect.objectContaining({ playerKey: 'white' })
    );
  });

  test('discards a completed batch when the authoritative state version changed while awaiting it', async () => {
    let stateVersion: number | string | null = 5;
    let resolveScore: ((value: any) => void) | null = null;
    const score = jest.fn(() => new Promise((resolve) => { resolveScore = resolve; }));
    const harness = createConfig({
      getCurrentStateVersionSafe: jest.fn(() => stateVersion),
      getScoreCandidatesInWorkerFn: jest.fn(() => score)
    });
    const phase = createCpuTurnMovePhase(harness.config as any);
    const pending = run(phase);

    stateVersion = '5';
    resolveScore!(harness.batch);

    await expect(pending).resolves.toEqual({ status: 'handled' });
    expect(harness.selectCpuMoveSafe).not.toHaveBeenCalled();
    expect(harness.executeMove).not.toHaveBeenCalled();
    expect(harness.config.setCpuProcessing).toHaveBeenCalledWith(false);
  });

  test('does not run local fallback when the turn changed before a failed Worker request settled', async () => {
    let turnNumber = 12;
    let rejectScore: ((reason: Error) => void) | null = null;
    const score = jest.fn(() => new Promise((_resolve, reject) => { rejectScore = reject; }));
    const harness = createConfig({
      getCurrentTurnNumberSafe: jest.fn(() => turnNumber),
      getScoreCandidatesInWorkerFn: jest.fn(() => score)
    });
    const phase = createCpuTurnMovePhase(harness.config as any);
    const pending = run(phase);

    turnNumber = 13;
    rejectScore!(new Error('late failure'));

    await expect(pending).resolves.toEqual({ status: 'handled' });
    expect(harness.selectCpuMoveSafe).not.toHaveBeenCalled();
    expect(harness.executeMove).not.toHaveBeenCalled();
  });

  test('does not apply a Worker result when invocation decision/retry identity is stale', async () => {
    const harness = createConfig();
    const phase = createCpuTurnMovePhase(harness.config as any);
    const isAnalysisCurrent = jest.fn(() => false);

    await expect(run(phase, {
      analysisSeed: {
        identity: {
          runId: 4,
          playerKey: 'white',
          turnNumber: 12,
          decisionLevel: 4,
          stateVersion: 5,
          decisionEpoch: 1,
          pendingEffectId: null,
          pendingStage: null,
          retryGeneration: 3
        },
        cardUsability: { usableCardIds: [] }
      },
      isAnalysisCurrent
    })).resolves.toEqual({ status: 'handled' });

    expect(isAnalysisCurrent).toHaveBeenCalledWith(true);
    expect(harness.selectCpuMoveSafe).not.toHaveBeenCalled();
    expect(harness.executeMove).not.toHaveBeenCalled();
  });

  test('fails closed across Worker await without stateVersion and resumes without async reuse', async () => {
    const expectedRequest = {
      requestId: 'cpu-score-1',
      decisionEpoch: 1,
      stateVersion: null,
      turnNumber: 12,
      playerKey: 'white'
    };
    const harness = createConfig({
      getCurrentStateVersionSafe: jest.fn(() => null),
      getPrepareCpuCandidateScoringRequestFn: jest.fn(() => jest.fn(() => expectedRequest)),
      getScoreCandidatesInWorkerFn: jest.fn(() => jest.fn(async () => ({
        request: expectedRequest,
        response: { scores: [] }
      })))
    });
    const phase = createCpuTurnMovePhase(harness.config as any);

    await expect(run(phase, {
      analysisSeed: {
        identity: {
          runId: 4,
          playerKey: 'white',
          turnNumber: 12,
          decisionLevel: 4,
          stateVersion: null,
          decisionEpoch: 1,
          pendingEffectId: null,
          pendingStage: null,
          retryGeneration: 3
        },
        cardUsability: { usableCardIds: [] }
      },
      isAnalysisCurrent: jest.fn(() => false)
    })).resolves.toEqual({ status: 'handled' });

    expect(harness.executeMove).not.toHaveBeenCalled();
    expect(harness.config.scheduleRunCpuTurn).toHaveBeenCalledWith(
      'white',
      expect.objectContaining({ autoMode: false, cpuSkipAsyncDecision: true }),
      0
    );
  });

  test('passes an awaited Lv6 placement lookahead into the synchronous selector', async () => {
    const placementRequest = {
      requestId: 'placement-lookahead:1',
      decisionEpoch: 1,
      stateVersion: 5,
      turnNumber: 12,
      playerKey: 'white'
    };
    const preparePlacement = jest.fn(() => placementRequest);
    const searchPlacement = jest.fn(async () => ({
      request: placementRequest,
      response: { bestMove: CANDIDATES[1] }
    }));
    const harness = createConfig({
      getPrepareCpuPlacementLookaheadRequestFn: jest.fn(() => preparePlacement),
      getSearchCpuPlacementLookaheadInWorkerFn: jest.fn(() => searchPlacement)
    });
    const phase = createCpuTurnMovePhase(harness.config as any);

    await expect(run(phase, { level: 6 })).resolves.toEqual({ status: 'handled' });

    expect(preparePlacement).toHaveBeenCalledWith(
      CANDIDATES,
      'white',
      expect.objectContaining({ decisionEpoch: 1, stateVersion: 5, turnNumber: 12 })
    );
    expect(searchPlacement).toHaveBeenCalledWith(placementRequest);
    expect(harness.selectCpuMoveSafe).toHaveBeenCalledWith(
      CANDIDATES,
      'white',
      expect.any(Object),
      { prepared: true, bestMove: CANDIDATES[1] }
    );
  });

  test('marks Lv6 placement lookahead prepared after Worker failure when sync fallback is disabled', async () => {
    const harness = createConfig({
      disableSynchronousPlacementLookaheadFallback: true,
      getPrepareCpuPlacementLookaheadRequestFn: jest.fn(() => jest.fn(() => ({
        requestId: 'placement-lookahead:failed',
        decisionEpoch: 1,
        stateVersion: 5,
        turnNumber: 12,
        playerKey: 'white'
      }))),
      getSearchCpuPlacementLookaheadInWorkerFn: jest.fn(() => jest.fn(async () => {
        throw new Error('placement Worker unavailable');
      }))
    });
    const phase = createCpuTurnMovePhase(harness.config as any);

    await expect(run(phase, { level: 6 })).resolves.toEqual({ status: 'handled' });

    expect(harness.selectCpuMoveSafe).toHaveBeenCalledWith(
      CANDIDATES,
      'white',
      expect.any(Object),
      { prepared: true, bestMove: null }
    );
  });
});
