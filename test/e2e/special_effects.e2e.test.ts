import { chromium } from 'playwright';
declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;
declare const window: any;
const { startStaticServer, stopStaticServer, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } = require('./e2e-runtime-helpers.js');
function startServer(port = 0) {
  return startStaticServer(port);
}

async function openPixiDebugLane(page: any, serverPort: number): Promise<void> {
  await page.goto(
    `http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=pixi&noanim=1`,
    { waitUntil: 'domcontentloaded' }
  );
  await closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => {
    const root = window as any;
    return root.__uiInitialized === true
      && !!root.__boardVisualDebug
      && root.__boardVisualDebug.getBackendKind() === 'pixi'
      && typeof root.require === 'function'
      && typeof root.renderBoard === 'function';
  }, undefined, { timeout: 30000 });
  await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());
}

describe('Special effects E2E', () => {
  let serverProc: any;
  let browser: any;
  let serverPort: any = null;
  beforeAll(async () => {
    serverProc = startServer(0);
    await new Promise(resolve => setTimeout(resolve, 500));
    serverPort = serverProc.address().port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(serverProc);
    serverProc = null;
  }, 30000);

  test('work stones and bombs render special visuals', async () => {
    const page = await browser.newPage();
    await openPixiDebugLane(page, serverPort);
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });
    await page.click('button:has-text("DEBUG: OFF")');

    // Apply the canonical debug fixture, then let the board controller settle it.
    await page.evaluate(() => {
      const root = window as any;
      let actions = root.DebugActions;
      if (!actions || typeof actions.applyVisualTestBoard !== 'function') {
        try { actions = root.require('game/debug/debug-actions'); } catch (_error) {
          actions = root.require('game/debug/debug-actions.js');
        }
      }
      if (!actions || typeof actions.applyVisualTestBoard !== 'function') {
        throw new Error('DebugActions.applyVisualTestBoard is unavailable');
      }
      actions.applyVisualTestBoard(root.gameState, root.cardState);
      root.renderBoard();
    });

    await page.waitForFunction(() => {
      const debug = window.__boardVisualDebug;
      const work = debug.getRenderedCell(4, 2);
      const blackBomb = debug.getRenderedCell(6, 0);
      const whiteBomb = debug.getRenderedCell(6, 1);
      return work && work.stone && work.stone.specialType === 'WORK'
        && blackBomb && blackBomb.stone && blackBomb.stone.specialType === 'TIME_BOMB'
        && whiteBomb && whiteBomb.stone && whiteBomb.stone.specialType === 'TIME_BOMB';
    }, undefined, { timeout: 20000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => {
      const debug = window.__boardVisualDebug;
      return {
        work: debug.getRenderedCell(4, 2),
        blackBomb: debug.getRenderedCell(6, 0),
        whiteBomb: debug.getRenderedCell(6, 1),
        workRect: debug.getCellClientRect(4, 2),
        frameDigest: debug.getVisualFrameDigest(),
        backendDiagnostics: debug.getBackendDiagnostics(),
        displayObjects: debug.getDisplayObjectCounts()
      };
    });
    expect(result.work.stone).toEqual(expect.objectContaining({
      visible: true,
      owner: 'black',
      specialType: 'WORK',
      timerLabel: '3'
    }));
    expect(result.work.stone.renderedMarkerKinds).toContain('special');
    expect(result.blackBomb.stone).toEqual(expect.objectContaining({
      visible: true,
      owner: 'black',
      specialType: 'TIME_BOMB'
    }));
    expect(result.blackBomb.stone.statusLabels).toContainEqual({ kind: 'bomb', value: '5' });
    expect(result.whiteBomb.stone.statusLabels).toContainEqual({ kind: 'bomb', value: '8' });
    expect(result.workRect.width).toBeGreaterThan(0);
    expect(result.frameDigest).toEqual(expect.any(String));
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      state: 'ready',
      playback: expect.objectContaining({ inFlightEffectCount: 0 }),
      timeline: expect.objectContaining({ state: 'idle' })
    }));
    expect(result.displayObjects).toEqual(expect.objectContaining({ active: expect.any(Number) }));
    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
  }, 120000);

  test('manifest stones expose theory, executor, and observer visuals through Pixi diagnostics', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openPixiDebugLane(page, serverPort);

    await page.evaluate(() => {
      const root = window as any;
      const shared = root.require('shared-constants');
      const BLACK = shared.BLACK;
      const WHITE = shared.WHITE;
      const EMPTY = shared.EMPTY;
      for (let row = 0; row < root.gameState.board.length; row += 1) {
        for (let col = 0; col < root.gameState.board[row].length; col += 1) {
          root.gameState.board[row][col] = EMPTY;
        }
      }
      root.gameState.board[2][2] = BLACK;
      root.gameState.board[2][3] = WHITE;
      root.gameState.board[2][4] = BLACK;
      root.cardState.markers = [
        { id: 9301, kind: 'manifestStone', row: 2, col: 2, owner: 'black', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 5 } },
        { id: 9302, kind: 'manifestStone', row: 2, col: 3, owner: 'white', data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4 } },
        { id: 9303, kind: 'manifestStone', row: 2, col: 4, owner: 'black', data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 } }
      ];
      root.cardState.pendingEffectByPlayer = { black: null, white: null };
      root.cardState.presentationEvents = [];
      root.cardState._presentationEventsPersist = [];
      root.renderBoard();
    });
    await page.waitForFunction(() => {
      const debug = window.__boardVisualDebug;
      return debug.getRenderedCell(2, 2)?.stone?.specialType === 'THEORY_INCARNATION'
        && debug.getRenderedCell(2, 3)?.stone?.specialType === 'BOARD_EXECUTOR'
        && debug.getRenderedCell(2, 4)?.stone?.specialType === 'OBSERVER_WILL';
    }, undefined, { timeout: 20000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => {
      const debug = window.__boardVisualDebug;
      return {
        theory: debug.getRenderedCell(2, 2),
        executor: debug.getRenderedCell(2, 3),
        observer: debug.getRenderedCell(2, 4),
        frameDigest: debug.getVisualFrameDigest(),
        backendDiagnostics: debug.getBackendDiagnostics()
      };
    });
    expect(result.theory.stone).toEqual(expect.objectContaining({
      owner: 'black',
      specialType: 'THEORY_INCARNATION',
      timerLabel: '5'
    }));
    expect(result.executor.stone).toEqual(expect.objectContaining({
      owner: 'white',
      specialType: 'BOARD_EXECUTOR',
      timerLabel: '4'
    }));
    expect(result.observer.stone).toEqual(expect.objectContaining({
      owner: 'black',
      specialType: 'OBSERVER_WILL',
      timerLabel: '3'
    }));
    for (const cell of [result.theory, result.executor, result.observer]) {
      expect(cell.stone.renderedMarkerKinds).toEqual(expect.arrayContaining(['special', 'manifest-aura']));
    }
    expect(result.frameDigest).toEqual(expect.any(String));
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({ domCellCount: 0 }));
    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
  }, 60000);

  test('retained global presentation branches stay DOM-only and preserve Pixi final pixels', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openPixiDebugLane(page, serverPort);

    const result = await page.evaluate(async () => {
      const root = window as any;
      const resolveModule = (globalName: string, moduleId: string): any => {
        if (root[globalName]) return root[globalName];
        try { return root.require(moduleId); } catch (_error) {
          return root.require(`${moduleId}.js`);
        }
      };
      const engine = resolveModule('AnimationEngine', 'ui/animation-engine');
      const renderer = resolveModule('BoardRenderer', 'ui/board-renderer');
      const debug = root.__boardVisualDebug;
      if (!engine || typeof engine.executePhase !== 'function'
        || !renderer || typeof renderer.playBoardVisualPhase !== 'function'
        || !debug) {
        throw new Error('Global presentation browser fixture runtime is unavailable');
      }

      const beforeDigest = debug.getVisualFrameDigest();
      const calls: Record<string, unknown[]> = {
        placeHand: [],
        captureToHand: [],
        cardUse: [],
        roundBanner: []
      };
      const originalGlobals = {
        playHandAnimation: root.playHandAnimation,
        playCaptureToHandAnimation: root.playCaptureToHandAnimation,
        playCardUseHandAnimation: root.playCardUseHandAnimation,
        showRoundBonusDisplay: root.showRoundBonusDisplay
      };
      const originalPlayBoardVisualPhase = renderer.playBoardVisualPhase;
      let boardPhaseLaunchCount = 0;
      renderer.playBoardVisualPhase = async function (...args: unknown[]) {
        boardPhaseLaunchCount += 1;
        return originalPlayBoardVisualPhase.apply(this, args);
      };
      root.playHandAnimation = (...args: unknown[]) => {
        calls.placeHand.push(args.slice(0, -1));
        const done = args[args.length - 1];
        if (typeof done === 'function') done();
      };
      root.playCaptureToHandAnimation = async (value: unknown) => {
        calls.captureToHand.push(value);
      };
      root.playCardUseHandAnimation = async (value: unknown) => {
        calls.cardUse.push(value);
      };
      root.showRoundBonusDisplay = (value: unknown) => {
        calls.roundBanner.push(value);
      };

      const events = [
        {
          type: 'place_hand_animation', phase: 1,
          targets: [{ player: 'black', owner: 'black', r: 2, row: 2, col: 2 }]
        },
        {
          type: 'capture_to_hand_animation', phase: 2,
          targets: [{
            player: 'black', owner: 'black', cardId: 'guard_01', count: 1,
            sourceRow: 2, sourceCol: 2, reason: 'capture_will'
          }]
        },
        {
          type: 'card_use_animation', phase: 3,
          targets: [{ player: 'black', owner: 'black', cardId: 'guard_01', name: '守護の意志', cost: 4 }]
        },
        {
          type: 'observer_bubble', rawType: 'SPECIAL_STONE_BUBBLE', phase: 4,
          targets: [{ r: 2, col: 2, owner: 'black', special: 'GUARD', text: '守る' }]
        },
        {
          type: 'observer_bubble', rawType: 'OBSERVER_BUBBLE', phase: 5,
          targets: [{ r: 2, col: 3, owner: 'white', text: '観測' }]
        },
        {
          type: 'observer_bubble', rawType: 'WORK_BUBBLE', phase: 6,
          targets: [{ r: 3, col: 2, owner: 'black', text: '出稼ぎ' }]
        },
        {
          type: 'observer_bubble', rawType: 'CHARGE_BUBBLE', phase: 7,
          targets: [{ r: 3, col: 3, owner: 'white', bubbleKind: 'charge', gained: 3 }]
        },
        {
          type: 'special_card_cinematic', phase: 8,
          targets: [{
            owner: 'black', cinematicKey: 'phase7_browser_fixture',
            displayName: '演出確認', quote: '盤面外演出', durationMs: 1
          }]
        },
        {
          type: 'round_bonus_banner', phase: 9,
          targets: [{ amount: 5, roundNumber: 10, durationMs: 1, text: 'BONUS ROUND +5' }]
        }
      ];

      const executedEventTypes: string[] = [];
      try {
        for (const event of events) {
          await engine.executePhase([event]);
          executedEventTypes.push(event.type);
        }
        await debug.waitForIdle();
        return {
          beforeDigest,
          afterDigest: debug.getVisualFrameDigest(),
          executedEventTypes,
          boardPhaseLaunchCount,
          calls,
          remainingOverlays: document.querySelectorAll([
            '.observer-speech-bubble',
            '.board-charge-bubble',
            '.special-card-cinematic-overlay'
          ].join(',')).length,
          diagnostics: debug.getBackendDiagnostics()
        };
      } finally {
        renderer.playBoardVisualPhase = originalPlayBoardVisualPhase;
        for (const [key, value] of Object.entries(originalGlobals)) root[key] = value;
      }
    });

    expect(result.executedEventTypes).toEqual([
      'place_hand_animation',
      'capture_to_hand_animation',
      'card_use_animation',
      'observer_bubble',
      'observer_bubble',
      'observer_bubble',
      'observer_bubble',
      'special_card_cinematic',
      'round_bonus_banner'
    ]);
    expect(result.boardPhaseLaunchCount).toBe(0);
    expect(result.beforeDigest).toBe(result.afterDigest);
    expect(result.calls.captureToHand).toHaveLength(1);
    expect(result.calls.cardUse).toHaveLength(1);
    expect(result.calls.roundBanner).toHaveLength(1);
    expect(result.remainingOverlays).toBe(0);
    expect(result.diagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      canvasCount: 1,
      timeline: expect.objectContaining({ state: 'idle' })
    }));

    await page.close();
  }, 60000);
});
