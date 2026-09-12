import { createCpuDecisionCardPipeline } from '../game/cpu-decision-card-pipeline';

function createController(overrides?: Record<string, unknown>) {
  let cardState = {
    turnIndex: 5,
    lastUsedCardByPlayer: { white: 'resolved_card', black: null }
  } as any;
  let gameState = {
    currentPlayer: -1
  } as any;
  const adapter = {
    runTurnWithAdapter: jest.fn()
  } as any;
  const pipeline = { id: 'pipeline' } as any;
  const emitPresentationEventForCpu = jest.fn();
  const emitCpuSelectionStateChange = jest.fn();
  const createAction = jest.fn((actionType, playerKey, actionPayload) => Object.assign({ type: actionType, playerKey }, actionPayload));
  const resolveCardDef = jest.fn((cardId, fallbackCardDef) => (
    cardId === 'resolved_card' ? { name: 'Resolved', cost: 2 } : fallbackCardDef
  ));

  const controller = createCpuDecisionCardPipeline({
    resolveTurnPipelineAdapter: () => adapter,
    resolveTurnPipeline: () => pipeline,
    createAction,
    getCardState: () => cardState,
    getGameState: () => gameState,
    setCardState: (nextCardState) => { cardState = nextCardState; },
    setGameState: (nextGameState) => { gameState = nextGameState; },
    getLastUsedCardId: (playerKey) => cardState && cardState.lastUsedCardByPlayer ? cardState.lastUsedCardByPlayer[playerKey] : null,
    resolveCardDef,
    emitPresentationEventForCpu,
    emitCpuSelectionStateChange
  });

  if (overrides && overrides.cardState) Object.assign(cardState, overrides.cardState);
  if (overrides && overrides.gameState) Object.assign(gameState, overrides.gameState);
  if (overrides && overrides.adapter) Object.assign(adapter, overrides.adapter);

  return {
    controller,
    adapter,
    pipeline,
    emitPresentationEventForCpu,
    emitCpuSelectionStateChange,
    createAction,
    resolveCardDef,
    getCardState: () => cardState,
    getGameState: () => gameState
  };
}

describe('cpu decision card pipeline controller', () => {
  test('a planned card copy index reaches canonical validation without changing legacy payloads', () => {
    const ctx = createController({ adapter: { runTurnWithAdapter: jest.fn(() => ({ ok: false })) } });
    ctx.controller.runCpuCardUseViaPipeline('white', 'perma_01', { cost: 5 }, null, 2);
    expect(ctx.createAction).toHaveBeenLastCalledWith('use_card', 'white', {
      useCardId: 'perma_01', useCardOwnerKey: 'white', useCardHandIndex: 2
    });
    ctx.controller.runCpuCardUseViaPipeline('white', 'perma_01', { cost: 5 });
    expect(ctx.createAction).toHaveBeenLastCalledWith('use_card', 'white', {
      useCardId: 'perma_01', useCardOwnerKey: 'white'
    });
  });
  test('runCpuCardUseViaPipeline normalizes card_use_animation playback targets using resolved card meta', () => {
    const nextCardState = { turnIndex: 6, lastUsedCardByPlayer: { white: 'resolved_card', black: null } } as any;
    const nextGameState = { currentPlayer: 1 } as any;
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          nextCardState,
          nextGameState,
          playbackEvents: [{
            type: 'card_use_animation',
            phase: 1,
            targets: [{ player: 'white', owner: 'white' }]
          }]
        }))
      }
    });

    const result = ctx.controller.runCpuCardUseViaPipeline('white', 'fallback_card', { name: 'Fallback', cost: 9 });

    expect(result).toMatchObject({
      ok: true,
      emittedCardUsePlayback: true,
      appliedCardId: 'resolved_card',
      appliedCardCost: 2,
      appliedCardName: 'Resolved'
    });
    expect(ctx.createAction).toHaveBeenCalledWith('use_card', 'white', {
      useCardId: 'fallback_card',
      useCardOwnerKey: 'white'
    });
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'white', expect.objectContaining({
      type: 'use_card',
      turnIndex: 5
    }), ctx.pipeline);
    expect(ctx.emitPresentationEventForCpu).toHaveBeenCalledWith({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{
          player: 'white',
          owner: 'white',
          cardId: 'resolved_card',
          cost: 2,
          name: 'Resolved'
        }]
      }],
      meta: { source: 'cpu_card_use_pipeline', cardId: 'resolved_card' }
    });
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.getCardState()).toBe(nextCardState);
    expect(ctx.getGameState()).toBe(nextGameState);
  });

  test('runCpuCardUseViaPipeline emits fallback card_use_animation when playback is empty', () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          playbackEvents: []
        }))
      }
    });

    const result = ctx.controller.runCpuCardUseViaPipeline('white', 'fallback_card', { name: 'Fallback', cost: 9 });

    expect(result).toMatchObject({
      ok: true,
      emittedCardUsePlayback: false,
      appliedCardId: 'resolved_card'
    });
    expect(ctx.emitPresentationEventForCpu).toHaveBeenCalledWith({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{
          player: 'white',
          owner: 'white',
          cardId: 'resolved_card',
          cost: 2,
          name: 'Resolved'
        }]
      }],
      meta: { source: 'cpu_card_use_pipeline_fallback' }
    });
  });

  test('runCpuHandDestroyViaPipeline updates state and emits selection change on success', () => {
    const nextCardState = { turnIndex: 6 } as any;
    const nextGameState = { currentPlayer: 1 } as any;
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({
          ok: true,
          nextCardState,
          nextGameState
        }))
      }
    });

    const result = ctx.controller.runCpuHandDestroyViaPipeline('white', 'destroy_card');

    expect(result).toEqual({
      ok: true,
      res: {
        ok: true,
        nextCardState,
        nextGameState
      }
    });
    expect(ctx.createAction).toHaveBeenCalledWith('destroy_hand_card', 'white', { destroyCardId: 'destroy_card' });
    expect(ctx.adapter.runTurnWithAdapter).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'white', expect.objectContaining({
      type: 'destroy_hand_card',
      turnIndex: 5
    }), ctx.pipeline);
    expect(ctx.emitCpuSelectionStateChange).toHaveBeenCalledTimes(1);
    expect(ctx.getCardState()).toBe(nextCardState);
    expect(ctx.getGameState()).toBe(nextGameState);
  });

  test('runCpuCardUseViaPipeline returns failure payload when adapter rejects the turn', () => {
    const ctx = createController({
      adapter: {
        runTurnWithAdapter: jest.fn(() => ({ ok: false, reason: 'blocked' }))
      }
    });

    const result = ctx.controller.runCpuCardUseViaPipeline('white', 'fallback_card', { name: 'Fallback', cost: 9 });

    expect(result).toEqual({
      ok: false,
      res: { ok: false, reason: 'blocked' }
    });
    expect(ctx.emitPresentationEventForCpu).not.toHaveBeenCalled();
    expect(ctx.emitCpuSelectionStateChange).not.toHaveBeenCalled();
  });
});
