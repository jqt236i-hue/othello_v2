const { JSDOM } = require('jsdom');

describe('board-renderer fallback legal hints', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    global.getPlayerKey = (player) => (player === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = jest.fn(() => [{ row: 0, col: 0 }]);
    global.countDiscs = jest.fn(() => ({ black: 0, white: 0 }));
    global.handleCellClick = jest.fn();
    global.applyStoneVisualEffect = jest.fn();
    global.renderBoardDiff = jest.fn();
    global.updateOccupancyUI = jest.fn();
    global.renderCardUI = jest.fn();

    global.CardLogic = {
      getCardContext: () => ({
        protectedStones: [{ row: 4, col: 4 }],
        permaProtectedStones: [{ row: 5, col: 5 }],
        bombs: []
      }),
      getSelectableTargets: () => []
    };

    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };

    global.cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null }
    };
  });

  afterEach(() => {
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
    delete global.getPlayerKey;
    delete global.getLegalMoves;
    delete global.countDiscs;
    delete global.handleCellClick;
    delete global.applyStoneVisualEffect;
    delete global.renderBoardDiff;
    delete global.updateOccupancyUI;
    delete global.renderCardUI;
    delete global.CardLogic;
    delete global.gameState;
    delete global.cardState;
  });

  test('renderBoardFull passes protected and perma arrays to getLegalMoves', () => {
    const boardRenderer = require('../ui/board-renderer');

    boardRenderer.renderBoardFull();

    expect(global.getLegalMoves).toHaveBeenCalledWith(
      global.gameState,
      [{ row: 4, col: 4 }],
      [{ row: 5, col: 5 }]
    );

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('renderBoardFull marks all empty cells as legal-free for UDR pending placement', () => {
    global.getLegalMoves.mockReturnValue([]);
    global.CardLogic.isFreePlacementPendingType = (type) => type === 'ULTIMATE_REVERSE_DRAGON';
    global.cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_REVERSE_DRAGON',
      stage: null,
      cardId: 'udr_01'
    };

    const boardRenderer = require('../ui/board-renderer');
    boardRenderer.renderBoardFull();

    const legalFreeCells = global.boardEl.querySelectorAll('.cell.legal-free');
    const normalLegalCells = global.boardEl.querySelectorAll('.cell.legal');
    expect(legalFreeCells).toHaveLength(64);
    expect(normalLegalCells).toHaveLength(0);
  });

  test('renderBoard skips diff render while PLAYBACK_EVENTS are pending', () => {
    global.cardState.presentationEvents = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hyperactive_move', phase: 1 }] }
    ];

    const boardRenderer = require('../ui/board-renderer');
    boardRenderer.renderBoard();

    expect(global.renderBoardDiff).not.toHaveBeenCalled();
    expect(global.updateOccupancyUI).not.toHaveBeenCalled();
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });

  test('renderBoard toggles time-stop-active class from card state', () => {
    const boardRenderer = require('../ui/board-renderer');

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoard();

    expect(document.documentElement.classList.contains('time-stop-active')).toBe(true);
    expect(document.body.classList.contains('time-stop-active')).toBe(true);

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 0 };
    boardRenderer.renderBoard();

    expect(document.documentElement.classList.contains('time-stop-active')).toBe(false);
    expect(document.body.classList.contains('time-stop-active')).toBe(false);
  });

  test('renderBoardFull adds time-stop legal emphasis to legal cells during time stop', () => {
    const boardRenderer = require('../ui/board-renderer');

    global.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 1, white: 0 };
    boardRenderer.renderBoardFull();

    const legalCell = global.boardEl.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(legalCell).toBeTruthy();
    expect(legalCell.classList.contains('legal')).toBe(true);
    expect(legalCell.classList.contains('time-stop-legal-emphasis')).toBe(true);
  });

  test('renderBoardFull skips full redraw while persisted PLAYBACK_EVENTS are pending', () => {
    global.boardEl.innerHTML = '<div class="sentinel"></div>';
    global.cardState._presentationEventsPersist = [
      { type: 'PLAYBACK_EVENTS', events: [{ type: 'hyperactive_move', phase: 1 }] }
    ];

    const boardRenderer = require('../ui/board-renderer');
    boardRenderer.renderBoardFull();

    expect(global.getLegalMoves).not.toHaveBeenCalled();
    expect(global.boardEl.querySelector('.sentinel')).toBeTruthy();
  });
});
