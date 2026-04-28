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
function createState() {
    const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
    cardState.charge.black = 30;
    cardState.charge.white = 30;
    return cardState;
}
describe('CONDEMN_WILL core behavior', () => {
    test('reveals opponent hand offers and destroys selected card by hand index', () => {
        const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
        expect(condemn).toBeTruthy();
        const cs = createState();
        cs.hands.black = [condemn.id];
        cs.hands.white = ['silver_stone', 'silver_stone', 'gold_stone'];
        const used = CardLogic.applyCardUsage(cs, 'black', condemn.id);
        expect(used).toBe(true);
        const pending = cs.pendingEffectByPlayer.black;
        expect(pending).toBeTruthy();
        expect(pending.type).toBe('CONDEMN_WILL');
        expect(Array.isArray(pending.offers)).toBe(true);
        expect(pending.offers.length).toBe(3);
        expect(pending.offers[1]).toEqual({ handIndex: 1, cardId: 'silver_stone' });
        const result = CardLogic.applyCondemnWill(cs, 'black', 1);
        expect(result.applied).toBe(true);
        expect(result.destroyedCardId).toBe('silver_stone');
        expect(cs.pendingEffectByPlayer.black).toBeNull();
        expect(cs.hands.white).toEqual(['silver_stone', 'gold_stone']);
        expect(cs.discard.includes(condemn.id)).toBe(true);
        expect(cs.discard.includes('silver_stone')).toBe(true);
    });
    test('cannot use when opponent hand is empty', () => {
        const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
        expect(condemn).toBeTruthy();
        const cs = createState();
        cs.hands.black = [condemn.id];
        cs.hands.white = [];
        const used = CardLogic.applyCardUsage(cs, 'black', condemn.id);
        expect(used).toBe(false);
        expect(cs.pendingEffectByPlayer.black).toBeNull();
    });
    test('applies by hand index even when opponent hand value is hidden token', () => {
        const cs = createState();
        cs.hands.black = [];
        cs.hands.white = ['__hidden_hand__:white:0'];
        cs.pendingEffectByPlayer.black = {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [{ handIndex: 0, cardId: 'gold_stone' }]
        };
        const result = CardLogic.applyCondemnWill(cs, 'black', 0);
        expect(result.applied).toBe(true);
        expect(result.destroyedCardId).toBe('gold_stone');
        expect(cs.pendingEffectByPlayer.black).toBeNull();
        expect(cs.hands.white).toEqual([]);
        expect(cs.discard).toContain('__hidden_hand__:white:0');
    });
    test('applies by hand index even when stored offer card id is stale', () => {
        const cs = createState();
        cs.hands.black = [];
        cs.hands.white = ['meteor_will'];
        cs.pendingEffectByPlayer.black = {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [{ handIndex: 0, cardId: 'silver_stone' }]
        };
        const result = CardLogic.applyCondemnWill(cs, 'black', 0);
        expect(result.applied).toBe(true);
        expect(result.destroyedCardId).toBe('meteor_will');
        expect(cs.pendingEffectByPlayer.black).toBeNull();
        expect(cs.hands.white).toEqual([]);
        expect(cs.discard).toContain('meteor_will');
    });
    test('clears selected card state after condemn resolution', () => {
        const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
        expect(condemn).toBeTruthy();
        const cs = createState();
        cs.hands.black = [condemn.id];
        cs.hands.white = ['silver_stone', 'gold_stone'];
        cs.selectedCardId = 'gold_stone';
        cs.selectedCardOwnerKey = 'white';
        const used = CardLogic.applyCardUsage(cs, 'black', condemn.id);
        expect(used).toBe(true);
        const result = CardLogic.applyCondemnWill(cs, 'black', 1);
        expect(result.applied).toBe(true);
        expect(cs.selectedCardId).toBeNull();
        expect(cs.selectedCardOwnerKey).toBeNull();
    });
    test('turn pipeline resolves condemn selection action and emits opponent hand removal', () => {
        const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
        expect(condemn).toBeTruthy();
        const prng = { shuffle: (arr) => arr, random: () => 0.5 };
        const cs = CardLogic.createCardState(prng);
        const gs = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            currentPlayer: Shared.BLACK,
            turnNumber: 1,
            consecutivePasses: 0
        };
        cs.debugNoDraw = true;
        cs.charge.black = 30;
        cs.hands.black = [condemn.id];
        cs.hands.white = ['silver_stone', 'gold_stone'];
        TurnPipeline.applyTurn(cs, gs, 'black', { type: 'use_card', useCardId: condemn.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
        const selectRes = TurnPipeline.applyTurn(cs, gs, 'black', { type: 'place', condemnTargetIndex: 1 }, prng, { skipTurnStart: true });
        expect(selectRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'condemn_selected',
                player: 'black',
                condemnTargetIndex: 1,
                applied: true,
                destroyedCardId: 'gold_stone'
            })
        ]));
        expect(selectRes.presentationEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'HAND_REMOVE',
                player: 'white',
                count: 1,
                reason: 'condemn_will',
                cardId: 'gold_stone'
            })
        ]));
        expect(cs.pendingEffectByPlayer.black).toBeNull();
        expect(cs.hands.white).toEqual(['silver_stone']);
        expect(gs.board.flat().every((cell) => cell === 0)).toBe(true);
    });
});
//# sourceMappingURL=game.condemn-will.test.js.map