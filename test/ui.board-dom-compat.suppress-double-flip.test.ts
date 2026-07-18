describe('DiffRenderer flip suppression (post-playback sync)', () => {
  beforeEach(() => {
    jest.resetModules();
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
    global.countDiscs = () => ({ black: 1, white: 0 });
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
    try { require('../ui/board-renderer.js').getBoardVisualController()?.destroy?.(); } catch (e) { /* cleanup */ }
    delete global.window;
    delete global.document;
    delete global.boardEl;
    delete global.countDiscs;
    delete (global as any).BoardRendererStoneHelpers;
  });

  test('does not apply fallback .flip when __suppressNextDiffFlip is set', async () => {
    const playbackState = require('../ui/playback-state-manager.js');
    const boardRenderer = require('../ui/board-renderer.js');
    await boardRenderer.getBoardVisualControllerReady();
    const diff = require('../ui/board-dom-compat/renderer');
    // Initial state: black stone at (0,0)
    gameState.board[0][0] = BLACK;
    diff.forceFullRender(boardEl);

    // Simulate a post-playback sync: state already flipped to WHITE, and AnimationEngine
    // requested a final emitBoardUpdate() which triggers DiffRenderer.
    gameState.board[0][0] = WHITE;
    playbackState.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'post_playback_sync'
    });

    diff.renderBoardDiff(boardEl);

    const cell = document.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();
    const disc = cell.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(disc.classList.contains('white')).toBe(true);
    expect(disc.classList.contains('flip')).toBe(false);
    expect(playbackState.getBoardUpdateContext()).toBeNull();
  });

  test('does not apply snapshot diff while pending playback is still queued', async () => {
    const playbackState = require('../ui/playback-state-manager.js');
    const boardUpdateSyncRuntime = require('../ui/board-update-sync-runtime.js');
    const boardRenderer = require('../ui/board-renderer.js');
    await boardRenderer.getBoardVisualControllerReady();
    const diff = require('../ui/board-dom-compat/renderer');
    gameState.board[0][0] = BLACK;
    diff.forceFullRender(boardEl);

    gameState.board[0][0] = WHITE;
    cardState._presentationEventsPersist = [
      {
        type: 'PLAYBACK_EVENTS',
        events: [{ type: 'flip', phase: 1, targets: [{ r: 0, col: 0, ownerBefore: 'black', ownerAfter: 'white' }] }]
      }
    ];
    boardUpdateSyncRuntime.armBoardUpdateSyncContext({
      allowBoardUpdateDuringPlayback: true,
      source: 'unit-test',
      reason: 'network_snapshot_refresh'
    });
    playbackState.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'unit-test',
      reason: 'network_snapshot_refresh'
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const updated = diff.renderBoardDiff(boardEl);
    warnSpy.mockRestore();

    const cell = document.querySelector('.cell[data-row="0"][data-col="0"]');
    expect(cell).toBeTruthy();
    const disc = cell.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(updated).toBe(0);
    expect(disc.classList.contains('black')).toBe(true);
    expect(disc.classList.contains('white')).toBe(false);
    expect(disc.classList.contains('flip')).toBe(false);
  });
});
