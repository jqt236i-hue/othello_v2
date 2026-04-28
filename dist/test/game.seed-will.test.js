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
function createEmptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
}
function findSeedMarker(cardState, row, col) {
    return (cardState.markers || []).find((marker) => (marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col &&
        marker.data &&
        marker.data.type === 'SEED')) || null;
}
describe('SEED_WILL（種まきの意志）', () => {
    test('カード使用で種をまき、5回目の自ターン開始で通常石が芽生えても反転しない', () => {
        const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'SEED_WILL');
        expect(def).toBeTruthy();
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = createEmptyBoard();
        gameState.currentPlayer = Core.BLACK;
        gameState.board[3][0] = Core.BLACK;
        gameState.board[3][1] = Core.WHITE;
        cardState.charge.black = 99;
        cardState.hands.black = [def.id];
        const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(used).toBe(true);
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('SEED_WILL');
        const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 3, 2);
        expect(planted).toEqual(expect.objectContaining({ applied: true, row: 3, col: 2 }));
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(CardLogic.isBlockedCell(cardState, 3, 2, gameState)).toBe(false);
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(5);
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(4);
        CardLogic.onTurnStart(cardState, 'white', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(4);
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(3);
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(2);
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(1);
        CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
        expect(findSeedMarker(cardState, 3, 2)).toBeNull();
        expect(gameState.board[3][2]).toBe(Core.BLACK);
        expect(gameState.board[3][1]).toBe(Core.WHITE);
    });
    test('種マスに石が置かれると種が無効化される', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = createEmptyBoard();
        cardState.pendingEffectByPlayer.black = {
            type: 'SEED_WILL',
            stage: 'selectTarget',
            cardId: 'seed_01'
        };
        const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 2, 2);
        expect(planted.applied).toBe(true);
        expect(findSeedMarker(cardState, 2, 2)).toBeTruthy();
        const spawnRes = BoardOps.spawnAt(cardState, gameState, 2, 2, 'white', 'TEST', 'manual_spawn');
        expect(spawnRes && spawnRes.spawned).toBe(true);
        expect(findSeedMarker(cardState, 2, 2)).toBeNull();
        expect(gameState.board[2][2]).toBe(Core.WHITE);
        expect((cardState.presentationEvents || [])).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'STATUS_REMOVED',
                row: 2,
                col: 2,
                reason: 'seed_invalidated',
                meta: expect.objectContaining({
                    special: 'SEED',
                    reason: 'seed_invalidated'
                })
            })
        ]));
    });
    test('種マスは封鎖と凍結の対象にならない', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        cardState.debugNoDraw = true;
        gameState.board = createEmptyBoard();
        cardState.pendingEffectByPlayer.black = {
            type: 'SEED_WILL',
            stage: 'selectTarget',
            cardId: 'seed_01'
        };
        const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 4, 4);
        expect(planted.applied).toBe(true);
        const seedTargets = CardLogic.getSeedTargets(cardState, gameState, 'black');
        const blockadeTargets = CardLogic.getBlockadeTargets(cardState, gameState, 'black');
        const freezeTargets = CardLogic.getFreezeTargets(cardState, gameState, 'black');
        expect(seedTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
        expect(blockadeTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
        expect(freezeTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
    });
});
//# sourceMappingURL=game.seed-will.test.js.map