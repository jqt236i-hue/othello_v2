import { JSDOM } from 'jsdom';

test('card initialization failure preserves the previous card state and random checkpoint', () => {
    const dom = new JSDOM('');
    (global as any).window = dom.window;
    const root = dom.window as any;
    root.SeededPRNG = require('../game/schema/prng');
    root.CardLogic = require('../game/logic/cards');
    const system = require('../card-system');
    try {
        system.initCardState(19);
        expect(system.getCardState()._defaultRandomSource).toBe(system.getGamePrng());
        const before = JSON.stringify(system.getCardState()), rng = system.getGamePrng();
        root.CardLogic = { createCardState: () => { throw new Error('factory failure'); } };
        expect(() => system.initCardState(20)).toThrow('factory failure');
        expect(JSON.stringify(system.getCardState())).toBe(before);
        expect(system.getGamePrng()).toBe(rng);
    } finally { dom.window.close(); delete (global as any).window; delete (global as any).cardState; }
});
