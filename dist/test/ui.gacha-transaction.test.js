"use strict";
describe('gacha transaction module', () => {
    beforeEach(() => {
        jest.resetModules();
    });
    test('returns a structured insufficient balance error', () => {
        import * as mod from '../ui/gacha/gacha-transaction.js';
        const result = mod.commitPullTransaction({}, 1, {
            helpersModule: {
                OBSERVATION_STONE_PULL_COST: 100,
                OBSERVATION_STONE_TEN_PULL_COST: 1000
            },
            storageModule: {
                spendObservationStones: () => ({ ok: false, missing: 40 }),
                getObservationStones: () => 60
            },
            catalogItems: [{ id: 'sample-hand' }]
        });
        expect(result).toEqual({
            ok: false,
            code: mod.TRANSACTION_ERROR_CODES.INSUFFICIENT_OBSERVATION_STONES,
            messageData: {
                cost: 100,
                missing: 40
            }
        });
    });
    test('returns a structured success payload when a mixed reward pull resolves', () => {
        import * as mod from '../ui/gacha/gacha-transaction.js';
        const rollObservationGacha = jest.fn(() => ({
            rarity: 'N',
            item: {
                id: 'gacha__n__placement_sound__type-1-standard',
                kind: 'placement_sound',
                label: 'type-1-standard',
                assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
                soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
            }
        }));
        const applyPullResults = jest.fn(() => ({
            newlyUnlockedIds: ['gacha__n__placement_sound__type-1-standard'],
            alreadyOwnedIds: [],
            state: {
                observationStones: 0
            }
        }));
        const result = mod.commitPullTransaction({}, 1, {
            helpersModule: {
                OBSERVATION_STONE_PULL_COST: 100,
                OBSERVATION_STONE_TEN_PULL_COST: 1000,
                rollObservationGacha
            },
            storageModule: {
                spendObservationStones: () => ({ ok: true }),
                applyPullResults
            },
            catalogItems: [{ id: 'sample-sound', kind: 'placement_sound' }]
        });
        expect(rollObservationGacha).toHaveBeenCalledTimes(1);
        expect(applyPullResults).toHaveBeenCalledWith({}, [
            expect.objectContaining({
                item: expect.objectContaining({
                    id: 'gacha__n__placement_sound__type-1-standard',
                    kind: 'placement_sound'
                })
            })
        ]);
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            code: 'ok',
            count: 1,
            cost: 100,
            newCount: 1,
            duplicateCount: 0,
            newlyUnlockedIds: ['gacha__n__placement_sound__type-1-standard']
        }));
    });
    test('derives mixed catalog items from loaded asset manifest before generated fallback', () => {
        import * as mod from '../ui/gacha/gacha-transaction.js';
        const items = mod.getCatalogItems({
            assetManifest: {
                generatedAt: '2026-04-12T00:00:00.000Z',
                files: [
                    { path: 'assets/images/Gacha/UR/天空の手.png' },
                    { path: 'assets/images/Gacha/N/type-1-standard.mp3' }
                ]
            },
            catalogModule: {
                items: [
                    {
                        id: 'fallback-item',
                        label: 'fallback-item',
                        rarity: 'N',
                        imagePath: 'assets/images/Gacha/N/fallback-item.png'
                    }
                ]
            }
        });
        expect(items).toEqual([
            expect.objectContaining({
                id: 'gacha__ur__天空の手',
                label: '天空の手',
                rarity: 'UR',
                kind: 'hand_skin',
                imagePath: 'assets/images/Gacha/UR/天空の手.png'
            }),
            expect.objectContaining({
                id: 'gacha__n__placement_sound__type-1-standard',
                label: 'type-1-standard',
                rarity: 'N',
                kind: 'placement_sound',
                assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
                soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
            })
        ]);
    });
    test('refunds spent stones when roll resolution fails after spending', () => {
        import * as mod from '../ui/gacha/gacha-transaction.js';
        const awardObservationStones = jest.fn();
        const applyPullResults = jest.fn();
        const result = mod.commitPullTransaction({}, 1, {
            helpersModule: {
                OBSERVATION_STONE_PULL_COST: 100,
                OBSERVATION_STONE_TEN_PULL_COST: 1000,
                rollObservationGacha: () => null
            },
            storageModule: {
                spendObservationStones: () => ({ ok: true }),
                awardObservationStones,
                applyPullResults
            },
            catalogItems: [{ id: 'sample-hand' }]
        });
        expect(result).toEqual({
            ok: false,
            code: mod.TRANSACTION_ERROR_CODES.ROLL_FAILED,
            messageData: {
                cost: 100,
                count: 1
            }
        });
        expect(awardObservationStones).toHaveBeenCalledWith({}, 100);
        expect(applyPullResults).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ui.gacha-transaction.test.js.map