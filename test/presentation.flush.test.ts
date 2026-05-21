describe('presentation flush persisted events', () => {
  beforeEach(() => {
    jest.resetModules();
    try { delete global.BoardOps; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('flushPersistedEvents forwards persisted events to BoardOps after registration', () => {
    const ph = require('../game/logic/presentation.js');
    const cardState = { presentationEvents: [] };
    global.cardState = cardState;
    // persist one event (BoardOps missing)
    ph.emitPresentationEvent(cardState, { type: 'SCHEDULE_CPU_TURN', delayMs: 10 });
    expect(Array.isArray(cardState._presentationEventsPersist)).toBe(true);
    // register BoardOps
    const mock = { emitPresentationEvent: jest.fn() };
    global.BoardOps = mock;
    ph.setPresentationRuntime({
      getCardState: () => global.cardState,
      emitPresentationEvent: (cardState, ev) => {
        global.BoardOps.emitPresentationEvent(cardState, ev);
        return true;
      }
    });

    const flushed = ph.flushPersistedEvents();
    expect(flushed).toBe(true);
    expect(mock.emitPresentationEvent).toHaveBeenCalled();
    expect(cardState._presentationEventsPersist.length).toBe(0);
    delete global.BoardOps;
  });

  test('flushPersistedEvents drains persisted events even when CardLogic returns []', () => {
    const ph = require('../game/logic/presentation.js');
    const cardState = { presentationEvents: [] };
    global.cardState = cardState;
    ph.emitPresentationEvent(cardState, { type: 'SCHEDULE_CPU_TURN', delayMs: 10 });
    global.CardLogic = { flushPresentationEvents: jest.fn(() => []) };
    const mock = { emitPresentationEvent: jest.fn() };
    global.BoardOps = mock;
    ph.setPresentationRuntime({
      getCardState: () => global.cardState,
      emitPresentationEvent: (cardState, ev) => {
        global.BoardOps.emitPresentationEvent(cardState, ev);
        return true;
      }
    });

    const flushed = ph.flushPersistedEvents();
    expect(flushed).toBe(true);
    expect(mock.emitPresentationEvent).toHaveBeenCalled();
    expect(cardState._presentationEventsPersist.length).toBe(0);
    delete global.BoardOps;
    delete global.CardLogic;
  });
});
