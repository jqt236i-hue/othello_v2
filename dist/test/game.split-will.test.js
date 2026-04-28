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
const SharedConstants = __importStar(require("../shared-constants.js"));
function createBombMarker(id, row, col, owner, remainingTurns) {
    return {
        id,
        kind: 'specialStone',
        row,
        col,
        owner,
        data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns }
    };
}
function isBombMarker(marker) {
    return !!(marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.category === 'bomb');
}
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
describe('SPLIT_WILL（分裂の意志）', () => {
    test('カード定義が存在し、コスト12である', () => {
        const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'SPLIT_WILL');
        expect(def).toBeTruthy();
        expect(def.cost).toBe(12);
    });
    test('周囲に空きがない石は対象外になる', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[6][6] = Core.BLACK;
        gameState.board[5][5] = Core.EMPTY;
        const targets = CardLogic.getSplitTargets(cardState, gameState, 'black');
        expect(targets).toEqual([{ row: 6, col: 6 }]);
    });
    test('分裂時に元石と生成石の持続ターンを半減し、生成だけでは反転しない', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][5] = Core.WHITE;
        gameState.board[3][6] = Core.BLACK;
        cardState.markers.push({
            id: 1999,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'DRAGON', remainingOwnerTurns: 5 }
        });
        cardState.markers.push({
            ...createBombMarker(2000, 3, 3, 'black', 3)
        });
        cardState.pendingEffectByPlayer.black = {
            type: 'SPLIT_WILL',
            stage: 'selectTarget',
            cardId: 'split_01'
        };
        const res = CardLogic.applySplitWill(cardState, gameState, 'black', 3, 3, createPrng(0.5));
        expect(res && res.applied).toBe(true);
        expect(Array.isArray(res.spawned)).toBe(true);
        expect(res.spawned.length).toBe(1);
        expect(res.spawned[0]).toEqual({ row: 3, col: 4 });
        expect(gameState.board[3][4]).toBe(Core.BLACK);
        expect(gameState.board[3][5]).toBe(Core.WHITE);
        const sourceDragon = (cardState.markers || []).find((marker) => (marker &&
            marker.kind === 'specialStone' &&
            marker.row === 3 &&
            marker.col === 3 &&
            marker.data &&
            marker.data.type === 'DRAGON'));
        expect(sourceDragon).toBeTruthy();
        expect(sourceDragon.data.remainingOwnerTurns).toBe(2);
        const spawnedDragon = (cardState.markers || []).find((marker) => (marker &&
            marker.kind === 'specialStone' &&
            marker.row === 3 &&
            marker.col === 4 &&
            marker.data &&
            marker.data.type === 'DRAGON'));
        expect(spawnedDragon).toBeTruthy();
        expect(spawnedDragon.data.remainingOwnerTurns).toBe(2);
        const sourceBomb = (cardState.markers || []).find((marker) => (marker &&
            isBombMarker(marker) &&
            marker.row === 3 &&
            marker.col === 3));
        expect(sourceBomb).toBeTruthy();
        expect(sourceBomb.data.remainingTurns).toBe(1);
        const spawnedBomb = (cardState.markers || []).find((marker) => (marker &&
            isBombMarker(marker) &&
            marker.row === 3 &&
            marker.col === 4));
        expect(spawnedBomb).toBeTruthy();
        expect(spawnedBomb.data.remainingTurns).toBe(1);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('expansion stone can split into an adjacent main-board cell', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
        gameState.board[3][0] = Core.EMPTY;
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: Core.EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: [{ side: 'left', row: 3, col: -1, owner: Core.BLACK }]
        };
        cardState.markers.push({
            id: 2999,
            kind: 'specialStone',
            row: 3,
            col: -1,
            owner: 'black',
            data: { type: 'DRAGON', remainingOwnerTurns: 5 }
        });
        cardState.markers.push({
            ...createBombMarker(3000, 3, -1, 'black', 3)
        });
        cardState.pendingEffectByPlayer.black = {
            type: 'SPLIT_WILL',
            stage: 'selectTarget',
            cardId: 'split_expansion_01'
        };
        const targets = CardLogic.getSplitTargets(cardState, gameState, 'black');
        expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));
        const res = CardLogic.applySplitWill(cardState, gameState, 'black', 3, -1, createPrng(0));
        expect(res && res.applied).toBe(true);
        expect(res.spawned).toEqual([{ row: 3, col: 0 }]);
        expect(gameState.board[3][0]).toBe(Core.BLACK);
        const sourceDragon = cardState.markers.find((marker) => marker && marker.kind === 'specialStone' && marker.row === 3 && marker.col === -1 && marker.data && marker.data.type === 'DRAGON');
        const spawnedDragon = cardState.markers.find((marker) => marker && marker.kind === 'specialStone' && marker.row === 3 && marker.col === 0 && marker.data && marker.data.type === 'DRAGON');
        const sourceBomb = cardState.markers.find((marker) => marker && isBombMarker(marker) && marker.row === 3 && marker.col === -1);
        const spawnedBomb = cardState.markers.find((marker) => marker && isBombMarker(marker) && marker.row === 3 && marker.col === 0);
        expect(sourceDragon.data.remainingOwnerTurns).toBe(2);
        expect(spawnedDragon.data.remainingOwnerTurns).toBe(2);
        expect(sourceBomb.data.remainingTurns).toBe(1);
        expect(spawnedBomb.data.remainingTurns).toBe(1);
    });
});
//# sourceMappingURL=game.split-will.test.js.map