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
function makeState() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
        currentPlayer: Shared.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    return { cardState, gameState };
}
describe('TABOO_REVERSE_WILL（禁忌の反転）', () => {
    test('applyCardUsage arms pending effect without target selection', () => {
        const { cardState, gameState } = makeState();
        const def = (Shared.CARD_DEFS || []).find((card) => card && card.id === 'taboo_reverse_01');
        expect(def).toBeTruthy();
        cardState.hands.black.push(def.id);
        cardState.charge.black = Number(def.cost || 0);
        const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
        expect(ok).toBe(true);
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({
            type: 'TABOO_REVERSE_WILL',
            stage: null,
            cardId: def.id
        });
    });
    test('prioritizes taboo reverse over normal flips and uses only the best one direction', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[3][3] = Shared.WHITE;
        gameState.board[4][3] = Shared.BLACK;
        gameState.board[2][4] = Shared.WHITE;
        gameState.board[2][5] = Shared.WHITE;
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });
        expect(res.gameState.board[3][3]).toBe(Shared.WHITE);
        expect(res.gameState.board[2][4]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][5]).toBe(Shared.BLACK);
        const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
        expect(tabooEvent).toBeTruthy();
        expect(tabooEvent.details).toHaveLength(2);
        expect(tabooEvent.direction).toEqual([0, 1]);
        expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('falls back to normal flips when taboo reverse is unavailable at that cell', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[3][3] = Shared.WHITE;
        gameState.board[4][3] = Shared.BLACK;
        const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, 'black', 2, 3);
        expect(candidates).toHaveLength(0);
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });
        expect(res.gameState.board[3][3]).toBe(Shared.BLACK);
        expect(res.events.some((ev) => ev && ev.type === 'taboo_reverse_flipped')).toBe(false);
        expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
    });
    test('frozen enemy stone blocks taboo reverse candidates', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        cardState.markers = [
            { kind: 'specialStone', row: 2, col: 5, owner: 'white', data: { type: 'FREEZE', remainingOwnerTurns: 5 } }
        ];
        gameState.board[2][4] = Shared.WHITE;
        gameState.board[2][5] = Shared.WHITE;
        const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, 'black', 2, 3);
        expect(candidates).toHaveLength(0);
    });
    test('bypasses protected and guard stones but leaves ABSOLUTE_PROTECTED unchanged in the same taboo line', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[2][4] = Shared.WHITE;
        gameState.board[2][5] = Shared.WHITE;
        gameState.board[2][6] = Shared.WHITE;
        gameState.board[2][7] = Shared.WHITE;
        cardState.markers = [
            { kind: 'specialStone', row: 2, col: 4, owner: 'white', data: { type: 'PROTECTED', expiresForPlayer: 'white' } },
            { kind: 'specialStone', row: 2, col: 5, owner: 'white', data: { type: 'PERMA_PROTECTED' } },
            { kind: 'specialStone', row: 2, col: 6, owner: 'white', data: { type: 'ABSOLUTE_PROTECTED' } },
            { kind: 'specialStone', row: 2, col: 7, owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
        ];
        const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, 'black', 2, 3);
        expect(candidates).toEqual([
            expect.objectContaining({
                direction: [0, 1],
                score: 3,
                flips: [
                    { row: 2, col: 4 },
                    { row: 2, col: 5 },
                    { row: 2, col: 7 }
                ]
            })
        ]);
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });
        expect(res.gameState.board[2][4]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][5]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][6]).toBe(Shared.WHITE);
        expect(res.gameState.board[2][7]).toBe(Shared.BLACK);
        expect(cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({ row: 2, col: 4, owner: 'black', data: expect.objectContaining({ type: 'PROTECTED', expiresForPlayer: 'black' }) }),
            expect.objectContaining({ row: 2, col: 5, owner: 'black', data: expect.objectContaining({ type: 'PERMA_PROTECTED' }) }),
            expect.objectContaining({ row: 2, col: 6, owner: 'white', data: expect.objectContaining({ type: 'ABSOLUTE_PROTECTED' }) }),
            expect.objectContaining({ row: 2, col: 7, owner: 'black', data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 3 }) })
        ]));
        const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
        expect(tabooEvent).toBeTruthy();
        expect(tabooEvent.details).toEqual([
            { row: 2, col: 4 },
            { row: 2, col: 5 },
            { row: 2, col: 7 }
        ]);
    });
    test('bypasses ghost and transfers marker ownership for ghost and bomb stones', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[2][4] = Shared.WHITE;
        gameState.board[2][5] = Shared.WHITE;
        cardState.markers = [
            { kind: 'specialStone', row: 2, col: 4, owner: 'white', data: { type: 'GHOST', remainingOwnerTurns: 5 } },
            { kind: 'specialStone', row: 2, col: 5, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
        ];
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });
        expect(res.gameState.board[2][4]).toBe(Shared.BLACK);
        expect(res.gameState.board[2][5]).toBe(Shared.BLACK);
        expect(cardState.markers).toEqual(expect.arrayContaining([
            expect.objectContaining({ row: 2, col: 4, owner: 'black', data: expect.objectContaining({ type: 'GHOST', remainingOwnerTurns: 5 }) }),
            expect.objectContaining({ row: 2, col: 5, owner: 'black', data: expect.objectContaining({ type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 }) })
        ]));
        const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
        expect(tabooEvent).toBeTruthy();
        expect(tabooEvent.details).toEqual([
            { row: 2, col: 4 },
            { row: 2, col: 5 }
        ]);
    });
    test('allows placement with zero normal flips and reverses only the longest enemy line', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[3][4] = Shared.WHITE;
        gameState.board[3][5] = Shared.WHITE;
        gameState.board[3][6] = Shared.WHITE;
        gameState.board[4][2] = Shared.WHITE;
        gameState.board[5][1] = Shared.WHITE;
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 });
        expect(res.gameState.board[3][4]).toBe(Shared.BLACK);
        expect(res.gameState.board[3][5]).toBe(Shared.BLACK);
        expect(res.gameState.board[3][6]).toBe(Shared.BLACK);
        expect(res.gameState.board[4][2]).toBe(Shared.WHITE);
        expect(res.gameState.board[5][1]).toBe(Shared.WHITE);
        const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
        expect(tabooEvent).toBeTruthy();
        expect(Array.isArray(tabooEvent.details)).toBe(true);
        expect(tabooEvent.details).toHaveLength(3);
    });
    test('breaks ties randomly among longest lines (deterministic with injected PRNG)', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        gameState.board[3][1] = Shared.WHITE;
        gameState.board[3][2] = Shared.WHITE;
        gameState.board[3][4] = Shared.WHITE;
        gameState.board[3][5] = Shared.WHITE;
        const prng = { shuffle: (arr) => arr, random: () => 0.9 };
        const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 }, prng);
        expect(res.gameState.board[3][4]).toBe(Shared.BLACK);
        expect(res.gameState.board[3][5]).toBe(Shared.BLACK);
        expect(res.gameState.board[3][1]).toBe(Shared.WHITE);
        expect(res.gameState.board[3][2]).toBe(Shared.WHITE);
        const tabooEvent = res.events.find((ev) => ev && ev.type === 'taboo_reverse_flipped');
        expect(tabooEvent).toBeTruthy();
        expect(tabooEvent.direction).toEqual([0, 1]);
    });
    test('rejects move when no taboo direction candidate exists', () => {
        const { cardState, gameState } = makeState();
        cardState.pendingEffectByPlayer.black = { type: 'TABOO_REVERSE_WILL', cardId: 'taboo_reverse_01', stage: null };
        expect(() => {
            TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 3, col: 3 });
        }).toThrow('Illegal move: no flips and not free placement');
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'TABOO_REVERSE_WILL' });
        expect(gameState.board[3][3]).toBe(Shared.EMPTY);
    });
});
//# sourceMappingURL=game.taboo-reverse-will.test.js.map