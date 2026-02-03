describe('presentation persistence when BoardOps missing', () => {
  beforeEach(() => {
    jest.resetModules();
    try { delete global.BoardOps; } catch (e) {}
  });

  test('emitPresentationEvent persists events into cardState._presentationEventsPersist when BoardOps missing', () => {
    const ph = require('../game/logic/presentation');
    const cardState = { presentationEvents: [] };
    ph.emitPresentationEvent(cardState, { type: 'SCHEDULE_CPU_TURN', delayMs: 100 });
    expect(Array.isArray(cardState._presentationEventsPersist)).toBe(true);
    expect(cardState._presentationEventsPersist.length).toBe(1);
    expect(cardState._presentationEventsPersist[0].type).toBe('SCHEDULE_CPU_TURN');
  });
});
