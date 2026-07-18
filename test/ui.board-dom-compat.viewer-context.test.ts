import { JSDOM } from 'jsdom';

describe('DiffRenderer viewer context', () => {
  function setupRuntime(overrides: any = {}) {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.boardEl = document.getElementById('board');
    window.requestAnimationFrame = (cb) => cb(0);

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = () => {};
    global.getPlayerKey = (p) => (p === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = jest.fn(() => [{ row: 2, col: 3 }]);
    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };
    global.cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: {}
    };
    global.gameState = {
      currentPlayer: global.WHITE,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };
    Object.assign(window, overrides.window || {});
    Object.assign(global.cardState, overrides.cardState || {});
    Object.assign(global.gameState, overrides.gameState || {});
    return require('../ui/board-dom-compat/renderer');
  }

  afterEach(() => {
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

  function renderAndReadLegalCell(diff) {
    diff.resetRenderStats();
    diff.renderBoardDiff(global.boardEl);
    return global.boardEl.querySelector('.cell[data-row="2"][data-col="3"]');
  }

  test('network mode uses the active NetworkMatchClient seat to show legal hints', () => {
    const diff = setupRuntime({
      window: {
        MATCH_MODE: 'network',
        NetworkMatchClient: {
          isActive: () => true,
          getSeatKey: () => 'white'
        }
      }
    });

    const legalCell = renderAndReadLegalCell(diff);

    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('network mode hides current-turn legal hints for the opposite seat', () => {
    const diff = setupRuntime({
      window: {
        MATCH_MODE: 'network',
        NetworkMatchClient: {
          isActive: () => true,
          getSeatKey: () => 'black'
        }
      }
    });

    const legalCell = renderAndReadLegalCell(diff);

    expect(legalCell.classList.contains('legal')).toBe(false);
  });

  test.each(['LOCAL_PLAYER_KEY', '__LOCAL_PLAYER_KEY', 'BOARD_VIEWER_KEY'])(
    'local viewer key %s can operate a fate-controlled turn',
    (key) => {
      const diff = setupRuntime({
        window: { [key]: 'white' },
        cardState: { fateWillControllerByTurnOwner: { white: 'white' } }
      });

      const legalCell = renderAndReadLegalCell(diff);

      expect(legalCell.classList.contains('legal')).toBe(true);
    }
  );

  test('human-vs-human debug mode lets the white turn show legal hints locally', () => {
    const diff = setupRuntime({
      window: { DEBUG_HUMAN_VS_HUMAN: true }
    });

    const legalCell = renderAndReadLegalCell(diff);

    expect(legalCell.classList.contains('legal')).toBe(true);
  });

  test('missing window and missing network client fall back without throwing', () => {
    jest.resetModules();
    delete global.window;
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.getPlayerKey = (p) => (p === global.BLACK ? 'black' : 'white');
    global.getLegalMoves = jest.fn(() => []);
    global.CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };
    global.cardState = { markers: [], pendingEffectByPlayer: {} };
    global.gameState = {
      currentPlayer: global.BLACK,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.EMPTY))
    };
    const diff = require('../ui/board-dom-compat/renderer');

    expect(() => diff.buildCurrentCellState()).not.toThrow();
  });
});
