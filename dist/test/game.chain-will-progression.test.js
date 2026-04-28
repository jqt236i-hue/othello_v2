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
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const chain_test_helpers_js_1 = require("./helpers/chain-test-helpers.js");
const PRNG = { shuffle: (arr) => arr, random: () => 0.5 };
function makeInitialState() {
    const cardState = CardLogic.createCardState(PRNG);
    cardState.debugNoDraw = true;
    const gameState = {
        board: Array(8).fill(null).map(() => Array(8).fill(0)),
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;
    gameState.board[4][3] = Shared.BLACK;
    gameState.board[4][4] = Shared.WHITE;
    return { cardState, gameState };
}
describe('chain-will escalation progression', () => {
    test('using DOUBLE_CHAIN_WILL immediately adds TRIPLE_CHAIN_WILL to hand and emits HAND_ADD', () => {
        const { cardState } = makeInitialState();
        cardState.charge.black = 30;
        cardState.hands.black = ['double_chain_01'];
        const used = CardLogic.applyCardUsage(cardState, 'black', 'double_chain_01');
        expect(used).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'DOUBLE_CHAIN_WILL' });
        expect(cardState.hands.black).toEqual(['triple_chain_01']);
        const pres = CardLogic.flushPresentationEvents(cardState);
        expect(pres.map((ev) => ev.type)).toEqual(['CARD_USED', 'HAND_ADD']);
        expect(pres[1]).toMatchObject({
            type: 'HAND_ADD',
            player: 'black',
            cardId: 'triple_chain_01',
            reason: 'generated_throw_chain',
            meta: expect.objectContaining({
                sourceType: 'DOUBLE_CHAIN_WILL',
                generatedType: 'TRIPLE_CHAIN_WILL',
                generatedName: '三連鎖の意志'
            })
        });
    });
    test('using QUAD_CHAIN_WILL immediately adds INFINITE_CHAIN_WILL to hand', () => {
        const { cardState } = makeInitialState();
        cardState.charge.black = 30;
        cardState.hands.black = ['quad_chain_01'];
        const used = CardLogic.applyCardUsage(cardState, 'black', 'quad_chain_01');
        expect(used).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'QUAD_CHAIN_WILL' });
        expect(cardState.hands.black).toEqual(['infinite_chain_01']);
        const pres = CardLogic.flushPresentationEvents(cardState);
        expect(pres[1]).toMatchObject({
            type: 'HAND_ADD',
            cardId: 'infinite_chain_01',
            meta: expect.objectContaining({
                sourceType: 'QUAD_CHAIN_WILL',
                generatedType: 'INFINITE_CHAIN_WILL',
                generatedName: '無限連鎖の意志'
            })
        });
    });
    test('using INFINITE_CHAIN_WILL does not add another follow-up card', () => {
        const { cardState } = makeInitialState();
        cardState.charge.black = 60;
        cardState.hands.black = ['infinite_chain_01'];
        const used = CardLogic.applyCardUsage(cardState, 'black', 'infinite_chain_01');
        expect(used).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'INFINITE_CHAIN_WILL' });
        expect(cardState.hands.black).toEqual([]);
        const pres = CardLogic.flushPresentationEvents(cardState);
        expect(pres.map((ev) => ev.type)).toEqual(['CARD_USED']);
    });
    test('INFINITE_CHAIN_WILL continues beyond the quad tier when another link exists', () => {
        const { cardState, gameState } = (0, chain_test_helpers_js_1.makeState)(CardLogic, Shared);
        cardState.pendingEffectByPlayer.black = { type: 'INFINITE_CHAIN_WILL', cardId: 'infinite_chain_01', stage: null };
        (0, chain_test_helpers_js_1.placeStones)(gameState, [
            [0, 1, Shared.WHITE],
            [0, 2, Shared.BLACK],
            [1, 1, Shared.WHITE],
            [2, 1, Shared.BLACK],
            [1, 2, Shared.WHITE],
            [1, 3, Shared.BLACK],
            [2, 2, Shared.WHITE],
            [3, 2, Shared.BLACK],
            [2, 3, Shared.WHITE],
            [2, 4, Shared.BLACK]
        ]);
        const prng = { random: () => 0, shuffle: (arr) => arr };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
        expect(res.gameState.board[0][1]).toBe(Shared.BLACK);
        expect(res.gameState.board[1][1]).toBe(Shared.BLACK);
        expect(res.gameState.board[1][2]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][2]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][3]).toBe(Shared.BLACK);
        const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
        expect(chainEvent).toBeTruthy();
        expect(chainEvent.details).toEqual(expect.arrayContaining([
            { row: 1, col: 1 },
            { row: 1, col: 2 },
            { row: 2, col: 2 },
            { row: 2, col: 3 }
        ]));
    });
});
//# sourceMappingURL=game.chain-will-progression.test.js.map