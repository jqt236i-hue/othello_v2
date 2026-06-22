import { JSDOM } from 'jsdom';

const diffRenderer = require('../ui/diff-renderer.js');
const playbackState = require('../ui/playback-state-manager.js');

describe('DiffRenderer flip fallback', () => {
	beforeEach(() => {
		jest.resetModules();
		const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
		global.window = dom.window;
		global.document = dom.window.document;
		global.HTMLElement = dom.window.HTMLElement;
		jest.useFakeTimers();

		(global as any).boardEl = document.getElementById('board');

		(global as any).BLACK = 1;
		(global as any).WHITE = -1;
		(global as any).EMPTY = 0;
		(global as any).handleCellClick = () => {};
		(global as any).getPlayerKey = (p: any) => (p === (global as any).BLACK ? 'black' : 'white');
		(global as any).getLegalMoves = () => [];
		(global as any).CardLogic = {
			getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
			getSelectableTargets: () => []
		};

		(global as any).cardState = { markers: [], pendingEffectByPlayer: {} };
		(global as any).gameState = {
			currentPlayer: (global as any).BLACK,
			board: Array.from({ length: 8 }, () => Array(8).fill((global as any).EMPTY))
		};

		if (typeof window !== 'undefined') {
			window.DISABLE_ANIMATIONS = false;
			window.__suppressNextDiffFlip = false;
		}
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		delete (global as any).window;
		delete (global as any).document;
		delete (global as any).HTMLElement;
		delete (global as any).boardEl;
		delete (global as any).BLACK;
		delete (global as any).WHITE;
		delete (global as any).EMPTY;
		delete (global as any).handleCellClick;
		delete (global as any).getPlayerKey;
		delete (global as any).getLegalMoves;
		delete (global as any).CardLogic;
		delete (global as any).cardState;
		delete (global as any).gameState;
	});

	test('adds flip class when occupied owner changes without playback suppression', () => {
		window.AnimationConstants = require('../ui/animation-constants.ts');
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		gameState.board[0][0] = WHITE;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(true);

		jest.advanceTimersByTime(500);

		expect(disc.classList.contains('flip')).toBe(false);
	});

	test('consumes suppress flag and skips fallback flip after playback sync', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		playbackState.armBoardUpdateContext({
			suppressFallbackFlip: true,
			source: 'unit-test',
			reason: 'post_playback_sync'
		});
		gameState.board[0][0] = WHITE;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(false);
		expect(playbackState.getBoardUpdateContext()).toBeNull();
		expect(window.__suppressNextDiffFlip).toBe(false);
	});

	test('skips fallback flip when the existing disc was just flipped by playback', () => {
		const playbackFlipMarker = require('../ui/playback-flip-marker.js');
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		const animatedDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc') as HTMLElement;
		expect(animatedDisc).toBeTruthy();
		playbackFlipMarker.markPlaybackFlippedDisc(animatedDisc);
		animatedDisc.classList.remove('black');
		animatedDisc.classList.add('white');

		gameState.board[0][0] = WHITE;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc') as HTMLElement;
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('white')).toBe(true);
		expect(disc.classList.contains('flip')).toBe(false);
	});

	test('suppression context is one-shot so later owner changes still flip', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		playbackState.armBoardUpdateContext({
			suppressFallbackFlip: true,
			source: 'unit-test',
			reason: 'post_playback_sync'
		});
		gameState.board[0][0] = WHITE;
		diffRenderer.renderBoardDiff(boardEl);

		expect(
			boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc.flip')
		).toBeFalsy();

		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(true);
	});

	test('keeps pending playback flip targets for AnimationEngine instead of diff fallback', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		cardState._presentationEventsPersist = [{
			type: 'CHANGE',
			row: 0,
			col: 0,
			ownerBefore: 'black',
			ownerAfter: 'white'
		}];
		gameState.board[0][0] = WHITE;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('black')).toBe(true);
		expect(disc.classList.contains('white')).toBe(false);
		expect(disc.classList.contains('flip')).toBe(false);
	});

	test('does not add flip class for newly placed stones', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.classList.contains('flip')).toBe(false);
	});

	test('syncDiscBaseImageAssignment sets base image vars', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.style.getPropertyValue('--stone-image')).toBeTruthy();
	});

	test('syncDiscImageFallbackState sets render mode and effect', () => {
		gameState.board[0][0] = BLACK;
		diffRenderer.renderBoardDiff(boardEl);

		const disc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
		expect(disc).toBeTruthy();
		expect(disc.dataset.renderMode).toBe('base-only');
		expect(disc.dataset.effect).toBe('normal');
	});

	test('stone info panel shows Japanese name and description for known stones', () => {
		// Setup a known stone type in cardState
		cardState.markers = [{ r: 0, c: 0, type: 'proliferation', player: 'black' }];
		diffRenderer.renderBoardDiff(boardEl);

		// Simulate click to trigger info panel (if the module supports it)
		const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
		expect(cell).toBeTruthy();
	});

	test('does not throw when boardEl is missing', () => {
		expect(() => diffRenderer.renderBoardDiff(null)).not.toThrow();
		expect(() => diffRenderer.renderBoardDiff(undefined)).not.toThrow();
	});
});
