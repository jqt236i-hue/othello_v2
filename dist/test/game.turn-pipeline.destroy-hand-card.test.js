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
const Core = __importStar(require("../game/logic/core.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
describe('TurnPipeline destroy_hand_card', () => {
    function findHandRemoveEvent(presentationEvents, reason) {
        const events = Array.isArray(presentationEvents) ? presentationEvents : [];
        return events.find((e) => e && e.type === 'HAND_REMOVE' && (!reason || e.reason === reason));
    }
    test('手札破壊アクションで手札から1枚消える', () => {
        const gameState = Core.createGameState();
        const cardState = CardLogic.createCardState();
        const first = cardState.decks.black.shift();
        const second = cardState.decks.black.shift();
        cardState.hands.black.push(first, second);
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
            type: 'destroy_hand_card',
            destroyCardId: first
        });
        expect(res.cardState.hands.black).toContain(second);
        expect(res.cardState.hands.black).not.toContain(first);
        expect(res.cardState.discard).toContain(first);
        expect(res.cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
        expect(res.cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
        expect(res.gameState.currentPlayer).toBe(Core.BLACK);
        const handRemove = findHandRemoveEvent(res.presentationEvents, 'destroy_hand_card');
        expect(handRemove).toMatchObject({ player: 'black', count: 1, cardId: first });
    });
    test('同一ターンに手札破壊を複数回実行できる', () => {
        const gameState = Core.createGameState();
        const cardState = CardLogic.createCardState();
        const first = cardState.decks.black.shift();
        const second = cardState.decks.black.shift();
        const third = cardState.decks.black.shift();
        cardState.hands.black.push(first, second, third);
        const firstDestroy = TurnPipeline.applyTurn(cardState, gameState, 'black', {
            type: 'destroy_hand_card',
            destroyCardId: first
        });
        const secondDestroy = TurnPipeline.applyTurn(firstDestroy.cardState, firstDestroy.gameState, 'black', {
            type: 'destroy_hand_card',
            destroyCardId: second
        });
        expect(secondDestroy.cardState.hands.black).toContain(third);
        expect(secondDestroy.cardState.hands.black).not.toContain(first);
        expect(secondDestroy.cardState.hands.black).not.toContain(second);
        expect(secondDestroy.cardState.discard).toEqual(expect.arrayContaining([first, second]));
        expect(secondDestroy.cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
        expect(secondDestroy.gameState.currentPlayer).toBe(Core.BLACK);
        const handRemove = findHandRemoveEvent(secondDestroy.presentationEvents, 'destroy_hand_card');
        expect(handRemove).toMatchObject({ player: 'black', count: 1, cardId: second });
    });
    test('CONDEMN_WILL選択時に相手側HAND_REMOVEを出す', () => {
        const gameState = Core.createGameState();
        const cardState = CardLogic.createCardState();
        cardState.hands.black = [];
        cardState.hands.white = ['enemy_a', 'enemy_b'];
        cardState.pendingEffectByPlayer.black = {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [{ handIndex: 1, cardId: 'enemy_b' }]
        };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
            type: 'place',
            condemnTargetIndex: 1
        });
        expect(res.cardState.hands.white).toEqual(['enemy_a']);
        const handRemove = findHandRemoveEvent(res.presentationEvents, 'condemn_will');
        expect(handRemove).toMatchObject({ player: 'white', count: 1, cardId: 'enemy_b', cardIds: ['enemy_b'] });
    });
    test('TRAP_WILL発動時に被害側HAND_REMOVEを出す', () => {
        const gameState = Core.createGameState();
        const cardState = CardLogic.createCardState();
        gameState.board[0][0] = Core.WHITE;
        cardState.markers.push({
            id: 501,
            kind: 'specialStone',
            row: 0,
            col: 0,
            owner: 'black',
            data: { type: 'TRAP', hidden: true }
        });
        cardState.decks.white = [];
        cardState.hands.white = ['w1', 'w2', 'w3'];
        const res = TurnPipeline.applyTurn(cardState, gameState, 'white', { type: 'use_card' });
        expect(res.cardState.hands.white).toEqual([]);
        const handRemove = findHandRemoveEvent(res.presentationEvents, 'trap_will_triggered');
        expect(handRemove).toMatchObject({ player: 'white', count: 3 });
        expect(Array.isArray(handRemove.cardIds)).toBe(true);
        expect(handRemove.cardIds).toEqual(['w1', 'w2', 'w3']);
    });
    test('skipTurnStart prevents card use from redrawing and clearing used flag mid-turn', () => {
        const permaCardId = 'perma_01';
        const gameState = Core.createGameState();
        const cardState = CardLogic.createCardState({ shuffle: () => { }, random: () => 0.5 });
        cardState.turnIndex = 7;
        cardState.turnCountByPlayer.black = 0;
        cardState.hands.black = [permaCardId];
        cardState.decks.black = ['draw_should_not_happen'];
        cardState.charge.black = 15;
        cardState.hasUsedCardThisTurnByPlayer.black = false;
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: permaCardId, useCardOwnerKey: 'black' }, { shuffle: () => { }, random: () => 0.5 }, { skipTurnStart: true });
        expect(res.cardState.turnIndex).toBe(7);
        expect(res.cardState.turnCountByPlayer.black).toBe(0);
        expect(res.cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
        expect(res.cardState.hands.black).toEqual([]);
        expect(res.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'PERMA_PROTECT_NEXT_STONE' }));
    });
});
//# sourceMappingURL=game.turn-pipeline.destroy-hand-card.test.js.map