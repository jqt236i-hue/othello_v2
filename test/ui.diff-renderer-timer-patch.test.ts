import { JSDOM } from 'jsdom';

function installGlobals() {
  (global as any).BLACK = 1;
  (global as any).WHITE = -1;
  (global as any).EMPTY = 0;
  (global as any).getLegalMoves = () => [];
  (global as any).getPlayerKey = (player: number) => player === 1 ? 'black' : 'white';
  (global as any).CardLogic = { getCardContext: () => ({}) };
  (global as any).applyStoneVisualEffect = jest.fn();
  (global as any).gameState = {
    currentPlayer: 1,
    board: Array.from({ length: 8 }, () => Array(8).fill(0))
  };
  (global as any).cardState = {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null }
  };
}

describe('diff renderer timed marker patch', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    document.body.innerHTML = '<div id="board"></div>';
    document.documentElement.classList.add('stone-images-loaded', 'stone-base-images-ready');
    installGlobals();
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).getLegalMoves;
    delete (global as any).getPlayerKey;
    delete (global as any).CardLogic;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).boardEl;
  });

  test('updates only UDG timer text when the stone and marker identity stay the same', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'udg-1', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(firstDisc).toBeTruthy();
    expect(boardEl.querySelector('.udg-timer')!.textContent).toBe('8');

    (global as any).cardState.markers[0].data.remainingOwnerTurns = 7;
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).toBe(firstDisc);
    expect(boardEl.querySelector('.udg-timer')!.textContent).toBe('7');
  });

  test('falls back to full cell update when the marker type changes', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'marker-1', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');

    (global as any).cardState.markers[0].data.type = 'DRAGON';
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).not.toBe(firstDisc);
  });

  test('falls back to full cell update when the primary duration timer is removed', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'hyper-1', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'HYPERACTIVE', remainingOwnerTurns: 4, flipEvadeRemaining: 2 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(boardEl.querySelector('.special-timer')!.textContent).toBe('4');
    expect(boardEl.querySelector('.flip-evade-timer')!.textContent).toBe('2');

    delete (global as any).cardState.markers[0].data.remainingOwnerTurns;
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).not.toBe(firstDisc);
    expect(boardEl.querySelector('.special-timer')).toBeNull();
    expect(boardEl.querySelector('.flip-evade-timer')!.textContent).toBe('2');
  });

  test('falls back to full cell update when a conditional evade timer is cleared', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'hyper-2', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'HYPERACTIVE', remainingOwnerTurns: 3, flipEvadeRemaining: 2 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(boardEl.querySelector('.flip-evade-timer')!.textContent).toBe('2');

    (global as any).cardState.markers[0].data.flipEvadeRemaining = null;
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).not.toBe(firstDisc);
    expect(boardEl.querySelector('.flip-evade-timer')).toBeNull();
    expect(boardEl.querySelector('.special-timer')!.textContent).toBe('3');
  });
});
