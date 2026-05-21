import * as path from 'path';

describe('game/logic/presentation', () => {
    const modPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');
    beforeEach(() => {
        // Clear module cache to ensure fresh require in each test
        delete require.cache[require.resolve(modPath)];
        // Clear any global PresentationHelper / BoardOps
        try { delete global.PresentationHelper; } catch (e) { /* Intentionally empty: test cleanup guard */ }
        try { delete global.BoardOps; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    });

    test('registers PresentationHelper on globalThis and forwards to BoardOps if present', () => {
        // provide a fake BoardOps on global
        global.BoardOps = { emitPresentationEvent: jest.fn() };

        const pres = require(modPath);
        expect(typeof pres.emitPresentationEvent).toBe('function');

        // ensure global registration happened
        const registeredHelper = globalThis.PresentationHelper || global.PresentationHelper;
        expect(registeredHelper).toBeDefined();
        expect(typeof registeredHelper.emitPresentationEvent).toBe('function');

        const cardState = { foo: 'bar' };
        const ev = { type: 'TEST_EVENT' };

        const res = pres.emitPresentationEvent(cardState, ev);
        expect(res).toBe(true);
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(cardState, ev);
    });

    test('returns false and does not throw when BoardOps missing', () => {
        // No BoardOps provided
        if (typeof global.BoardOps !== 'undefined') delete global.BoardOps;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const pres = require(modPath);
            const res = pres.emitPresentationEvent({}, { type: 'NOOP' });
            expect(res).toBe(false);
            expect(warnSpy).not.toHaveBeenCalledWith('[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)');
        } finally {
            warnSpy.mockRestore();
        }
    });
});
