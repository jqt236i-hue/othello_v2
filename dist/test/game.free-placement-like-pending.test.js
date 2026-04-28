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
const TurnPipelinePhases = __importStar(require("../game/turn/turn_pipeline_phases.js"));
const BoardOps = __importStar(require("../game/logic/board_ops.js"));
function createPrng(randomValue = 0.5) {
    return {
        shuffle: (arr) => arr,
        random: () => randomValue
    };
}
function createStates(randomValue = 0.5) {
    const cardState = CardLogic.createCardState(createPrng(randomValue));
    const gameState = {
        board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
        currentPlayer: Core.BLACK,
        turnNumber: 1,
        consecutivePasses: 0
    };
    return { cardState, gameState };
}
describe('free-placement-like pending cards', () => {
    beforeEach(() => {
        jest.resetModules();
        global.BLACK = Core.BLACK;
        global.WHITE = Core.WHITE;
        global.EMPTY = Core.EMPTY;
        global.CoreLogic = Core;
        global.CardLogic = CardLogic;
        global.getFlips = (state, row, col, player, protection, perma) => Core.getFlipsWithContext(state, row, col, player, {
            protectedStones: protection || [],
            permaProtectedStones: perma || []
        });
    });
    afterEach(() => {
        jest.restoreAllMocks();
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
        delete global.CoreLogic;
        delete global.CardLogic;
        delete global.getFlips;
        delete global.gameState;
        delete global.cardState;
    });
    test.each([
        ['ULTIMATE_REVERSE_DRAGON', 'DRAGON'],
        ['ULTIMATE_DESTROY_GOD', 'ULTIMATE_DESTROY_GOD']
    ])('generateMovesForPlayer treats %s as free placement', (pendingType) => {
        const { cardState, gameState } = createStates();
        global.cardState = cardState;
        global.gameState = gameState;
        import * as MoveGenerator from '../game/move-generator.js';
        const moves = MoveGenerator.generateMovesForPlayer(Core.BLACK, {
            type: pendingType,
            stage: null,
            cardId: pendingType.toLowerCase()
        }, [], []);
        expect(moves).toHaveLength(64);
        expect(moves).toContainEqual(expect.objectContaining({
            row: 0,
            col: 0,
            effectUsed: pendingType,
            player: Core.BLACK
        }));
        expect(moves.every((move) => Array.isArray(move.flips) && move.flips.length === 0)).toBe(true);
    });
    test.each([
        ['ULTIMATE_REVERSE_DRAGON', 'DRAGON'],
        ['ULTIMATE_DESTROY_GOD', 'ULTIMATE_DESTROY_GOD']
    ])('applyActionPhase allows zero-flip placement for %s without FREE_PLACEMENT spawn metadata', (pendingType, markerType) => {
        const { cardState, gameState } = createStates();
        cardState.pendingEffectByPlayer.black = {
            type: pendingType,
            stage: null,
            cardId: pendingType.toLowerCase()
        };
        const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');
        try {
            TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, [], createPrng(), BoardOps);
        }
        finally {
            expect(spawnSpy).toHaveBeenCalled();
            const first = spawnSpy.mock.calls[0];
            expect(first[5]).toBe('SYSTEM');
            expect(first[6]).toBe('standard_place');
            spawnSpy.mockRestore();
        }
        expect(gameState.board[0][0]).toBe(Core.BLACK);
        expect((cardState.markers || []).some((marker) => (marker &&
            marker.kind === 'specialStone' &&
            marker.row === 0 &&
            marker.col === 0 &&
            marker.owner === 'black' &&
            marker.data &&
            marker.data.type === markerType))).toBe(true);
    });
    test('ULTIMATE_REVERSE_DRAGON converts adjacent enemy stones immediately on placement while respecting protected cells', () => {
        const { cardState, gameState } = createStates();
        cardState.pendingEffectByPlayer.black = {
            type: 'ULTIMATE_REVERSE_DRAGON',
            stage: null,
            cardId: 'ultimate_reverse_dragon_01'
        };
        gameState.board[3][3] = Core.WHITE;
        gameState.board[4][5] = Core.WHITE;
        gameState.board[5][4] = Core.WHITE;
        gameState.board[5][5] = Core.WHITE;
        cardState.markers.push({
            id: 901,
            kind: 'specialStone',
            row: 5,
            col: 5,
            owner: 'white',
            data: { type: 'FREEZE', remainingOwnerTurns: 2 }
        });
        const events = [];
        TurnPipelinePhases.applyActionPhase(CardLogic, Core, cardState, gameState, 'black', { type: 'place', row: 4, col: 4 }, events, createPrng(), BoardOps);
        expect(gameState.board[4][4]).toBe(Core.BLACK);
        expect(gameState.board[3][3]).toBe(Core.BLACK);
        expect(gameState.board[4][5]).toBe(Core.BLACK);
        expect(gameState.board[5][4]).toBe(Core.BLACK);
        expect(gameState.board[5][5]).toBe(Core.WHITE);
        expect(cardState.charge.black).toBe(3);
        expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'dragon_converted_immediate',
                details: expect.arrayContaining([
                    expect.objectContaining({ row: 3, col: 3 }),
                    expect.objectContaining({ row: 4, col: 5 }),
                    expect.objectContaining({ row: 5, col: 4 })
                ])
            })
        ]));
        expect((cardState.markers || []).some((marker) => (marker &&
            marker.kind === 'specialStone' &&
            marker.row === 4 &&
            marker.col === 4 &&
            marker.owner === 'black' &&
            marker.data &&
            marker.data.type === 'DRAGON' &&
            marker.data.remainingOwnerTurns === CardLogic.ULTIMATE_DRAGON_TURNS))).toBe(true);
    });
});
//# sourceMappingURL=game.free-placement-like-pending.test.js.map