const path = require('path');


describe('DiffRenderer fallback flip', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    // cleanup globals
    delete global.gameState;
    delete global.cardState;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    document.body.innerHTML = '';
  });

  test('uses AnimationShared.triggerFlip and schedules AnimationShared.removeFlip', () => {
    const mockTrigger = jest.fn();
    const mockRemove = jest.fn();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      triggerFlip: mockTrigger,
      removeFlip: mockRemove,
      getTimer: () => ({ setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: () => {}, clearAll: () => {}, pendingCount: () => 0, newScope: () => null, clearScope: () => {} })
    }));

    const diff = require('../ui/diff-renderer');

    // Minimal fake DOM implementation sufficient for DiffRenderer's needs in this test
    function makeEl() {
      const children = [];
      return {
        children,
        className: '',
        dataset: {},
        innerHTML: '',
        style: { setProperty: () => {} },
        appendChild(child) { children.push(child); },
        querySelector(sel) { return children.find(ch => ch.className && ch.className.indexOf(sel.replace('.', '')) !== -1) || null; },
        addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } }
      };
    }
    global.document = {
      createElement: () => makeEl(),
      body: makeEl(),
      getElementById: (id) => global.document.body
    };
    const board = global.document.getElementById('board');

    // Basic constants and state for a single flip at [0][0]
    global.BLACK = 1; global.WHITE = -1; global.EMPTY = 0;

    // no cardState/markers to avoid invoking CardLogic in this unit test
    global.cardState = null;
    // minimal helper stubs used by DiffRenderer
    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = () => [];
    global.CardLogic = {};
    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };

    // initial stone is BLACK at 0,0
    gameState.board[0][0] = global.BLACK;

    // initial render to set previousBoardState
    diff.renderBoardDiff(board);

    // change owner to WHITE (causes fallback flip on re-render)
    gameState.board[0][0] = global.WHITE;

    const updated = diff.renderBoardDiff(board);
    expect(updated).toBeGreaterThan(0);
    // triggerFlip should have been called once
    expect(mockTrigger).toHaveBeenCalledTimes(1);

    // advance timers to allow scheduled removeFlip to run
    jest.advanceTimersByTime(700);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  test('applies destroy-fade fallback and uses AnimationShared.getTimer', () => {
    const mockTimerSet = jest.fn();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => ({ setTimeout: mockTimerSet, clearTimeout: () => {} })
    }));

    const diff = require('../ui/diff-renderer');

    function makeEl() {
      const children = [];
      return {
        children,
        className: '',
        dataset: {},
        innerHTML: '',
        style: { setProperty: () => {} },
        appendChild(child) { children.push(child); },
        querySelector(sel) { return children.find(ch => ch.className && ch.className.indexOf(sel.replace('.', '')) !== -1) || null; },
        addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } }
      };
    }
    global.document = {
      createElement: () => makeEl(),
      body: makeEl(),
      getElementById: (id) => global.document.body
    };
    const board = global.document.getElementById('board');

    global.BLACK = 1; global.WHITE = -1; global.EMPTY = 0;
    global.cardState = null;
    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = () => [];
    global.CardLogic = {};

    // initial state: stone present
    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.BLACK))
    };

    // initial render
    diff.renderBoardDiff(board);

    // change a cell to EMPTY to force destroy-fade
    gameState.board[0][0] = global.EMPTY;

    diff.renderBoardDiff(board);
    expect(mockTimerSet).toHaveBeenCalled();
  });
});