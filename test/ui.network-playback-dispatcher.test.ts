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

  test('requests a board refresh after direct presentation playback finishes', async () => {
    const calls: string[] = [];
    const dispatcher = Dispatcher.createNetworkPlaybackDispatcher({
      handlePresentationEvent: jest.fn(async () => {
        calls.push('playback');
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
    expect(calls).toEqual(['playback', 'board']);
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
});
