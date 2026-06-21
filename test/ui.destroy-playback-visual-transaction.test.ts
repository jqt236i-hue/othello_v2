import { JSDOM } from 'jsdom';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createCardState() {
  return {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null },
    boardBonusByCell: {},
    boardBonusConsumedByCell: {},
    presentationEvents: [],
    _presentationEventsPersist: []
  };
}

describe('destroy playback visual transaction', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).handleCellClick = jest.fn();
    (global as any).getPlayerKey = (player: number) => (player === 1 ? 'black' : 'white');
    (global as any).getLegalMoves = () => [];
    (global as any).CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };
    (global as any).gameState = {
      currentPlayer: 1,
      turnNumber: 1,
      board: createBoard()
    };
    (global as any).cardState = createCardState();
    (global as any).window.DISABLE_ANIMATIONS = false;
  });

  afterEach(() => {
    try {
      const manager = require('../ui/playback-state-manager.js');
      if (manager && typeof manager.clearPlaybackLock === 'function') {
        manager.clearPlaybackLock();
      }
    } catch (e) {
      // ignore cleanup failures in partially implemented red phase
    }
    if (dom && dom.window) dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).boardEl;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).handleCellClick;
    delete (global as any).getPlayerKey;
    delete (global as any).getLegalMoves;
    delete (global as any).CardLogic;
    delete (global as any).gameState;
    delete (global as any).cardState;
  });

  test('claimed destroy playback prevents final empty board diff from removing the target first', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const diff = require('../ui/diff-renderer.js');
    const manager = require('../ui/playback-state-manager.js');
    const boardEl = (global as any).boardEl;

    try {
      (global as any).gameState.board[2][3] = (global as any).WHITE;
      diff.renderBoardDiff(boardEl);

      const targetBefore = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
      expect(targetBefore).toBeTruthy();
      expect(targetBefore.classList.contains('destroy-fade')).toBe(false);

      const claim = manager.claimVisualPlayback({
        source: 'unit-test',
        eventTypes: ['destroy'],
        eventCount: 1
      });
      boardEl.classList.remove('playback-locked');
      (global as any).gameState.board[2][3] = (global as any).EMPTY;

      const changed = diff.renderBoardDiff(boardEl);

      expect(changed).toBe(0);
      const targetDuringClaim = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
      expect(targetDuringClaim).toBeTruthy();
      expect(targetDuringClaim.classList.contains('destroy-fade')).toBe(false);

      manager.releaseVisualPlaybackClaim(claim);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
