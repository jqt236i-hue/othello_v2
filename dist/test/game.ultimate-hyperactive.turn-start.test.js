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
const CardLogic = __importStar(require("../game/logic/cards.js"));
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
describe('ULTIMATE_HYPERACTIVE turn-start integration', () => {
    test('emits move/flip events and grants charge from flipped stones', () => {
        const prng = { shuffle: (arr) => arr, random: () => 0.1 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            currentPlayer: 1
        };
        cardState.charge.black = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                gameState.board[r][c] = 1;
            }
        }
        // Ultimate anchor at (3,3) for black.
        gameState.board[3][3] = 1;
        gameState.board[3][6] = 0;
        gameState.board[3][5] = -1;
        cardState.markers.push({
            id: 1,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'ULTIMATE_HYPERACTIVE' }
        });
        const events = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: 1, WHITE: -1 }, cardState, gameState, 'black', events, { random: () => 0.1 });
        const types = new Set(events.map(ev => ev && ev.type));
        expect(types.has('ultimate_hyperactive_moved_start')).toBe(true);
        expect(types.has('ultimate_hyperactive_flipped_start')).toBe(true);
        expect(types.has('ultimate_hyperactive_blown_start')).toBe(false);
        expect(cardState.charge.black).toBeGreaterThanOrEqual(1);
        const movedEvent = events.find((ev) => ev && ev.type === 'ultimate_hyperactive_moved_start');
        const lastMove = movedEvent && Array.isArray(movedEvent.details) ? movedEvent.details[movedEvent.details.length - 1] : null;
        const presentationEvents = CardLogic.flushPresentationEvents(cardState);
        const bubble = (presentationEvents || []).find((ev) => ev && ev.type === 'CHARGE_BUBBLE' && ev.meta && ev.meta.sourceType === 'ultimate_hyperactive_turn_start');
        expect(lastMove && lastMove.to).toBeTruthy();
        expect(bubble).toBeTruthy();
        expect({ row: bubble.row, col: bubble.col }).toEqual(lastMove.to);
    });
    test('duration decrements only on owner turn', () => {
        const prng = { shuffle: (arr) => arr, random: () => 0.1 };
        const cardState = CardLogic.createCardState(prng);
        const gameState = {
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            currentPlayer: -1
        };
        gameState.board[3][3] = 1;
        cardState.markers.push({
            id: 100,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 }
        });
        const eventsWhite = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: 1, WHITE: -1 }, cardState, gameState, 'white', eventsWhite, { random: () => 0.1 });
        let marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
        expect(marker).toBeTruthy();
        expect(marker.data.remainingOwnerTurns).toBe(10);
        const eventsBlack = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: 1, WHITE: -1 }, cardState, gameState, 'black', eventsBlack, { random: () => 0.1 });
        marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
        expect(marker).toBeTruthy();
        expect(marker.data.remainingOwnerTurns).toBe(9);
    });
});
//# sourceMappingURL=game.ultimate-hyperactive.turn-start.test.js.map