describe('PresentationHandler strict network playback', () => {
  afterEach(() => {
    jest.resetModules();
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
  });

  test('passes strict option through and rejects playback failures', async () => {
    const playbackError = new Error('network_playback_watchdog');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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
        events: [{ type: 'flip', phase: 1 }],
        meta: {
          source: 'network_timeline',
          strictNetworkPlayback: true
        }
      })).rejects.toThrow(/network_playback_watchdog/);

      expect((global as any).AnimationEngine.play).toHaveBeenCalledWith(
        [{ type: 'flip', phase: 1 }],
        { strictNetworkPlayback: true }
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
