import { JSDOM } from 'jsdom';

describe('LIGHTNING_WILL legal hint rendering', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    global.handleCellClick = () => {};
    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = () => [
      { row: 2, col: 3, flips: [[2, 4]] }
    ];

    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };

    global.cardState = {
      markers: [],
      pendingEffectByPlayer: {
        black: { type: 'LIGHTNING_WILL', stage: null, cardId: 'lightning_01' },
        white: null
      }
    };

    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
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

  test('pending中でも合法手のみを表示し、全空きマスを legal-free にしない', () => {
    const diff = require('../ui/board-dom-compat/renderer');
    diff.renderBoardDiff(boardEl);

    const legalCell = boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    const nonLegalCell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    const freeHintCells = boardEl.querySelectorAll('.cell.legal-free');

    expect(legalCell).toBeTruthy();
    expect(nonLegalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
    expect(legalCell.classList.contains('legal-free')).toBe(false);
    expect(nonLegalCell.classList.contains('legal')).toBe(false);
    expect(nonLegalCell.classList.contains('legal-free')).toBe(false);
    expect(freeHintCells.length).toBe(0);
  });
});
