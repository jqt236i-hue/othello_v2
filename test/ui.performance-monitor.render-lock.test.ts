import { JSDOM } from 'jsdom';
import path from 'path';

function resetPerfGlobals() {
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).BLACK;
  delete (global as any).WHITE;
  delete (global as any).EMPTY;
  delete (global as any).gameState;
  delete (global as any).cardState;
  delete (global as any).boardEl;
  delete (global as any).getPlayerKey;
  delete (global as any).CardLogic;
  delete (global as any).renderBoardDiff;
  delete (global as any).countDiscs;
  delete (global as any).CARD_DEFS;
  delete (global as any).onCardClick;
  delete (global as any).updateCardDetailPanel;
  delete (global as any).MATCH_MODE;
}

describe('UI performance monitor render and lock integration', () => {
  beforeEach(() => {
    jest.resetModules();
    resetPerfGlobals();
  });

  afterEach(() => {
    try {
      const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
      if (monitor && typeof monitor.resetPerformanceMetrics === 'function') {
        monitor.resetPerformanceMetrics();
      }
    } catch (e) { /* ignore */ }
    if ((global as any).window && typeof (global as any).window.close === 'function') {
      (global as any).window.close();
    }
    resetPerfGlobals();
  });

  test('PlaybackStateManager records playback lock duration', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (dom.window as any).CARD_REVERSI_PERF_MONITOR = true;
    let now = 100;
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    monitor.configurePerformanceMonitor({ enabled: true, now: () => now });

    const manager = require(path.resolve(__dirname, '../ui/playback-state-manager.js'));
    manager.beginPlayback();
    now = 145;
    manager.finalizePlayback();

    const lockSpans = monitor.getPerformanceSnapshot().spans.filter((span: any) => span.name === 'playback.lock');
    expect(lockSpans).toHaveLength(1);
    expect(lockSpans[0]).toMatchObject({
      durationMs: 45,
      endMeta: { reason: 'finalizePlayback' }
    });
  });

  test('BoardRenderer records renderBoard calls and duration', () => {
    const dom = new JSDOM(
      '<!doctype html><html><body><div id="board"></div><div id="occ-black"></div><div id="occ-white"></div></body></html>'
    );
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (dom.window as any).CARD_REVERSI_PERF_MONITOR = true;
    let now = 200;
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    monitor.configurePerformanceMonitor({
      enabled: true,
      now: () => {
        now += 7;
        return now;
      }
    });

    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).gameState = { currentPlayer: 1, board: [[1, 0], [-1, 0]] };
    (global as any).cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      markers: []
    };
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).getPlayerKey = (player: number) => player === -1 ? 'white' : 'black';
    (global as any).CardLogic = { getSelectableTargets: () => [] };
    (global as any).renderBoardDiff = jest.fn();
    (global as any).countDiscs = () => ({ black: 1, white: 1 });

    const boardRenderer = require(path.resolve(__dirname, '../ui/board-renderer.js'));
    boardRenderer.renderBoard();

    const snapshot = monitor.getPerformanceSnapshot();
    expect(snapshot.counters['ui.renderBoard.calls'].count).toBe(1);
    expect(snapshot.spans.filter((span: any) => span.name === 'ui.renderBoard')).toHaveLength(1);
    expect((global as any).renderBoardDiff).toHaveBeenCalled();
  });

  test('CardRenderer records renderCardUI calls and duration', () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div id="deck-black"><div class="deck-count"></div></div>
        <div id="deck-white"><div class="deck-count"></div></div>
        <div id="hand-black"></div>
        <div id="hand-white"></div>
        <div id="charge-black"></div>
        <div id="charge-white"></div>
        <div id="discard-count"></div>
        <div id="active-black"><div class="effect-slot-content"></div></div>
        <div id="active-white"><div class="effect-slot-content"></div></div>
      </body></html>`
    );
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (dom.window as any).CARD_REVERSI_PERF_MONITOR = true;
    let now = 300;
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    monitor.configurePerformanceMonitor({
      enabled: true,
      now: () => {
        now += 11;
        return now;
      }
    });

    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).MATCH_MODE = 'cpu';
    (global as any).gameState = { currentPlayer: 1, board: [[0]] };
    (global as any).cardState = {
      turnIndex: 1,
      charge: { black: 0, white: 0 },
      chargeDeltaEvents: [],
      hands: { black: [], white: [] },
      decks: { black: [], white: [] },
      discard: [],
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      activeEffectsByPlayer: { black: [], white: [] },
      selectedCardId: null,
      selectedCardOwnerKey: null
    };
    (global as any).CARD_DEFS = [];
    (global as any).onCardClick = jest.fn();
    (global as any).updateCardDetailPanel = jest.fn();

    const cardRenderer = require(path.resolve(__dirname, '../cards/card-renderer.js'));
    cardRenderer.renderCardUI();

    const snapshot = monitor.getPerformanceSnapshot();
    expect(snapshot.counters['ui.renderCardUI.calls'].count).toBe(1);
    expect(snapshot.spans.filter((span: any) => span.name === 'ui.renderCardUI')).toHaveLength(1);
  });
});
