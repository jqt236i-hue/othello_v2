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
const SharedConstants = __importStar(require("../shared-constants.js"));
describe('POSITION_SWAP_WILL (入替の意志)', () => {
    function makeState() {
        const prng = { shuffle: () => { }, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            currentPlayer: 1
        };
        return { cardState, gameState };
    }
    test('applyCardUsage requires at least two occupied cells', () => {
        const { cardState, gameState } = makeState();
        const def = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'POSITION_SWAP_WILL');
        expect(def).toBeTruthy();
        cardState.hands.black = [def.id];
        cardState.charge.black = 30;
        gameState.board[2][2] = 1;
        const fail = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(fail).toBe(false);
        gameState.board[4][4] = -1;
        const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(ok).toBe(true);
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('POSITION_SWAP_WILL');
    });
    test('applyCardUsage counts occupied expansion cells toward the minimum', () => {
        const { cardState, gameState } = makeState();
        const def = (SharedConstants.CARD_DEFS || []).find(d => d && d.type === 'POSITION_SWAP_WILL');
        expect(def).toBeTruthy();
        cardState.hands.black = [def.id];
        cardState.charge.black = 30;
        gameState.board[2][2] = 1;
        gameState.boardExpansion = {
            active: true,
            side: 'bottom',
            row: 8,
            owner: -1,
            usedByPlayer: { black: true, white: false },
            cells: [{ side: 'bottom', row: 8, col: 2, owner: -1 }]
        };
        const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(ok).toBe(true);
        expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('POSITION_SWAP_WILL');
    });
    test('getSelectableTargets excludes first selected cell', () => {
        const { cardState, gameState } = makeState();
        gameState.board[1][1] = 1;
        gameState.board[2][2] = -1;
        gameState.board[3][3] = 1;
        cardState.pendingEffectByPlayer.black = {
            type: 'POSITION_SWAP_WILL',
            stage: 'selectTarget',
            firstTarget: { row: 2, col: 2 }
        };
        const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
        const set = new Set(targets.map(t => `${t.row},${t.col}`));
        expect(set.has('1,1')).toBe(true);
        expect(set.has('3,3')).toBe(true);
        expect(set.has('2,2')).toBe(false);
    });
    test('second selection swaps board, markers, and stone ids', () => {
        const { cardState, gameState } = makeState();
        gameState.board[2][2] = 1;
        gameState.board[5][5] = -1;
        cardState.stoneIdMap[2][2] = 'sa';
        cardState.stoneIdMap[5][5] = 'sb';
        cardState.markers.push({
            id: 101,
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'black',
            data: { type: 'DRAGON', remainingOwnerTurns: 3 }
        });
        cardState.markers.push({
            id: 102,
            kind: 'specialStone',
            row: 5,
            col: 5,
            owner: 'white',
            data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 }
        });
        cardState.workAnchorPosByPlayer.black = { row: 2, col: 2 };
        cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' };
        const first = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 2, 2);
        expect(first && first.applied).toBe(true);
        expect(first && first.completed).toBe(false);
        const second = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 5, 5);
        expect(second && second.applied).toBe(true);
        expect(second && second.completed).toBe(true);
        expect(gameState.board[2][2]).toBe(-1);
        expect(gameState.board[5][5]).toBe(1);
        expect(cardState.stoneIdMap[2][2]).toBe('sb');
        expect(cardState.stoneIdMap[5][5]).toBe('sa');
        const dragon = cardState.markers.find(m => m && m.id === 101);
        const bomb = cardState.markers.find(m => m && m.id === 102);
        expect(dragon.row).toBe(5);
        expect(dragon.col).toBe(5);
        expect(bomb.row).toBe(2);
        expect(bomb.col).toBe(2);
        expect(cardState.workAnchorPosByPlayer.black).toEqual({ row: 5, col: 5 });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('GLUTTONOUS石はPOSITION_SWAP_WILLの交換対象にならない', () => {
        const { cardState, gameState } = makeState();
        gameState.board[1][1] = 1;
        gameState.board[2][2] = -1;
        gameState.board[3][3] = 1;
        cardState.markers.push({
            id: 210,
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'white',
            data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 }
        });
        cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' };
        const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
        const set = new Set(targets.map((t) => `${t.row},${t.col}`));
        expect(set.has('1,1')).toBe(true);
        expect(set.has('3,3')).toBe(true);
        expect(set.has('2,2')).toBe(false);
        const blockedFirst = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 2, 2);
        expect(blockedFirst).toMatchObject({ applied: false, reason: 'swap_protected' });
        expect(cardState.pendingEffectByPlayer.black.firstTarget).toBeUndefined();
        const first = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 1, 1);
        expect(first && first.applied).toBe(true);
        expect(first && first.completed).toBe(false);
        const blockedSecond = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 2, 2);
        expect(blockedSecond).toMatchObject({ applied: false, reason: 'swap_protected' });
        expect(cardState.pendingEffectByPlayer.black.firstTarget).toEqual({ row: 1, col: 1 });
        expect(gameState.board[1][1]).toBe(1);
        expect(gameState.board[2][2]).toBe(-1);
    });
    test('expansion cell can be selected and swapped with a main-board stone', () => {
        const { cardState, gameState } = makeState();
        gameState.board[5][5] = 1;
        gameState.boardExpansion = {
            active: true,
            side: 'left',
            row: 2,
            owner: -1,
            usedByPlayer: { black: false, white: false },
            cells: [{ side: 'left', row: 2, col: -1, owner: -1 }]
        };
        cardState.stoneIdMap[5][5] = 'main-stone';
        cardState.expansionStoneIdByCell = { '2,-1': 'exp-stone' };
        cardState.markers.push({
            id: 301,
            kind: 'specialStone',
            row: 2,
            col: -1,
            owner: 'white',
            data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 }
        });
        cardState.pendingEffectByPlayer.black = { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', cardId: 'position_swap_01' };
        const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
        expect(targets).toEqual(expect.arrayContaining([{ row: 2, col: -1 }, { row: 5, col: 5 }]));
        const first = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 2, -1);
        expect(first).toMatchObject({ applied: true, completed: false, firstTarget: { row: 2, col: -1 } });
        const second = CardLogic.applyPositionSwapWill(cardState, gameState, 'black', 5, 5);
        expect(second).toMatchObject({ applied: true, completed: true, from: { row: 2, col: -1 }, to: { row: 5, col: 5 } });
        expect(gameState.board[5][5]).toBe(-1);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 2 && cell.col === -1).owner).toBe(1);
        expect(cardState.stoneIdMap[5][5]).toBe('exp-stone');
        expect(cardState.expansionStoneIdByCell['2,-1']).toBe('main-stone');
        const movedBomb = cardState.markers.find((marker) => marker && marker.id === 301);
        expect(movedBomb).toMatchObject({ row: 5, col: 5 });
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
    });
});
//# sourceMappingURL=game.position-swap-will.test.js.map