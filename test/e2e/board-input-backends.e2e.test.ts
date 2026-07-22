import * as os from 'os';
import * as path from 'path';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import {
  closeMaintenanceNoticeIfPresent,
  closeSidePanelIfPresent,
  startStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  stopStaticServer
} from './e2e-runtime-helpers.js';

const PixijsBoardBrowserCheck = require('../../scripts/pixijs-board-browser-check');
const { BROWSER_FIXTURES, applyPhaseZeroFixture } = PixijsBoardBrowserCheck as {
  BROWSER_FIXTURES: readonly BrowserFixture[];
  applyPhaseZeroFixture: (page: Page, fixture: BrowserFixture) => Promise<unknown>;
};

type BackendKind = 'dom' | 'pixi';
type PointerKind = 'mouse' | 'touch' | 'pen';

type BrowserFixture = Readonly<{
  name: string;
  rows: number;
  cols: number;
  shape: 'rectangle' | 'circle';
  captureKind: 'topology' | 'presentation';
  expansionCells?: readonly Readonly<{ row: number; col: number; side: string; owner: number }>[];
  holes?: readonly Readonly<{ row: number; col: number }>[];
}>;

type CanonicalTarget = Readonly<{
  row: number;
  col: number;
  centerX: number;
  centerY: number;
  turnNumber: number;
  cellDigest: string;
}>;

type CanonicalSnapshot = Readonly<{
  turnNumber: number;
  boardDigest: string;
}>;

type BoardSession = Readonly<{
  context: BrowserContext;
  page: Page;
}>;

const SCREENSHOT_PATH = path.join(os.tmpdir(), 'card-reversi-phase5-pixi-input.png');
const EXPANDED_FRAME_SCREENSHOT_PATHS = Object.freeze({
  dom: path.join(os.tmpdir(), 'card-reversi-expanded-frame-dom.png'),
  pixi: path.join(os.tmpdir(), 'card-reversi-expanded-frame-pixi.png')
});
const HOLE_FIXTURE_NAME = 'circle-10-hole-pseudo-edge';
const PIXI_TOPOLOGY_POINTER_CASES = Object.freeze([
  Object.freeze({ fixtureName: 'rectangle-8x8-four-stars', topology: 'base', pointerKind: 'mouse' }),
  Object.freeze({ fixtureName: 'rectangle-8x8-multistage-negative', topology: 'expanded', pointerKind: 'touch' }),
  Object.freeze({ fixtureName: HOLE_FIXTURE_NAME, topology: 'hole', pointerKind: 'pen' }),
  Object.freeze({ fixtureName: 'circle-10', topology: 'circle', pointerKind: 'mouse' })
] as const);

function browserFixtureByName(name: string): BrowserFixture {
  const fixture = BROWSER_FIXTURES.find((candidate) => candidate.name === name);
  if (!fixture) throw new Error(`Browser input fixture is missing: ${name}`);
  return fixture;
}

describe('board input backend E2E', () => {
  let server: ReturnType<typeof startStaticServer> | null = null;
  let browser: Browser | null = null;
  let serverPort: number | null = null;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.once('listening', resolve);
        server?.once('error', reject);
      });
    }
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Static E2E server did not expose a TCP port');
    serverPort = address.port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(server);
    server = null;
  }, 30000);

  async function openBoard(backend: BackendKind, hasTouch = false): Promise<BoardSession> {
    if (!browser || serverPort == null) throw new Error('E2E runtime is not initialized');
    const context = await browser.newContext({
      hasTouch,
      viewport: { width: 1280, height: 1000 }
    });
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=${backend}&noanim=1`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction((expectedBackend: BackendKind) => {
      const root = window as any;
      if (root.__uiInitialized !== true || !root.__boardVisualDebug) return false;
      if (root.__boardVisualDebug.getBackendKind() !== expectedBackend) return false;
      if (typeof root.require !== 'function') return false;
      const renderer = root.require('ui/board-renderer');
      const input = renderer && renderer.getBoardInputController?.();
      const state = input && input.getState?.();
      return state?.enabled === true
        && Array.isArray(input.getLegalCells?.())
        && input.getLegalCells().length > 0;
    }, backend, { timeout: 30000 });
    await page.evaluate(async () => {
      await (window as any).__boardVisualDebug.waitForIdle();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
    await closeSidePanelIfPresent(page);
    await page.waitForFunction(() => {
      const root = window as any;
      const panel = document.getElementById('side-panel');
      const renderer = root.require('ui/board-renderer');
      return (!panel || !panel.classList.contains('is-open'))
        && renderer.getBoardInputController().getState().locked === false;
    }, undefined, { timeout: 10000 });
    await page.evaluate(() => {
      const root = window as any;
      root.__observedBoardPointerTypes = [];
      const board = document.getElementById('board');
      board?.addEventListener('pointerdown', (event: PointerEvent) => {
        root.__observedBoardPointerTypes.push(event.pointerType);
      }, true);
    });
    return Object.freeze({ context, page });
  }

  async function closeSession(session: BoardSession | null): Promise<void> {
    if (!session) return;
    await stopPlaywrightPage(session.page, 5000);
    await session.context.close().catch(() => undefined);
  }

  async function getFirstLegalTarget(page: Page): Promise<CanonicalTarget> {
    return page.evaluate(() => {
      const root = window as any;
      const renderer = root.require('ui/board-renderer');
      const legal = renderer.getBoardInputController().getLegalCells()[0];
      if (!legal) throw new Error('No legal board input target is available');
      const rect = root.__boardVisualDebug.getCellClientRect(legal.row, legal.col);
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
        throw new Error(`Legal target ${legal.row},${legal.col} has no client rect`);
      }
      const state = root.gameState;
      return {
        row: legal.row,
        col: legal.col,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        turnNumber: Number(state.turnNumber) || 0,
        cellDigest: JSON.stringify(state.board[legal.row][legal.col])
      };
    });
  }

  async function applyInputFixture(page: Page, fixture: BrowserFixture): Promise<void> {
    await applyPhaseZeroFixture(page, fixture);
    if (fixture.name === HOLE_FIXTURE_NAME) {
      await page.evaluate(async () => {
        const root = window as any;
        const core = root.require('game/logic/core');
        if (!core || typeof core.createGameState !== 'function') {
          throw new Error('Canonical opening state helper is unavailable');
        }
        // The checked-in hole fixture replaces one opening diagonal, leaving
        // no legal move. Reuse the canonical 4x4 opening and translate it away
        // from those holes so this input-only E2E can exercise a real move.
        const opening = core.createGameState({ rows: 4, cols: 4, shape: 'rectangle' });
        const state = root.gameState;
        for (const row of state.board) row.fill(0);
        for (let row = 0; row < opening.board.length; row += 1) {
          for (let col = 0; col < opening.board[row].length; col += 1) {
            const value = opening.board[row][col];
            if (value) state.board[row + 1][col + 2] = value;
          }
        }
        state.currentPlayer = opening.currentPlayer;
        state.turnNumber = 0;
        state.consecutivePasses = 0;
        await Promise.resolve(root.renderBoard());
        await root.__boardVisualDebug.waitForIdle();
      });
    }
    await page.waitForFunction((expected: BrowserFixture) => {
      const root = window as any;
      const renderer = root.require('ui/board-renderer');
      const config = root.gameState?.boardConfig;
      return Number(config?.rows) === expected.rows
        && Number(config?.cols) === expected.cols
        && String(config?.shape) === expected.shape
        && renderer.getBoardInputController().getLegalCells().length > 0
        && root.__boardVisualDebug.getWriterMode() === 'idle';
    }, fixture, { timeout: 15000 });
  }

  async function refreshCanonicalTarget(page: Page, target: Pick<CanonicalTarget, 'row' | 'col'>): Promise<CanonicalTarget> {
    return page.evaluate(({ row, col }) => {
      const root = window as any;
      const rect = root.__boardVisualDebug.getCellClientRect(row, col);
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
        throw new Error(`Target ${row},${col} has no client rect`);
      }
      const state = root.gameState;
      return {
        row,
        col,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        turnNumber: Number(state.turnNumber) || 0,
        cellDigest: JSON.stringify(state.board[row][col])
      };
    }, target);
  }

  async function readCanonicalSnapshot(page: Page): Promise<CanonicalSnapshot> {
    return page.evaluate(() => ({
      turnNumber: Number((window as any).gameState.turnNumber) || 0,
      boardDigest: JSON.stringify((window as any).gameState.board)
    }));
  }

  async function settleTwoAnimationFrames(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  }

  async function installSpectatorInputStub(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const root = window as any;
      const currentClient = root.NetworkMatchClient;
      let installed = false;
      if (currentClient && typeof currentClient === 'object') {
        try {
          currentClient.isSpectator = () => true;
          installed = currentClient.isSpectator() === true;
        } catch (_error) { /* use an E2E-only proxy below */ }
      }
      if (!installed) {
        const target = currentClient && typeof currentClient === 'object' ? currentClient : {};
        const spectatorClient = new Proxy(target, {
          get(client, property) {
            if (property === 'isSpectator') return () => true;
            const value = Reflect.get(client, property, client);
            return typeof value === 'function' ? value.bind(client) : value;
          }
        });
        root.NetworkMatchClient = spectatorClient;
        installed = root.NetworkMatchClient?.isSpectator?.() === true;
      }
      if (!installed) throw new Error('Unable to install the E2E spectator client view');

      root.__boardSpectatorStatusTrace = [];
      const previousWriter = typeof root.writeNetworkStatus === 'function'
        ? root.writeNetworkStatus.bind(root)
        : null;
      root.writeNetworkStatus = (text: unknown, isError: unknown) => {
        root.__boardSpectatorStatusTrace.push({ text: String(text || ''), isError: isError === true });
        return previousWriter?.(text, isError);
      };
      await Promise.resolve(root.renderBoard());
      await root.__boardVisualDebug.waitForIdle();
    });
    await page.waitForFunction(() => {
      const root = window as any;
      const renderer = root.require('ui/board-renderer');
      return renderer.getBoardInputController().getState().spectator === true
        && renderer.getBoardVisualController().getSettledFrame()?.model?.viewerContext === 'spectator';
    }, undefined, { timeout: 10000 });
  }

  async function waitForCanonicalMove(page: Page, target: CanonicalTarget): Promise<void> {
    await page.waitForFunction((before: CanonicalTarget) => {
      const state = (window as any).gameState;
      if (!state || !Array.isArray(state.board)) return false;
      const nextCellDigest = JSON.stringify(state.board[before.row]?.[before.col]);
      return (Number(state.turnNumber) || 0) > before.turnNumber
        && nextCellDigest !== before.cellDigest;
    }, target, { timeout: 15000 });
  }

  async function expectPointerType(page: Page, pointerKind: PointerKind): Promise<void> {
    await page.waitForFunction((expected: PointerKind) => (
      (window as any).__observedBoardPointerTypes?.includes(expected) === true
    ), pointerKind, { timeout: 5000 });
  }

  async function dispatchMouse(page: Page, target: CanonicalTarget): Promise<void> {
    await page.mouse.move(target.centerX, target.centerY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'left' });
  }

  async function dispatchPen(page: Page, target: CanonicalTarget): Promise<void> {
    const client = await page.context().newCDPSession(page);
    try {
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: target.centerX,
        y: target.centerY,
        pointerType: 'pen'
      });
      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: target.centerX,
        y: target.centerY,
        button: 'left',
        buttons: 1,
        clickCount: 1,
        pointerType: 'pen'
      });
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: target.centerX,
        y: target.centerY,
        button: 'left',
        buttons: 0,
        clickCount: 1,
        pointerType: 'pen'
      });
    } finally {
      await client.detach().catch(() => undefined);
    }
  }

  async function dispatchPointer(page: Page, target: CanonicalTarget, pointerKind: PointerKind): Promise<void> {
    if (pointerKind === 'touch') {
      await page.touchscreen.tap(target.centerX, target.centerY);
      return;
    }
    if (pointerKind === 'pen') {
      await dispatchPen(page, target);
      return;
    }
    await dispatchMouse(page, target);
  }

  test('dom real mouse input reaches the canonical move path', async () => {
    let session: BoardSession | null = null;
    try {
      session = await openBoard('dom');
      const target = await getFirstLegalTarget(session.page);
      await dispatchMouse(session.page, target);
      await expectPointerType(session.page, 'mouse');
      await waitForCanonicalMove(session.page, target);
    } finally {
      await closeSession(session);
    }
  }, 60000);

  for (const backend of ['dom', 'pixi'] as const) {
    test(`${backend} keeps the image frame for a complete 8x8 base with sparse expansion bounds`, async () => {
      let session: BoardSession | null = null;
      try {
        session = await openBoard(backend);
        const fixture = browserFixtureByName('rectangle-8x8-multistage-negative');
        await applyInputFixture(session.page, fixture);
        const presentation = await session.page.evaluate(() => {
          const root = window as any;
          const board = document.getElementById('board');
          const frame = document.getElementById('board-frame');
          if (!board || !frame) throw new Error('Board frame surface is unavailable');
          const frameStyle = getComputedStyle(frame);
          const frameArtStyle = getComputedStyle(frame, '::before');
          return {
            boardHasRenderVoid: board.classList.contains('board-has-void-cells'),
            frameHasBaseVoid: frame.classList.contains('board-has-base-void-cells'),
            frameHasLegacyVoid: frame.classList.contains('board-has-void-cells'),
            frameBackgroundImage: frameStyle.backgroundImage,
            frameBoxShadow: frameStyle.boxShadow,
            artDisplay: frameArtStyle.display,
            artBackgroundImage: frameArtStyle.backgroundImage,
            diagnostics: root.__boardVisualDebug.getBackendDiagnostics()
          };
        });

        expect(presentation).toEqual(expect.objectContaining({
          boardHasRenderVoid: true,
          frameHasBaseVoid: false,
          frameHasLegacyVoid: false,
          artDisplay: 'block'
        }));
        expect(presentation.artBackgroundImage).toContain('url(');
        expect(presentation.frameBackgroundImage).not.toBe('none');
        expect(presentation.frameBoxShadow).not.toBe('none');
        if (backend === 'pixi') {
          expect(presentation.diagnostics).toEqual(expect.objectContaining({ domCellCount: 0 }));
        } else {
          expect(Number(presentation.diagnostics?.domCellCount)).toBeGreaterThan(0);
        }
        await session.page.locator('#board-frame').screenshot({
          path: EXPANDED_FRAME_SCREENSHOT_PATHS[backend]
        });
      } finally {
        await closeSession(session);
      }
    }, 60000);
  }

  for (const backend of ['dom', 'pixi'] as const) {
    test(`${backend} still uses the CSS contour when the initial board mask has voids`, async () => {
      let session: BoardSession | null = null;
      try {
        session = await openBoard(backend);
        await applyInputFixture(session.page, browserFixtureByName('circle-10'));
        const presentation = await session.page.evaluate(() => {
          const board = document.getElementById('board');
          const frame = document.getElementById('board-frame');
          if (!board || !frame) throw new Error('Board frame surface is unavailable');
          const frameStyle = getComputedStyle(frame);
          const frameArtStyle = getComputedStyle(frame, '::before');
          return {
            boardHasRenderVoid: board.classList.contains('board-has-void-cells'),
            frameHasBaseVoid: frame.classList.contains('board-has-base-void-cells'),
            frameHasLegacyVoid: frame.classList.contains('board-has-void-cells'),
            frameBackgroundImage: frameStyle.backgroundImage,
            frameBoxShadow: frameStyle.boxShadow,
            artDisplay: frameArtStyle.display
          };
        });

        expect(presentation).toEqual({
          boardHasRenderVoid: true,
          frameHasBaseVoid: true,
          frameHasLegacyVoid: false,
          frameBackgroundImage: 'none',
          frameBoxShadow: 'none',
          artDisplay: 'none'
        });
      } finally {
        await closeSession(session);
      }
    }, 60000);
  }

  for (const backend of ['dom', 'pixi'] as const) {
    test(`${backend} keyboard placement is blocked by the help modal and resumes after close`, async () => {
      let session: BoardSession | null = null;
      try {
        session = await openBoard(backend);
        const { page } = session;
        await page.keyboard.press('KeyD');
        const cursor = await page.waitForFunction((expectedBackend: BackendKind) => {
          const root = window as any;
          const renderer = root.require('ui/board-renderer');
          const key = renderer.getBoardInputController().getState().keyboardCursorKey;
          if (!key) return false;
          const [row, col] = key.split(',').map(Number);
          const rendered = root.__boardVisualDebug.getRenderedCell(row, col);
          const cursorVisible = expectedBackend === 'pixi'
            ? rendered?.hint?.keyboardCursor === true
            : rendered?.interaction?.keyboardCursor === true;
          return cursorVisible ? { row, col } : false;
        }, backend, { timeout: 10000 });
        const cursorTarget = await cursor.jsonValue() as { row: number; col: number };
        const target = await page.evaluate(({ row, col }) => {
          const root = window as any;
          const rect = root.__boardVisualDebug.getCellClientRect(row, col);
          const state = root.gameState;
          return {
            row,
            col,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            turnNumber: Number(state.turnNumber) || 0,
            cellDigest: JSON.stringify(state.board[row][col])
          };
        }, cursorTarget) as CanonicalTarget;

        if (backend === 'pixi') {
          await page.mouse.move(target.centerX, target.centerY);
          await page.waitForFunction(({ row, col }) => {
            const root = window as any;
            const rendered = root.__boardVisualDebug.getRenderedCell(row, col);
            const inputState = root.require('ui/board-renderer').getBoardInputController().getState();
            return rendered?.hint?.legal === true
              && rendered?.hint?.keyboardCursor === true
              && inputState.hoveredCellKey === `${row},${col}`;
          }, cursorTarget, { timeout: 10000 });
          await page.locator('#board-frame').screenshot({ path: SCREENSHOT_PATH });
        }

        await page.click('#rulesHelpBtn');
        await page.waitForFunction(() => {
          const root = window as any;
          const panel = document.getElementById('rules-help-panel');
          const renderer = root.require('ui/board-renderer');
          return panel?.classList.contains('is-open') === true
            && renderer.getBoardInputController().getState().locked === true;
        }, undefined, { timeout: 10000 });
        const beforeBlockedSpace = await page.evaluate(() => ({
          turnNumber: Number((window as any).gameState.turnNumber) || 0,
          boardDigest: JSON.stringify((window as any).gameState.board)
        }));
        await page.keyboard.press('Space');
        await page.evaluate(() => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
        const afterBlockedSpace = await page.evaluate(() => ({
          turnNumber: Number((window as any).gameState.turnNumber) || 0,
          boardDigest: JSON.stringify((window as any).gameState.board)
        }));
        expect(afterBlockedSpace).toEqual(beforeBlockedSpace);

        await page.evaluate(() => {
          const panel = document.getElementById('rules-help-panel');
          if (panel?.classList.contains('is-open')) {
            (document.getElementById('rules-help-close-btn') as HTMLElement | null)?.click();
          }
        });
        await page.waitForFunction(() => (
          !document.getElementById('rules-help-panel')?.classList.contains('is-open')
        ));
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press('Space');
        await waitForCanonicalMove(page, target);
      } finally {
        await closeSession(session);
      }
    }, 60000);
  }

  for (const fixtureCase of PIXI_TOPOLOGY_POINTER_CASES) {
    test(`pixi real ${fixtureCase.pointerKind} input reaches the canonical move path on ${fixtureCase.topology} topology`, async () => {
      let session: BoardSession | null = null;
      try {
        const fixture = browserFixtureByName(fixtureCase.fixtureName);
        session = await openBoard('pixi', fixtureCase.pointerKind === 'touch');
        await applyInputFixture(session.page, fixture);
        const target = await getFirstLegalTarget(session.page);
        await dispatchPointer(session.page, target, fixtureCase.pointerKind);
        await expectPointerType(session.page, fixtureCase.pointerKind);
        await waitForCanonicalMove(session.page, target);
      } finally {
        await closeSession(session);
      }
    }, 60000);
  }

  for (const backend of ['dom', 'pixi'] as const) {
    test(`${backend} real pointer keeps spectator state read-only and reaches the existing status path`, async () => {
      let session: BoardSession | null = null;
      try {
        session = await openBoard(backend);
        const localLegalTarget = await getFirstLegalTarget(session.page);
        await installSpectatorInputStub(session.page);
        const target = await refreshCanonicalTarget(session.page, localLegalTarget);
        const before = await readCanonicalSnapshot(session.page);
        await dispatchMouse(session.page, target);
        await expectPointerType(session.page, 'mouse');
        await session.page.waitForFunction(() => (
          (window as any).__boardSpectatorStatusTrace?.some((entry: any) => (
            entry.text === '観測中は操作できません' && entry.isError === true
          )) === true
        ), undefined, { timeout: 5000 });
        await settleTwoAnimationFrames(session.page);
        expect(await readCanonicalSnapshot(session.page)).toEqual(before);
      } finally {
        await closeSession(session);
      }
    }, 60000);
  }
});
