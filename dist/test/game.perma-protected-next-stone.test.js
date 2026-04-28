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
const Core = __importStar(require("../game/logic/core.js"));
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
function createEmptyGameState() {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.turnNumber = 1;
    gameState.consecutivePasses = 0;
    return gameState;
}
function getPermaProtectNextStoneDef() {
    return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'PERMA_PROTECT_NEXT_STONE');
}
function findSpecialMarker(cardState, row, col) {
    return (cardState.markers || []).find((marker) => (marker &&
        marker.kind === 'specialStone' &&
        marker.row === row &&
        marker.col === col));
}
describe('PERMA_PROTECT_NEXT_STONE（強い意志）', () => {
    test('use card -> place creates PERMA_PROTECTED marker with promotion metadata', () => {
        const def = getPermaProtectNextStoneDef();
        expect(def).toBeTruthy();
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        cardState.debugNoDraw = true;
        cardState.hands.black = [def.id];
        cardState.charge.black = def.cost;
        gameState.board[2][4] = Core.WHITE;
        gameState.board[2][5] = Core.BLACK;
        gameState.board[2][6] = Core.WHITE;
        const useRes = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
        expect(useRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'card_used', player: 'black', cardId: def.id })
        ]));
        expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'PERMA_PROTECT_NEXT_STONE' }));
        const placeRes = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });
        expect(placeRes.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'placement_effects',
                player: 'black',
                effects: expect.objectContaining({ permaProtected: true })
            })
        ]));
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        const marker = findSpecialMarker(cardState, 2, 3);
        expect(marker).toBeTruthy();
        expect(marker.owner).toBe('black');
        expect(marker.data).toEqual(expect.objectContaining({
            type: 'PERMA_PROTECTED',
            strongWillPromotionOwnerTurnStarts: 0,
            strongWillPromotionThreshold: SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS
        }));
        const withoutProtectionContext = {
            ...CardLogic.getCardContext(cardState),
            protectedStones: [],
            permaProtectedStones: []
        };
        expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, withoutProtectionContext)).toEqual([
            [2, 3],
            [2, 4],
            [2, 5]
        ]);
        expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, CardLogic.getCardContext(cardState))).toEqual([]);
    });
    test('owner turn starts promote PERMA_PROTECTED into ABSOLUTE_PROTECTED on the 10th owner start', () => {
        const def = getPermaProtectNextStoneDef();
        expect(def).toBeTruthy();
        const promotionTurns = SharedConstants.STRONG_WILL_PROMOTION_OWNER_TURNS;
        const prng = createPrng(0);
        const cardState = CardLogic.createCardState(prng);
        const gameState = createEmptyGameState();
        cardState.debugNoDraw = true;
        cardState.hands.black = [def.id];
        cardState.charge.black = def.cost;
        gameState.board[2][4] = Core.WHITE;
        gameState.board[2][5] = Core.BLACK;
        gameState.board[2][6] = Core.WHITE;
        TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
        TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });
        cardState.presentationEvents = [];
        for (let i = 0; i < promotionTurns - 1; i += 1) {
            CardLogic.onTurnStart(cardState, 'white', gameState, prng);
            let marker = findSpecialMarker(cardState, 2, 3);
            expect(marker.data.type).toBe('PERMA_PROTECTED');
            expect(marker.data.strongWillPromotionOwnerTurnStarts).toBe(i);
            CardLogic.onTurnStart(cardState, 'black', gameState, prng);
            marker = findSpecialMarker(cardState, 2, 3);
            expect(marker.data.type).toBe('PERMA_PROTECTED');
            expect(marker.data.strongWillPromotionOwnerTurnStarts).toBe(i + 1);
        }
        CardLogic.onTurnStart(cardState, 'white', gameState, prng);
        let marker = findSpecialMarker(cardState, 2, 3);
        expect(marker.data.type).toBe('PERMA_PROTECTED');
        expect(marker.data.strongWillPromotionOwnerTurnStarts).toBe(promotionTurns - 1);
        CardLogic.onTurnStart(cardState, 'black', gameState, prng);
        marker = findSpecialMarker(cardState, 2, 3);
        expect(marker).toBeTruthy();
        expect(marker.data.type).toBe('ABSOLUTE_PROTECTED');
        expect(marker.data.strongWillPromotionOwnerTurnStarts).toBeUndefined();
        expect(marker.data.strongWillPromotionThreshold).toBeUndefined();
        const markerCount = (cardState.markers || []).filter((entry) => (entry &&
            entry.kind === 'specialStone' &&
            entry.row === 2 &&
            entry.col === 3)).length;
        expect(markerCount).toBe(1);
        expect(CardLogic.isAbsoluteProtectedCell(cardState, 2, 3)).toBe(true);
        const promotionEvent = (cardState.presentationEvents || []).find((event) => (event &&
            event.type === 'STATUS_APPLIED' &&
            event.reason === 'strong_will_promoted'));
        expect(promotionEvent).toEqual(expect.objectContaining({
            type: 'STATUS_APPLIED',
            row: 2,
            col: 3,
            reason: 'strong_will_promoted',
            meta: expect.objectContaining({
                special: 'ABSOLUTE_PROTECTED',
                promotedFrom: 'PERMA_PROTECTED'
            })
        }));
    });
});
//# sourceMappingURL=game.perma-protected-next-stone.test.js.map