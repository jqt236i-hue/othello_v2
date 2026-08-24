const OverlaySelectionModule = require('../cards/card-interaction-overlay-selection.js');

describe('card-interaction-overlay-selection finalizePendingSelectionAfterRun', () => {
  test('clears busy state and falls back safely when finalizer throws synchronously', async () => {
    const setPendingSelectionBusy = jest.fn();
    const ensureCurrentPlayerCanActOrPassSafely = jest.fn();
    const deps = {
      getGameStateValue: jest.fn(() => ({ currentPlayer: 1 })),
      getCardStateValue: jest.fn(() => ({ turnIndex: 3 })),
      getRunResultPlaybackEvents: jest.fn(() => []),
      pendingSelectionFlowModule: {
        finalizePendingSelectionFlow: jest.fn(() => {
          throw new Error('sync failure');
        })
      },
      ensureCurrentPlayerCanActOrPass: null,
      ensureCurrentPlayerCanActOrPassSafely,
      setPendingSelectionBusy
    };

    OverlaySelectionModule.finalizePendingSelectionAfterRun(
      'black',
      'HEAVEN_BLESSING',
      { ok: true, result: { playbackEvents: [] } },
      deps
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(ensureCurrentPlayerCanActOrPassSafely).toHaveBeenCalledTimes(1);
  });

  test('clears busy without local recovery when finalizer failure raises the integrity latch', async () => {
    let blocked = false;
    const setPendingSelectionBusy = jest.fn();
    const ensureCurrentPlayerCanActOrPassSafely = jest.fn();
    const deps = {
      getGameStateValue: jest.fn(() => ({ currentPlayer: 1 })),
      getCardStateValue: jest.fn(() => ({ turnIndex: 3 })),
      getRunResultPlaybackEvents: jest.fn(() => []),
      pendingSelectionFlowModule: {
        finalizePendingSelectionFlow: jest.fn(async () => {
          blocked = true;
          throw new Error('runtime unavailable');
        })
      },
      ensureCurrentPlayerCanActOrPass: null,
      ensureCurrentPlayerCanActOrPassSafely,
      isCardRuntimeIntegrityBlocked: jest.fn(() => blocked),
      setPendingSelectionBusy
    };

    OverlaySelectionModule.finalizePendingSelectionAfterRun(
      'black',
      'HEAVEN_BLESSING',
      { ok: true, result: { playbackEvents: [] } },
      deps
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(ensureCurrentPlayerCanActOrPassSafely).not.toHaveBeenCalled();
  });

  test.each([
    ['HEAVEN_BLESSING', 'executeHeavenSelection', ['black', 'offer_1']],
    ['CONDEMN_WILL', 'executeCondemnSelection', ['black', 0, 'target_1']],
    ['OBSERVER_WILL', 'executeObserverWillSelection', ['black', 0, 'target_1']]
  ])('%s cannot fall back to local execution when integrity latches during network publish startup', (
    pendingType,
    methodName,
    args
  ) => {
    let blocked = false;
    const runPipelineAction = jest.fn();
    const finalizePendingSelectionFlow = jest.fn();
    const setPendingSelectionBusy = jest.fn();
    const deps = {
      getCardStateValue: () => ({
        turnIndex: 3,
        pendingEffectByPlayer: {
          black: { type: pendingType, stage: 'selectTarget' },
          white: null
        }
      }),
      getGameStateValue: () => ({ currentPlayer: 1 }),
      pendingSelectionFlowModule: {
        createPendingSelectionAction: (_playerKey, type, payload) => ({ type: 'place', pendingType: type, ...payload }),
        finalizePendingSelectionFlow
      },
      actionManager: null,
      canInteractWithCardUi: () => true,
      setPendingSelectionBusy,
      playUiEffectSound: jest.fn(),
      resolveCardDef: jest.fn(() => ({ name: 'test card' })),
      startNetworkOnlyPendingSelectionPublish: jest.fn(() => {
        blocked = true;
        return false;
      }),
      clearHeavenSelection: jest.fn(),
      hideHeavenOverlay: jest.fn(),
      runPipelineAction,
      addLog: jest.fn(),
      requestCardUiSync: jest.fn(),
      emitBoardUpdate: jest.fn(),
      hasHandRemovePlaybackEvent: jest.fn(() => false),
      renderCardUiWithOptionalPlaybackDelay: jest.fn(),
      ensureCurrentPlayerCanActOrPass: null,
      ensureCurrentPlayerCanActOrPassSafely: jest.fn(),
      isCardRuntimeIntegrityBlocked: () => blocked,
      getRunResultPlaybackEvents: () => [],
      getCardDisplayLabel: (_cardId, cardDef) => cardDef?.name || 'test card'
    };

    const result = OverlaySelectionModule[methodName](...args, deps);

    expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable' });
    expect(runPipelineAction).not.toHaveBeenCalled();
    expect(finalizePendingSelectionFlow).not.toHaveBeenCalled();
    expect(deps.emitBoardUpdate).not.toHaveBeenCalled();
    expect(deps.requestCardUiSync).not.toHaveBeenCalled();
    expect(deps.addLog).not.toHaveBeenCalled();
    expect(setPendingSelectionBusy).toHaveBeenCalledWith(false);
  });
});
