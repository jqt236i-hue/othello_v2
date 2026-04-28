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
const SharedConstants = __importStar(require("../shared-constants.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const DeckSpecHelpers = __importStar(require("../shared/deck-spec.js"));
const SeededPRNG = __importStar(require("../game/schema/prng.js"));
describe('CardLogic commitDraw reshuffle cycle policy', () => {
    test('default deck uses 30 unique enabled cards and shares contents while shuffling order per player', () => {
        const prng = SeededPRNG.createPRNG(7);
        const cardState = CardLogic.createCardState(prng);
        const enabledIds = (SharedConstants.CARD_DEFS || [])
            .filter((card) => card && card.enabled !== false && card.id)
            .map((card) => card.id);
        const enabledIdSet = new Set(enabledIds);
        const expectedDeckSize = DeckSpecHelpers.getDefaultDeckSize();
        expect(cardState.initialDeckSize).toBe(expectedDeckSize);
        expect(cardState.decks.black).toHaveLength(expectedDeckSize);
        expect(cardState.decks.white).toHaveLength(expectedDeckSize);
        expect(new Set(cardState.decks.black).size).toBe(expectedDeckSize);
        expect(new Set(cardState.decks.white).size).toBe(expectedDeckSize);
        expect(cardState.decks.black.every((cardId) => enabledIdSet.has(cardId))).toBe(true);
        expect(cardState.decks.white.every((cardId) => enabledIdSet.has(cardId))).toBe(true);
        expect(cardState.decks.black.slice().sort()).toEqual(cardState.decks.white.slice().sort());
        expect(cardState.decks.black).not.toEqual(cardState.decks.white);
    });
    test('does not reshuffle when deck is empty even if discard has cards', () => {
        const ids = (SharedConstants.CARD_DEFS || []).map(c => c.id);
        expect(ids.length).toBeGreaterThan(0);
        const prng = { shuffle: jest.fn(), random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        prng.shuffle.mockClear();
        cardState.decks.black = [];
        cardState.discard = ids.slice(0, 10);
        cardState.hands.black = [];
        const drawn = CardLogic.commitDraw(cardState, 'black', prng);
        expect(drawn).toBeNull();
        expect(cardState.decks.black).toHaveLength(0);
        expect(cardState.discard).toHaveLength(10);
        expect(prng.shuffle).not.toHaveBeenCalled();
    });
    test('normal draws from initial deck do not repeat card ids before deck is exhausted', () => {
        const prng = { shuffle: (arr) => arr, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng);
        cardState.hands.black = [];
        const seen = new Set();
        while (cardState.decks.black.length > 0) {
            const drawn = CardLogic.commitDraw(cardState, 'black', prng);
            expect(drawn).toBeTruthy();
            expect(seen.has(drawn)).toBe(false);
            seen.add(drawn);
            // keep drawing without hand-cap interference
            cardState.hands.black = [];
        }
        expect(seen.size).toBe(cardState.initialDeckSizeByPlayer.black);
    });
    test('different seeds reroll the default deck contents', () => {
        const firstState = CardLogic.createCardState(SeededPRNG.createPRNG(7), {});
        const secondState = CardLogic.createCardState(SeededPRNG.createPRNG(8), {});
        expect(firstState.decks.black.slice().sort()).not.toEqual(secondState.decks.black.slice().sort());
    });
    test('custom initialDeckSpec initializes both players with the requested 30-card deck', () => {
        const enabledIds = (SharedConstants.CARD_DEFS || [])
            .filter((card) => card && card.enabled !== false && card.id)
            .map((card) => card.id)
            .slice(0, 10);
        expect(enabledIds).toHaveLength(10);
        const customDeckIds = enabledIds.flatMap((cardId) => [cardId, cardId, cardId]);
        const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(customDeckIds);
        const prng = { shuffle: (arr) => arr, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng, { initialDeckSpec: deckSpec });
        expect(cardState.initialDeckSize).toBe(30);
        expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
        expect(cardState.initialDeckSizeByPlayer.white).toBe(30);
        expect(cardState.decks.black).toHaveLength(30);
        expect(cardState.decks.white).toHaveLength(30);
        expect(cardState.decks.black).toEqual(customDeckIds);
        expect(cardState.decks.white).toEqual(customDeckIds);
        expect(cardState.decks.black.filter((cardId) => cardId === enabledIds[0])).toHaveLength(3);
        expect(cardState.decks.white.filter((cardId) => cardId === enabledIds[0])).toHaveLength(3);
    });
    test('initialDeckCardIdsByPlayer accepts duplicate-heavy story encounter decks', () => {
        const storyDeckIds = Array(15).fill('perma_01').concat(Array(15).fill('observer_01'));
        const prng = { shuffle: (arr) => arr, random: () => 0.5 };
        const cardState = CardLogic.createCardState(prng, {
            initialDeckCardIdsByPlayer: {
                black: storyDeckIds
            }
        });
        expect(cardState.initialDeckSize).toBe(30);
        expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
        expect(cardState.decks.black).toEqual(storyDeckIds);
        expect(cardState.decks.black.filter((cardId) => cardId === 'perma_01')).toHaveLength(15);
        expect(cardState.decks.black.filter((cardId) => cardId === 'observer_01')).toHaveLength(15);
        expect(cardState.decks.white).toHaveLength(cardState.initialDeckSizeByPlayer.white);
        expect(new Set(cardState.decks.white).size).toBe(cardState.initialDeckSizeByPlayer.white);
    });
});
//# sourceMappingURL=game.cards.reshuffle-cycle.test.js.map