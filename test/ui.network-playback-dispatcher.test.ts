const Dispatcher = require('../ui/network/playback-dispatcher');

function settlementHandle(visualSeq: number) {
  return Object.freeze({
    kind: 'strict-network-settlement',
    visualSeq,
    applyCommittedFrame: jest.fn(async () => true),
    settle: jest.fn(async () => true),
    cancel: jest.fn(async () => true)
  });
}

describe('NetworkPlaybackDispatcher', () => {
  test('dispatches PLAYBACK_EVENTS through the presentation handler', async () => {
    const handled: any[] = [];
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      handlePresentationEvent: jest.fn(async (event: any) => {
        handled.push(event);
        return settlementHandle(event.meta.visualSeq);
      })
    });

    const result = await dispatcher.dispatchNetworkPlaybackEvents([{ type: 'flip' }], {
      source: 'network_timeline',
      visualSeq: 4,
      strictNetworkPlayback: true
    });

    expect(result).toMatchObject({ started: true, method: 'presentation_handler' });
    expect(handled).toEqual([
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: [{ type: 'flip' }],
        meta: expect.objectContaining({
          source: 'network_timeline',
          visualSeq: 4,
          strictNetworkPlayback: true
        })
      })
    ]);
  });

  test('does not invoke a second board drain after direct strict presentation playback', async () => {
    const calls: string[] = [];
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      handlePresentationEvent: jest.fn(async (event: any) => {
        calls.push('playback');
        return settlementHandle(event.meta.visualSeq);
      }),
      onBoardUpdated: jest.fn(() => {
        calls.push('board');
      })
    });

    const result = await dispatcher.dispatchNetworkPlaybackEvents([{ type: 'place' }], {
      source: 'network_timeline',
      visualSeq: 7,
      strictNetworkPlayback: true
    });

    expect(result).toMatchObject({ started: true, method: 'presentation_handler' });
    expect(calls).toEqual(['playback']);
  });

  test('queues to cardState, requests a drain, and clears the drained network batch', async () => {
    const cardState: any = {};
    const onBoardUpdated = jest.fn(() => {
      expect(cardState.presentationEvents).toHaveLength(1);
      expect(cardState._presentationEventsPersist).toHaveLength(1);
      expect(cardState.presentationEvents[0]).toMatchObject({
        type: 'PLAYBACK_EVENTS',
        events: [{ type: 'destroy' }],
        meta: expect.objectContaining({ visualSeq: 5 })
      });
    });
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      getCardState: () => cardState,
      onBoardUpdated
    });

    const result = await dispatcher.dispatchNetworkPlaybackEvents([{ type: 'destroy' }], {
      source: 'network_timeline',
      visualSeq: 5
    });

    expect(result).toMatchObject({ started: true, method: 'card_state_queue' });
    expect(cardState.presentationEvents).toHaveLength(0);
    expect(cardState._presentationEventsPersist).toHaveLength(0);
    expect(onBoardUpdated).toHaveBeenCalledWith(expect.objectContaining({
      source: 'network_timeline',
      reason: 'network_playback_dispatch'
    }));
  });

  test('clears the drained network batch from the current cardState after a state object swap', async () => {
    let cardState: any = {};
    const onBoardUpdated = jest.fn(() => {
      cardState = {
        presentationEvents: cardState.presentationEvents.slice(),
        _presentationEventsPersist: cardState._presentationEventsPersist.slice()
      };
    });
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      getCardState: () => cardState,
      onBoardUpdated
    });

    await expect(dispatcher.dispatchNetworkPlaybackEvents([{ type: 'card_use_animation' }], {
      source: 'network_timeline',
      visualSeq: 6
    })).resolves.toMatchObject({ started: true, method: 'card_state_queue' });

    expect(cardState.presentationEvents).toHaveLength(0);
    expect(cardState._presentationEventsPersist).toHaveLength(0);
  });

  test('does not dispatch empty playback lists', async () => {
    const handlePresentationEvent = jest.fn();
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({ handlePresentationEvent });

    await expect(dispatcher.dispatchNetworkPlaybackEvents([], {
      source: 'network_timeline'
    })).resolves.toMatchObject({ started: false, method: 'empty' });
    expect(handlePresentationEvent).not.toHaveBeenCalled();
  });

  test('dispatches an empty strict frame and still returns its settlement handle', async () => {
    const handle = settlementHandle(9);
    const handlePresentationEvent = jest.fn(async () => handle);
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({ handlePresentationEvent });

    await expect(dispatcher.dispatchNetworkPlaybackEvents([], {
      source: 'network_timeline',
      visualSeq: 9,
      strictNetworkPlayback: true
    })).resolves.toMatchObject({
      started: true,
      method: 'presentation_handler',
      settlementHandle: handle
    });
    expect(handlePresentationEvent).toHaveBeenCalledTimes(1);
  });

  test('awaits board visual readiness before invoking strict presentation playback', async () => {
    const order: string[] = [];
    let releaseReady: (() => void) | null = null;
    const ready = new Promise<void>((resolve) => { releaseReady = resolve; });
    const handlePresentationEvent = jest.fn(async (event: any) => {
      order.push('handler');
      return settlementHandle(event.meta.visualSeq);
    });
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      awaitBoardVisualReady: jest.fn(async () => {
        order.push('ready:start');
        await ready;
        order.push('ready:end');
      }),
      handlePresentationEvent
    });

    const dispatchPromise = dispatcher.dispatchNetworkPlaybackEvents([{ type: 'move' }], {
      visualSeq: 10,
      strictNetworkPlayback: true
    });
    await Promise.resolve();
    expect(order).toEqual(['ready:start']);
    expect(handlePresentationEvent).not.toHaveBeenCalled();
    releaseReady && releaseReady();
    await expect(dispatchPromise).resolves.toMatchObject({ started: true });
    expect(order).toEqual(['ready:start', 'ready:end', 'handler']);
  });

  test('marks readiness failure as safe to retry before dispatch side effects', async () => {
    const handlePresentationEvent = jest.fn();
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      awaitBoardVisualReady: jest.fn(async () => {
        throw new Error('mount pending');
      }),
      handlePresentationEvent
    });

    let caught: any = null;
    try {
      await dispatcher.dispatchNetworkPlaybackEvents([{ type: 'move' }], {
        visualSeq: 11,
        strictNetworkPlayback: true
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      message: 'strict_network_board_visual_not_ready',
      code: 'STRICT_NETWORK_BOARD_VISUAL_NOT_READY',
      safeDispatchRetry: true
    });
    expect(handlePresentationEvent).not.toHaveBeenCalled();
  });
});
