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
const SelectorOrchestrator = __importStar(require("../game/logic/cards-internal/selector-orchestrator.js"));
function createBoard(rows = 10, cols = rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}
function createExpansionCells(cells) {
    return Array.isArray(cells) ? cells.map((cell) => ({ ...cell })) : [];
}
function createContext(overrides = {}) {
    return {
        cardState: { markers: [] },
        gameState: {
            board: createBoard(),
            boardExpansion: { active: false, side: null, row: null, owner: 0, cells: [] }
        },
        pending: null,
        playerKey: 'black',
        constants: { EMPTY: 0, BLACK: 1, WHITE: -1 },
        helpers: {
            getExpansionDescriptorsForCard(gameState) {
                return createExpansionCells(gameState && gameState.boardExpansion && gameState.boardExpansion.cells);
            }
        },
        ...overrides
    };
}
describe('selector-orchestrator fallback on custom boards', () => {
    test('DESTROY_ONE_STONE fallback scans full 10x10 main board and right expansion cells', () => {
        const context = createContext({
            pending: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' }
        });
        context.gameState.board[9][9] = -1;
        context.gameState.boardExpansion.cells = createExpansionCells([
            { side: 'right', row: 0, col: 10, owner: -1 }
        ]);
        const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
        const set = new Set(targets.map((target) => `${target.row},${target.col}`));
        expect(set.has('9,9')).toBe(true);
        expect(set.has('0,10')).toBe(true);
    });
    test('SWAP_WITH_ENEMY fallback scans full 10x10 main board and right expansion cells', () => {
        const context = createContext({
            pending: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' }
        });
        context.gameState.board[9][9] = -1;
        context.gameState.boardExpansion.cells = createExpansionCells([
            { side: 'right', row: 0, col: 10, owner: -1 }
        ]);
        const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
        const set = new Set(targets.map((target) => `${target.row},${target.col}`));
        expect(set.has('9,9')).toBe(true);
        expect(set.has('0,10')).toBe(true);
    });
    test('POSITION_SWAP_WILL fallback scans full 10x10 main board and expansion cells while skipping first target', () => {
        const context = createContext({
            pending: {
                type: 'POSITION_SWAP_WILL',
                stage: 'selectTarget',
                firstTarget: { row: 9, col: 9 }
            },
            helpers: {
                getExpansionDescriptorsForCard(gameState) {
                    return createExpansionCells(gameState && gameState.boardExpansion && gameState.boardExpansion.cells);
                },
                isPositionSwapProtectedCell: () => false
            }
        });
        context.gameState.board[9][9] = -1;
        context.gameState.board[8][8] = 1;
        context.gameState.boardExpansion.cells = createExpansionCells([
            { side: 'bottom', row: 10, col: 9, owner: -1 }
        ]);
        const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
        const set = new Set(targets.map((target) => `${target.row},${target.col}`));
        expect(set.has('9,9')).toBe(false);
        expect(set.has('8,8')).toBe(true);
        expect(set.has('10,9')).toBe(true);
    });
});
//# sourceMappingURL=game.selector-orchestrator.fallback.test.js.map