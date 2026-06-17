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

    test('falls back to legacy card-system state when injected state is unavailable', () => {
        jest.resetModules();

        const cardSystem = require('../card-system');
        const stateRefs = require('../game/card-effects/state-refs');
        const legacyState = {
            active: true,
            markers: [{ kind: 'specialStone', owner: 'black', data: { type: 'PROTECTED' } }]
        };

        for (const key of Object.keys(cardSystem.cardState)) {
            delete cardSystem.cardState[key];
        }
        Object.assign(cardSystem.cardState, legacyState);

        expect(stateRefs.resolveActiveCardState(null, null)).toBe(cardSystem.cardState);
    });

    test('prefers explicit state over legacy provider state', () => {
        jest.resetModules();

        const stateRefs = require('../game/card-effects/state-refs');
        const explicitState = { markers: [{ id: 'explicit' }] };
        const legacyState = { markers: [{ id: 'legacy' }] };

        stateRefs.setLegacyCardStateProviderForTests(() => legacyState);

        expect(stateRefs.resolveActiveCardState({ getCardState: () => explicitState }, null)).toBe(explicitState);
        expect(stateRefs.resolveActiveCardState(null, null)).toBe(legacyState);

        stateRefs.setLegacyCardStateProviderForTests(null);
    });
});
