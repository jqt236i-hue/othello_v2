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
const CardLogic = __importStar(require("../game/logic/cards.js"));
const Core = __importStar(require("../game/logic/core.js"));
describe('SUPER_BUOYANCY_WILL expansion regression', () => {
    test('can move an occupied expansion cell upward along an expansion column', () => {
        const prng = { shuffle: (arr) => arr, random: () => 0 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: Core.EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: [
                { side: 'left', row: 1, col: -1, owner: Core.EMPTY },
                { side: 'left', row: 2, col: -1, owner: Core.EMPTY },
                { side: 'left', row: 3, col: -1, owner: Core.BLACK }
            ]
        };
        cardState.pendingEffectByPlayer.black = {
            type: 'SUPER_BUOYANCY_WILL',
            stage: 'selectTarget',
            cardId: 'super_buoyancy_expansion_01'
        };
        const targets = CardLogic.getSuperBuoyancyTargets(cardState, gameState);
        expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));
        const res = CardLogic.applySuperBuoyancyWill(cardState, gameState, 'black', 3, -1);
        expect(res).toMatchObject({ applied: true, from: { row: 3, col: -1 }, to: { row: 1, col: -1 }, destroyedCount: 0, movedDistance: 2 });
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(Core.EMPTY);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 1 && cell.col === -1).owner).toBe(Core.BLACK);
    });
});
//# sourceMappingURL=game.super-buoyancy-will.test.js.map