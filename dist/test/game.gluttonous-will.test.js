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
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
const CardLogic = __importStar(require("../game/logic/cards.js"));
const Shared = __importStar(require("../shared-constants.js"));
function createPrng(randomValue = 0) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
function createState(randomValue = 0) {
    const prng = createPrng(randomValue);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    return { cardState, gameState, prng };
}
describe('GLUTTONOUS_WILL（悪食の意志）', () => {
    test('カード使用時に残り手札を全破壊し、pendingは保持される', () => {
        const { cardState, gameState } = createState(0.25);
        cardState.debugNoDraw = true;
        cardState.hands.black = ['gluttonous_will_01', 'gold_stone', 'silver_stone'];
        cardState.charge.black = 99;
        const action = { type: 'use_card', useCardId: 'gluttonous_will_01' };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, createPrng(0.25));
        expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'gluttonous_will_01')).toBe(true);
        expect(res.events.some((e) => e && e.type === 'gluttonous_will_hand_destroyed' && e.destroyedCount === 2)).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toBeTruthy();
        expect(cardState.pendingEffectByPlayer.black.type).toBe('GLUTTONOUS_WILL');
        expect(cardState.hands.black).toEqual([]);
        expect(cardState.discard).toEqual(expect.arrayContaining(['gluttonous_will_01', 'gold_stone', 'silver_stone']));
        const handClearEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'HAND_CLEAR');
        expect(handClearEvents).toHaveLength(1);
        expect(handClearEvents[0]).toMatchObject({ player: 'black', count: 2, reason: 'gluttonous_will' });
    });
    test('配置時に悪食石マーカー（GLUTTONOUS）を付与する', () => {
        const { cardState, gameState } = createState(0.5);
        gameState.board[3][3] = Shared.BLACK;
        cardState.pendingEffectByPlayer.black = {
            type: 'GLUTTONOUS_WILL',
            stage: null,
            cardId: 'gluttonous_will_01'
        };
        const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
        expect(effects && effects.gluttonousPlaced).toBe(true);
        const marker = (cardState.markers || []).find((m) => (m &&
            m.kind === 'specialStone' &&
            m.row === 3 &&
            m.col === 3 &&
            m.owner === 'black' &&
            m.data &&
            m.data.type === 'GLUTTONOUS'));
        expect(marker).toBeTruthy();
        expect(marker.data.remainingOwnerTurns).toBeUndefined();
    });
    test('悪食石は反転保護リストに含まれる', () => {
        const { cardState, gameState } = createState(0.2);
        gameState.board[4][4] = Shared.BLACK;
        cardState.markers.push({
            id: 3150,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 }
        });
        const context = CardLogic.getCardContext(cardState);
        expect(Array.isArray(context.permaProtectedStones)).toBe(true);
        expect(context.permaProtectedStones.some((s) => s.row === 4 && s.col === 4 && s.owner === Shared.BLACK)).toBe(true);
    });
    test('ターン開始時に隣接敵石を優先して捕食移動する', () => {
        const { cardState, gameState } = createState(0.1);
        gameState.board[3][3] = Shared.BLACK;
        gameState.board[3][4] = Shared.WHITE;
        cardState.markers.push({
            id: 3101,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GLUTTONOUS' }
        });
        const events = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'black', events, createPrng(0.1));
        const movedEvent = events.find((ev) => ev && ev.type === 'hyperactive_moved_start');
        const destroyedEvent = events.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
        expect(movedEvent && movedEvent.details).toHaveLength(1);
        expect(destroyedEvent && destroyedEvent.details).toHaveLength(1);
        const move = movedEvent.details[0];
        expect(move.specialType).toBe('GLUTTONOUS');
        expect(move.from).toEqual({ row: 3, col: 3 });
        expect(move.to).toEqual({ row: 3, col: 4 });
        expect(gameState.board[3][3]).toBe(Shared.EMPTY);
        expect(gameState.board[3][4]).toBe(Shared.BLACK);
        const marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'GLUTTONOUS');
        expect(marker).toBeTruthy();
        expect(marker.row).toBe(3);
        expect(marker.col).toBe(4);
    });
    test('増殖石を捕食すると移動せずに増殖だけ発生し、捕食失敗扱いにはならない', () => {
        const { cardState, gameState } = createState(0);
        gameState.board[3][3] = Shared.BLACK;
        gameState.board[3][4] = Shared.WHITE;
        gameState.board[2][3] = Shared.EMPTY;
        cardState.markers.push({
            id: 3111,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GLUTTONOUS', gluttonousMissStreak: 1 }
        }, {
            id: 3112,
            kind: 'specialStone',
            row: 3,
            col: 4,
            owner: 'white',
            data: { type: 'PROLIFERATION' }
        });
        const events = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'black', events, createPrng(0));
        const movedEvent = events.find((ev) => ev && ev.type === 'hyperactive_moved_start');
        const destroyedEvent = events.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
        expect(movedEvent).toBeUndefined();
        expect(destroyedEvent).toBeUndefined();
        expect(gameState.board[3][3]).toBe(Shared.BLACK);
        expect(gameState.board[3][4]).toBe(Shared.WHITE);
        expect(gameState.board[2][3]).toBe(Shared.WHITE);
        const gluttonous = (cardState.markers || []).find((marker) => marker && marker.id === 3111);
        expect(gluttonous).toBeTruthy();
        expect(gluttonous.row).toBe(3);
        expect(gluttonous.col).toBe(3);
        expect(gluttonous.data.gluttonousMissStreak).toBe(0);
    });
    test('隣接敵石がない場合は2連続で捕食失敗した時に消滅する', () => {
        const { cardState, gameState } = createState(0);
        gameState.board[3][3] = Shared.BLACK;
        gameState.board[3][6] = Shared.WHITE;
        cardState.markers.push({
            id: 3201,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GLUTTONOUS' }
        });
        const firstEvents = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'black', firstEvents, createPrng(0));
        const firstMovedEvent = firstEvents.find((ev) => ev && ev.type === 'hyperactive_moved_start');
        const firstDestroyedEvent = firstEvents.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
        expect(firstMovedEvent && firstMovedEvent.details).toHaveLength(1);
        expect(firstDestroyedEvent).toBeUndefined();
        const firstMove = firstMovedEvent.details[0];
        expect(firstMove.specialType).toBe('GLUTTONOUS');
        const markerAfterFirstMiss = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'GLUTTONOUS');
        expect(markerAfterFirstMiss).toBeTruthy();
        expect(markerAfterFirstMiss.data && markerAfterFirstMiss.data.gluttonousMissStreak).toBe(1);
        gameState.currentPlayer = Shared.WHITE;
        gameState.turnNumber += 1;
        const secondEvents = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'white', secondEvents, createPrng(0));
        const secondMovedEvent = secondEvents.find((ev) => ev && ev.type === 'hyperactive_moved_start');
        const secondDestroyedEvent = secondEvents.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
        expect(secondMovedEvent && secondMovedEvent.details).toHaveLength(1);
        expect(secondDestroyedEvent && secondDestroyedEvent.details).toBeTruthy();
        const secondMove = secondMovedEvent.details[0];
        expect(secondMove.specialType).toBe('GLUTTONOUS');
        const destroyedAtMovedCell = (secondDestroyedEvent.details || []).some((d) => d && d.row === secondMove.to.row && d.col === secondMove.to.col);
        expect(destroyedAtMovedCell).toBe(true);
        expect(gameState.board[secondMove.to.row][secondMove.to.col]).toBe(Shared.EMPTY);
        const marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'GLUTTONOUS');
        expect(marker).toBeUndefined();
        expect(gameState.board[3][6]).toBe(Shared.WHITE);
    });
    test('悪食自身が完全保護中でも2連続捕食失敗で必ず消滅し、相手側の完全保護は維持される', () => {
        const { cardState, gameState } = createState(0);
        gameState.board[3][3] = Shared.BLACK;
        gameState.board[3][4] = Shared.WHITE;
        cardState.markers.push({
            id: 3301,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GLUTTONOUS' }
        }, {
            id: 3302,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }, {
            id: 3303,
            kind: 'specialStone',
            row: 3,
            col: 4,
            owner: 'white',
            data: { type: 'GUARD', remainingOwnerTurns: 3 }
        });
        const firstEvents = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'black', firstEvents, createPrng(0));
        const markerAfterFirstMiss = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'GLUTTONOUS');
        expect(markerAfterFirstMiss).toBeTruthy();
        expect(markerAfterFirstMiss.data && markerAfterFirstMiss.data.gluttonousMissStreak).toBe(1);
        expect(gameState.board[3][4]).toBe(Shared.WHITE);
        gameState.currentPlayer = Shared.WHITE;
        gameState.turnNumber += 1;
        const secondEvents = [];
        TurnPipelinePhases.applyTurnStartPhase(CardLogic, { BLACK: Shared.BLACK, WHITE: Shared.WHITE }, cardState, gameState, 'white', secondEvents, createPrng(0));
        const secondDestroyedEvent = secondEvents.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
        expect(secondDestroyedEvent && secondDestroyedEvent.details).toHaveLength(1);
        expect((cardState.markers || []).some((m) => m && m.owner === 'black' && m.data && m.data.type === 'GLUTTONOUS')).toBe(false);
        expect((cardState.markers || []).some((m) => m && m.owner === 'black' && m.data && m.data.type === 'GUARD')).toBe(false);
        expect(gameState.board[3][4]).toBe(Shared.WHITE);
        expect((cardState.markers || []).some((m) => m && m.owner === 'white' && m.row === 3 && m.col === 4 && m.data && m.data.type === 'GUARD')).toBe(true);
    });
});
//# sourceMappingURL=game.gluttonous-will.test.js.map