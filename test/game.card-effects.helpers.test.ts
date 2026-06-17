describe('game/card-effects/helpers', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('getActiveProtectionForPlayer reads legacy card-system state through the wrapper', () => {
        const cardSystem = require('../card-system');
        const helpers = require('../game/card-effects/helpers');
        const blackProtection = {
            kind: 'specialStone',
            owner: 'black',
            data: { type: 'PROTECTED' },
            id: 'black-protection'
        };

        for (const key of Object.keys(cardSystem.cardState)) {
            delete cardSystem.cardState[key];
        }
        Object.assign(cardSystem.cardState, {
            markers: [
                blackProtection,
                { kind: 'specialStone', owner: 'white', data: { type: 'PROTECTED' }, id: 'white-protection' },
                { kind: 'specialStone', owner: 'black', data: { type: 'OTHER' }, id: 'ignored-type' }
            ]
        });

        expect(helpers.getActiveProtectionForPlayer(1)).toEqual([blackProtection]);
    });

    test('exports pure protection lookup for explicit card state callers', () => {
        const helpers = require('../game/card-effects/helpers');
        const whiteProtection = {
            kind: 'specialStone',
            owner: 'white',
            data: { type: 'PROTECTED' },
            id: 'white-protection'
        };

        expect(helpers.getActiveProtectionForCardState({
            markers: [
                { kind: 'specialStone', owner: 'black', data: { type: 'PROTECTED' }, id: 'black-protection' },
                whiteProtection
            ]
        }, -1)).toEqual([whiteProtection]);
    });
});
