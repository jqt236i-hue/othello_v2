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
const SharedConstants = __importStar(require("../shared-constants.js"));
const CardWork = __importStar(require("../game/logic/cards/work_will.js"));
function createStates() {
    const cardState = {
        markers: [],
        workAnchorPosByPlayer: { black: null, white: null },
        charge: { black: 0, white: 0 }
    };
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
        boardExpansion: {
            active: true,
            side: 'right',
            row: 7,
            owner: SharedConstants.BLACK,
            cells: [{ side: 'right', row: 7, col: 8, owner: SharedConstants.BLACK }]
        }
    };
    return { cardState, gameState };
}
describe('WORK_WILL on expansion cells', () => {
    test('processWorkEffects gains charge from a right expansion anchor cell', () => {
        const { cardState, gameState } = createStates();
        cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
        cardState.markers.push({
            id: 5001,
            kind: 'specialStone',
            row: 7,
            col: 8,
            owner: 'black',
            data: { type: 'WORK', ownerColor: 'black', workStage: 0, remainingOwnerTurns: 2 }
        });
        const res = CardWork.processWorkEffects(cardState, gameState, 'black');
        expect(res.gained).toBe(1);
        expect(res.removed).toBe(false);
        expect(cardState.charge.black).toBe(1);
        const work = cardState.markers.find((m) => m && m.row === 7 && m.col === 8 && m.data && m.data.type === 'WORK');
        expect(work).toBeTruthy();
        expect(work.data.workStage).toBe(1);
        expect(work.data.remainingOwnerTurns).toBe(1);
    });
    test('processWorkEffects clears an expansion anchor cell when duration ends', () => {
        const { cardState, gameState } = createStates();
        cardState.workAnchorPosByPlayer.black = { row: 7, col: 8 };
        cardState.markers.push({
            id: 5002,
            kind: 'specialStone',
            row: 7,
            col: 8,
            owner: 'black',
            data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
        });
        const res = CardWork.processWorkEffects(cardState, gameState, 'black');
        expect(res.gained).toBe(16);
        expect(res.removed).toBe(true);
        expect(cardState.workAnchorPosByPlayer.black).toBeNull();
        expect(cardState.markers.find((m) => m && m.row === 7 && m.col === 8 && m.data && m.data.type === 'WORK')).toBeUndefined();
        expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.EMPTY);
    });
    test('processWorkEffects clears a bottom expansion anchor cell when duration ends', () => {
        const cardState = {
            markers: [],
            workAnchorPosByPlayer: { black: { row: 8, col: 3 }, white: null },
            charge: { black: 0, white: 0 }
        };
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
            boardExpansion: {
                active: true,
                side: 'bottom',
                row: 8,
                owner: SharedConstants.BLACK,
                cells: [{ side: 'bottom', row: 8, col: 3, owner: SharedConstants.BLACK }]
            }
        };
        cardState.markers.push({
            id: 5003,
            kind: 'specialStone',
            row: 8,
            col: 3,
            owner: 'black',
            data: { type: 'WORK', ownerColor: 'black', workStage: 4, remainingOwnerTurns: 1 }
        });
        const res = CardWork.processWorkEffects(cardState, gameState, 'black');
        expect(res.gained).toBe(16);
        expect(res.removed).toBe(true);
        expect(cardState.workAnchorPosByPlayer.black).toBeNull();
        expect(cardState.markers.find((m) => m && m.row === 8 && m.col === 3 && m.data && m.data.type === 'WORK')).toBeUndefined();
        expect(gameState.boardExpansion.cells[0].owner).toBe(SharedConstants.EMPTY);
    });
});
//# sourceMappingURL=game.work-will.expansion.test.js.map