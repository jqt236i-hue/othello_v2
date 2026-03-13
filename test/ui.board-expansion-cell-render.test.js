const { JSDOM } = require('jsdom');

describe('DiffRenderer board expansion cell rendering', () => {
  beforeEach(() => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = () => {};
    global.getPlayerKey = (p) => (p === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = () => [];
    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };

    global.cardState = { markers: [], pendingEffectByPlayer: { black: null, white: null } };
    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY)),
      boardExpansion: {
        active: true,
        side: 'left',
        row: 2,
        owner: global.EMPTY,
        usedByPlayer: { black: true, white: false }
      }
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

  test('keeps expansion classes after render updates', () => {
    const diff = require('../ui/diff-renderer');
    diff.resetRenderStats();

    diff.renderBoardDiff(boardEl);

    const expansionCell = boardEl.querySelector('.cell-expanded-left[data-row="2"][data-col="-1"]');
    expect(expansionCell).toBeTruthy();
    expect(expansionCell.classList.contains('cell-expanded')).toBe(true);
    expect(expansionCell.style.left).toBe('-12.5%');
    expect(expansionCell.classList.contains('cell-expanded-reveal')).toBe(false);

    diff.renderBoardDiff(boardEl);

    const expansionCellAfter = boardEl.querySelector('.cell-expanded-left[data-row="2"][data-col="-1"]');
    expect(expansionCellAfter).toBeTruthy();
    expect(expansionCellAfter.classList.contains('cell-expanded')).toBe(true);
  });

  test('renders multiple expansion cells when defined in cells[]', () => {
    const diff = require('../ui/diff-renderer');
    diff.resetRenderStats();
    global.gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 5,
      owner: global.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'left', row: 2, owner: global.EMPTY },
        { side: 'right', row: 5, owner: global.EMPTY }
      ]
    };

    diff.renderBoardDiff(boardEl);

    const leftCell = boardEl.querySelector('.cell-expanded-left[data-row="2"][data-col="-1"]');
    const rightCell = boardEl.querySelector('.cell-expanded-right[data-row="5"][data-col="8"]');
    expect(leftCell).toBeTruthy();
    expect(rightCell).toBeTruthy();
    expect(boardEl.classList.contains('board-expanded-left')).toBe(true);
    expect(boardEl.classList.contains('board-expanded-right')).toBe(true);
  });

  test('renders top/corner/bottom expansion cells with expected positions', () => {
    const diff = require('../ui/diff-renderer');
    diff.resetRenderStats();
    global.gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -1,
      owner: global.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'top', row: -1, col: 0, owner: global.EMPTY },
        { side: 'left', row: -1, col: -1, owner: global.EMPTY },
        { side: 'bottom', row: 8, col: 7, owner: global.EMPTY }
      ]
    };

    diff.renderBoardDiff(boardEl);

    const topCell = boardEl.querySelector('.cell-expanded-top[data-row="-1"][data-col="0"]');
    const cornerCell = boardEl.querySelector('.cell-expanded-left[data-row="-1"][data-col="-1"]');
    const bottomCell = boardEl.querySelector('.cell-expanded-bottom[data-row="8"][data-col="7"]');

    expect(topCell).toBeTruthy();
    expect(cornerCell).toBeTruthy();
    expect(bottomCell).toBeTruthy();

    expect(topCell.style.top).toBe('-12.5%');
    expect(topCell.style.left).toBe('0%');
    expect(cornerCell.style.top).toBe('-12.5%');
    expect(cornerCell.style.left).toBe('-12.5%');
    expect(bottomCell.style.top).toBe('100%');
    expect(bottomCell.style.left).toBe('87.5%');

    expect(boardEl.classList.contains('board-expanded-top')).toBe(true);
    expect(boardEl.classList.contains('board-expanded-bottom')).toBe(true);
  });

  test('adds fade-in class only to newly appeared expansion cells', () => {
    const diff = require('../ui/diff-renderer');
    diff.resetRenderStats();

    global.gameState.boardExpansion = null;
    diff.renderBoardDiff(boardEl);

    global.gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 2,
      owner: global.EMPTY,
      usedByPlayer: { black: true, white: false }
    };
    diff.renderBoardDiff(boardEl);

    const newCell = boardEl.querySelector('.cell-expanded-left[data-row="2"][data-col="-1"]');
    expect(newCell).toBeTruthy();
    expect(newCell.classList.contains('cell-expanded-reveal')).toBe(true);

    global.gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 5,
      owner: global.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'left', row: 2, owner: global.EMPTY },
        { side: 'right', row: 5, owner: global.EMPTY }
      ]
    };
    diff.renderBoardDiff(boardEl);

    const oldCell = boardEl.querySelector('.cell-expanded-left[data-row="2"][data-col="-1"]');
    const addedCell = boardEl.querySelector('.cell-expanded-right[data-row="5"][data-col="8"]');
    expect(oldCell).toBeTruthy();
    expect(addedCell).toBeTruthy();
    expect(oldCell.classList.contains('cell-expanded-reveal')).toBe(false);
    expect(addedCell.classList.contains('cell-expanded-reveal')).toBe(true);
  });
});
