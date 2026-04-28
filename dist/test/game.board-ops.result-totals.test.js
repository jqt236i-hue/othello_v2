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
const BoardOps = __importStar(require("../game/logic/board_ops.js"));
function createPrng() {
    return {
        shuffle: (arr) => arr,
        random: () => 0.5
    };
}
describe('BoardOps result totals', () => {
    test('changeAtで総反転枚数を加算する', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board[3][3] = Core.WHITE;
        const changed = BoardOps.changeAt(cardState, gameState, 3, 3, 'black', 'SYSTEM', 'standard_flip');
        expect(changed && changed.changed).toBe(true);
        expect(cardState.totalFlipCountByPlayer.black).toBe(1);
        expect(cardState.totalFlipCountByPlayer.white).toBe(0);
    });
    test('角の奪取時に角取得数を加算する', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board[0][0] = Core.WHITE;
        BoardOps.changeAt(cardState, gameState, 0, 0, 'black', 'SYSTEM', 'standard_flip');
        expect(cardState.cornerCaptureCountByPlayer.black).toBe(1);
        expect(cardState.cornerCaptureCountByPlayer.white).toBe(0);
        BoardOps.changeAt(cardState, gameState, 0, 0, 'white', 'SYSTEM', 'standard_flip');
        expect(cardState.cornerCaptureCountByPlayer.black).toBe(1);
        expect(cardState.cornerCaptureCountByPlayer.white).toBe(1);
        expect(cardState.totalFlipCountByPlayer.black).toBe(1);
        expect(cardState.totalFlipCountByPlayer.white).toBe(1);
    });
});
//# sourceMappingURL=game.board-ops.result-totals.test.js.map