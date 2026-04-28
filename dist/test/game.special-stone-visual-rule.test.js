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
const Shared = __importStar(require("../shared-constants.js"));
const CardUtils = __importStar(require("../game/logic/cards/utils.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
function createCardState() {
    return {
        markers: [],
        pendingEffectByPlayer: { black: null, white: null }
    };
}
function createGameState() {
    return {
        board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
        currentPlayer: Shared.BLACK
    };
}
describe('special stone visual rule', () => {
    test('isSpecialStoneAt は通常石画像を使わない石を特殊石扱いする', () => {
        const cardState = createCardState();
        cardState.markers.push({
            id: 1,
            kind: 'specialStone',
            row: 1,
            col: 1,
            owner: 'white',
            data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 4 }
        }, {
            id: 2,
            kind: 'specialStone',
            row: 1,
            col: 2,
            owner: 'white',
            data: { type: 'PROTECTED', remainingOwnerTurns: 2 }
        }, {
            id: 3,
            kind: 'specialStone',
            row: 1,
            col: 3,
            owner: 'white',
            data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 }
        });
        expect(CardUtils.isSpecialStoneAt(cardState, 1, 1)).toBe(true);
        expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 1)).toBe(true);
        expect(CardUtils.getSpecialOwnerAt(cardState, 1, 1)).toBe('white');
        expect(CardUtils.isSpecialStoneAt(cardState, 1, 2)).toBe(true);
        expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 2)).toBe(true);
        expect(CardUtils.getSpecialOwnerAt(cardState, 1, 2)).toBe('white');
        expect(CardUtils.isSpecialStoneAt(cardState, 1, 3)).toBe(true);
        expect(CardUtils.isNonNormalStoneVisualAt(cardState, 1, 3)).toBe(true);
        expect(CardUtils.getSpecialOwnerAt(cardState, 1, 3)).toBe('white');
    });
    test('盤面では通常石見た目の hidden trap は特殊石扱いしない', () => {
        const cardState = createCardState();
        cardState.markers.push({
            id: 4,
            kind: 'specialStone',
            row: 2,
            col: 2,
            owner: 'white',
            data: { type: 'TRAP', hidden: true }
        });
        expect(CardUtils.isSpecialStoneAt(cardState, 2, 2)).toBe(false);
        expect(CardUtils.isNonNormalStoneVisualAt(cardState, 2, 2)).toBe(false);
        expect(CardUtils.getSpecialOwnerAt(cardState, 2, 2)).toBe(null);
    });
    test('GUARD は特殊石扱いし、BLOCKADE と METEOR_HOLE は特殊石扱いしない', () => {
        const cardState = createCardState();
        cardState.markers.push({
            id: 7,
            kind: 'specialStone',
            row: 2,
            col: 3,
            owner: 'white',
            data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }, {
            id: 8,
            kind: 'specialStone',
            row: 2,
            col: 4,
            owner: 'white',
            data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
        }, {
            id: 9,
            kind: 'specialStone',
            row: 2,
            col: 5,
            owner: 'white',
            data: { type: 'METEOR_HOLE' }
        });
        expect(CardUtils.isSpecialStoneAt(cardState, 2, 3)).toBe(true);
        expect(CardUtils.getSpecialOwnerAt(cardState, 2, 3)).toBe('white');
        expect(CardUtils.isSpecialStoneAt(cardState, 2, 4)).toBe(false);
        expect(CardUtils.isSpecialStoneAt(cardState, 2, 5)).toBe(false);
    });
    test('isNormalStoneForPlayer は hidden trap を通常石扱いする', () => {
        const cardState = createCardState();
        const gameState = createGameState();
        gameState.board[3][3] = Shared.BLACK;
        cardState.markers.push({
            id: 5,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'TRAP', hidden: true }
        });
        expect(CardUtils.isNormalStoneForPlayer(cardState, gameState, 'black', 3, 3)).toBe(true);
    });
    test('TEMPT_WILL は hidden trap を特殊石対象として選べない', () => {
        const prng = { shuffle: (arr) => arr, random: () => 0 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = createGameState();
        gameState.board[4][4] = Shared.WHITE;
        cardState.pendingEffectByPlayer.black = { type: 'TEMPT_WILL', stage: 'selectTarget', cardId: 'tempt_01' };
        cardState.markers.push({
            id: 6,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'white',
            data: { type: 'TRAP', hidden: true }
        });
        expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([]);
        const res = CardLogic.applyTemptWill(cardState, gameState, 'black', 4, 4);
        expect(res).toMatchObject({ applied: false, reason: 'not_special' });
    });
});
//# sourceMappingURL=game.special-stone-visual-rule.test.js.map