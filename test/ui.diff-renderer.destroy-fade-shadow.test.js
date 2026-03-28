const { JSDOM } = require('jsdom');

describe('DiffRenderer destroy-fade cleanup', () => {
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

  test('removes has-disc after deferred destroy cleanup', () => {
    const diff = require('../ui/diff-renderer');

    gameState.board[0][0] = BLACK;
    diff.renderBoardDiff(boardEl);

    const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();
    expect(cell.classList.contains('has-disc')).toBe(true);

    gameState.board[0][0] = EMPTY;
    diff.renderBoardDiff(boardEl);

    const fadingDisc = cell.querySelector('.disc');
    expect(fadingDisc).toBeTruthy();
    expect(fadingDisc.classList.contains('destroy-fade')).toBe(true);

    jest.advanceTimersByTime(700);

    expect(cell.classList.contains('has-disc')).toBe(false);
    expect(cell.querySelector('.disc')).toBeNull();
  });

  test('reconciles stale has-disc class even when state is unchanged', () => {
    const diff = require('../ui/diff-renderer');

    diff.renderBoardDiff(boardEl);

    const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();
    expect(cell.querySelector('.disc')).toBeNull();

    cell.classList.add('has-disc');
    expect(cell.classList.contains('has-disc')).toBe(true);

    diff.renderBoardDiff(boardEl);

    expect(cell.querySelector('.disc')).toBeNull();
    expect(cell.classList.contains('has-disc')).toBe(false);
  });

  test('reconciles stale legal hint classes even when state is unchanged', () => {
    const diff = require('../ui/diff-renderer');

    diff.renderBoardDiff(boardEl);

    const cell = boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();

    cell.classList.add(
      'legal',
      'legal-free',
      'effect-target-highlight',
      'selectable-friendly',
      'selectable-friendly-no-circle',
      'time-stop-legal-emphasis'
    );

    diff.renderBoardDiff(boardEl);

    expect(cell.classList.contains('legal')).toBe(false);
    expect(cell.classList.contains('legal-free')).toBe(false);
    expect(cell.classList.contains('effect-target-highlight')).toBe(false);
    expect(cell.classList.contains('selectable-friendly')).toBe(false);
    expect(cell.classList.contains('selectable-friendly-no-circle')).toBe(false);
    expect(cell.classList.contains('time-stop-legal-emphasis')).toBe(false);
  });
});
