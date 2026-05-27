import { createCpuDecisionCardActions } from '../game/cpu-decision-card-actions';

function createController(overrides?: Record<string, unknown>) {
  const runtime = {
    playCardUseHandAnimation: jest.fn(),
    isVisualPlaybackActive: jest.fn(() => false)
  } as any;
  const cardState = {
    hands: { white: ['c1', 'c2'], black: [] },
    hasUsedCardThisTurnByPlayer: { white: false, black: false }
  } as any;
  const gameState = {
    currentPlayer: -1
  } as any;
  const cardLogic = {
    getCardCost: jest.fn(() => 1),
    getCardDef: jest.fn((cardId: any) => ({ id: cardId, name: String(cardId).toUpperCase(), cost: 1 })),
    destroyHandCard: jest.fn(() => ({ applied: true })),
    applyCardUsage: jest.fn(() => true),
    flushPresentationEvents: jest.fn(() => [])
  } as any;
  const pipelineUiAdapter = {
    mapToPlaybackEvents: jest.fn(() => [])
  } as any;
  const chooseHandDestroyTargetForCycle = jest.fn(() => ({ cardId: 'c1', reason: 'cycle' }));
  const runCpuHandDestroyViaPipeline = jest.fn(() => null);
  const runCpuCardUseViaPipeline = jest.fn(() => null);
  const emitCpuSelectionStateChange = jest.fn();
  const emitCardStateChange = jest.fn();
  const emitBoardUpdate = jest.fn();
  const emitLogAdded = jest.fn();
  const emitPresentationEventForCpu = jest.fn();
  const emitCpuCardUseLog = jest.fn();
  const cpuDebugLog = jest.fn();
  const warn = jest.fn();
  const selectCardToUse = jest.fn(() => ({ cardId: 'c1', cardDef: { id: 'c1', name: 'C1', cost: 2 } }));

  const controller = createCpuDecisionCardActions({
    getCardState: () => cardState,
    getGameState: () => gameState,
    resolveCardLogic: () => cardLogic,
    readPendingEffect: () => null,
    resolveCpuSmartnessLevel: () => 6,
    readCardUseDisplayLevel: () => 6,
    resolvePlayerValue: (playerKey: any) => (playerKey === 'black' ? 1 : -1),
    getActiveProtectionForPlayer: jest.fn(() => []),
    getFlipBlockers: jest.fn(() => []),
    getLegalMoves: jest.fn(() => [{ row: 2, col: 3 }]),
    getTargetAwareUsableCardIds: jest.fn(() => ['c1', 'c2']),
    buildCardUseDecisionContext: jest.fn(() => ({ level: 6 })),
    chooseHandDestroyTargetForCycle,
    runCpuHandDestroyViaPipeline,
    runCpuCardUseViaPipeline,
    resolveTurnPipelineUIAdapter: () => pipelineUiAdapter,
    getRuntime: () => runtime,
    emitCpuSelectionStateChange,
    emitCardStateChange,
    emitBoardUpdate,
    emitLogAdded,
    emitPresentationEventForCpu,
    emitCpuCardUseLog,
    cpuDebugLog,
    isOthelloModeForCpuDecision: () => false,
    selectCardToUse,
    warn
  });

  if (overrides) {
    if (overrides.runtime) Object.assign(runtime, overrides.runtime);
    if (overrides.cardState) Object.assign(cardState, overrides.cardState);
    if (overrides.gameState) Object.assign(gameState, overrides.gameState);
    if (overrides.cardLogic) Object.assign(cardLogic, overrides.cardLogic);
    if (overrides.pipelineUiAdapter) Object.assign(pipelineUiAdapter, overrides.pipelineUiAdapter);
  }

  return {
    controller,
    runtime,
    cardState,
    gameState,
    cardLogic,
    pipelineUiAdapter,
    chooseHandDestroyTargetForCycle,
    runCpuHandDestroyViaPipeline,
    runCpuCardUseViaPipeline,
    emitCpuSelectionStateChange,
    emitCardStateChange,
    emitBoardUpdate,
    emitLogAdded,
    emitPresentationEventForCpu,
    emitCpuCardUseLog,
    cpuDebugLog,
    warn,
    selectCardToUse
  };
}

describe('cpu decision card actions controller', () => {
  test('applyHandCardDestroy falls back to direct destroy when pipeline is unavailable', () => {
    const ctx = createController();

    const result = ctx.controller.applyHandCardDestroy('white', { cardId: 'c1', reason: 'cycle' });

    expect(result).toBe(true);
    expect(ctx.runCpuHandDestroyViaPipeline).toHaveBeenCalledWith('white', 'c1');
    expect(ctx.cardLogic.destroyHandCard).toHaveBeenCalledWith(ctx.cardState, 'white', 'c1');
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.emitLogAdded).toHaveBeenCalledWith('白(Lv6)が手札を破壊: C1');
  });

  test('applyCardChoice emits fallback playback and direct hand animation when pipeline is unavailable', () => {
    const ctx = createController({
      cardLogic: {
        flushPresentationEvents: jest.fn(() => [{ type: 'marker' }])
      },
      pipelineUiAdapter: {
        mapToPlaybackEvents: jest.fn(() => [])
      }
    });

    const result = ctx.controller.applyCardChoice('white', { cardId: 'c1', cardDef: { id: 'c1', name: 'C1', cost: 2 } });

    expect(result).toBe(true);
    expect(ctx.runCpuCardUseViaPipeline).toHaveBeenCalledWith('white', 'c1', { id: 'c1', name: 'C1', cost: 2 });
    expect(ctx.cardLogic.applyCardUsage).toHaveBeenCalledWith(ctx.cardState, ctx.gameState, 'white', 'c1');
    expect(ctx.emitPresentationEventForCpu).toHaveBeenCalledWith({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{
          player: 'white',
          owner: 'white',
          cardId: 'c1',
          cost: 2,
          name: 'C1'
        }]
      }],
      meta: { source: 'cpu_card_use_fallback' }
    });
    expect(ctx.runtime.playCardUseHandAnimation).toHaveBeenCalledWith({
      player: 'white',
      owner: 'white',
      cardId: 'c1',
      cost: 2,
      name: 'C1'
    });
    expect(ctx.emitCpuCardUseLog).toHaveBeenCalledWith('white', 6, { id: 'c1', name: 'C1', cost: 2 }, 'c1');
    expect(ctx.emitCardStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.emitBoardUpdate).toHaveBeenCalledTimes(1);
  });

  test('cpuMaybeUseCardWithPolicy retries other usable cards after the first card fails', () => {
    const ctx = createController({
      cardLogic: {
        applyCardUsage: jest.fn((state: any, game: any, playerKey: any, cardId: any) => cardId === 'c2')
      }
    });

    const result = ctx.controller.cpuMaybeUseCardWithPolicy('white');

    expect(result).toBe(true);
    expect(ctx.selectCardToUse).toHaveBeenCalledWith('white');
    expect(ctx.cardLogic.applyCardUsage).toHaveBeenNthCalledWith(1, ctx.cardState, ctx.gameState, 'white', 'c1');
    expect(ctx.cardLogic.applyCardUsage).toHaveBeenNthCalledWith(2, ctx.cardState, ctx.gameState, 'white', 'c2');
    expect(ctx.emitCpuCardUseLog).toHaveBeenCalledTimes(1);
    expect(ctx.cpuDebugLog).not.toHaveBeenCalledWith('[CPU] Lv6 white: カード使用に失敗');
  });
});
