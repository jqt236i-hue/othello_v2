// @jest-environment jsdom
const assert = require('assert');
const fs = require('fs');
const path = require('path');
import { JSDOM } from 'jsdom';

// Ensure DOM is available
require('../tests/jest.setup'); // in case project has setup, otherwise DOM is global via jest

describe('UI stone rendering', () => {
  beforeEach(() => {
    jest.resetModules();

    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    } else {
      document.body.innerHTML = '<div id="board"></div>';
    }
    document.documentElement.className = '';
    global.boardEl = document.getElementById('board');

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
    global.cardState = { markers: [], pendingEffectByPlayer: { black: null, white: null } };
  });

  test('static disc CSS avoids transform layer promotion until an animation class is active', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
    const animationCss = fs.readFileSync(path.join(__dirname, '..', 'styles-animations.css'), 'utf8');
    const baseDiscBlock = boardCss.match(/\.disc\s*\{[^{}]*\}/);

    assert.ok(baseDiscBlock, 'base .disc block should exist');
    assert.ok(!/will-change:\s*transform;/.test(baseDiscBlock[0]), 'base .disc should not keep will-change: transform');
    assert.ok(
      /\.disc\.flip,\s*[\r\n\s]*\.disc\.destroy-fade,\s*[\r\n\s]*\.disc\.hyperactive-moving\s*\{[\s\S]*?backface-visibility:\s*hidden;[\s\S]*?transform-style:\s*preserve-3d;/.test(animationCss),
      'animated disc states should keep the 3D/backface settings'
    );
    assert.ok(/\.disc\.flip\s*\{[\s\S]*?will-change:\s*transform,\s*filter;/.test(animationCss), 'flip animation should opt in to transform layer promotion');
    assert.ok(/\.disc\.flip\s*\{[\s\S]*?animation:\s*stone-flip\s+0\.462s\s+cubic-bezier\(\.2,\.85,\.3,1\);/.test(animationCss), 'flip animation CSS should use the standard 30%-faster tempo');
  });

  test('setDiscStoneImage helper creates the disc skeleton and sets black base render state', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    document.documentElement.classList.add('stone-base-images-ready');
    const disc = document.createElement('div');
    disc.className = 'disc black';
    boardRenderer.setDiscStoneImage(disc, BLACK);
    assert.strictEqual(disc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-black-image)');
    assert.strictEqual(disc.style.getPropertyValue('--disc-base-image'), 'var(--normal-stone-black-image)');
    assert.strictEqual(disc.style.getPropertyValue('--disc-base-fallback-color'), 'transparent');
    assert.strictEqual(disc.dataset.renderMode, 'base-only');
    assert.strictEqual(disc.dataset.imageState, 'loaded');
    assert.ok(disc.querySelector('.disc__face'));
    assert.ok(disc.querySelector('.disc__base-image'));
    assert.ok(disc.querySelector('.disc__overlay-image'));
    assert.ok(disc.querySelector('.disc__hud'));
  });

  test('setDiscStoneImage helper creates the disc skeleton and sets white base render state', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    document.documentElement.classList.add('stone-base-images-ready');
    const disc = document.createElement('div');
    disc.className = 'disc white';
    boardRenderer.setDiscStoneImage(disc, WHITE);
    assert.strictEqual(disc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-white-image)');
    assert.strictEqual(disc.style.getPropertyValue('--disc-base-image'), 'var(--normal-stone-white-image)');
    assert.strictEqual(disc.style.getPropertyValue('--disc-base-fallback-color'), 'transparent');
    assert.strictEqual(disc.dataset.renderMode, 'base-only');
    assert.strictEqual(disc.dataset.imageState, 'loaded');
    assert.ok(disc.querySelector('.disc__face'));
    assert.ok(disc.querySelector('.disc__base-image'));
    assert.ok(disc.querySelector('.disc__overlay-image'));
    assert.ok(disc.querySelector('.disc__hud'));
  });

  test('setDiscStoneImage keeps owner-color fallback only while base stone images are not ready', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    const disc = document.createElement('div');
    disc.className = 'disc black';
    boardRenderer.setDiscStoneImage(disc, BLACK);
    assert.strictEqual(disc.dataset.imageState, 'fallback');
    assert.strictEqual(disc.style.getPropertyValue('--disc-base-fallback-color'), '#050505');
  });

  test('diff-renderer renders the shared disc skeleton during initial render', () => {
    // Ensure jsdom is available and create a minimal document
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }
    // Ensure the base stone assets are considered ready for this render path.
    document.documentElement.classList.add('stone-images-loaded');
    document.documentElement.classList.add('stone-base-images-ready');

    // Prepare board element and a couple of stones
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    // Place sample stones on the gameState board
    gameState.board[3][3] = WHITE;
    gameState.board[3][4] = BLACK;

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const discs = boardEl.querySelectorAll('.disc');
    assert.ok(discs.length >= 2, 'expected at least two discs to be created');
    const first = discs[0];
    const expected = first.classList.contains('black') ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)';
    assert.strictEqual(first.style.getPropertyValue('--stone-image'), expected);
    assert.strictEqual(first.style.getPropertyValue('--disc-base-image'), expected);
    assert.strictEqual(first.style.getPropertyValue('--disc-base-fallback-color'), 'transparent');
    assert.strictEqual(first.dataset.renderMode, 'base-only');
    assert.strictEqual(first.dataset.imageState, 'loaded');
    assert.ok(first.querySelector('.disc__face'));
    assert.ok(first.querySelector('.disc__base-image'));
    assert.ok(first.querySelector('.disc__overlay-image'));
    assert.ok(first.querySelector('.disc__hud'));
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
    gameState.board[1][2] = BLACK;
    gameState.board[1][3] = BLACK;
    gameState.board[1][4] = BLACK;

    cardState.markers = [
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 10 } },
      { id: 2, kind: 'specialStone', row: 0, col: 1, owner: 'black', data: { type: 'BREEDING', remainingOwnerTurns: 7 } },
      { id: 3, kind: 'specialStone', row: 0, col: 2, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } },
      { id: 4, kind: 'specialStone', row: 0, col: 3, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 12 } },
      { id: 5, kind: 'specialStone', row: 0, col: 4, owner: 'black', data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 6 } },
      { id: 6, kind: 'specialStone', row: 0, col: 5, owner: 'black', data: { type: 'HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 } },
      { id: 8, kind: 'specialStone', row: 0, col: 7, owner: 'black', data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 } },
      { id: 9, kind: 'specialStone', row: 1, col: 0, owner: 'black', data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 } },
      { id: 11, kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'PROTECTED', remainingOwnerTurns: 2, flipEvadeRemaining: 0 } },
      { id: 12, kind: 'specialStone', row: 1, col: 2, owner: 'black', data: { type: 'REGEN', regenRemaining: 3, remainingOwnerTurns: 3 } },
      { id: 13, kind: 'specialStone', row: 1, col: 3, owner: 'black', data: { type: 'PERMA_PROTECTED' } },
      { id: 14, kind: 'specialStone', row: 1, col: 4, owner: 'black', data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const dragonTimers = Array.from(boardEl.querySelectorAll('.dragon-timer')).map((el) => el.textContent).sort();
    assert.deepStrictEqual(dragonTimers, ['10', '6'].sort());
    assert.strictEqual(boardEl.querySelector('.breeding-timer').textContent, '7');
    assert.strictEqual(boardEl.querySelector('.udg-timer').textContent, '8');
    assert.strictEqual(boardEl.querySelector('.work-timer').textContent, '12');
    assert.ok(boardEl.querySelector('.dragon-timer').closest('.disc__hud'));

    const hyperDisc = boardEl.querySelector('.cell[data-row="0"][data-col="5"] .disc');
    assert.strictEqual(hyperDisc.querySelector('.flip-evade-timer').textContent, '1');

    const ultimateDisc = boardEl.querySelector('.cell[data-row="0"][data-col="7"] .disc');
    assert.strictEqual(ultimateDisc.querySelector('.flip-evade-timer').textContent, '5');
    assert.strictEqual(ultimateDisc.querySelector('.destroy-evade-timer').textContent, '2');

    const coexistDisc = boardEl.querySelector('.cell[data-row="1"][data-col="0"] .disc');
    const coexistEvadeTimers = coexistDisc.querySelectorAll('.flip-evade-timer');
    assert.strictEqual(coexistEvadeTimers.length, 1);
    assert.strictEqual(coexistEvadeTimers[0].textContent, '5');
    assert.strictEqual(coexistDisc.querySelector('.destroy-evade-timer').textContent, '2');

    const protectedDisc = boardEl.querySelector('.cell[data-row="1"][data-col="1"] .disc');
    assert.strictEqual(protectedDisc.querySelector('.flip-evade-timer'), null);

    const regenDisc = boardEl.querySelector('.cell[data-row="1"][data-col="2"] .disc');
    assert.strictEqual(regenDisc.querySelector('.special-timer'), null);
    assert.strictEqual(regenDisc.querySelector('.stone-regen-badge').textContent, '3');
    assert.strictEqual(boardEl.querySelector('.cell[data-row="1"][data-col="2"]').classList.contains('has-regen-badge'), true);

    const strongWillDisc = boardEl.querySelector('.cell[data-row="1"][data-col="3"] .disc');
    assert.strictEqual(strongWillDisc.querySelector('.countdown-timer'), null);
    assert.strictEqual(strongWillDisc.querySelector('.special-timer'), null);

    const extremeDisc = boardEl.querySelector('.cell[data-row="1"][data-col="4"] .disc');
    assert.strictEqual(extremeDisc.querySelector('.flip-evade-timer').textContent, '5');
    assert.strictEqual(extremeDisc.querySelector('.destroy-evade-timer').textContent, '5');
  });

  test('diff-renderer shows bomb countdown for unified TIME_BOMB markers', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[2][2] = BLACK;
    cardState.markers = [{
      id: 14,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 }
    }];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const disc = boardEl.querySelector('.cell[data-row="2"][data-col="2"] .disc');
    assert.ok(disc, 'expected bomb disc');
    const timer = disc.querySelector('.bomb-timer.countdown-timer');
    assert.ok(timer, 'expected time bomb countdown timer');
    assert.strictEqual(timer.textContent, '3');
    assert.strictEqual(disc.querySelector('.special-timer'), null);
  });

  test('countdown timer css uses a red triangle marker', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../styles-board.css'), 'utf8');
    const countdownRule = css.match(/\.bomb-timer,\s*\.countdown-timer\s*\{[\s\S]*?\n\}/);

    assert.ok(countdownRule, 'expected countdown timer CSS rule');
    assert.match(countdownRule[0], /clip-path:\s*polygon\(50% 0%, 100% 100%, 0% 100%\)/);
    assert.match(countdownRule[0], /rgba\(172,\s*28,\s*28,\s*0\.88\)/);
  });

  test('diff-renderer keeps living will aura as an overlay on normal and special stones', () => {
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[2][2] = BLACK;
    gameState.board[2][3] = BLACK;
    cardState.markers = [
      {
        id: 21,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: BLACK, markers: [] } }
      },
      {
        id: 22,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: { type: 'WORK', remainingOwnerTurns: 4 }
      },
      {
        id: 23,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: BLACK, markers: [] } }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const normalDisc = boardEl.querySelector('.cell[data-row="2"][data-col="2"] .disc');
    assert.ok(normalDisc.classList.contains('living-will-aura'));
    assert.strictEqual(normalDisc.dataset.renderMode, 'base-only');

    const workDisc = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
    assert.ok(workDisc.classList.contains('living-will-aura'));
    assert.strictEqual(workDisc.querySelector('.work-timer').textContent, '4');
  });

  test('board-renderer keeps living will aura as an overlay on special stones', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[3][3] = BLACK;
    cardState.markers = [
      {
        id: 31,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'WORK', remainingOwnerTurns: 4 }
      },
      {
        id: 32,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: BLACK, markers: [] } }
      }
    ];

    boardRenderer.renderBoardFull();

    const disc = boardEl.querySelector('.cell[data-row="3"][data-col="3"] .disc');
    assert.ok(disc.classList.contains('living-will-aura'));
    assert.strictEqual(disc.querySelector('.work-timer').textContent, '4');
  });

  test('diff-renderer adds owner-colored aura to manifestation stones', () => {
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[2][4] = WHITE;
    gameState.board[2][5] = BLACK;
    cardState.markers = [
      {
        id: 41,
        kind: 'manifestStone',
        row: 2,
        col: 4,
        owner: 'white',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4 }
      },
      {
        id: 42,
        kind: 'manifestStone',
        row: 2,
        col: 5,
        owner: 'black',
        data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 3 }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const whiteDisc = boardEl.querySelector('.cell[data-row="2"][data-col="4"] .disc');
    assert.ok(whiteDisc.classList.contains('manifest-stone-aura'));
    assert.ok(whiteDisc.classList.contains('manifest-stone-aura-white'));
    assert.ok(!whiteDisc.classList.contains('manifest-stone-aura-black'));

    const blackDisc = boardEl.querySelector('.cell[data-row="2"][data-col="5"] .disc');
    assert.ok(blackDisc.classList.contains('manifest-stone-aura'));
    assert.ok(blackDisc.classList.contains('manifest-stone-aura-black'));
    assert.ok(!blackDisc.classList.contains('manifest-stone-aura-white'));
  });

  test('board-renderer adds owner-colored aura to manifestation stones', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[4][2] = BLACK;
    gameState.board[4][3] = WHITE;
    cardState.markers = [
      {
        id: 51,
        kind: 'manifestStone',
        row: 4,
        col: 2,
        owner: 'black',
        data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4 }
      },
      {
        id: 52,
        kind: 'manifestStone',
        row: 4,
        col: 3,
        owner: 'white',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 }
      }
    ];

    boardRenderer.renderBoardFull();

    const blackDisc = boardEl.querySelector('.cell[data-row="4"][data-col="2"] .disc');
    assert.ok(blackDisc.classList.contains('manifest-stone-aura'));
    assert.ok(blackDisc.classList.contains('manifest-stone-aura-black'));
    assert.ok(!blackDisc.classList.contains('manifest-stone-aura-white'));

    const whiteDisc = boardEl.querySelector('.cell[data-row="4"][data-col="3"] .disc');
    assert.ok(whiteDisc.classList.contains('manifest-stone-aura'));
    assert.ok(whiteDisc.classList.contains('manifest-stone-aura-white'));
    assert.ok(!whiteDisc.classList.contains('manifest-stone-aura-black'));
  });

  test('board-renderer does not render manifestation stones as ordinary special stones', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;
    global.getEffectKeyForSpecialType = (type) => {
      const normalized = String(type || '').toUpperCase();
      if (normalized === 'THEORY_INCARNATION') return 'theoryIncarnationStone';
      if (normalized === 'HYPERACTIVE') return 'hyperactiveStone';
      return null;
    };
    global.applyStoneVisualEffect = jest.fn((disc, effectKey) => {
      disc.classList.add('special-stone', `${effectKey}-applied`);
      return true;
    });

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[0][0] = BLACK;
    gameState.board[2][3] = BLACK;
    cardState.markers = [
      {
        id: 61,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'HYPERACTIVE', remainingOwnerTurns: 5 }
      },
      {
        id: 62,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 2 }
      }
    ];

    boardRenderer.renderBoardFull();

    const spawnedDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    const manifestDisc = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
    assert.ok(spawnedDisc.classList.contains('special-stone'));
    assert.ok(spawnedDisc.classList.contains('hyperactiveStone-applied'));
    assert.ok(manifestDisc.classList.contains('manifest-stone-aura'));
    assert.ok(!manifestDisc.classList.contains('special-stone'));
    assert.ok(!manifestDisc.classList.contains('theoryIncarnationStone-applied'));
  });

  test('manifestation stone aura CSS defines owner-specific glow selectors', () => {
    const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');

    assert.ok(/\.disc\.manifest-stone-aura\s*\{/.test(boardCss), 'common manifestation aura selector should exist');
    assert.ok(/\.disc\.manifest-stone-aura\.manifest-stone-aura-black\s*\{/.test(boardCss), 'black manifestation aura selector should exist');
    assert.ok(/\.disc\.manifest-stone-aura\.manifest-stone-aura-white\s*\{/.test(boardCss), 'white manifestation aura selector should exist');
  });

  test('diff-renderer renders seed overlay and countdown on empty cells', () => {
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    cardState.markers = [{
      id: 101,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'SEED', remainingOwnerTurns: 5 }
    }];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const cell = boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    assert.ok(cell, 'expected seeded cell');
    assert.ok(cell.classList.contains('seeded-cell'));
    assert.strictEqual(cell.querySelector('.disc'), null);
    assert.ok(cell.querySelector('.seed-mark'));
    assert.strictEqual(cell.querySelector('.seed-turn.countdown-timer').textContent, '5');
  });

  test('diff-renderer shows destroy evade remaining for will hunter king', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board[2][3] = BLACK;
    cardState.markers = [
      {
        id: 21,
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const disc = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
    assert.ok(disc, 'expected will hunter king disc');
    const flipEvadeTimer = disc.querySelector('.flip-evade-timer');
    const destroyEvadeTimer = disc.querySelector('.destroy-evade-timer');
    assert.ok(flipEvadeTimer, 'expected flip evade timer');
    assert.strictEqual(flipEvadeTimer.textContent, '2');
    assert.ok(destroyEvadeTimer, 'expected destroy evade timer');
    assert.strictEqual(destroyEvadeTimer.textContent, '2');
  });

  test('diff-renderer patches regen badge changes without using duration timer', () => {
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[1][2] = BLACK;
    cardState.markers = [
      { id: 23, kind: 'specialStone', row: 1, col: 2, owner: 'black', data: { type: 'REGEN', regenRemaining: 3, remainingOwnerTurns: 3 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    cardState.markers[0].data.regenRemaining = 2;
    diffRenderer.renderBoardDiff(boardEl);

    const disc = boardEl.querySelector('.cell[data-row="1"][data-col="2"] .disc');
    const badges = disc.querySelectorAll('.stone-regen-badge');
    assert.strictEqual(badges.length, 1);
    assert.strictEqual(badges[0].textContent, '2');
    assert.strictEqual(badges[0].getAttribute('data-count'), '2');
    assert.strictEqual(badges[0].querySelector('.stone-regen-badge-value').textContent, '2');
    assert.strictEqual(disc.querySelector('.special-timer'), null);
    assert.strictEqual(boardEl.querySelector('.cell[data-row="1"][data-col="2"]').classList.contains('has-regen-badge'), true);
  });

  test('diff-renderer shows dual evade timers for afterimage will', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board[2][4] = BLACK;
    cardState.markers = [
      {
        id: 22,
        kind: 'specialStone',
        row: 2,
        col: 4,
        owner: 'black',
        data: {
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 3,
          destroyEvadeRemaining: 2
        }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const disc = boardEl.querySelector('.cell[data-row="2"][data-col="4"] .disc');
    assert.ok(disc, 'expected afterimage disc');
    const flipEvadeTimer = disc.querySelector('.flip-evade-timer');
    const destroyEvadeTimer = disc.querySelector('.destroy-evade-timer');
    assert.ok(flipEvadeTimer, 'expected flip evade timer');
    assert.strictEqual(flipEvadeTimer.textContent, '3');
    assert.ok(destroyEvadeTimer, 'expected destroy evade timer');
    assert.strictEqual(destroyEvadeTimer.textContent, '2');
  });

  test('board-renderer keeps hidden trap as normal stone for both seats', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[2][2] = BLACK;
    cardState.markers = [
      {
        id: 22,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'TRAP', remainingOwnerTurns: 1 }
      }
    ];

    global.window.LOCAL_PLAYER_KEY = 'black';

    boardRenderer.renderBoardFull();

    const ownerDisc = boardEl.querySelector('.cell[data-row="2"][data-col="2"] .disc');
    assert.ok(ownerDisc, 'expected trap disc for owner render');
    assert.strictEqual(ownerDisc.querySelector('.special-timer'), null);
    assert.strictEqual(ownerDisc.classList.contains('trap-stone'), false);

    boardEl.innerHTML = '';
    global.window.LOCAL_PLAYER_KEY = 'white';

    boardRenderer.renderBoardFull();

    const opponentDisc = boardEl.querySelector('.cell[data-row="2"][data-col="2"] .disc');
    assert.ok(opponentDisc, 'expected trap disc for opponent render');
    assert.strictEqual(opponentDisc.querySelector('.special-timer'), null);
    assert.strictEqual(opponentDisc.classList.contains('trap-stone'), false);
  });

  test('board-renderer shows bomb countdown for unified TIME_BOMB markers', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[3][3] = WHITE;
    cardState.markers = [{
      id: 23,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'white',
      data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 }
    }];

    boardRenderer.renderBoardFull();

    const disc = boardEl.querySelector('.cell[data-row="3"][data-col="3"] .disc');
    assert.ok(disc, 'expected bomb disc');
    const timer = disc.querySelector('.bomb-timer.countdown-timer');
    assert.ok(timer, 'expected board-renderer bomb timer');
    assert.strictEqual(timer.textContent, '2');
    assert.strictEqual(disc.querySelector('.special-timer'), null);
  });

  test('board-renderer uses shared special-stone timer classes for body duration labels', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    const SpecialStoneRegistry = require('../shared/special-stone-registry.js');
    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    const cases = [
      { type: 'STONE_SALVATION_GOD', row: 0, col: 0, timer: 12 },
      { type: 'LIGHTNING', row: 0, col: 1, timer: 6 },
      { type: 'METEOR_GOD', row: 0, col: 2, timer: 5 }
    ];

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    for (const item of cases) gameState.board[item.row][item.col] = BLACK;
    cardState.markers = cases.map((item, index) => ({
      id: 100 + index,
      kind: 'specialStone',
      row: item.row,
      col: item.col,
      owner: 'black',
      data: { type: item.type, remainingOwnerTurns: item.timer }
    }));

    boardRenderer.renderBoardFull();

    for (const item of cases) {
      const expectedClass = SpecialStoneRegistry.getSpecialStoneTimerClass(item.type, 'special-timer');
      const disc = boardEl.querySelector(`.cell[data-row="${item.row}"][data-col="${item.col}"] .disc`);
      assert.ok(disc, `expected ${item.type} disc`);
      const timer = disc.querySelector(`.${expectedClass}`);
      assert.ok(timer, `expected ${item.type} to use ${expectedClass}`);
      assert.strictEqual(timer.textContent, String(item.timer));
      if (expectedClass !== 'countdown-timer') {
        assert.strictEqual(disc.querySelector('.countdown-timer'), null, `${item.type} should not use countdown timer`);
      }
    }
  });

  test('diff-renderer renders freeze overlay and remaining turns on frozen cells', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[4][4] = BLACK;
    cardState.markers = [
      {
        id: 31,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'FREEZE', remainingOwnerTurns: 5 }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const cell = boardEl.querySelector('.cell[data-row="4"][data-col="4"]');
    assert.ok(cell.classList.contains('frozen-cell'));
    const freezeMark = cell.querySelector('.freeze-mark');
    assert.ok(freezeMark, 'expected freeze overlay');
    assert.strictEqual(freezeMark.querySelector('.freeze-turn').textContent, '5');
  });

  test('diff-renderer marks stones with flip protection using a left-side badge', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[0][0] = BLACK;
    gameState.board[0][1] = BLACK;
    gameState.board[0][2] = BLACK;
    gameState.board[0][3] = BLACK;
    cardState.markers = [
      { id: 41, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'PROTECTED', remainingOwnerTurns: 2 } },
      { id: 42, kind: 'specialStone', row: 0, col: 1, owner: 'black', data: { type: 'PERMA_PROTECTED' } },
      { id: 43, kind: 'specialStone', row: 0, col: 2, owner: 'black', data: { type: 'GHOST', remainingOwnerTurns: 3 } },
      { id: 44, kind: 'specialStone', row: 0, col: 3, owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const protectedDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    const permaDisc = boardEl.querySelector('.cell[data-row="0"][data-col="1"] .disc');
    const ghostDisc = boardEl.querySelector('.cell[data-row="0"][data-col="2"] .disc');
    const guardDisc = boardEl.querySelector('.cell[data-row="0"][data-col="3"] .disc');

    assert.strictEqual(protectedDisc.querySelector('.stone-flip-protection-badge').textContent, '反');
    assert.strictEqual(permaDisc.querySelector('.stone-flip-protection-badge').textContent, '反');
    assert.strictEqual(ghostDisc.querySelector('.stone-flip-protection-badge'), null);
    assert.strictEqual(guardDisc.querySelector('.stone-flip-protection-badge').textContent, '反');
  });

  test('showSpecialStoneInfoAt renders TIME_STOP name and timer', () => {
    if (typeof document === 'undefined') {
      const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
      global.window = dom.window;
      global.document = dom.window.document;
      global.HTMLElement = dom.window.HTMLElement;
    }

    const boardEl = document.getElementById('board') || document.createElement('div');
    boardEl.id = 'board';
    global.boardEl = boardEl;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
    gameState.board[2][2] = BLACK;
    cardState.markers = [
      {
        id: 32,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'TIME_STOP', remainingOwnerTurns: 3 }
      }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);

    const timer = boardEl.querySelector('.cell[data-row="2"][data-col="2"] .countdown-timer');
    assert.ok(timer, 'expected time stop timer');
    assert.strictEqual(timer.textContent, '3');

    assert.strictEqual(diffRenderer.showSpecialStoneInfoAt(2, 2), true);
    assert.strictEqual(document.getElementById('stone-info-name').textContent, '時間停石');
    assert.ok(document.getElementById('stone-info-desc').textContent.includes('時間停止'));
  });

  test('board stylesheet references ICE overlay asset for frozen cells', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles-board.css'), 'utf8');
    assert.ok(css.includes("assets/images/other/ICE.png"));
    assert.ok(css.includes('.freeze-mark'));
  });


});
