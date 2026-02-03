// @jest-environment jsdom
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Ensure DOM is available
require('../tests/jest.setup'); // in case project has setup, otherwise DOM is global via jest

const boardRenderer = require('../ui/board-renderer');

describe('UI stone rendering', () => {
  beforeEach(() => {
    // Minimal globals expected by helper function tests
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    // Minimal stubs for other code paths (not used here)
    global.getLegalMoves = () => [];
    global.getPlayerKey = (p) => (p === BLACK ? 'black' : 'white');
    global.CardLogic = { getCardContext: () => ({}) };

    // Minimal gameState placeholder
    global.gameState = { currentPlayer: BLACK, board: Array.from({ length: 8 }, () => Array(8).fill(EMPTY)) };
    global.cardState = {};
  });

  test('setDiscStoneImage helper sets CSS var for black stone', () => {
    const fakeDisc = { style: { vars: {}, setProperty(k, v) { this.vars[k] = v; }, getPropertyValue(k) { return this.vars[k] || ''; } } };
    boardRenderer.setDiscStoneImage(fakeDisc, BLACK);
    assert.strictEqual(fakeDisc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-black-image)');
  });

  test('setDiscStoneImage helper sets CSS var for white stone', () => {
    const fakeDisc = { style: { vars: {}, setProperty(k, v) { this.vars[k] = v; }, getPropertyValue(k) { return this.vars[k] || ''; } } };
    boardRenderer.setDiscStoneImage(fakeDisc, WHITE);
    assert.strictEqual(fakeDisc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-white-image)');
  });

  test('diff-renderer sets per-disc --stone-image during initial render when images-loaded class present', () => {
    // Ensure jsdom is available and create a minimal document
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }
    // Ensure the page-level class is active (this hides base backgrounds)
    document.documentElement.classList.add('stone-images-loaded');

    // Prepare board element and a couple of stones
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    // Place sample stones on the gameState board
    gameState.board[3][3] = WHITE;
    gameState.board[3][4] = BLACK;

    const diffRenderer = require('../ui/diff-renderer');
    diffRenderer.renderBoardDiff(boardEl);

    const discs = boardEl.querySelectorAll('.disc');
    assert.ok(discs.length >= 2, 'expected at least two discs to be created');
    const first = discs[0];
    const expected = first.classList.contains('black') ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)';
    assert.strictEqual(first.style.getPropertyValue('--stone-image'), expected);
  });


});