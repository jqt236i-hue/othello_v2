describe('presentation flush persisted events', () => {
  beforeEach(() => {
    jest.resetModules();
    try { delete global.BoardOps; } catch (e) {}
  });

  test('flushPersistedEvents forwards persisted events to BoardOps after registration', () => {
    const ph = require('../game/logic/presentation');
    const cardState = { presentationEvents: [] };
    // persist one event (BoardOps missing)
    ph.emitPresentationEvent(cardState, { type: 'SCHEDULE_CPU_TURN', delayMs: 10 });
    expect(Array.isArray(cardState._presentationEventsPersist)).toBe(true);
    // register BoardOps
    const mock = { emitPresentationEvent: jest.fn() };
    global.BoardOps = mock;

    const flushed = ph.flushPersistedEvents();
    expect(flushed).toBe(true);
    expect(mock.emitPresentationEvent).toHaveBeenCalled();
    expect(cardState._presentationEventsPersist.length).toBe(0);
    delete global.BoardOps;
  });
});