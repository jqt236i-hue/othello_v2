"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const CardMarkers = __importStar(require("../game/logic/cards/markers.js"));
describe('CardMarkers duration effects', () => {
    test('applyExtendLifeWill doubles timed markers on the selected cell and clears pending', () => {
        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget', cardId: 'extend_01' }
            },
            markers: [
                { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 5 } },
                { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
            ]
        };
        const result = CardMarkers.applyExtendLifeWill(cardState, {}, 'black', 2, 2, {
            getExtendLifeTargets: () => [{ row: 2, col: 2 }]
        });
        expect(result).toEqual({
            applied: true,
            row: 2,
            col: 2,
            previousRemainingOwnerTurns: 5,
            newRemainingOwnerTurns: 10,
            multiplier: 2,
            cardType: 'EXTEND_LIFE_WILL'
        });
        expect(cardState.markers[0].data.remainingOwnerTurns).toBe(10);
        expect(cardState.markers[1].data.remainingOwnerTurns).toBe(6);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'STATUS_TICK',
                row: 2,
                col: 2,
                meta: expect.objectContaining({
                    special: 'WORK',
                    timer: 10,
                    owner: 'black',
                    reason: 'extend_life_applied',
                    highlightTone: 'positive'
                })
            })
        ]));
    });
    test('applyExtendLifeGod quadruples timed markers on the selected cell and clears pending', () => {
        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'EXTEND_LIFE_GOD', stage: 'selectTarget', cardId: 'extend_life_god_01' }
            },
            markers: [
                { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 5 } },
                { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
            ]
        };
        const result = CardMarkers.applyExtendLifeGod(cardState, {}, 'black', 2, 2, {
            getExtendLifeTargets: () => [{ row: 2, col: 2 }]
        });
        expect(result).toEqual({
            applied: true,
            row: 2,
            col: 2,
            previousRemainingOwnerTurns: 5,
            newRemainingOwnerTurns: 20,
            multiplier: 4,
            cardType: 'EXTEND_LIFE_GOD'
        });
        expect(cardState.markers[0].data.remainingOwnerTurns).toBe(20);
        expect(cardState.markers[1].data.remainingOwnerTurns).toBe(12);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'STATUS_TICK',
                row: 2,
                col: 2,
                meta: expect.objectContaining({
                    special: 'WORK',
                    timer: 20,
                    owner: 'black',
                    reason: 'extend_life_applied',
                    highlightTone: 'positive'
                })
            })
        ]));
    });
    test('applyCorrosionWill halves timed markers on the selected cell and returns detail rows', () => {
        const cardState = {
            pendingEffectByPlayer: {
                black: { type: 'CORROSION_WILL', stage: 'selectTarget', cardId: 'corrosion_01' }
            },
            markers: [
                { id: 1, row: 3, col: 4, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 5 } },
                { id: 2, row: 3, col: 4, kind: 'specialStone', owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 2 } },
                { id: 3, row: 1, col: 1, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 4 } }
            ]
        };
        const result = CardMarkers.applyCorrosionWill(cardState, {}, 'black', 3, 4, {
            getCorrosionTargets: () => [{ row: 3, col: 4 }]
        });
        expect(result.applied).toBe(true);
        expect(result.affectedCount).toBe(2);
        expect(result.details).toEqual([
            {
                row: 3,
                col: 4,
                owner: 'black',
                special: 'WORK',
                previousRemainingOwnerTurns: 5,
                newRemainingOwnerTurns: 2
            },
            {
                row: 3,
                col: 4,
                owner: 'white',
                special: 'GUARD',
                previousRemainingOwnerTurns: 2,
                newRemainingOwnerTurns: 1
            }
        ]);
        expect(cardState.markers[0].data.remainingOwnerTurns).toBe(2);
        expect(cardState.markers[1].data.remainingOwnerTurns).toBe(1);
        expect(cardState.markers[2].data.remainingOwnerTurns).toBe(4);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'STATUS_TICK',
                row: 3,
                col: 4,
                meta: expect.objectContaining({
                    special: 'WORK',
                    timer: 2,
                    owner: 'black',
                    reason: 'corrosion_applied',
                    highlightTone: 'negative'
                })
            })
        ]));
    });
});
//# sourceMappingURL=game.cards.markers-duration-module.test.js.map