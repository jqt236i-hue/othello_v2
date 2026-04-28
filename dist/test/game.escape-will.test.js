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
const Core = __importStar(require("../game/logic/core.js"));
const BoardOps = __importStar(require("../game/logic/board_ops.js"));
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
describe('ESCAPE_WILL（逃げる意志）', () => {
    function makePrng(randomValue = 0) {
        return {
            shuffle: (arr) => arr,
            random: () => randomValue
        };
    }
    function createEmptyBoard() {
        return Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    }
    test('applyPlacementEffects で逃亡石マーカーを付与する', () => {
        const prng = makePrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
        gameState.board[3][3] = Core.BLACK;
        cardState.pendingEffectByPlayer.black = {
            type: 'ESCAPE_WILL',
            stage: null,
            cardId: 'escape_01'
        };
        const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
        expect(effects && effects.hyperactivePlaced).toBe(true);
        expect(effects && effects.escapeHyperactivePlaced).toBe(true);
        const marker = (cardState.markers || []).find((m) => (m &&
            m.kind === 'specialStone' &&
            m.row === 3 &&
            m.col === 3 &&
            m.owner === 'black' &&
            m.data &&
            m.data.type === 'ESCAPE_HYPERACTIVE'));
        expect(marker).toBeTruthy();
    });
    test('近くの石から逃げる方向へ移動する', () => {
        const prng = makePrng(0.99);
        const cardState = CardLogic.createCardState(prng);
        const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
        gameState.board[3][3] = Core.BLACK;
        gameState.board[3][4] = Core.WHITE;
        cardState.markers.push({
            id: 101,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5 }
        });
        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, prng);
        expect(res && res.moved && res.moved.length).toBe(1);
        expect(res.moved[0].from).toEqual({ row: 3, col: 3 });
        expect(res.moved[0].to).toEqual({ row: 2, col: 2 });
        expect(res.moved[0].specialType).toBe('ESCAPE_HYPERACTIVE');
        expect(gameState.board[3][3]).toBe(Core.EMPTY);
        expect(gameState.board[2][2]).toBe(Core.BLACK);
    });
    test('移動先が無い場合は周囲8マスを爆破して消滅する', () => {
        const prng = makePrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
        gameState.board[3][3] = Core.BLACK;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                gameState.board[3 + dr][3 + dc] = Core.WHITE;
            }
        }
        cardState.markers.push({
            id: 102,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'black',
            data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5 }
        });
        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, prng);
        expect(res && res.moved).toHaveLength(0);
        expect(res && res.destroyed).toHaveLength(9);
        const destroyedSet = new Set((res.destroyed || []).map((p) => `${p.row},${p.col}`));
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const row = 3 + dr;
                const col = 3 + dc;
                expect(gameState.board[row][col]).toBe(Core.EMPTY);
                expect(destroyedSet.has(`${row},${col}`)).toBe(true);
            }
        }
        const marker = (cardState.markers || []).find((m) => (m && m.kind === 'specialStone' && m.data && m.data.type === 'ESCAPE_HYPERACTIVE'));
        expect(marker).toBeUndefined();
    });
    test('反転対象時は1回だけ回避し、同列の他石は通常反転される', () => {
        const prng = makePrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        gameState.board = createEmptyBoard();
        gameState.currentPlayer = Core.WHITE;
        gameState.board[3][3] = Core.WHITE;
        gameState.board[3][4] = Core.WHITE;
        gameState.board[3][5] = Core.BLACK;
        gameState.board[2][3] = Core.BLACK;
        gameState.board[2][4] = Core.BLACK;
        gameState.board[4][2] = Core.BLACK;
        gameState.board[4][3] = Core.BLACK;
        gameState.board[4][4] = Core.BLACK;
        cardState.markers.push({
            id: 103,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'white',
            data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 }
        });
        const events = [];
        TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, 'black', { type: 'place', row: 3, col: 2 }, events, prng, BoardOps);
        expect(gameState.board[3][2]).toBe(Core.BLACK);
        expect(gameState.board[3][3]).toBe(Core.EMPTY);
        expect(gameState.board[2][2]).toBe(Core.WHITE);
        expect(gameState.board[3][4]).toBe(Core.BLACK);
        const marker = (cardState.markers || []).find((m) => (m && m.kind === 'specialStone' && m.data && m.data.type === 'ESCAPE_HYPERACTIVE'));
        expect(marker).toBeTruthy();
        expect(marker.row).toBe(2);
        expect(marker.col).toBe(2);
        expect(marker.data.flipEvadeRemaining).toBe(0);
        const movedEvent = events.find((ev) => ev && ev.type === 'hyperactive_moved_immediate');
        expect(movedEvent).toBeTruthy();
        expect(Array.isArray(movedEvent.details)).toBe(true);
        expect(movedEvent.details[0].specialType).toBe('ESCAPE_HYPERACTIVE');
        const placeEvent = events.find((ev) => ev && ev.type === 'place');
        expect(placeEvent).toBeTruthy();
        expect(placeEvent.flips).toEqual([[3, 4]]);
    });
    test('expansion cell can be chosen as an escape destination', () => {
        const prng = makePrng(0.99);
        const cardState = CardLogic.createCardState(prng);
        const gameState = { board: createEmptyBoard(), currentPlayer: Core.BLACK };
        gameState.board[3][0] = Core.BLACK;
        gameState.board[3][1] = Core.WHITE;
        gameState.board[2][0] = Core.WHITE;
        gameState.board[2][1] = Core.WHITE;
        gameState.board[4][0] = Core.WHITE;
        gameState.board[4][1] = Core.WHITE;
        gameState.boardExpansion = {
            active: false,
            side: null,
            row: null,
            owner: Core.EMPTY,
            usedByPlayer: { black: false, white: false },
            cells: [{ side: 'left', row: 3, col: -1, owner: Core.EMPTY }]
        };
        cardState.markers.push({
            id: 190,
            kind: 'specialStone',
            row: 3,
            col: 0,
            owner: 'black',
            data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5 }
        });
        const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 0, prng);
        expect(res && res.moved && res.moved.length).toBe(1);
        expect(res.moved[0].to).toEqual({ row: 3, col: -1 });
        expect(gameState.board[3][0]).toBe(Core.EMPTY);
        expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 3 && cell.col === -1).owner).toBe(Core.BLACK);
    });
    test('回避を使い切った逃亡石は通常どおり反転される', () => {
        const prng = makePrng();
        const cardState = CardLogic.createCardState(prng);
        const gameState = Core.createGameState();
        gameState.board = createEmptyBoard();
        gameState.currentPlayer = Core.WHITE;
        gameState.board[3][3] = Core.WHITE;
        gameState.board[3][4] = Core.BLACK;
        cardState.markers.push({
            id: 104,
            kind: 'specialStone',
            row: 3,
            col: 3,
            owner: 'white',
            data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 0 }
        });
        const events = [];
        TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, 'black', { type: 'place', row: 3, col: 2 }, events, prng, BoardOps);
        expect(gameState.board[3][3]).toBe(Core.BLACK);
        const marker = (cardState.markers || []).find((m) => (m && m.kind === 'specialStone' && m.data && m.data.type === 'ESCAPE_HYPERACTIVE'));
        expect(marker).toBeUndefined();
    });
});
//# sourceMappingURL=game.escape-will.test.js.map