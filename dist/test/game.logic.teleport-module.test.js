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
const CardTeleport = __importStar(require("../game/logic/cards/teleport.js"));
describe('CardTeleport module', () => {
    test('applyTeleportWill moves marker and clears pending on success', () => {
        const cardState = {
            pendingEffectByPlayer: { black: { type: 'TELEPORT_WILL', stage: 'selectTarget', cardId: 'teleport_01' } },
            markers: [{ id: 'bomb_1', kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }]
        };
        const result = CardTeleport.applyTeleportWill(cardState, {}, 'black', 4, 4, { random: () => 0 }, {
            getTeleportTargets: () => [{ row: 4, col: 4 }],
            getTeleportDestinations: () => [{ row: 2, col: 2 }],
            getCellValueForCard: (state, row, col) => (row === 4 && col === 4 ? 1 : (row === 2 && col === 2 ? 0 : null)),
            moveAt: jest.fn(() => ({ moved: true })),
            getMarkers: (state) => state.markers
        });
        expect(result).toEqual({ applied: true, from: { row: 4, col: 4 }, to: { row: 2, col: 2 } });
        expect(cardState.markers[0]).toMatchObject({ row: 2, col: 2 });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('applyCellTeleportWill creates a hole and moves stone ids on fallback move', () => {
        const cardState = {
            pendingEffectByPlayer: { black: { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget', cardId: 'cell_tp_01' } },
            markers: [{ id: 'bomb_2', kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }]
        };
        const setCalls = [];
        const added = [];
        const stoneIds = { '4,4': 's1' };
        const result = CardTeleport.applyCellTeleportWill(cardState, {}, 'black', 4, 4, { random: () => 0 }, {
            getCellTeleportTargets: () => [{ row: 4, col: 4 }],
            getCellTeleportDestinations: () => [{ row: -1, col: 0, active: false }],
            getCellValueForCard: (state, row, col) => (row === 4 && col === 4 ? 1 : (row === -1 && col === 0 ? 0 : null)),
            ensureExpansionCellForCard: jest.fn(() => true),
            setCellValueForCard: (state, row, col, value) => {
                setCalls.push({ row, col, value });
                return true;
            },
            getStoneIdAtForCard: (cs, gs, row, col) => stoneIds[`${row},${col}`] || null,
            clearStoneIdAtForCard: (cs, gs, row, col) => { delete stoneIds[`${row},${col}`]; },
            setStoneIdAtForCard: (cs, gs, row, col, value) => { stoneIds[`${row},${col}`] = value; return true; },
            removeMarkersAt: jest.fn((cs, row, col) => {
                cs.markers = cs.markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
            }),
            addMarker: jest.fn((cs, kind, row, col, owner, data) => {
                added.push({ kind, row, col, owner, data });
                cs.markers.push({ kind, row, col, owner, data });
                return true;
            }),
            getMarkers: (state) => state.markers
        });
        expect(result).toEqual({ applied: true, from: { row: 4, col: 4 }, to: { row: -1, col: 0 }, createdDestination: true });
        expect(stoneIds['4,4']).toBeUndefined();
        expect(stoneIds['-1,0']).toBe('s1');
        expect(cardState.markers.some((marker) => marker.row === 4 && marker.col === 4 && marker.data && marker.data.type === 'METEOR_HOLE')).toBe(true);
        expect(cardState.markers.some((marker) => marker.id === 'bomb_2' && marker.row === -1 && marker.col === 0)).toBe(true);
        expect(setCalls).toEqual(expect.arrayContaining([
            { row: 4, col: 4, value: 0 },
            { row: -1, col: 0, value: 1 }
        ]));
        expect(added).toEqual(expect.arrayContaining([{ kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'METEOR_HOLE' } }]));
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
});
//# sourceMappingURL=game.logic.teleport-module.test.js.map