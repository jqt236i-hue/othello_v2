import * as path from 'path';
import {
  createCardRuntimeUnavailableError,
  isCardRuntimeUnavailableError
} from '../game/logic/card-runtime-errors';
import { compileNamedFunctionFromSource } from './helpers/card-runtime-contract-fixtures';

const ROOT = path.resolve(__dirname, '..');

describe('CPU runtime-unavailable terminal recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).cpuSmartness = { black: 2, white: 2 };
    (global as any).emitLogAdded = jest.fn();
    (global as any).isGameOver = jest.fn(() => false);
    (global as any).isProcessing = false;
    (global as any).isCardAnimating = false;
    (global as any).VisualPlaybackActive = false;
    (global as any).gameState = {
      currentPlayer: -1,
      turnNumber: 4,
      stateVersion: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    (global as any).cardState = {
      pendingEffectByPlayer: {
        black: null,
        white: { type: 'CAPTURE_WILL', stage: 'apply', pendingEffectId: 'pending-1' }
      },
      hasUsedCardThisTurnByPlayer: { black: false, white: true },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
  });

  afterEach(() => {
    for (const key of [
      'BLACK', 'WHITE', 'cpuSmartness', 'emitLogAdded', 'isGameOver',
      'isProcessing', 'isCardAnimating', 'VisualPlaybackActive', 'gameState', 'cardState'
    ]) delete (global as any)[key];
  });

  test('releases processing, cancels scheduler generation, preserves pending, and never retries', async () => {
    const CpuTurnHandler = require('../game/cpu-turn-handler');
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    const notify = jest.fn();
    const clearTimeout = jest.fn();
    const setTimeout = jest.fn((_callback: () => void) => 41);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    CpuTurnHandler.setTimers(null);
    CpuTurnHandler.setCpuTurnTimerService({ setTimeout, clearTimeout });
    expect(CpuTurnHandler.scheduleRetry(jest.fn(), 100)).toBe(true);
    CpuTurnHandler.setCpuUIImpl({
      resolveRuntimeValue: (name: string) => (global as any)[name],
      setProcessing: (next: boolean) => { (global as any).isProcessing = next === true; },
      emitLogAdded: (...args: any[]) => (global as any).emitLogAdded(...args),
      generateMovesForPlayer: () => { throw unavailable; },
      handleCardRuntimeIntegrityFailure: notify
    });

    try {
      const pendingBefore = JSON.parse(JSON.stringify((global as any).cardState.pendingEffectByPlayer.white));
      await CpuTurnHandler.runCpuTurn('white');

      expect((global as any).isProcessing).toBe(false);
      expect((global as any).cardState.pendingEffectByPlayer.white).toEqual(pendingBefore);
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(clearTimeout).toHaveBeenCalledWith(41);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(unavailable, 'cpu-turn-handler');
      expect((global as any).emitLogAdded).toHaveBeenCalledWith(
        '白のゲーム実行環境を確認できませんでした。再読み込みしてください'
      );

      await CpuTurnHandler.runCpuTurn('white');
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledTimes(1);
      expect((global as any).cardState.pendingEffectByPlayer.white).toEqual(pendingBefore);
    } finally {
      consoleError.mockRestore();
      CpuTurnHandler.setTimers(null);
      CpuTurnHandler.setCpuTurnTimerService(null);
      CpuTurnHandler.setCpuUIImpl({});
    }
  });

  test('propagates branded retry-context failure before another card can be applied while preserving plain-error fallback', () => {
    const unavailable = createCardRuntimeUnavailableError('card.definition', 'defs');
    const buildTaggedContext = compileNamedFunctionFromSource(
      ROOT,
      'game/cpu-turn-handler.ts',
      'buildCpuRetryCardDecisionContext',
      {
        resolveCpuDecisionFunction: () => () => { throw unavailable; },
        buildCardUseDecisionContext: null,
        isCardRuntimeUnavailableError
      }
    );
    const buildPlainContext = compileNamedFunctionFromSource(
      ROOT,
      'game/cpu-turn-handler.ts',
      'buildCpuRetryCardDecisionContext',
      {
        resolveCpuDecisionFunction: () => () => { throw new Error('legacy context failure'); },
        buildCardUseDecisionContext: null,
        isCardRuntimeUnavailableError
      }
    );

    expect(() => buildTaggedContext('white', 2, 0, [], {}, null)).toThrow(unavailable);
    expect(buildPlainContext('white', 2, 0, [], {}, null)).toBeNull();

    const state = (global as any).cardState;
    state.pendingEffectByPlayer.white = null;
    state.hasUsedCardThisTurnByPlayer.white = false;
    state.hands.white = ['work_01'];
    const applyTaggedChoice = jest.fn(() => true);
    const compileRetryApplication = (buildContext: (...args: any[]) => any, applyChoice: jest.Mock) => (
      compileNamedFunctionFromSource(ROOT, 'game/cpu-turn-handler.ts', 'tryApplyAnyUsableCard', {
        cardState: state,
        gameState: (global as any).gameState,
        readCpuPendingSelection: () => null,
        resolveApplyCardChoiceFn: () => applyChoice,
        getCardUsabilityAnalysisForCpuRetry: () => ({ usableCardIds: ['work_01'] }),
        resolveCpuDecisionLevelForTurn: () => 2,
        buildCpuRetryCardDecisionContext: buildContext,
        resolveCpuCardLogic: () => ({ getCardDef: () => ({ id: 'work_01', type: 'WORK_WILL' }) }),
        isCpuRetryCardChoiceAllowed: () => true
      })
    );

    const runTaggedRetry = compileRetryApplication(buildTaggedContext, applyTaggedChoice);
    expect(() => runTaggedRetry('white', 2, 0, [], {})).toThrow(unavailable);
    expect(applyTaggedChoice).not.toHaveBeenCalled();

    const applyPlainChoice = jest.fn(() => true);
    const runPlainRetry = compileRetryApplication(buildPlainContext, applyPlainChoice);
    expect(runPlainRetry('white', 2, 0, [], {})).toBe(true);
    expect(applyPlainChoice).toHaveBeenCalledTimes(1);
  });
});
