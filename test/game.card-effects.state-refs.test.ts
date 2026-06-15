describe('card-effects state refs', () => {
    test('injected current cardState is preferred over stale fallback cardState', () => {
        let stateRefs: any = null;

        expect(() => {
            stateRefs = require('../game/card-effects/state-refs');
        }).not.toThrow();

        const currentCardState = {
            pendingEffectByPlayer: {
                black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
                white: null
            }
        };
        const staleCardState = {
            pendingEffectByPlayer: {
                black: null,
                white: null
            }
        };

        expect(stateRefs.resolveActiveCardState({
            getCardState: () => currentCardState
        }, staleCardState)).toBe(currentCardState);
    });

    test('fallback cardState is used only when injected cardState is unavailable', () => {
        const stateRefs = require('../game/card-effects/state-refs');
        const fallbackCardState = {
            pendingEffectByPlayer: {
                black: { type: 'FREE_PLACEMENT', stage: 'selectTarget' },
                white: null
            }
        };

        expect(stateRefs.resolveActiveCardState({
            getCardState: () => null
        }, fallbackCardState)).toBe(fallbackCardState);
        expect(stateRefs.resolveActiveCardState(null, fallbackCardState)).toBe(fallbackCardState);
    });
});
