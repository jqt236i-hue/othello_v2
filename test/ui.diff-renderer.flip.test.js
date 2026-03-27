const { JSDOM } = require('jsdom');

describe('DiffRenderer flip fallback', () => {
	beforeEach(() => {
		jest.resetModules();
		const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
		global.window = dom.window;
		global.document = dom.window.document;
		global.HTMLElement = dom.window.HTMLElement;
		jest.useFakeTimers();

		global.boardEl = document.getElementById('board');

		global.BLACK = 1;
		global.WHITE = -1;
		global.EMPTY = 0;
		global.handleCellClick = () => {};
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
			window.__suppressNextDiffFlip = false;
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

	test('adds flip class when occupied owner changes without playback suppression', () => {
		const diff = require('../ui/diff-renderer');

		gameState.board[0][0] = BLACK;
		diff.renderBoardDiff(boardEl);

		gameState.board[0][0] = WHITE;
		diff.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(true);

		jest.advanceTimersByTime(650);

		expect(disc.classList.contains('flip')).toBe(false);
	});

	test('consumes suppress flag and skips fallback flip after playback sync', () => {
		const playbackState = require('../ui/playback-state-manager');
		const diff = require('../ui/diff-renderer');

		gameState.board[0][0] = BLACK;
		diff.renderBoardDiff(boardEl);

		playbackState.armBoardUpdateContext({
			suppressFallbackFlip: true,
			source: 'unit-test',
			reason: 'post_playback_sync'
		});
		gameState.board[0][0] = WHITE;
		diff.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(false);
		expect(playbackState.getBoardUpdateContext()).toBeNull();
		expect(window.__suppressNextDiffFlip).toBe(false);
	});

	test('suppression context is one-shot so later owner changes still flip', () => {
		const playbackState = require('../ui/playback-state-manager');
		const diff = require('../ui/diff-renderer');

		gameState.board[0][0] = BLACK;
		diff.renderBoardDiff(boardEl);

		playbackState.armBoardUpdateContext({
			suppressFallbackFlip: true,
			source: 'unit-test',
			reason: 'self_snapshot_sync'
		});
		gameState.board[0][0] = WHITE;
		diff.renderBoardDiff(boardEl);

		let disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(false);

		gameState.board[0][0] = BLACK;
		diff.renderBoardDiff(boardEl);

		disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(true);
	});

	test('shows registered stone info for proliferation stones', () => {
		const diff = require('../ui/diff-renderer');

		gameState.board[1][2] = BLACK;
		cardState.markers = [{
			kind: 'specialStone',
			row: 1,
			col: 2,
			data: { type: 'PROLIFERATION' }
		}];

		diff.renderBoardDiff(boardEl);

		expect(diff.showSpecialStoneInfoAt(1, 2)).toBe(true);
		expect(document.getElementById('stone-info-name').textContent).toBe('増殖石');
		expect(document.getElementById('stone-info-desc').textContent).toContain('破壊対象');
		expect(document.getElementById('stone-info-desc').textContent).not.toContain('未登録');
	});
});
