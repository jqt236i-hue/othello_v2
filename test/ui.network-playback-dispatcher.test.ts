const Dispatcher = require('../ui/network/playback-dispatcher');

describe('NetworkPlaybackDispatcher', () => {
  test('dispatches PLAYBACK_EVENTS through the presentation handler', async () => {
    const handled: any[] = [];
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      handlePresentationEvent: jest.fn(async (event: any) => {
        handled.push(event);
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

  test('queues to cardState and requests a drain when no direct handler exists', async () => {
    const cardState: any = {};
    const onBoardUpdated = jest.fn();
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      getCardState: () => cardState,
      onBoardUpdated
    });

    const result = await dispatcher.dispatchNetworkPlaybackEvents([{ type: 'destroy' }], {
      source: 'network_timeline',
      visualSeq: 5
    });

    expect(result).toMatchObject({ started: true, method: 'card_state_queue' });
    expect(cardState.presentationEvents).toHaveLength(1);
    expect(cardState.presentationEvents[0]).toMatchObject({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy' }],
      meta: expect.objectContaining({ visualSeq: 5 })
    });
    expect(onBoardUpdated).toHaveBeenCalledWith(expect.objectContaining({
      source: 'network_timeline',
      reason: 'network_playback_dispatch'
    }));
  });

  test('does not dispatch empty playback lists', async () => {
    const handlePresentationEvent = jest.fn();
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({ handlePresentationEvent });

    await expect(dispatcher.dispatchNetworkPlaybackEvents([], {
      source: 'network_timeline'
    })).resolves.toMatchObject({ started: false, method: 'empty' });
    expect(handlePresentationEvent).not.toHaveBeenCalled();
  });
});
