"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
describe('DiffRenderer destroy-fade cleanup', () => {
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        jest.useFakeTimers();
        global.boardEl = document.getElementById('board');
        global.BLACK = 1;
        global.WHITE = -1;
        global.EMPTY = 0;
        global.handleCellClick = () => { };
        global.getPlayerKey = (p) => (p === BLACK ? 'black' : 'white');
        global.getLegalMoves = () => [];
        global.CardLogic = {
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
            getSelectableTargets: () => []
        };
        global.cardState = { markers: [], pendingEffectByPlayer: {} };
        global.gameState = {
            currentPlayer: BLACK,
            board: Array.from({ length: 8 }, () => Array(8).fill(EMPTY))
        };
        if (typeof window !== 'undefined') {
            window.DISABLE_ANIMATIONS = false;
        }
    });
    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
        delete global.boardEl;
        delete global.BLACK;
        delete global.WHITE;
        delete global.EMPTY;
        delete global.handleCellClick;
        delete global.getPlayerKey;
        delete global.getLegalMoves;
        delete global.CardLogic;
        delete global.cardState;
        delete global.gameState;
    });
    test('removes has-disc after deferred destroy cleanup', () => {
        import * as diff from '../ui/diff-renderer.js';
        gameState.board[0][0] = BLACK;
        diff.renderBoardDiff(boardEl);
        const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell).toBeTruthy();
        expect(cell.classList.contains('has-disc')).toBe(true);
        gameState.board[0][0] = EMPTY;
        diff.renderBoardDiff(boardEl);
        const fadingDisc = cell.querySelector('.disc');
        expect(fadingDisc).toBeTruthy();
        expect(fadingDisc.classList.contains('destroy-fade')).toBe(true);
        jest.advanceTimersByTime(700);
        expect(cell.classList.contains('has-disc')).toBe(false);
        expect(cell.querySelector('.disc')).toBeNull();
    });
    test('reconciles stale has-disc class even when state is unchanged', () => {
        import * as diff from '../ui/diff-renderer.js';
        diff.renderBoardDiff(boardEl);
        const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell).toBeTruthy();
        expect(cell.querySelector('.disc')).toBeNull();
        cell.classList.add('has-disc');
        expect(cell.classList.contains('has-disc')).toBe(true);
        diff.renderBoardDiff(boardEl);
        expect(cell.querySelector('.disc')).toBeNull();
        expect(cell.classList.contains('has-disc')).toBe(false);
    });
    test('reconciles stale legal hint classes even when state is unchanged', () => {
        import * as diff from '../ui/diff-renderer.js';
        diff.renderBoardDiff(boardEl);
        const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell).toBeTruthy();
        cell.classList.add('legal', 'legal-free', 'effect-target-highlight', 'effect-target-highlight-positive', 'selectable-friendly', 'selectable-friendly-no-circle', 'time-stop-legal-emphasis');
        diff.renderBoardDiff(boardEl);
        expect(cell.classList.contains('legal')).toBe(false);
        expect(cell.classList.contains('legal-free')).toBe(false);
        expect(cell.classList.contains('effect-target-highlight')).toBe(false);
        expect(cell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(cell.classList.contains('selectable-friendly')).toBe(false);
        expect(cell.classList.contains('selectable-friendly-no-circle')).toBe(false);
        expect(cell.classList.contains('time-stop-legal-emphasis')).toBe(false);
    });
    test('suppresses normal legal hints during BLOCKADE_WILL target selection while keeping selectable targets', () => {
        global.getLegalMoves = () => [{ row: 0, col: 0 }];
        global.CardLogic.getSelectableTargets = () => [{ row: 0, col: 1 }];
        global.cardState.pendingEffectByPlayer = {
            black: { type: 'BLOCKADE_WILL', stage: 'selectTarget', cardId: 'blockade_01' },
            white: null
        };
        import * as diff from '../ui/diff-renderer.js';
        diff.renderBoardDiff(boardEl);
        const legalCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        const selectableCell = boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
        expect(legalCell).toBeTruthy();
        expect(selectableCell).toBeTruthy();
        expect(legalCell.classList.contains('legal')).toBe(false);
        expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    });
    test('updates POSITION_SWAP_WILL first-target highlight as pending selection changes', () => {
        import * as diff from '../ui/diff-renderer.js';
        global.gameState.board[0][0] = BLACK;
        global.gameState.board[0][1] = WHITE;
        global.CardLogic.getSelectableTargets = () => [{ row: 0, col: 1 }];
        diff.renderBoardDiff(boardEl);
        const firstCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        const secondCell = boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
        expect(firstCell).toBeTruthy();
        expect(secondCell).toBeTruthy();
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        global.cardState.pendingEffectByPlayer = {
            black: {
                type: 'POSITION_SWAP_WILL',
                stage: 'selectTarget',
                cardId: 'position_swap_01',
                firstTarget: { row: 0, col: 0 }
            },
            white: null
        };
        diff.renderBoardDiff(boardEl);
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
        expect(secondCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(secondCell.classList.contains('selectable-friendly')).toBe(true);
        global.cardState.pendingEffectByPlayer = { black: null, white: null };
        global.CardLogic.getSelectableTargets = () => [];
        diff.renderBoardDiff(boardEl);
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(false);
    });
    test('updates BOARD_SHRINK_WILL selected-target highlight as pending selection changes', () => {
        import * as diff from '../ui/diff-renderer.js';
        global.CardLogic.getSelectableTargets = () => [{ row: 0, col: 2 }];
        diff.renderBoardDiff(boardEl);
        const firstCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        const secondCell = boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
        const selectableCell = boardEl.querySelector('.cell[data-row="0"][data-col="2"]');
        expect(firstCell).toBeTruthy();
        expect(secondCell).toBeTruthy();
        expect(selectableCell).toBeTruthy();
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(secondCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        global.cardState.pendingEffectByPlayer = {
            black: {
                type: 'BOARD_SHRINK_WILL',
                stage: 'selectTarget',
                cardId: 'board_shrink_01',
                selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
                selectedCount: 2,
                maxSelections: 3
            },
            white: null
        };
        diff.renderBoardDiff(boardEl);
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(secondCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
        expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    });
    test('updates BOARD_SHRINK_GOD first-target highlight as pending selection changes', () => {
        import * as diff from '../ui/diff-renderer.js';
        global.CardLogic.getSelectableTargets = () => [{ row: 0, col: 1 }];
        diff.renderBoardDiff(boardEl);
        const firstCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        const selectableCell = boardEl.querySelector('.cell[data-row="0"][data-col="1"]');
        expect(firstCell).toBeTruthy();
        expect(selectableCell).toBeTruthy();
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        global.cardState.pendingEffectByPlayer = {
            black: {
                type: 'BOARD_SHRINK_GOD',
                stage: 'selectTarget',
                cardId: 'board_shrink_god_01',
                firstTarget: { row: 0, col: 0 }
            },
            white: null
        };
        diff.renderBoardDiff(boardEl);
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
        expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    });
    test('updates BOARD_EXPANSION_GOD selected-target highlight from firstTarget and selectedTargets', () => {
        import * as diff from '../ui/diff-renderer.js';
        global.CardLogic.getSelectableTargets = () => [{ row: 0, col: 7 }];
        diff.renderBoardDiff(boardEl);
        const firstCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        const secondSelectedCell = boardEl.querySelector('.cell[data-row="7"][data-col="7"]');
        const selectableCell = boardEl.querySelector('.cell[data-row="0"][data-col="7"]');
        expect(firstCell).toBeTruthy();
        expect(secondSelectedCell).toBeTruthy();
        expect(selectableCell).toBeTruthy();
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(secondSelectedCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        global.cardState.pendingEffectByPlayer = {
            black: {
                type: 'BOARD_EXPANSION_GOD',
                stage: 'selectTarget',
                cardId: 'board_expand_god_01',
                firstTarget: { row: 0, col: 0 },
                selectedTargets: [{ row: 0, col: 0 }, { row: 7, col: 7 }],
                selectedCount: 2,
                maxSelections: 2
            },
            white: null
        };
        diff.renderBoardDiff(boardEl);
        expect(firstCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(secondSelectedCell.classList.contains('effect-target-highlight-positive')).toBe(true);
        expect(selectableCell.classList.contains('effect-target-highlight-positive')).toBe(false);
        expect(firstCell.classList.contains('effect-target-highlight')).toBe(false);
        expect(selectableCell.classList.contains('selectable-friendly')).toBe(true);
    });
    test('keeps the board grid size fixed even when shrink holes consume the full top edge', () => {
        import * as diff from '../ui/diff-renderer.js';
        diff.renderBoardDiff(boardEl);
        expect(boardEl.style.getPropertyValue('--board-rows')).toBe('8');
        expect(boardEl.querySelector('.cell[data-row="0"][data-col="0"]')).toBeTruthy();
        global.cardState.markers = Array.from({ length: 8 }, (_, col) => ({
            id: `shrink-top-${col}`,
            kind: 'specialStone',
            row: 0,
            col,
            owner: 'black',
            data: { type: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME' }
        }));
        diff.renderBoardDiff(boardEl);
        expect(boardEl.style.getPropertyValue('--board-rows')).toBe('8');
        expect(boardEl.querySelector('.cell[data-row="0"][data-col="0"]')).toBeTruthy();
        expect(boardEl.querySelector('.cell[data-row="1"][data-col="0"]')).toBeTruthy();
        expect(boardEl.querySelectorAll('.cell:not(.cell-expanded)')).toHaveLength(64);
        const topLeftCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(topLeftCell.classList.contains('board-shrink-hole-cell')).toBe(true);
        const holeMark = topLeftCell.querySelector('.board-shrink-hole-mark');
        expect(holeMark.querySelector('.board-shrink-hole-inner-edge.inner-edge-bottom')).toBeTruthy();
    });
    test('renders shrink-created holes with frame styling and rerenders back to meteor styling when the variant changes', () => {
        import * as diff from '../ui/diff-renderer.js';
        global.cardState.markers = [{
                id: 'shrink-hole',
                kind: 'specialStone',
                row: 0,
                col: 0,
                owner: 'black',
                data: { type: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME' }
            }];
        diff.renderBoardDiff(boardEl);
        const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell).toBeTruthy();
        expect(cell.classList.contains('board-shrink-hole-cell')).toBe(true);
        expect(cell.classList.contains('meteor-hole-cell')).toBe(false);
        const shrinkHoleMark = cell.querySelector('.board-shrink-hole-mark');
        expect(shrinkHoleMark).toBeTruthy();
        expect(shrinkHoleMark.querySelector('.board-shrink-hole-inner-edge.inner-edge-right')).toBeTruthy();
        expect(shrinkHoleMark.querySelector('.board-shrink-hole-inner-edge.inner-edge-bottom')).toBeTruthy();
        expect(cell.querySelector('.meteor-hole-mark')).toBeNull();
        global.cardState.markers = [{
                id: 'meteor-hole',
                kind: 'specialStone',
                row: 0,
                col: 0,
                owner: 'black',
                data: { type: 'METEOR_HOLE' }
            }];
        diff.renderBoardDiff(boardEl);
        expect(cell.classList.contains('board-shrink-hole-cell')).toBe(false);
        expect(cell.classList.contains('meteor-hole-cell')).toBe(true);
        expect(cell.querySelector('.board-shrink-hole-mark')).toBeNull();
        expect(cell.querySelector('.meteor-hole-mark')).toBeTruthy();
    });
});
//# sourceMappingURL=ui.diff-renderer.destroy-fade-shadow.test.js.map