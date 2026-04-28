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
const SharedConstants = __importStar(require("../shared-constants.js"));
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
describe('FREEZE_WILL（凍結の意志）', () => {
    test('カード使用で占有マスを凍結し、その石は反転も破壊もされない', () => {
        const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'FREEZE_WILL');
        expect(def).toBeTruthy();
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.currentPlayer = Core.BLACK;
        gameState.board[3][2] = Core.BLACK;
        gameState.board[3][3] = Core.WHITE;
        cardState.charge.black = 99;
        cardState.hands.black = [def.id];
        const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(used).toBe(true);
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('FREEZE_WILL');
        const res = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 3);
        expect(res && res.applied).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        const freezeMarker = (cardState.markers || []).find((m) => (m &&
            m.kind === 'specialStone' &&
            m.row === 3 &&
            m.col === 3 &&
            m.data &&
            m.data.type === 'FREEZE'));
        expect(freezeMarker).toBeTruthy();
        expect(freezeMarker.data.remainingOwnerTurns).toBe(5);
        const context = CardLogic.getCardContext(cardState);
        const flips = Core.getFlipsWithContext(gameState, 3, 4, Core.BLACK, context);
        expect(flips).toEqual([]);
        const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test_freeze');
        expect(destroyed).toEqual({ destroyed: false, reason: 'frozen_protected' });
        expect(gameState.board[3][3]).toBe(Core.WHITE);
    });
    test('凍結した空きマスは合法手と自由配置から除外される', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.currentPlayer = Core.BLACK;
        gameState.board[3][1] = Core.WHITE;
        gameState.board[3][2] = Core.BLACK;
        cardState.pendingEffectByPlayer.black = {
            type: 'FREEZE_WILL',
            stage: 'selectTarget',
            cardId: 'freeze_01'
        };
        const selected = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 0);
        expect(selected && selected.applied).toBe(true);
        const context = CardLogic.getCardContext(cardState);
        const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, context);
        const freeBlack = Core.getFreePlacementMoves(gameState, Core.BLACK, context);
        const freeWhite = Core.getFreePlacementMoves(gameState, Core.WHITE, context);
        expect(legalMoves.some((m) => m.row === 3 && m.col === 0)).toBe(false);
        expect(freeBlack.some((m) => m.row === 3 && m.col === 0)).toBe(false);
        expect(freeWhite.some((m) => m.row === 3 && m.col === 0)).toBe(false);
    });
    test('凍結した自分石は反転の支点に使えず合法手にもならない', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.currentPlayer = Core.BLACK;
        gameState.board[3][1] = Core.WHITE;
        gameState.board[3][2] = Core.BLACK;
        cardState.pendingEffectByPlayer.black = {
            type: 'FREEZE_WILL',
            stage: 'selectTarget',
            cardId: 'freeze_01'
        };
        const selected = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 2);
        expect(selected && selected.applied).toBe(true);
        const context = CardLogic.getCardContext(cardState);
        const flips = Core.getFlipsWithContext(gameState, 3, 0, Core.BLACK, context);
        const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, context);
        expect(flips).toEqual([]);
        expect(legalMoves.some((m) => m.row === 3 && m.col === 0)).toBe(false);
    });
    test('凍結中の持続ターン付き特殊石は減らず、解凍後に再び減る', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[2][2] = Core.BLACK;
        cardState.charge.black = 0;
        cardState.workAnchorPosByPlayer.black = { row: 2, col: 2 };
        cardState.markers.push({
            id: 'work_1',
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'black',
            data: { type: 'WORK', workStage: 0, remainingOwnerTurns: 3, ownerColor: 'black' }
        }, {
            id: 'freeze_1',
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'black',
            data: { type: 'FREEZE', remainingOwnerTurns: 1 }
        });
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        let workMarker = cardState.markers.find((m) => m && m.id === 'work_1');
        let freezeMarker = cardState.markers.find((m) => m && m.id === 'freeze_1');
        expect(workMarker).toBeTruthy();
        expect(workMarker.data.remainingOwnerTurns).toBe(3);
        expect(cardState.charge.black).toBe(0);
        expect(freezeMarker).toBeUndefined();
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        workMarker = cardState.markers.find((m) => m && m.id === 'work_1');
        expect(workMarker).toBeTruthy();
        expect(workMarker.data.remainingOwnerTurns).toBe(2);
        expect(cardState.charge.black).toBe(1);
    });
});
//# sourceMappingURL=game.freeze-will.test.js.map