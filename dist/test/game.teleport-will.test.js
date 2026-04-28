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
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
describe('TELEPORT_WILL（テレポート）', () => {
    test('カード定義が存在し、コスト10である', () => {
        const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'TELEPORT_WILL');
        expect(def).toBeTruthy();
        expect(def.cost).toBe(10);
    });
    test('対象は敵味方を問わず盤面の全石。移動先が無い場合は対象がない', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
        gameState.board[1][1] = Core.BLACK;
        gameState.board[2][2] = Core.WHITE;
        const targets = CardLogic.getTeleportTargets(cardState, gameState);
        expect(targets).toEqual([{ row: 1, col: 1 }, { row: 2, col: 2 }]);
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK));
        const noTargets = CardLogic.getTeleportTargets(cardState, gameState);
        expect(noTargets).toEqual([]);
    });
    test('選んだ石をランダム空きマスへ移動し、マーカーも追従する（反転なし）', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
        gameState.board[4][4] = Core.BLACK;
        gameState.board[1][1] = Core.EMPTY;
        gameState.board[2][2] = Core.EMPTY;
        // 1,1 は封鎖中にして移動先候補から除外
        cardState.markers.push({
            id: 'blockade_1',
            kind: 'specialStone',
            row: 1,
            col: 1,
            owner: 'black',
            data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
        });
        cardState.markers.push({
            id: 'bomb_1',
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 }
        });
        cardState.stoneIdMap[4][4] = 'tp1';
        cardState.stoneIdMap[2][2] = null;
        cardState.pendingEffectByPlayer.black = {
            type: 'TELEPORT_WILL',
            stage: 'selectTarget',
            cardId: 'teleport_01'
        };
        const res = CardLogic.applyTeleportWill(cardState, gameState, 'black', 4, 4, createPrng(0));
        expect(res && res.applied).toBe(true);
        expect(res.from).toEqual({ row: 4, col: 4 });
        expect(res.to).toEqual({ row: 2, col: 2 });
        expect(gameState.board[4][4]).toBe(Core.EMPTY);
        expect(gameState.board[2][2]).toBe(Core.BLACK);
        expect(cardState.stoneIdMap[4][4]).toBeNull();
        expect(cardState.stoneIdMap[2][2]).toBe('tp1');
        const movedBomb = cardState.markers.find((m) => m && m.id === 'bomb_1');
        expect(movedBomb).toBeTruthy();
        expect(movedBomb.row).toBe(2);
        expect(movedBomb.col).toBe(2);
        const moveEvents = (cardState._presentationEventsPersist || []).filter((ev) => ev && ev.type === 'MOVE');
        expect(moveEvents.length).toBeGreaterThanOrEqual(1);
        expect(moveEvents[0].cause).toBe('TELEPORT_WILL');
        expect(moveEvents[0].reason).toBe('teleport_move');
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('occupied expansion cell is a teleport target and can move onto the main board', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
        gameState.board[4][0] = Core.EMPTY;
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: Core.EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: [{ side: 'left', row: 4, col: -1, owner: Core.BLACK }]
        };
        const targets = CardLogic.getTeleportTargets(cardState, gameState);
        expect(targets).toEqual(expect.arrayContaining([{ row: 4, col: -1 }]));
        cardState.pendingEffectByPlayer.black = {
            type: 'TELEPORT_WILL',
            stage: 'selectTarget',
            cardId: 'teleport_expansion_source_01'
        };
        const res = CardLogic.applyTeleportWill(cardState, gameState, 'black', 4, -1, createPrng(0));
        expect(res && res.applied).toBe(true);
        expect(res.from).toEqual({ row: 4, col: -1 });
        expect(res.to).toEqual({ row: 4, col: 0 });
        expect(gameState.board[4][0]).toBe(Core.BLACK);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 4 && cell.col === -1).owner).toBe(Core.EMPTY);
    });
    test('empty expansion cell can be chosen as the only teleport destination', () => {
        const cardState = CardLogic.createCardState(createPrng());
        const gameState = Core.createGameState();
        gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
        gameState.board[3][3] = Core.BLACK;
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: Core.EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: [{ side: 'left', row: 3, col: -1, owner: Core.EMPTY }]
        };
        cardState.pendingEffectByPlayer.black = {
            type: 'TELEPORT_WILL',
            stage: 'selectTarget',
            cardId: 'teleport_expansion_dest_01'
        };
        const res = CardLogic.applyTeleportWill(cardState, gameState, 'black', 3, 3, createPrng(0));
        expect(res && res.applied).toBe(true);
        expect(res.to).toEqual({ row: 3, col: -1 });
        expect(gameState.board[3][3]).toBe(Core.EMPTY);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(Core.BLACK);
    });
});
//# sourceMappingURL=game.teleport-will.test.js.map