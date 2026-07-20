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

  test('reports presentation handoff immediately before the selected executor without changing events', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const order: string[] = [];
    const events = [{ type: 'flip', phase: 1 }];
    const animationEngine = {
      play: jest.fn(async (payload) => {
        order.push('play');
        expect(payload).toEqual(events);
      })
    };

    await playbackEngine.dispatchPresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events
    }, {
      AnimationEngine: animationEngine,
      onPresentationStart: () => order.push('start')
    });

    expect(order).toEqual(['start', 'play']);
    expect(events).toEqual([{ type: 'flip', phase: 1 }]);
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

  test('playPresentationEvents removes duplicate persistent playback after dispatch', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const animationEngine = { play: jest.fn().mockResolvedValue(undefined) };
    const playbackEvent = {
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'card_use_animation', phase: 1 }]
    };
    const persistedOnlyEvent = {
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'move', phase: 2 }]
    };
    const cardState = {
      presentationEvents: [playbackEvent],
      _presentationEventsPersist: [playbackEvent, persistedOnlyEvent]
    };

    await playbackEngine.playPresentationEvents(cardState, {
      AnimationEngine: animationEngine
    });

    expect(animationEngine.play).toHaveBeenCalledWith([{ type: 'card_use_animation', phase: 1 }]);
    expect(cardState.presentationEvents).toEqual([]);
    expect(cardState._presentationEventsPersist).toEqual([persistedOnlyEvent]);
  });

  test('strict network playback passes strict option to AnimationEngine', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const animationEngine = { play: jest.fn().mockResolvedValue(undefined) };
    const boardWriterToken = Object.freeze({ id: 7, frameToken: 'network:12', mode: 'network' });

    await playbackEngine.dispatchPresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'flip', phase: 1 }]
    }, {
      AnimationEngine: animationEngine,
      strictNetworkPlayback: true,
      boardWriterToken
    });

    expect(animationEngine.play).toHaveBeenCalledWith(
      [{ type: 'flip', phase: 1 }],
      expect.objectContaining({ strictNetworkPlayback: true, boardWriterToken })
    );
  });

  test('passes a deferred settlement result through without converting it', async () => {
    const playbackEngine = require('../ui/playback-engine.js');
    const settlement = Object.freeze({
      kind: 'deferred-finalization',
      runId: 17,
      mode: 'finalize',
      finalize: jest.fn(() => true)
    });
    const animationEngine = { play: jest.fn().mockResolvedValue(settlement) };

    await expect(playbackEngine.dispatchPresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'flip', phase: 1 }]
    }, {
      AnimationEngine: animationEngine,
      deferFinalSettlement: true
    })).resolves.toBe(settlement);

    expect(animationEngine.play).toHaveBeenCalledWith(
      [{ type: 'flip', phase: 1 }],
      expect.objectContaining({ deferFinalSettlement: true })
    );
  });

  test('strict network playback rejects when no playback implementation is available', async () => {
    const playbackEngine = require('../ui/playback-engine.js');

    await expect(playbackEngine.dispatchPresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'flip', phase: 1 }]
    }, {
      strictNetworkPlayback: true
    })).rejects.toThrow(/strict_network_playback_animation_engine_unavailable/);
  });
});
