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
const MatchAuthority = __importStar(require("../utils/match-authority.js"));
function createPrng() {
    return {
        shuffle: (arr) => arr,
        random: () => 0.5
    };
}
function createStates() {
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    cardState.charge.black = 30;
    cardState.charge.white = 30;
    return { prng, cardState, gameState };
}
function projectForSeat(cardState, seatKey) {
    return MatchAuthority.projectSnapshotForViewer({
        stateVersion: 1,
        gameState: { currentPlayer: Shared.BLACK },
        cardState: CardLogic.copyCardState(cardState)
    }, seatKey);
}
describe('REVEAL_HAND_WILL (観測の意志)', () => {
    const revealHandCard = Shared.CARD_DEFS.find((card) => card && card.type === 'REVEAL_HAND_WILL');
    test('reveals only the opponent hand at use time and keeps future duplicate draws hidden', () => {
        expect(revealHandCard).toBeTruthy();
        const { prng, cardState } = createStates();
        cardState.hands.black = [revealHandCard.id];
        cardState.hands.white = ['silver_stone', 'gold_stone'];
        cardState.decks.white = ['silver_stone'];
        CardLogic.ensureCardCopyState(cardState);
        expect(CardLogic.applyCardUsage(cardState, 'black', revealHandCard.id)).toBe(true);
        expect(CardLogic.applyRevealHandWill(cardState, 'black')).toMatchObject({
            applied: true,
            opponentKey: 'white',
            revealedCount: 2
        });
        expect(projectForSeat(cardState, 'black').cardState.hands.white).toEqual(['silver_stone', 'gold_stone']);
        expect(CardLogic.destroyHandCard(cardState, 'white', 'silver_stone').applied).toBe(true);
        expect(CardLogic.commitDraw(cardState, 'white', prng)).toBe('silver_stone');
        expect(projectForSeat(cardState, 'black').cardState.hands.white).toEqual([
            'gold_stone',
            '__hidden_hand__:white:1'
        ]);
        expect(projectForSeat(cardState, 'white').cardState.hands.white).toEqual(['gold_stone', 'silver_stone']);
    });
    test('keeps the same revealed card copy visible after it leaves hand and returns', () => {
        expect(revealHandCard).toBeTruthy();
        const { cardState } = createStates();
        cardState.hands.black = [revealHandCard.id];
        cardState.hands.white = ['gold_stone'];
        CardLogic.ensureCardCopyState(cardState);
        expect(CardLogic.applyCardUsage(cardState, 'black', revealHandCard.id)).toBe(true);
        expect(CardLogic.applyRevealHandWill(cardState, 'black').applied).toBe(true);
        const originalCopyId = CardLogic.getHandCopyIdAt(cardState, 'white', 0);
        expect(Number.isInteger(originalCopyId)).toBe(true);
        const destroyed = CardLogic.destroyHandCard(cardState, 'white', 'gold_stone');
        expect(destroyed).toMatchObject({ applied: true, destroyedCardId: 'gold_stone', destroyedCardCopyId: originalCopyId });
        const restored = CardLogic.moveDiscardCardToHandByCardId(cardState, 'white', 'gold_stone', { ignoreHandLimit: true });
        expect(restored).toMatchObject({ cardId: 'gold_stone', cardCopyId: originalCopyId });
        expect(projectForSeat(cardState, 'black').cardState.hands.white).toEqual(['gold_stone']);
    });
    test('turn pipeline resolves immediately and clears pending state', () => {
        expect(revealHandCard).toBeTruthy();
        const { prng, cardState, gameState } = createStates();
        cardState.debugNoDraw = true;
        cardState.hands.black = [revealHandCard.id];
        cardState.hands.white = ['silver_stone', 'gold_stone'];
        const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: revealHandCard.id }, prng, { skipTurnStart: true });
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'reveal_hand_will_resolved',
                player: 'black',
                opponent: 'white',
                revealedCount: 2
            })
        ]));
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        expect(projectForSeat(cardState, 'black').cardState.hands.white).toEqual(['silver_stone', 'gold_stone']);
    });
});
//# sourceMappingURL=game.reveal-hand-will.test.js.map