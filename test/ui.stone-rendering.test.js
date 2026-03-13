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
    global.applyStoneVisualEffect = () => {};

    // Minimal gameState placeholder
    global.gameState = { currentPlayer: BLACK, board: Array.from({ length: 8 }, () => Array(8).fill(EMPTY)) };
    global.cardState = { markers: [] };
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

  test('diff-renderer shows actual remainingOwnerTurns for timed special stones', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board[0][0] = BLACK;
    gameState.board[0][1] = BLACK;
    gameState.board[0][2] = BLACK;
    gameState.board[0][3] = BLACK;
    gameState.board[0][4] = BLACK;
    gameState.board[0][5] = BLACK;
    gameState.board[0][6] = BLACK;
    gameState.board[0][7] = BLACK;
    gameState.board[1][0] = BLACK;
    gameState.board[1][1] = BLACK;

    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 0, col: 1, owner: 'black', data: { type: 'BREEDING', remainingOwnerTurns: 7 } },
      { id: 3, kind: 'specialStone', row: 0, col: 2, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } },
      { id: 4, kind: 'specialStone', row: 0, col: 3, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 12 } },
      { id: 5, kind: 'specialStone', row: 0, col: 4, owner: 'black', data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 6 } },
      { id: 6, kind: 'specialStone', row: 0, col: 5, owner: 'black', data: { type: 'HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 } },
      { id: 7, kind: 'specialStone', row: 0, col: 6, owner: 'black', data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 4, flipEvadeRemaining: 0 } },
      { id: 8, kind: 'specialStone', row: 0, col: 7, owner: 'black', data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 } },
      { id: 9, kind: 'specialStone', row: 1, col: 0, owner: 'black', data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 } },
      { id: 10, kind: 'specialStone', row: 1, col: 0, owner: 'black', data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 4, flipEvadeRemaining: 1 } },
      { id: 11, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'PROTECTED', remainingOwnerTurns: 2, flipEvadeRemaining: 0 } }
    ];

    const diffRenderer = require('../ui/diff-renderer');
    diffRenderer.renderBoardDiff(boardEl);

    const dragonTimers = Array.from(boardEl.querySelectorAll('.dragon-timer')).map((el) => el.textContent).sort();
    assert.deepStrictEqual(dragonTimers, ['10', '6'].sort());
    assert.strictEqual(boardEl.querySelector('.breeding-timer').textContent, '7');
    assert.strictEqual(boardEl.querySelector('.udg-timer').textContent, '8');
    assert.strictEqual(boardEl.querySelector('.work-timer').textContent, '12');

    const hyperDisc = boardEl.querySelector('.cell[data-row="0"][data-col="5"] .disc');
    assert.strictEqual(hyperDisc.querySelector('.flip-evade-timer').textContent, '1');

    const inheritedDisc = boardEl.querySelector('.cell[data-row="0"][data-col="6"] .disc');
    assert.strictEqual(inheritedDisc.querySelector('.inherited-hyperactive-timer').textContent, '4');
    assert.strictEqual(inheritedDisc.querySelector('.flip-evade-timer').textContent, '0');

    const ultimateDisc = boardEl.querySelector('.cell[data-row="0"][data-col="7"] .disc');
    assert.strictEqual(ultimateDisc.querySelector('.flip-evade-timer').textContent, '5');

    const coexistDisc = boardEl.querySelector('.cell[data-row="1"][data-col="0"] .disc');
    const coexistEvadeTimers = coexistDisc.querySelectorAll('.flip-evade-timer');
    assert.strictEqual(coexistEvadeTimers.length, 1);
    assert.strictEqual(coexistEvadeTimers[0].textContent, '6');
    assert.strictEqual(coexistDisc.querySelector('.inherited-hyperactive-timer').textContent, '4');

    const protectedDisc = boardEl.querySelector('.cell[data-row="1"][data-col="1"] .disc');
    assert.strictEqual(protectedDisc.querySelector('.flip-evade-timer'), null);
  });


});
