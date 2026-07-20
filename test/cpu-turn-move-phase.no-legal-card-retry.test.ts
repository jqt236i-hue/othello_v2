import { createCpuTurnMovePhase } from '../game/cpu-turn-move-phase.js';

function createConfig(overrides: Record<string, any> = {}) {
  const passFn = jest.fn();
  const scheduleRunCpuTurn = jest.fn();

  return {
    config: {
      blackValue: 1,
      countOwnedBasicCornersSafe: jest.fn(() => 0),
      debugCpuTrace: jest.fn(),
      emitCpuCommentary: jest.fn(),
      emitCpuDebugLog: jest.fn(),
      getActiveProtectionSafe: jest.fn(() => []),
      getAnimationRetryDelayMs: jest.fn(() => 0),
      getCardState: jest.fn(() => ({})),
      getCurrentPlayerKeySafe: jest.fn(() => 'white'),
      getCurrentTurnNumberSafe: jest.fn(() => 12),
      getFlipBlockersSafe: jest.fn(() => []),
      getGameState: jest.fn(() => ({ currentPlayer: 'white', turnNumber: 12 })),
      getSelectMoveFromOnnxFn: jest.fn(() => null),
      getUseCardWithPolicyFn: jest.fn(() => jest.fn(() => false)),
      handleCpuTurnError: jest.fn(),
      isCpuDebugLogAvailable: jest.fn(() => false),
      isUiAnimationBusy: jest.fn(() => false),
      readNowMs: jest.fn(() => 1000),
      resetPendingSelectRetryState: jest.fn(),
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => true)
      })),
      resolveExecuteMoveFn: jest.fn(() => null),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [])),
      resolveLv6MinThinkMs: jest.fn(() => 0),
      resolveProcessPassTurn: jest.fn(() => passFn),
      scheduleRetry: jest.fn(),
      scheduleRunCpuTurn,
      selectCpuMoveSafe: jest.fn(() => null),
      setCpuProcessing: jest.fn(),
      shouldAbortCpuForHumanMode: jest.fn(() => false),
      shouldUseOnnxMoveDecision: jest.fn(() => false),
      tryApplyAnyUsableCard: jest.fn(() => false),
      whiteValue: -1,
      ...overrides
    },
    passFn,
    scheduleRunCpuTurn
  };
}

describe('cpu turn move phase no-legal card retry', () => {
  test('derives placement once and skips card derivation/availability rescan for a usable-zero seed', async () => {
    const getCardUsabilityAnalysis = jest.fn(() => ({ usableCardIds: ['unexpected'] }));
    const { config } = createConfig({ getCardUsabilityAnalysis });
    const phase = createCpuTurnMovePhase(config as any);
    const deriveCardDecisionAnalysis = jest.fn(() => ({ cardLegalMoves: [] }));
    const derivePlacementAnalysis = jest.fn(() => ({ placementCandidates: [] }));
    const analysisInvocation = {
      deriveCardDecisionAnalysis,
      derivePlacementAnalysis,
      peekCardDecisionAnalysis: jest.fn(() => null)
    };

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 1,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now(),
      analysisSeed: { cardUsability: { usableCardIds: [] } },
      analysisInvocation
    });

    expect(result).toEqual({ status: 'pass' });
    expect(derivePlacementAnalysis).toHaveBeenCalledTimes(1);
    expect(deriveCardDecisionAnalysis).not.toHaveBeenCalled();
    expect(getCardUsabilityAnalysis).not.toHaveBeenCalled();
  });

  test('uses a normal pass when no legal moves remain but a card was still technically usable', async () => {
    const { config, passFn, scheduleRunCpuTurn } = createConfig();
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'pass' });
    expect(passFn).toHaveBeenCalledWith('white', {
      autoMode: false
    });
    expect(scheduleRunCpuTurn).not.toHaveBeenCalled();
  });

  test('uses auto no-action pass only when no legal moves and no usable card remain', async () => {
    const { config, passFn, scheduleRunCpuTurn } = createConfig({
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => false)
      }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'pass' });
    expect(passFn).toHaveBeenCalledWith('white', {
      autoMode: false,
      autoNoActionPass: true
    });
    expect(scheduleRunCpuTurn).not.toHaveBeenCalled();
  });

  test('shares one prepared usability bundle across no-legal card retries', async () => {
    const usability = {
      usableCardIds: ['card_a'],
      usableCardTypes: ['TREASURE_BOX'],
      selectorEvidence: {},
      usableSlots: []
    };
    const getCardUsabilityAnalysis = jest.fn(() => usability);
    const useCardWithPolicy = jest.fn((_playerKey: any, _scope: any, prepared: any) => {
      prepared.decisionContext = { legalMovesCount: 0 };
      return false;
    });
    const tryApplyAnyUsableCard = jest.fn(() => false);
    const { config } = createConfig({
      getCardState: jest.fn(() => ({ hands: { white: ['card_a'] } })),
      getCardUsabilityAnalysis,
      getUseCardWithPolicyFn: jest.fn(() => useCardWithPolicy),
      tryApplyAnyUsableCard
    });
    const phase = createCpuTurnMovePhase(config as any);

    await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(getCardUsabilityAnalysis).toHaveBeenCalledTimes(1);
    expect(useCardWithPolicy).toHaveBeenCalledTimes(1);
    expect(tryApplyAnyUsableCard).toHaveBeenCalledTimes(1);
    const preparedFromUse = useCardWithPolicy.mock.calls[0][2];
    const preparedFromFallback = tryApplyAnyUsableCard.mock.calls[0][4];
    expect(preparedFromFallback).toBe(preparedFromUse);
    expect(preparedFromFallback).toMatchObject({
      usability,
      decisionContext: { legalMovesCount: 0 }
    });
  });

  test('uses a normal pass when a card pending action remains after no legal moves', async () => {
    const { config, passFn, scheduleRunCpuTurn } = createConfig({
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => false)
      }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: {
        type: 'PROLIFERATION_WILL',
        cardId: 'proliferation_01',
        pendingEffectId: 'pending_32_18',
        stage: null
      },
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'pass' });
    expect(passFn).toHaveBeenCalledWith('white', {
      autoMode: false
    });
    expect(scheduleRunCpuTurn).not.toHaveBeenCalled();
  });

  test('retries instead of stopping when the pass handler rejects the CPU pass', async () => {
    const passFn = jest.fn(() => Promise.resolve(false));
    const { config, scheduleRunCpuTurn } = createConfig({
      resolveProcessPassTurn: jest.fn(() => passFn)
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'retry' });
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
    expect(scheduleRunCpuTurn).toHaveBeenCalledWith('white', { autoMode: false }, 0);
  });

  test('retries when pass handler is not available for a no-action CPU turn', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { config, scheduleRunCpuTurn } = createConfig({
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => false)
      })),
      resolveProcessPassTurn: jest.fn(() => null)
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'retry' });
    expect(errorSpy).toHaveBeenCalledWith('[AI] processPassTurn is not available');
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
    expect(scheduleRunCpuTurn).toHaveBeenCalledWith('white', { autoMode: false }, 0);
    errorSpy.mockRestore();
  });

  test('skips a delayed move commit when the turn changed before the retry fires', async () => {
    let retryCallback: any = null;
    let currentTurnNumber = 12;
    const executeMove = jest.fn();
    const { config } = createConfig({
      getCurrentTurnNumberSafe: jest.fn(() => currentTurnNumber),
      getGameState: jest.fn(() => ({ currentPlayer: 'white', turnNumber: currentTurnNumber })),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [{ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }])),
      resolveExecuteMoveFn: jest.fn(() => executeMove),
      resolveLv6MinThinkMs: jest.fn(() => 50),
      scheduleRetry: jest.fn((fn) => {
        retryCallback = fn;
        return true;
      }),
      selectCpuMoveSafe: jest.fn(() => ({ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'handled' });
    expect(typeof retryCallback).toBe('function');

    currentTurnNumber = 13;
    await retryCallback();

    expect(executeMove).not.toHaveBeenCalled();
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
  });

  test('uses injected clock for Lv6 minimum think delay when turnStartMs is absent', async () => {
    const executeMove = jest.fn();
    const nowValues = [1000, 1025];
    const { config } = createConfig({
      readNowMs: jest.fn(() => nowValues.shift() ?? 1025),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [{ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }])),
      resolveExecuteMoveFn: jest.fn(() => executeMove),
      resolveLv6MinThinkMs: jest.fn(() => 50),
      scheduleRetry: jest.fn(() => true),
      selectCpuMoveSafe: jest.fn(() => ({ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null
    });

    expect(result).toEqual({ status: 'handled' });
    expect(config.readNowMs).toHaveBeenCalledTimes(2);
    expect(config.scheduleRetry).toHaveBeenCalledWith(expect.any(Function), 25);
    expect(executeMove).not.toHaveBeenCalled();
  });

  test('skips a delayed move commit when the runtime player changed on the same turn number', async () => {
    let retryCallback: any = null;
    let runtimePlayerKey = 'black';
    const executeMove = jest.fn();
    const { config } = createConfig({
      getCurrentPlayerKeySafe: jest.fn(() => runtimePlayerKey),
      getCurrentTurnNumberSafe: jest.fn(() => 12),
      getGameState: jest.fn(() => ({ currentPlayer: 'black', turnNumber: 12 })),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [{ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }])),
      resolveExecuteMoveFn: jest.fn(() => executeMove),
      resolveLv6MinThinkMs: jest.fn(() => 50),
      scheduleRetry: jest.fn((fn) => {
        retryCallback = fn;
        return true;
      }),
      selectCpuMoveSafe: jest.fn(() => ({ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'black',
      autoMode: true,
      level: 1,
      selfColor: 1,
      selfName: '黒',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'handled' });
    expect(typeof retryCallback).toBe('function');

    runtimePlayerKey = 'white';
    await retryCallback();

    expect(executeMove).not.toHaveBeenCalled();
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
  });
});
