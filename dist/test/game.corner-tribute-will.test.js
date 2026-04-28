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
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const SharedConstants = __importStar(require("../shared-constants.js"));
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
function createEmptyGameState() {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.turnNumber = 1;
    return gameState;
}
function getCornerTributeDef() {
    return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CORNER_TRIBUTE');
}
describe('CORNER_TRIBUTE（角の代償）', () => {
    test('標準4角を相手が取っている時だけ使え、布石を最大20奪う', () => {
        const def = getCornerTributeDef();
        expect(def).toBeTruthy();
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = createEmptyGameState();
        gameState.board[0][0] = Core.WHITE;
        gameState.board[0][7] = Core.WHITE;
        gameState.board[7][0] = Core.WHITE;
        gameState.board[7][7] = Core.WHITE;
        cardState.hands.black = [def.id];
        cardState.charge.black = 0;
        cardState.charge.white = 50;
        expect(CardLogic.countOccupiedCornersForPlayer(cardState, gameState, 'white')).toBe(4);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([def.id]);
        const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: def.id }, createPrng());
        expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(result.cardState.charge.black).toBe(20);
        expect(result.cardState.charge.white).toBe(30);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'corner_tribute_resolved',
                player: 'black',
                opponent: 'white',
                stolen: 20,
                opponentCornerCount: 4
            })
        ]));
    });
    test('相手角が3個以下なら使用不可', () => {
        const def = getCornerTributeDef();
        expect(def).toBeTruthy();
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = createEmptyGameState();
        gameState.board[0][0] = Core.WHITE;
        gameState.board[0][7] = Core.WHITE;
        gameState.board[7][0] = Core.WHITE;
        cardState.hands.black = [def.id];
        expect(CardLogic.countOccupiedCornersForPlayer(cardState, gameState, 'white')).toBe(3);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
        expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(false);
    });
    test('盤面拡張で増えた角も角扱いに含む', () => {
        const def = getCornerTributeDef();
        expect(def).toBeTruthy();
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = createEmptyGameState();
        gameState.board[7][7] = Core.WHITE;
        gameState.boardExpansion = {
            active: true,
            side: 'left',
            row: 0,
            owner: Core.EMPTY,
            usedByPlayer: { black: true, white: false },
            cells: [
                { row: -1, col: -1, owner: Core.WHITE },
                { row: -1, col: 0, owner: Core.WHITE },
                { row: 0, col: -1, owner: Core.WHITE }
            ]
        };
        cardState.hands.black = [def.id];
        expect(CardLogic.getCurrentCornerCellsForCard(cardState, gameState)).toEqual(expect.arrayContaining([
            { row: -1, col: -1 },
            { row: -1, col: 0 },
            { row: 0, col: -1 },
            { row: 7, col: 7 }
        ]));
        expect(CardLogic.countOccupiedCornersForPlayer(cardState, gameState, 'white')).toBe(4);
        expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([def.id]);
    });
    test('隕石でできた疑似角は数えるが、封鎖では角形状を変えない', () => {
        const def = getCornerTributeDef();
        expect(def).toBeTruthy();
        const meteorCardState = CardLogic.createCardState(createPrng());
        const meteorGameState = createEmptyGameState();
        meteorGameState.board[0][1] = Core.WHITE;
        meteorGameState.board[1][0] = Core.WHITE;
        meteorGameState.board[0][7] = Core.WHITE;
        meteorGameState.board[7][7] = Core.WHITE;
        meteorCardState.markers.push({
            id: 'meteor-hole-top-left',
            kind: 'specialStone',
            row: 0,
            col: 0,
            owner: 'black',
            data: { type: 'METEOR_HOLE' }
        });
        meteorCardState.hands.black = [def.id];
        expect(CardLogic.getCurrentCornerCellsForCard(meteorCardState, meteorGameState)).toEqual(expect.arrayContaining([
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 0, col: 7 },
            { row: 7, col: 0 },
            { row: 7, col: 7 }
        ]));
        expect(CardLogic.countOccupiedCornersForPlayer(meteorCardState, meteorGameState, 'white')).toBe(4);
        expect(CardLogic.getUsableCardIds(meteorCardState, meteorGameState, 'black')).toEqual([def.id]);
        const blockadeCardState = CardLogic.createCardState(createPrng());
        const blockadeGameState = createEmptyGameState();
        blockadeGameState.board[0][1] = Core.WHITE;
        blockadeGameState.board[1][0] = Core.WHITE;
        blockadeGameState.board[0][7] = Core.WHITE;
        blockadeGameState.board[7][7] = Core.WHITE;
        blockadeCardState.markers.push({
            id: 'blockade-top-left',
            kind: 'specialStone',
            row: 0,
            col: 0,
            owner: 'black',
            data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
        });
        blockadeCardState.hands.black = [def.id];
        expect(CardLogic.countOccupiedCornersForPlayer(blockadeCardState, blockadeGameState, 'white')).toBe(2);
        expect(CardLogic.getUsableCardIds(blockadeCardState, blockadeGameState, 'black')).toEqual([]);
    });
});
//# sourceMappingURL=game.corner-tribute-will.test.js.map