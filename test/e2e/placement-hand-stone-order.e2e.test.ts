import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import {
  closeMaintenanceNoticeIfPresent,
  closeSidePanelIfPresent,
  startStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  stopStaticServer
} from './e2e-runtime-helpers.js';

declare const require: any;

const { PNG } = require('pngjs');

type PlainRect = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type PlacementTarget = Readonly<{
  row: number;
  col: number;
  centerX: number;
  centerY: number;
}>;

type PlacementFrameSample = Readonly<{
  atMs: number;
  canvasPngDataUrl: string;
  projectedStoneCount: number;
  renderedStoneVisible: boolean;
}>;

type PlacementProbe = Readonly<{
  target: PlacementTarget;
  canvasRect: PlainRect;
  cellRect: PlainRect;
  approach: PlacementFrameSample;
  contactBefore: PlacementFrameSample;
  contactAfter: PlacementFrameSample;
  error: string | null;
}>;

function pngBufferFromDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Placement probe did not return a valid PNG data URL');
  return Buffer.from(match[1], 'base64');
}

function changedPixelRatio(
  beforeDataUrl: string,
  afterDataUrl: string,
  canvasRect: PlainRect,
  cellRect: PlainRect
): number {
  const before = PNG.sync.read(pngBufferFromDataUrl(beforeDataUrl));
  const after = PNG.sync.read(pngBufferFromDataUrl(afterDataUrl));
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error('Placement probe PNG dimensions changed during playback');
  }

  const scaleX = before.width / canvasRect.width;
  const scaleY = before.height / canvasRect.height;
  const insetX = cellRect.width * 0.14;
  const insetY = cellRect.height * 0.14;
  const left = Math.max(0, Math.floor((cellRect.left - canvasRect.left + insetX) * scaleX));
  const top = Math.max(0, Math.floor((cellRect.top - canvasRect.top + insetY) * scaleY));
  const right = Math.min(
    before.width,
    Math.ceil((cellRect.left - canvasRect.left + cellRect.width - insetX) * scaleX)
  );
  const bottom = Math.min(
    before.height,
    Math.ceil((cellRect.top - canvasRect.top + cellRect.height - insetY) * scaleY)
  );

  let changed = 0;
  let total = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = ((y * before.width) + x) * 4;
      const delta = Math.abs(before.data[offset] - after.data[offset])
        + Math.abs(before.data[offset + 1] - after.data[offset + 1])
        + Math.abs(before.data[offset + 2] - after.data[offset + 2])
        + Math.abs(before.data[offset + 3] - after.data[offset + 3]);
      if (delta >= 48) changed += 1;
      total += 1;
    }
  }
  if (total === 0) throw new Error('Placement probe target ROI was empty');
  return changed / total;
}

async function openAnimatedPixiBoard(page: Page, serverPort: number): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('othello.handAnimation.place', 'on');
    localStorage.setItem('othello.handAnimation.placeStyle', 'hand');
  });
  await page.goto(
    `http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=pixi`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => {
    const root = window as any;
    if (root.__uiInitialized !== true || !root.__boardVisualDebug) return false;
    if (root.__boardVisualDebug.getBackendKind() !== 'pixi') return false;
    if (typeof root.require !== 'function' || typeof root.playHandAnimation !== 'function') return false;
    const renderer = root.require('ui/board-renderer');
    const input = renderer?.getBoardInputController?.();
    return input?.getState?.().enabled === true
      && input.getState().locked === false
      && Array.isArray(input.getLegalCells?.())
      && input.getLegalCells().length > 0
      && root.isProcessing !== true
      && root.isCardAnimating !== true;
  }, undefined, { timeout: 30000 });
  await page.evaluate(async () => {
    await (window as any).__boardVisualDebug.waitForIdle();
  });
  await closeSidePanelIfPresent(page);
}

async function installPlacementProbe(page: Page): Promise<PlacementTarget> {
  return page.evaluate(() => {
    const root = window as any;
    const renderer = root.require('ui/board-renderer');
    const controller = renderer?.getBoardVisualController?.();
    const input = renderer?.getBoardInputController?.();
    const debug = root.__boardVisualDebug;
    const legal = input?.getLegalCells?.()[0];
    const canvas = document.querySelector('#board canvas');
    if (!controller || typeof controller.captureDebugFramePngDataUrl !== 'function') {
      throw new Error('Pixi frame extraction is unavailable');
    }
    if (!legal) throw new Error('No legal placement target is available');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Pixi canvas is unavailable');
    const cellRect = debug.getCellClientRect(legal.row, legal.col);
    if (!cellRect || !(cellRect.width > 0) || !(cellRect.height > 0)) {
      throw new Error(`Legal target ${legal.row},${legal.col} has no client rect`);
    }
    const target = {
      row: legal.row,
      col: legal.col,
      centerX: cellRect.left + cellRect.width / 2,
      centerY: cellRect.top + cellRect.height / 2
    };
    const canvasClientRect = canvas.getBoundingClientRect();
    const probe: any = {
      target,
      canvasRect: {
        left: canvasClientRect.left,
        top: canvasClientRect.top,
        width: canvasClientRect.width,
        height: canvasClientRect.height
      },
      cellRect: {
        left: cellRect.left,
        top: cellRect.top,
        width: cellRect.width,
        height: cellRect.height
      },
      approach: null,
      contactBefore: null,
      contactAfter: null,
      error: null
    };
    const capture = (): PlacementFrameSample => {
      const diagnostics = debug.getBackendDiagnostics?.();
      const renderedCell = debug.getRenderedCell(legal.row, legal.col);
      return {
        atMs: performance.now(),
        canvasPngDataUrl: controller.captureDebugFramePngDataUrl(),
        projectedStoneCount: Number(diagnostics?.playback?.projectedStoneCount || 0),
        renderedStoneVisible: renderedCell?.stone?.visible === true
      };
    };
    const originalPlayHandAnimation = root.playHandAnimation;
    const actorObserver = new MutationObserver(() => {
      if (probe.approach) return;
      const activeActor = document.querySelector(
        '.hand-animation-actor-image[data-hand-animation-active="true"]'
      );
      if (!activeActor) return;
      try {
        probe.approach = capture();
      } catch (error) {
        probe.error = error instanceof Error ? error.message : String(error);
      } finally {
        actorObserver.disconnect();
      }
    });
    actorObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['data-hand-animation-active']
    });

    root.__placementHandStoneOrderProbe = probe;
    root.playHandAnimation = function (
      player: unknown,
      row: number,
      col: number,
      onContact: (() => void) | undefined,
      visualOptions: unknown
    ) {
      if (row !== legal.row || col !== legal.col) {
        return originalPlayHandAnimation.apply(this, arguments);
      }
      const wrappedContact = () => {
        try {
          probe.contactBefore = capture();
        } catch (error) {
          probe.error = error instanceof Error ? error.message : String(error);
        }
        if (typeof onContact === 'function') onContact();
        const captureAfterProjection = (remainingFrames: number) => {
          try {
            const diagnostics = debug.getBackendDiagnostics?.();
            if (Number(diagnostics?.playback?.projectedStoneCount || 0) > 0) {
              probe.contactAfter = capture();
              return;
            }
            if (remainingFrames <= 0) {
              probe.error = 'Stone projection did not start after hand contact';
              return;
            }
            requestAnimationFrame(() => captureAfterProjection(remainingFrames - 1));
          } catch (error) {
            probe.error = error instanceof Error ? error.message : String(error);
          }
        };
        requestAnimationFrame(() => captureAfterProjection(30));
      };
      return originalPlayHandAnimation.call(
        this,
        player,
        row,
        col,
        wrappedContact,
        visualOptions
      );
    };

    return target;
  });
}

describe('placement hand and stone ordering E2E', () => {
  let server: ReturnType<typeof startStaticServer> | null = null;
  let browser: Browser | null = null;
  let serverPort: number | null = null;
  let page: Page | null = null;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.once('listening', resolve);
        server?.once('error', reject);
      });
    }
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Static E2E server did not expose a TCP port');
    }
    serverPort = address.port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightPage(page, 10000);
    page = null;
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(server);
    server = null;
  }, 30000);

  test('keeps the target empty until hand contact, then shows the placed stone', async () => {
    if (!browser || serverPort == null) throw new Error('E2E runtime is not initialized');
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openAnimatedPixiBoard(page, serverPort);
    const target = await installPlacementProbe(page);

    await page.mouse.click(target.centerX, target.centerY);
    await page.waitForFunction(() => {
      const probe = (window as any).__placementHandStoneOrderProbe;
      return !!probe?.approach || !!probe?.error;
    }, undefined, { timeout: 5000 });
    const approachScreenshot = await page.screenshot({ animations: 'allow' });
    expect(approachScreenshot.byteLength).toBeGreaterThan(1000);

    await page.waitForFunction(() => {
      const probe = (window as any).__placementHandStoneOrderProbe;
      return (!!probe?.contactBefore && !!probe?.contactAfter) || !!probe?.error;
    }, undefined, { timeout: 5000 });

    const probe = await page.evaluate(() => {
      return (window as any).__placementHandStoneOrderProbe as PlacementProbe;
    });
    expect(probe.error).toBeNull();
    expect(probe.target).toEqual(target);
    expect(probe.approach.renderedStoneVisible).toBe(false);
    expect(probe.approach.projectedStoneCount).toBe(0);
    expect(probe.contactBefore.renderedStoneVisible).toBe(false);
    expect(probe.contactBefore.projectedStoneCount).toBe(0);
    expect(probe.approach.atMs).toBeLessThan(probe.contactBefore.atMs);
    expect(probe.contactBefore.atMs).toBeLessThan(probe.contactAfter.atMs);
    expect(probe.contactAfter.projectedStoneCount).toBeGreaterThan(0);

    const contactPixelChange = changedPixelRatio(
      probe.contactBefore.canvasPngDataUrl,
      probe.contactAfter.canvasPngDataUrl,
      probe.canvasRect,
      probe.cellRect
    );
    expect(contactPixelChange).toBeGreaterThan(0.03);

    await page.waitForFunction(({ row, col }) => {
      const debug = (window as any).__boardVisualDebug;
      return debug.getRenderedCell(row, col)?.stone?.visible === true;
    }, target, { timeout: 10000 });
    const settledScreenshot = await page.locator('#board').screenshot({ animations: 'allow' });
    expect(settledScreenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
    page = null;
  }, 60000);
});
