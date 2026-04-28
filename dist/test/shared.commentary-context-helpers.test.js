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
const helpers = __importStar(require("../shared/commentary-context-helpers.js"));
function createBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(0));
}
describe('CommentaryContextHelpers.buildCommentaryContext', () => {
    test('builds counts phase and advantage from board and normalizes player key', () => {
        const board = createBoard();
        board[3][3] = 1;
        board[3][4] = 1;
        board[4][3] = -1;
        const context = helpers.buildCommentaryContext({
            eventType: 'turn_start',
            playerKey: ' WHITE ',
            turnNumber: 5,
            board
        });
        expect(context).toMatchObject({
            eventType: 'turn_start',
            playerKey: 'white',
            turnNumber: 5,
            phase: 'opening',
            advantage: 'even',
            counts: { black: 2, white: 1 },
            occupiedCells: 3
        });
        expect(context.board).toBe(board);
    });
    test('opening advantage values corner control above a small disc deficit', () => {
        const board = createBoard();
        board[0][0] = -1;
        board[0][1] = 1;
        board[1][0] = 1;
        board[1][1] = 1;
        board[3][3] = 1;
        board[3][4] = -1;
        board[4][3] = -1;
        const counts = helpers.countDiscsFromBoard(board);
        expect(helpers.resolveAdvantageLabel('white', counts, {
            board,
            turnNumber: 8
        })).toBe('ahead');
    });
    test('opening advantage penalizes risky X/C occupancy under an empty corner', () => {
        const board = createBoard();
        board[0][1] = -1;
        board[1][0] = -1;
        board[1][1] = -1;
        board[2][2] = -1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        const counts = helpers.countDiscsFromBoard(board);
        expect(helpers.resolveAdvantageLabel('white', counts, {
            board,
            turnNumber: 8
        })).toBe('behind');
    });
    test('endgame advantage still respects a large disc lead', () => {
        const board = [
            [-1, -1, -1, -1, -1, -1, -1, 1],
            [-1, -1, -1, -1, -1, -1, 1, 1],
            [-1, -1, -1, -1, -1, -1, -1, 1],
            [-1, -1, -1, -1, -1, -1, 1, 1],
            [-1, -1, -1, -1, -1, -1, 1, 1],
            [-1, -1, -1, -1, -1, 0, 1, 1],
            [-1, -1, -1, -1, -1, 1, 1, 1],
            [-1, -1, -1, -1, -1, 1, 1, 0]
        ];
        const counts = helpers.countDiscsFromBoard(board);
        expect(helpers.resolveAdvantageLabel('white', counts, {
            board,
            turnNumber: 52
        })).toBe('ahead');
    });
    test('preserves explicit phase and advantage when provided', () => {
        const context = helpers.buildCommentaryContext({
            eventType: 'card_used',
            playerKey: 'black',
            counts: { black: 20, white: 10 },
            phase: 'endgame',
            advantage: 'behind',
            cardId: 'swap_01'
        });
        expect(context).toMatchObject({
            eventType: 'card_used',
            playerKey: 'black',
            phase: 'endgame',
            advantage: 'behind',
            cardId: 'swap_01',
            counts: { black: 20, white: 10 },
            occupiedCells: 30
        });
    });
    test('does not treat the untouched initial board as commentary start', () => {
        const board = createBoard();
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        expect(helpers.hasCommentaryGameplayStarted({
            board,
            turnNumber: 0
        })).toBe(false);
    });
    test('treats post-opening progress as commentary start', () => {
        const board = createBoard();
        board[2][3] = 1;
        board[3][3] = 1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;
        expect(helpers.hasCommentaryGameplayStarted({
            board,
            turnNumber: 1
        })).toBe(true);
        expect(helpers.hasCommentaryGameplayStarted({
            board
        })).toBe(true);
    });
});
//# sourceMappingURL=shared.commentary-context-helpers.test.js.map