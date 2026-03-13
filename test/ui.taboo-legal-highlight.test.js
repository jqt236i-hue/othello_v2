const { JSDOM } = require('jsdom');

describe('TABOO_REVERSE_WILL legal hint highlight', () => {
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
      { row: 2, col: 3, flips: [[3, 3]] },
      { row: 3, col: 3, flips: [[4, 3]] }
    ];

    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => [],
      getTabooReverseCandidates: (_cardState, _gameState, _playerKey, row, col) => {
        if (row === 2 && col === 3) {
          return [{ direction: [0, 1], flips: [{ row: 2, col: 4 }, { row: 2, col: 5 }], score: 2 }];
        }
        if (row === 4 && col === 4) {
          return [{ direction: [0, 1], flips: [{ row: 2, col: 4 }, { row: 2, col: 5 }], score: 2 }];
        }
        return [];
      }
    };

    global.cardState = {
      markers: [],
      pendingEffectByPlayer: {
        black: { type: 'TABOO_REVERSE_WILL', stage: null, cardId: 'taboo_reverse_01' },
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

  test('shows normal-only as green and taboo-available cells as red', () => {
    const diff = require('../ui/diff-renderer');
    diff.renderBoardDiff(boardEl);

    const tabooAndNormalCell = boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
    const normalOnlyCell = boardEl.querySelector('.cell[data-row="3"][data-col="3"]');
    const tabooOnlyCell = boardEl.querySelector('.cell[data-row="4"][data-col="4"]');

    expect(tabooAndNormalCell).toBeTruthy();
    expect(normalOnlyCell).toBeTruthy();
    expect(tabooOnlyCell).toBeTruthy();

    expect(tabooAndNormalCell.classList.contains('legal')).toBe(true);
    expect(tabooAndNormalCell.classList.contains('effect-target-highlight')).toBe(true);

    expect(normalOnlyCell.classList.contains('legal')).toBe(true);
    expect(normalOnlyCell.classList.contains('effect-target-highlight')).toBe(false);

    expect(tabooOnlyCell.classList.contains('legal')).toBe(true);
    expect(tabooOnlyCell.classList.contains('effect-target-highlight')).toBe(true);
  });
});
