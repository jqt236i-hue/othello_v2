import { JSDOM } from 'jsdom';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.boardEl = document.getElementById('board');
  return dom;
}

function setupGlobalsForWhiteNetworkTurn() {
  global.BLACK = 1;
  global.WHITE = -1;
  global.EMPTY = 0;
  global.handleCellClick = jest.fn();
  global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
  global.getLegalMoves = jest.fn(() => [{ row: 2, col: 3, flips: [[2, 4]] }]);
  global.applyStoneVisualEffect = jest.fn();
  global.renderBoardDiff = jest.fn();
  global.updateOccupancyUI = jest.fn();
  global.renderCardUI = jest.fn();

  global.CardLogic = {
    getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
    getSelectableTargets: () => []
  };

  global.gameState = {
    currentPlayer: global.WHITE,
    board: createBoard()
  };

  global.cardState = {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null },
    presentationEvents: [],
    _presentationEventsPersist: []
  };

  window.MATCH_MODE = 'network';
  window.LOCAL_PLAYER_KEY = 'white';
  window.BOARD_VIEWER_KEY = 'white';
  window.__LOCAL_PLAYER_KEY = 'white';
}

function cleanupGlobals(dom) {
  try {
    if (dom && dom.window && typeof dom.window.close === 'function') {
      dom.window.close();
    }
  } catch (e) {
    // ignore
  }

  delete global.window;
  delete global.document;
  delete global.boardEl;
  delete global.BLACK;
  delete global.WHITE;
  delete global.EMPTY;
  delete global.handleCellClick;
  delete global.getPlayerKey;
  delete global.getLegalMoves;
  delete global.applyStoneVisualEffect;
  delete global.renderBoardDiff;
  delete global.updateOccupancyUI;
  delete global.renderCardUI;
  delete global.CardLogic;
  delete global.gameState;
  delete global.cardState;
}

describe('network legal hints for join seat', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = setupDom();
    setupGlobalsForWhiteNetworkTurn();
  });

  afterEach(() => {
    cleanupGlobals(dom);
  });

  test('board-renderer shows legal hints for white joiner on white turn', () => {
    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.renderBoardFull();

    const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    expect(global.getLegalMoves).toHaveBeenCalledTimes(1);
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('diff-renderer shows legal hints for white joiner on white turn', () => {
    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(global.boardEl);

    const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    expect(global.getLegalMoves).toHaveBeenCalledTimes(1);
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('diff-renderer adds time-stop legal emphasis when time stop class is active', () => {
    const diffRenderer = require('../ui/diff-renderer.js');
    document.documentElement.classList.add('time-stop-active');
    document.body.classList.add('time-stop-active');
    diffRenderer.renderBoardDiff(global.boardEl);

    const legalCell = global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
    expect(legalCell.classList.contains('time-stop-legal-emphasis')).toBe(true);
  });
});
