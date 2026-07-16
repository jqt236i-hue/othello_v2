import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightPage, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
}

async function openPixiDebugLane(page: any, serverPort: number): Promise<void> {
  await page.goto(
    `http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=pixi&noanim=1`,
    { waitUntil: 'domcontentloaded' }
  );
  await closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => (
    window.__uiInitialized === true
    && !!window.__boardVisualDebug
    && window.__boardVisualDebug.getBackendKind() === 'pixi'
    && typeof window.require === 'function'
  ), undefined, { timeout: 30000 });
  await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());
}

describe('DESTROY_ONE_STONE destroy evade E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  let page = null;

  beforeAll(async () => {
    serverProc = startServer(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    serverPort = serverProc.address().port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightPage(page, 10000);
    page = null;
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(serverProc);
    serverProc = null;
  }, 30000);

  test('破壊の意志で意志狩りの王を選んだ時は破壊回避して表示も移動先へ残る', async () => {
    page = await browser.newPage();

    await openPixiDebugLane(page, serverPort);
    await page.waitForFunction(
      () => {
        const destroyModule = typeof window.require === 'function'
          ? window.require('game/card-effects/destroy.js')
          : null;
        return !!(window.gameState && window.cardState && destroyModule && destroyModule.executeDestroy);
      },
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      const playbackState = typeof window.require === 'function'
        ? window.require('ui/playback-state-manager.js')
        : null;
      if (window.AnimationEngine && typeof window.AnimationEngine.abortAndSync === 'function') {
        window.AnimationEngine.abortAndSync();
      }
      if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
        playbackState.clearPlaybackLock();
      }
      window.waitForPlaybackIdle = () => Promise.resolve();
      window.VisualPlaybackActive = false;
      isProcessing = false;
      isCardAnimating = false;
      window.isProcessing = false;
      window.isCardAnimating = false;
    });
    await page.waitForFunction(() => {
      const bareAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
      return window.VisualPlaybackActive !== true && bareAnimating !== true;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const Shared = window.require('shared-constants.js');
      const BLACK = Shared.BLACK;
      const WHITE = Shared.WHITE;
      const EMPTY = Shared.EMPTY;
      const gs = window.gameState;
      const cs = window.cardState;

      window.DEBUG_HUMAN_VS_HUMAN = true;
      isProcessing = false;
      isCardAnimating = false;
      window.isProcessing = false;
      window.isCardAnimating = false;

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          gs.board[row][col] = BLACK;
        }
      }
      gs.board[1][1] = WHITE;
      gs.board[4][4] = WHITE;
      gs.board[0][0] = EMPTY;
      gs.board[7][7] = EMPTY;
      gs.currentPlayer = BLACK;
      gs.turnNumber = 1;
      gs.consecutivePasses = 0;

      cs.markers = [{
        id: 8451,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 1
        }
      }];
      cs.pendingEffectByPlayer = {
        black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget', cardId: 'destroy_01' },
        white: null
      };
      cs.presentationEvents = [];
      cs._presentationEventsPersist = [];
      cs.turnIndex = 0;

      window.renderBoard();
    });
    await page.waitForFunction(() => {
      const source = window.__boardVisualDebug.getRenderedCell(4, 4);
      const destination = window.__boardVisualDebug.getRenderedCell(7, 7);
      return source && source.stone && source.stone.visible === true
        && source.stone.specialType === 'WILL_HUNTER_KING'
        && destination && destination.stone && destination.stone.visible === false;
    }, undefined, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());
    const beforeVisualDigest = await page.evaluate(() => window.__boardVisualDebug.getVisualFrameDigest());

    const execution = await page.evaluate(async () => {
      const destroyModule = window.require('game/card-effects/destroy.js');
      const result = await Promise.race([
        Promise.resolve(destroyModule.executeDestroy(4, 4, 'black')).then((value) => ({ settled: true, value })),
        new Promise((resolve) => setTimeout(() => resolve({
          settled: false,
          boardVisual: window.__boardVisualDebug.getBackendDiagnostics(),
          writerMode: window.__boardVisualDebug.getWriterMode(),
          playbackState: window.require('ui/playback-state-manager.js').getDiagnostics?.() || null
        }), 15000))
      ]);
      if (!result.settled) return result;
      const value = result.value;
      if (!value || value.ok !== true) {
        throw new Error(`executeDestroy failed: ${value && value.reason ? value.reason : 'unknown'}`);
      }
      const playbackState = window.require('ui/playback-state-manager.js');
      if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
        playbackState.clearPlaybackLock();
      }
      window.VisualPlaybackActive = false;
      isProcessing = false;
      isCardAnimating = false;
      window.isProcessing = false;
      window.isCardAnimating = false;
      window.cardState.presentationEvents = [];
      window.cardState._presentationEventsPersist = [];
      window.renderBoard();

      const rawEvents = value.result && Array.isArray(value.result.rawEvents)
        ? value.result.rawEvents
        : [];
      const destroySelectedIndex = rawEvents.findIndex((event) => event && event.type === 'destroy_selected');
      const destroySelected = destroySelectedIndex >= 0 ? rawEvents[destroySelectedIndex] : null;
      return {
        settled: true,
        rawEventTypes: rawEvents.map((event) => event && event.type),
        destroySelectedIndex,
        destroySelected
      };
    });
    if (!execution.settled) {
      throw new Error(`executeDestroy settlement timed out: ${JSON.stringify(execution)}`);
    }

    await page.waitForFunction(() => {
      const gs = window.gameState;
      const cs = window.cardState;
      const marker = Array.isArray(cs && cs.markers)
        ? cs.markers.find((m) => m && m.id === 8451)
        : null;
      const source = window.__boardVisualDebug.getRenderedCell(4, 4);
      const destination = marker
        ? window.__boardVisualDebug.getRenderedCell(marker.row, marker.col)
        : null;
      const bareAnimating = typeof isCardAnimating !== 'undefined' ? isCardAnimating : false;
      return (
        window.VisualPlaybackActive !== true &&
        bareAnimating !== true &&
        gs &&
        Array.isArray(gs.board) &&
        gs.board[4][4] === 0 &&
        marker &&
        (marker.row !== 4 || marker.col !== 4) &&
        Array.isArray(gs.board[marker.row]) &&
        gs.board[marker.row][marker.col] === -1 &&
        marker.data &&
        marker.data.destroyEvadeRemaining === 0 &&
        source && source.stone && source.stone.visible === false &&
        destination && destination.stone && destination.stone.visible === true &&
        destination.stone.specialType === 'WILL_HUNTER_KING'
      );
    }, undefined, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    expect(execution.destroySelected).toEqual(expect.objectContaining({
      type: 'destroy_selected',
      applied: true,
      evaded: true,
      from: { row: 4, col: 4 },
      to: { row: 7, col: 7 }
    }));
    expect(execution.destroySelectedIndex).toBeGreaterThanOrEqual(0);

    const finalState = await page.evaluate(() => {
      const marker = window.cardState.markers.find((m) => m && m.id === 8451);
      const source = window.__boardVisualDebug.getRenderedCell(4, 4);
      const destination = window.__boardVisualDebug.getRenderedCell(marker.row, marker.col);
      return {
        board44: window.gameState.board[4][4],
        board77: window.gameState.board[7][7],
        boardAtMarker: window.gameState.board[marker.row][marker.col],
        markerRow: marker.row,
        markerCol: marker.col,
        remainingOwnerTurns: marker.data.remainingOwnerTurns,
        destroyEvadeRemaining: marker.data.destroyEvadeRemaining,
        sourceHasStone: !!(source && source.stone && source.stone.visible),
        destinationHasStone: !!(destination && destination.stone && destination.stone.visible),
        destinationStone: destination && destination.stone,
        destinationRect: window.__boardVisualDebug.getCellClientRect(marker.row, marker.col),
        visualDigest: window.__boardVisualDebug.getVisualFrameDigest(),
        backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics()
      };
    });

    expect(finalState).toEqual(expect.objectContaining({
      board44: 0,
      board77: -1,
      boardAtMarker: -1,
      markerRow: 7,
      markerCol: 7,
      destroyEvadeRemaining: 0,
      sourceHasStone: false,
      destinationHasStone: true
    }));
    expect(finalState.destinationStone).toEqual(expect.objectContaining({
      visible: true,
      owner: 'white',
      specialType: 'WILL_HUNTER_KING',
      timerLabel: String(finalState.remainingOwnerTurns)
    }));
    expect(finalState.destinationStone.renderedMarkerKinds).toContain('special');
    expect(finalState.destinationStone.statusLabels).not.toContainEqual(expect.objectContaining({ kind: 'destroy-evade' }));
    expect(finalState.destinationRect.width).toBeGreaterThan(0);
    expect(finalState.visualDigest).toEqual(expect.any(String));
    expect(finalState.visualDigest).not.toBe(beforeVisualDigest);
    expect(finalState.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      state: 'ready',
      playback: expect.objectContaining({ inFlightEffectCount: 0 }),
      timeline: expect.objectContaining({ state: 'idle' }),
      pool: expect.objectContaining({
        activePlaybackGhostCount: 0
      })
    }));
    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
    page = null;
  }, 60000);
});
