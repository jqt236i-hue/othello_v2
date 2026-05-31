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
});
