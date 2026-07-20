describe('PresentationHandler strict network playback', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../ui/board-renderer');
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
  });

  test('passes strict option through and rejects playback failures', async () => {
    const playbackError = new Error('network_playback_watchdog');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const boardWriterToken = Object.freeze({ id: 1, frameToken: 'network:1', mode: 'network' });
    const abortBoardVisualWriterBeforeHandoff = jest.fn(async () => true);
    jest.doMock('../ui/board-renderer', () => ({
      claimBoardVisualWriter: jest.fn(() => boardWriterToken),
      abortBoardVisualWriterBeforeHandoff
    }));
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).AnimationEngine = {
      play: jest.fn().mockRejectedValue(playbackError)
    };

    try {
      const PresentationHandler = require('../ui/presentation-handler.js');

      await expect(PresentationHandler.handlePresentationEvent({
        type: 'PLAYBACK_EVENTS',
        events: [{
          type: 'CROSSFADE_STONE',
          phase: 1,
          row: 2,
          col: 3,
          effectKey: 'regenStone',
          durationMs: 600
        }],
        meta: {
          source: 'network_timeline',
          strictNetworkPlayback: true,
          visualSeq: 1
        }
      })).rejects.toThrow(/network_playback_watchdog/);

      expect((global as any).AnimationEngine.play).toHaveBeenCalledWith(
        [expect.objectContaining({
          type: 'crossfade_stone',
          phase: 1,
          row: 2,
          col: 3,
          effectKey: 'regenStone',
          durationMs: 600,
          visualSeq: 1,
          meta: expect.objectContaining({ visualSeq: 1 })
        })],
        expect.objectContaining({
          strictNetworkPlayback: true,
          deferFinalSettlement: true
        })
      );
      expect((global as any).AnimationEngine.play.mock.calls[0][1]).not.toHaveProperty('onFinalizationReady');
      expect(abortBoardVisualWriterBeforeHandoff).toHaveBeenCalledWith(boardWriterToken);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('rejects malformed strict standalone board events instead of downgrading to a local writer', async () => {
    (global as any).GameEvents = { gameEvents: { on: jest.fn() } };
    const claimBoardVisualWriter = jest.fn();
    jest.doMock('../ui/board-renderer', () => ({ claimBoardVisualWriter }));

    const PresentationHandler = require('../ui/presentation-handler.js');

    await expect(PresentationHandler.handlePresentationEvent({
      type: 'CROSSFADE_STONE',
      row: 1,
      col: 4,
      meta: {
        source: 'network_timeline',
        strictNetworkPlayback: true,
        visualSeq: 9
      }
    })).rejects.toThrow('strict_network_standalone_board_event_requires_playback_batch');
    expect(claimBoardVisualWriter).not.toHaveBeenCalled();
  });
});
