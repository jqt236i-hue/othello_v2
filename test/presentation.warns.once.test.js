describe('presentation warn deduplication', () => {
  beforeEach(() => {
    jest.resetModules();
    try { delete global.BoardOps; } catch (e) {}
  });

  test('emitPresentationEvent warns at most once when BoardOps missing', () => {
    const ph = require('../game/logic/presentation');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Call multiple times: only the first should warn
    ph.emitPresentationEvent({}, { type: 'A' });
    ph.emitPresentationEvent({}, { type: 'B' });

    const calls = spy.mock.calls.filter(c => String(c[0]).indexOf('BoardOps.emitPresentationEvent not available') !== -1);
    expect(calls.length).toBeLessThanOrEqual(1);

    spy.mockRestore();
  });

  test('no warn when BoardOps present', () => {
    jest.resetModules();
    global.BoardOps = { emitPresentationEvent: jest.fn() };
    const ph = require('../game/logic/presentation');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    ph.emitPresentationEvent({}, { type: 'A' });

    const calls = spy.mock.calls.filter(c => String(c[0]).indexOf('BoardOps.emitPresentationEvent not available') !== -1);
    expect(calls.length).toBe(0);

    spy.mockRestore();
    delete global.BoardOps;
  });
});
