describe('ui playback engine dispatch', () => {
  afterEach(() => {
    jest.resetModules();
    delete global.AnimationEngine;
  });

  test('dispatchPresentationEvent routes playback and scheduled turn separately', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const animationEngine = { play: jest.fn().mockResolvedValue(undefined) };
    const scheduleCpuTurnEvent = jest.fn();

    await playbackEngine.dispatchPresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'flip', phase: 1 }]
    }, {
      AnimationEngine: animationEngine,
      scheduleCpuTurnEvent
    });

    expect(animationEngine.play).toHaveBeenCalledWith([{ type: 'flip', phase: 1 }]);
    expect(scheduleCpuTurnEvent).not.toHaveBeenCalled();

    await playbackEngine.dispatchPresentationEvent({
      type: 'SCHEDULE_CPU_TURN',
      delayMs: 0,
      expectedPlayerKey: 'white'
    }, {
      AnimationEngine: animationEngine,
      scheduleCpuTurnEvent
    });

    expect(scheduleCpuTurnEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCHEDULE_CPU_TURN',
      expectedPlayerKey: 'white'
    }));
  });

  test('playPresentationEvents consumes buffered presentation events', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const animationEngine = { play: jest.fn().mockResolvedValue(undefined) };
    const cardState = {
      presentationEvents: [{
        type: 'PLAYBACK_EVENTS',
        events: [{ type: 'move', phase: 1 }]
      }]
    };

    await playbackEngine.playPresentationEvents(cardState, {
      AnimationEngine: animationEngine
    });

    expect(animationEngine.play).toHaveBeenCalledWith([{ type: 'move', phase: 1 }]);
    expect(cardState.presentationEvents).toEqual([]);
  });
});
