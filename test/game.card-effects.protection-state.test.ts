describe('game/card-effects/protection-state', () => {
    test('filters active protection markers for the requested player', () => {
        const ProtectionState = require('../game/card-effects/protection-state');
        const cardState = {
            markers: [
                { kind: 'specialStone', owner: 'black', data: { type: 'PROTECTED' }, id: 'black-protection' },
                { kind: 'specialStone', owner: 'white', data: { type: 'PROTECTED' }, id: 'white-protection' },
                { kind: 'specialStone', owner: 'black', data: { type: 'OTHER' }, id: 'ignored-type' },
                { kind: 'bomb', owner: 'black', data: { type: 'PROTECTED' }, id: 'ignored-kind' }
            ]
        };

        expect(ProtectionState.getActiveProtectionForCardState(cardState, 1)).toEqual([
            { kind: 'specialStone', owner: 'black', data: { type: 'PROTECTED' }, id: 'black-protection' }
        ]);
    });

    test('returns an empty list for missing or malformed marker state', () => {
        const ProtectionState = require('../game/card-effects/protection-state');

        expect(ProtectionState.getActiveProtectionForCardState(null, 1)).toEqual([]);
        expect(ProtectionState.getActiveProtectionForCardState({ markers: null }, 1)).toEqual([]);
    });
});
