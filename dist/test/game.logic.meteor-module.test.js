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
const CardMeteor = __importStar(require("../game/logic/cards/meteor.js"));
describe('CardMeteor module', () => {
    test('applyMeteorWill creates a meteor hole on an empty target and clears pending', () => {
        const cardState = {
            pendingEffectByPlayer: { black: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' } },
            markers: [{ id: 'blockade_1', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'BLOCKADE' } }]
        };
        const added = [];
        const result = CardMeteor.applyMeteorWill(cardState, {}, 'black', 1, 1, {
            getMeteorTargets: () => [{ row: 1, col: 1 }],
            getCellValueForCard: () => 0,
            clearStoneIdAtForCard: jest.fn(),
            setCellValueForCard: jest.fn(() => true),
            removeMarkersAt: jest.fn((cs, row, col) => {
                cs.markers = cs.markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
            }),
            addMarker: jest.fn((cs, kind, row, col, owner, data) => {
                added.push({ kind, row, col, owner, data });
                cs.markers.push({ kind, row, col, owner, data });
                return true;
            })
        });
        expect(result).toEqual({ applied: true, row: 1, col: 1, destroyed: false });
        expect(added).toEqual([{ kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'METEOR_HOLE' } }]);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('applyMeteorWill uses destroyAt for occupied cells before leaving a hole', () => {
        const destroyed = [];
        const cardState = {
            pendingEffectByPlayer: { white: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_02' } },
            markers: []
        };
        const result = CardMeteor.applyMeteorWill(cardState, {}, 'white', 3, 3, {
            getMeteorTargets: () => [{ row: 3, col: 3 }],
            getCellValueForCard: () => 1,
            destroyAt: (cs, gs, row, col, cause, reason, meta) => {
                destroyed.push({ row, col, cause, reason, meta });
                return { destroyed: true };
            },
            isDestroyResolved: (value) => !!(value && value.destroyed),
            removeMarkersAt: jest.fn(),
            addMarker: jest.fn((cs, kind, row, col, owner, data) => {
                cs.markers.push({ kind, row, col, owner, data });
                return true;
            })
        });
        expect(result).toEqual({ applied: true, row: 3, col: 3, destroyed: true });
        expect(destroyed).toEqual([{ row: 3, col: 3, cause: 'METEOR_WILL', reason: 'meteor_cell_destroy', meta: { ignoreGuard: true, ignoreRegen: true } }]);
        expect(cardState.markers).toEqual([{ kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } }]);
        expect(cardState.pendingEffectByPlayer.white).toBeNull();
    });
});
//# sourceMappingURL=game.logic.meteor-module.test.js.map