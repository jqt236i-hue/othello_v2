const path = require('path');

describe('game/logic/presentation', () => {
    const modPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');
    beforeEach(() => {
        // Clear module cache to ensure fresh require in each test
        delete require.cache[require.resolve(modPath)];
        // Clear any global PresentationHelper / BoardOps
        try { delete global.PresentationHelper; } catch (e) {}
        try { delete global.BoardOps; } catch (e) {}
    });

    test('registers PresentationHelper on globalThis and forwards to BoardOps if present', () => {
        // provide a fake BoardOps on global
        global.BoardOps = { emitPresentationEvent: jest.fn() };

        const pres = require(modPath);
        expect(typeof pres.emitPresentationEvent).toBe('function');

        // ensure global registration happened
        expect(global.PresentationHelper).toBeDefined();
        expect(typeof global.PresentationHelper.emitPresentationEvent).toBe('function');

        const cardState = { foo: 'bar' };
        const ev = { type: 'TEST_EVENT' };

        const res = pres.emitPresentationEvent(cardState, ev);
        expect(res).toBe(true);
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(cardState, ev);
    });

    test('returns false and does not throw when BoardOps missing', () => {
        // No BoardOps provided
        if (typeof global.BoardOps !== 'undefined') delete global.BoardOps;
        const pres = require(modPath);
        const res = pres.emitPresentationEvent({}, { type: 'NOOP' });
        expect(res).toBe(false);
        expect(global.PresentationHelper).toBeDefined();
    });
});