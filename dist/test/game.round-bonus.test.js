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
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
function createCardState() {
    return {
        charge: { black: 0, white: 0 },
        chargeGainedTotal: { black: 0, white: 0 },
        chargeDeltaEvents: [],
        _nextChargeDeltaSeq: 1,
        presentationEvents: [],
        _presentationEventsPersist: [],
        pendingEffectByPlayer: { black: null, white: null },
        lastTurnStartedFor: null,
        markers: []
    };
}
function createTurnStartCardLogic() {
    return {
        onTurnStart: jest.fn(() => null),
        emitPresentationEvent: jest.fn((cardState, ev) => {
            cardState.presentationEvents.push(ev);
        })
    };
}
describe('round bonus', () => {
    test('same player consecutive completed turns do not advance the round until the opponent also completes one', () => {
        const gameState = Core.createGameState();
        Core.advanceRoundAfterCompletedTurn(gameState, 'black');
        expect(gameState.roundNumber).toBe(1);
        expect(gameState.roundCompletionByPlayer).toEqual({ black: true, white: false });
        Core.advanceRoundAfterCompletedTurn(gameState, 'black');
        expect(gameState.roundNumber).toBe(1);
        expect(gameState.roundCompletionByPlayer).toEqual({ black: true, white: false });
        Core.advanceRoundAfterCompletedTurn(gameState, 'white');
        expect(gameState.roundNumber).toBe(2);
        expect(gameState.roundCompletionByPlayer).toEqual({ black: false, white: false });
        expect(gameState.pendingRoundBonus).toBeNull();
    });
    test('applyPass also advances the authoritative round state and schedules a round 10 bonus', () => {
        const gameState = Core.createGameState();
        gameState.currentPlayer = Core.WHITE;
        gameState.roundNumber = 9;
        gameState.roundCompletionByPlayer = { black: true, white: false };
        const nextState = Core.applyPass(gameState);
        expect(nextState.currentPlayer).toBe(Core.BLACK);
        expect(nextState.turnNumber).toBe(1);
        expect(nextState.roundNumber).toBe(10);
        expect(nextState.roundCompletionByPlayer).toEqual({ black: false, white: false });
        expect(nextState.pendingRoundBonus).toEqual({ roundNumber: 10, amount: 5 });
    });
    test('turn start consumes the pending bonus, grants both players charge, and emits the round banner', () => {
        const cardState = createCardState();
        const gameState = Core.createGameState();
        const CardLogic = createTurnStartCardLogic();
        const events = [];
        gameState.roundNumber = 10;
        gameState.pendingRoundBonus = { roundNumber: 10, amount: 5 };
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events);
        expect(cardState.charge).toEqual({ black: 5, white: 5 });
        expect(cardState.chargeGainedTotal).toEqual({ black: 5, white: 5 });
        expect(cardState.chargeDeltaEvents).toEqual([
            { seq: 1, player: 'black', before: 0, after: 5, delta: 5, reason: 'round_bonus' },
            { seq: 2, player: 'white', before: 0, after: 5, delta: 5, reason: 'round_bonus' }
        ]);
        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'round_bonus_gain',
                roundNumber: 10,
                amount: 5,
                gainedByPlayer: { black: 5, white: 5 }
            }),
            expect.objectContaining({ type: 'turn_start', player: 'black' })
        ]));
        expect(cardState.presentationEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'ROUND_BONUS_BANNER',
                roundNumber: 10,
                amount: 5,
                text: 'BONUS ROUND +5'
            })
        ]));
        expect(gameState.pendingRoundBonus).toBeNull();
        expect(CardLogic.onTurnStart).toHaveBeenCalledWith(cardState, 'black', gameState, undefined);
    });
});
//# sourceMappingURL=game.round-bonus.test.js.map