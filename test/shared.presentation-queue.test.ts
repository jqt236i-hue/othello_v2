'use strict';

describe('shared presentation queue helpers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('appendPresentationEvent writes the same event to live and persistent queues', () => {
    const Queue = require('../shared/presentation-queue');
    const state: any = {};
    const event = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] };

    Queue.appendPresentationEvent(state, event);

    expect(state.presentationEvents).toEqual([event]);
    expect(state._presentationEventsPersist).toEqual([event]);
    expect(state.presentationEvents[0]).toBe(state._presentationEventsPersist[0]);
  });

  test('appendPersistedPresentationEvent writes only the persistent queue', () => {
    const Queue = require('../shared/presentation-queue');
    const state: any = { presentationEvents: [{ type: 'HAND_ADD' }] };
    const event = { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip' }] };

    Queue.appendPersistedPresentationEvent(state, event);

    expect(state.presentationEvents).toEqual([{ type: 'HAND_ADD' }]);
    expect(state._presentationEventsPersist).toEqual([event]);
  });

  test('drainLivePresentationEvents clears live queue and preserves persistent queue', () => {
    const Queue = require('../shared/presentation-queue');
    const liveEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'move' }] };
    const persistedEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] };
    const state: any = {
      presentationEvents: [liveEvent],
      _presentationEventsPersist: [liveEvent, persistedEvent]
    };

    const drained = Queue.drainLivePresentationEvents(state);

    expect(drained).toEqual([liveEvent]);
    expect(state.presentationEvents).toEqual([]);
    expect(state._presentationEventsPersist).toEqual([liveEvent, persistedEvent]);
  });

  test('removePersistedPresentationEvent removes by reference or JSON signature', () => {
    const Queue = require('../shared/presentation-queue');
    const referenceEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1 }] };
    const signatureEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] };
    const state: any = {
      presentationEvents: [],
      _presentationEventsPersist: [referenceEvent, signatureEvent]
    };

    expect(Queue.removePersistedPresentationEvent(state, referenceEvent)).toBe(true);
    expect(Queue.removePersistedPresentationEvent(state, { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] })).toBe(true);
    expect(state._presentationEventsPersist).toEqual([]);
  });

  test('getPresentationQueueState detects PLAYBACK_EVENTS in either queue', () => {
    const Queue = require('../shared/presentation-queue');

    expect(Queue.getPresentationQueueState({
      presentationEvents: [],
      _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] }]
    })).toEqual(expect.objectContaining({
      hasPending: true,
      hasVisualPlayback: true
    }));

    expect(Queue.getPresentationQueueState({
      presentationEvents: [{ type: 'HAND_ADD' }],
      _presentationEventsPersist: []
    })).toEqual(expect.objectContaining({
      hasPending: true,
      hasVisualPlayback: false
    }));
  });
});
