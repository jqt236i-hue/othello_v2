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
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
describe('SUPPLY_WILL (補給の意志)', () => {
    function makeState() {
        const prng = { shuffle: () => { }, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            currentPlayer: 1,
            turnNumber: 1,
            consecutivePasses: 0
        };
        return { cardState, gameState };
    }
    test('use card: draws 2 cards immediately', () => {
        const { cardState, gameState } = makeState();
        cardState.debugNoDraw = true;
        cardState.hands.black = ['supply_01', 'gold_stone'];
        cardState.decks.black = ['deck_a', 'deck_b', 'deck_c'];
        cardState.charge.black = 1;
        const action = { type: 'use_card', useCardId: 'supply_01' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'supply_01')).toBe(true);
        expect(res.events.some((e) => e && e.type === 'supply_will_resolved' && e.drawnCount === 2)).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(cardState.charge.black).toBe(0);
        expect(cardState.hands.black).toEqual(['gold_stone', 'deck_c', 'deck_b']);
        expect(cardState.discard).toEqual(expect.arrayContaining(['supply_01']));
        const handClearEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'HAND_CLEAR');
        const drawEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'DRAW_CARD');
        expect(handClearEvents).toHaveLength(0);
        expect(drawEvents).toHaveLength(2);
    });
    test('use card: hand limit remains 5', () => {
        const { cardState, gameState } = makeState();
        cardState.debugNoDraw = true;
        cardState.hands.black = ['supply_01', 'gold_stone', 'silver_stone', 'hard_01', 'work_01'];
        cardState.decks.black = ['deck_a', 'deck_b'];
        cardState.charge.black = 1;
        const action = { type: 'use_card', useCardId: 'supply_01' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        expect(res.events.some((e) => e && e.type === 'supply_will_resolved' && e.drawnCount === 1)).toBe(true);
        expect(cardState.hands.black).toEqual(['gold_stone', 'silver_stone', 'hard_01', 'work_01', 'deck_b']);
        expect(cardState.hands.black).toHaveLength(5);
        const drawEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'DRAW_CARD');
        expect(drawEvents).toHaveLength(1);
    });
});
//# sourceMappingURL=game.supply-will.test.js.map