import { JSDOM } from 'jsdom';
import { createCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';

describe('UI card runtime integrity latch', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><main id="game-container"></main></body></html>', {
      url: 'http://127.0.0.1:8000/'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    for (const key of [
      'CardLogic', 'cardState', 'gameState', 'BLACK', 'WHITE', 'addLog',
      'isProcessing', 'isCardAnimating', 'TurnPipeline', 'TurnPipelineUIAdapter'
    ]) {
      delete (global as any)[key];
    }
    delete (global as any).window;
    delete (global as any).document;
  });

  test('settles uncommitted UI work once and blocks later pipeline actions without retry', () => {
    const integrity = require('../ui/card-runtime-integrity');
    const PipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');
    const cancelSelection = jest.fn();
    const settleLocks = jest.fn();
    const emitLog = jest.fn();
    const turnPipeline = { applyTurnSafe: jest.fn(() => ({ ok: true })) };
    const error = createCardRuntimeUnavailableError('targeting.targetResolver', 'targeting');

    expect(integrity.latchCardRuntimeIntegrityFailure(error, {
      source: 'ui-test',
      cancelUncommittedSelection: cancelSelection,
      settleInputLocks: settleLocks,
      emitLog
    })).toBe(true);
    expect(integrity.getCardRuntimeIntegrityState()).toEqual({
      blocked: true,
      source: 'ui-test',
      capability: 'targeting.targetResolver',
      cohort: 'targeting'
    });
    expect(cancelSelection).toHaveBeenCalledTimes(1);
    expect(settleLocks).toHaveBeenCalledTimes(1);
    expect(emitLog).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-reload-required="true"]')).not.toBeNull();
    expect(document.querySelector('[data-presentation-retry="true"]')).toBeNull();

    expect(integrity.latchCardRuntimeIntegrityFailure(error, {
      source: 'ui-test-duplicate',
      cancelUncommittedSelection: cancelSelection,
      settleInputLocks: settleLocks,
      emitLog
    })).toBe(true);
    expect(cancelSelection).toHaveBeenCalledTimes(1);
    expect(settleLocks).toHaveBeenCalledTimes(1);
    expect(emitLog).toHaveBeenCalledTimes(1);
    expect(integrity.getCardRuntimeIntegrityState().source).toBe('ui-test');

    PipelineUIAdapter.setPipelineUIAdapterRuntime({
      isCardRuntimeIntegrityBlocked: integrity.isCardRuntimeIntegrityBlocked
    });
    expect(PipelineUIAdapter.runTurnWithAdapter({}, {}, 'black', { type: 'place' }, turnPipeline)).toEqual({
      ok: false,
      rejectedReason: 'RUNTIME_UNAVAILABLE',
      events: []
    });
    expect(turnPipeline.applyTurnSafe).not.toHaveBeenCalled();
  });

  test('does not classify an ordinary rule exception as runtime unavailable', () => {
    const integrity = require('../ui/card-runtime-integrity');
    const emitLog = jest.fn();
    expect(integrity.latchCardRuntimeIntegrityFailure(new Error('illegal target'), { emitLog })).toBe(false);
    expect(integrity.isCardRuntimeIntegrityBlocked()).toBe(false);
    expect(emitLog).not.toHaveBeenCalled();
    expect(document.querySelector('[data-reload-required="true"]')).toBeNull();
  });

  test('card usability query stops at the tagged failure without trying the legacy fallback', () => {
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const canUseCard = jest.fn(() => true);
    const addLog = jest.fn();
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).cardState = {
      hands: { black: ['work_01'], white: [] },
      charge: { black: 99, white: 0 },
      selectedCardId: 'work_01',
      selectedCardOwnerKey: 'black',
      selectedCardHandIndex: 0,
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null }
    };
    (global as any).gameState = { currentPlayer: 1, board: [] };
    (global as any).addLog = addLog;
    (global as any).CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'work_01', cost: 0 })),
      getUsableCardIds: jest.fn(() => { throw unavailable; }),
      canUseCard
    };
    (global as any).window.MATCH_MODE = 'cpu';
    (global as any).window.cardState = (global as any).cardState;
    (global as any).window.gameState = (global as any).gameState;

    const controller = require('../cards/card-interaction');
    controller.useSelectedCard();

    const integrity = require('../ui/card-runtime-integrity');
    expect(integrity.getCardRuntimeIntegrityState()).toMatchObject({
      blocked: true,
      source: 'card-interaction:getUsableCardIds',
      capability: 'state.availability',
      cohort: 'state'
    });
    expect(canUseCard).not.toHaveBeenCalled();
    expect((global as any).cardState.selectedCardId).toBeNull();
    expect(addLog).toHaveBeenCalledTimes(1);
  });
});
