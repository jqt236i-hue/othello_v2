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
const CardMovement = __importStar(require("../game/logic/cards/movement.js"));
describe('CardMovement module', () => {
    test('applyStrongWindWill moves to the farthest option and clears pending', () => {
        const cardState = {
            pendingEffectByPlayer: { black: { type: 'STRONG_WIND_WILL', stage: 'selectTarget', cardId: 'wind_01' } },
            markers: [{ id: 'm1', row: 3, col: 3, kind: 'specialStone', owner: 'black', data: { type: 'WORK' } }]
        };
        const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        const result = CardMovement.applyStrongWindWill(cardState, gameState, 'black', 3, 3, { random: () => 0 }, {
            getCellValueForCard: (state, row, col) => {
                if (row === 3 && col === 3)
                    return 1;
                if (row === 3 && (col === 4 || col === 5))
                    return 0;
                return null;
            },
            hasBoardShapeCellForCard: (cs, gs, row, col) => row === 3 && (col === 4 || col === 5),
            isBlockedCell: () => false,
            setCellValueForCard: jest.fn(() => true),
            moveAt: jest.fn(() => ({ moved: true })),
            getMarkers: (state) => state.markers
        });
        expect(result).toMatchObject({
            applied: true,
            from: { row: 3, col: 3 },
            to: { row: 3, col: 5 },
            movedDistance: 2,
            chargeGained: 0
        });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState.markers[0]).toMatchObject({ row: 3, col: 5 });
    });
    test('applySuperBuoyancyWill destroys collisions, moves the stone, and clears pending', () => {
        const destroyed = [];
        const moved = [];
        const cardState = {
            pendingEffectByPlayer: { white: { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget', cardId: 'buoyancy_01' } },
            markers: []
        };
        const occupied = new Set(['4,2', '3,2']);
        const result = CardMovement.applySuperBuoyancyWill(cardState, {}, 'white', 4, 2, {
            getSuperBuoyancyTargets: () => [{ row: 4, col: 2 }],
            getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? -1 : 0),
            hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 1 && row <= 3 && col === 2,
            isBlockedCell: () => false,
            findSpecialMarkerAt: () => null,
            destroyAt: (cs, gs, row, col) => {
                destroyed.push({ row, col });
                occupied.delete(`${row},${col}`);
                return { destroyed: true };
            },
            isDestroyResolved: (resultValue) => !!(resultValue && resultValue.destroyed),
            moveAt: (cs, gs, fromRow, fromCol, toRow, toCol) => {
                moved.push({ fromRow, fromCol, toRow, toCol });
                occupied.delete(`${fromRow},${fromCol}`);
                occupied.add(`${toRow},${toCol}`);
                return { moved: true };
            },
            getMarkers: () => []
        });
        expect(result).toMatchObject({
            applied: true,
            to: { row: 1, col: 2 },
            destroyedCount: 1,
            movedDistance: 3
        });
        expect(destroyed).toEqual([{ row: 3, col: 2 }]);
        expect(moved).toEqual([{ fromRow: 4, fromCol: 2, toRow: 1, toCol: 2 }]);
        expect(cardState.pendingEffectByPlayer.white).toBeNull();
    });
});
//# sourceMappingURL=game.logic.movement-module.test.js.map