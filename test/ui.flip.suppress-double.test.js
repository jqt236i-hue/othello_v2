describe('DiffRenderer flip suppression (post-playback sync)', () => {
  beforeEach(() => {
    // Minimal DOM (this repo's Jest environment may be "node", so create JSDOM explicitly)
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    // Minimal globals used by diff-renderer.js
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
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.boardEl;
  });

  test('does not apply fallback .flip when __suppressNextDiffFlip is set', () => {
    const diff = require('../ui/diff-renderer');

    // Initial state: black stone at (0,0)
    gameState.board[0][0] = BLACK;
    diff.forceFullRender(boardEl);

    // Simulate a post-playback sync: state already flipped to WHITE, and AnimationEngine
    // requested a final emitBoardUpdate() which triggers DiffRenderer.
    gameState.board[0][0] = WHITE;
    window.__suppressNextDiffFlip = true;

    diff.renderBoardDiff(boardEl);

    const cell = document.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();
    const disc = cell.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(disc.classList.contains('white')).toBe(true);
    expect(disc.classList.contains('flip')).toBe(false);
    expect(window.__suppressNextDiffFlip).not.toBe(true);
  });
});
