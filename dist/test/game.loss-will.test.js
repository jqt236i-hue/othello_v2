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
const TurnPipeline = __importStar(require("../game/turn/turn_pipeline.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const LOSS_WILL_DEF = (SharedConstants.CARD_DEFS || []).find((card) => card && card.id === 'loss_will_01');
const LOSS_WILL_COST = Number(LOSS_WILL_DEF && LOSS_WILL_DEF.cost);
if (!Number.isFinite(LOSS_WILL_COST)) {
    throw new Error('loss_will_01 cost missing');
}
describe('LOSS_WILL（意志の喪失）', () => {
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
    test('use card: 完全保護マスは除外し、それ以外の特殊石と爆弾を通常石へ戻す', () => {
        const { cardState, gameState } = makeState();
        cardState.hands.black = ['loss_will_01'];
        cardState.charge.black = LOSS_WILL_COST;
        gameState.board[2][2] = 1;
        gameState.board[3][3] = -1;
        gameState.board[4][4] = 1;
        cardState.markers = [
            { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'GUARD', remainingOwnerTurns: 2 } },
            { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'WORK', remainingOwnerTurns: 4 } },
            { id: 3, row: 3, col: 3, kind: 'specialStone', owner: 'white', createdSeq: 3, data: { type: 'WORK', remainingOwnerTurns: 4 } },
            { id: 4, row: 4, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 4, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
        ];
        cardState._nextMarkerId = 5;
        cardState._nextCreatedSeq = 5;
        cardState.presentationEvents = [];
        const action = { type: 'use_card', useCardId: 'loss_will_01' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'loss_will_01')).toBe(true);
        expect(res.events.some((e) => e && e.type === 'loss_will_resolved' && e.removedCount === 2)).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toBeNull();
        const specials = (cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && (!m.data || m.data.category !== 'bomb'));
        const bombs = (cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb');
        expect(specials).toHaveLength(2);
        expect(specials.some((m) => m.row === 2 && m.col === 2 && m.data && m.data.type === 'GUARD')).toBe(true);
        expect(specials.some((m) => m.row === 2 && m.col === 2 && m.data && m.data.type === 'WORK')).toBe(true);
        expect(specials.some((m) => m.row === 3 && m.col === 3)).toBe(false);
        expect(bombs).toHaveLength(0);
        expect(gameState.board[2][2]).toBe(1);
        expect(gameState.board[3][3]).toBe(-1);
        expect(gameState.board[4][4]).toBe(1);
        const removedEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'STATUS_REMOVED' && e.reason === 'loss_will_reset');
        expect(removedEvents).toHaveLength(2);
        expect(removedEvents.some((e) => e.row === 3 && e.col === 3)).toBe(true);
        expect(removedEvents.some((e) => e.row === 4 && e.col === 4)).toBe(true);
        expect(removedEvents.every((e) => e.cause === 'LOSS_WILL')).toBe(true);
    });
    test('use card: 特殊石が無い場合でも爆弾は解除される', () => {
        const { cardState, gameState } = makeState();
        cardState.hands.black = ['loss_will_01'];
        cardState.charge.black = LOSS_WILL_COST;
        gameState.board[4][4] = 1;
        cardState.markers = [
            { id: 1, row: 4, col: 4, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
        ];
        cardState._nextMarkerId = 2;
        cardState._nextCreatedSeq = 2;
        const action = { type: 'use_card', useCardId: 'loss_will_01' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        expect(res.events.some((e) => e && e.type === 'loss_will_resolved' && e.removedCount === 1)).toBe(true);
        const removedEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'STATUS_REMOVED' && e.reason === 'loss_will_reset');
        expect(removedEvents).toHaveLength(1);
        expect((cardState.markers || []).filter((m) => m && m.kind === 'specialStone' && m.data && m.data.category === 'bomb')).toHaveLength(0);
    });
    test('特殊石も爆弾もない場合は使用できない', () => {
        const { cardState, gameState } = makeState();
        cardState.hands.black = ['loss_will_01'];
        cardState.charge.black = LOSS_WILL_COST;
        cardState.markers = [];
        const action = { type: 'use_card', useCardId: 'loss_will_01' };
        expect(() => {
            TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        }).toThrow('applyCardUsage failed');
        // Card was not consumed
        expect(cardState.hands.black).toContain('loss_will_01');
        expect(cardState.charge.black).toBe(LOSS_WILL_COST);
    });
    test('全特殊石がGUARD保護下で除去対象ゼロの場合は使用できない', () => {
        const { cardState, gameState } = makeState();
        cardState.hands.black = ['loss_will_01'];
        cardState.charge.black = LOSS_WILL_COST;
        gameState.board[2][2] = 1;
        // GUARD on (2,2) protects the WORK on the same cell
        cardState.markers = [
            { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'GUARD', remainingOwnerTurns: 2 } },
            { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'WORK', remainingOwnerTurns: 4 } }
        ];
        cardState._nextMarkerId = 3;
        cardState._nextCreatedSeq = 3;
        const action = { type: 'use_card', useCardId: 'loss_will_01' };
        expect(() => {
            TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => { }, random: () => 0.5 });
        }).toThrow('applyCardUsage failed');
        expect(cardState.hands.black).toContain('loss_will_01');
    });
});
//# sourceMappingURL=game.loss-will.test.js.map