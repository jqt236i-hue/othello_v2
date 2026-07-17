import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  closeMaintenanceNoticeIfPresent,
  startStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  stopStaticServer
} from './e2e-runtime-helpers.js';

type Session = Readonly<{ context: BrowserContext; page: Page }>;

describe('Pixi WebGL context recovery E2E', () => {
  let server: ReturnType<typeof startStaticServer> | null = null;
  let browser: Browser | null = null;
  let port: number | null = null;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.once('listening', resolve);
        server?.once('error', reject);
      });
    }
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Context recovery server has no port');
    port = address.port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(server);
    server = null;
  }, 30000);

  async function openPixi(animated = false): Promise<Session> {
    if (!browser || port == null) throw new Error('Context recovery browser is unavailable');
    const context = await browser.newContext({ viewport: { width: 1180, height: 900 } });
    const page = await context.newPage();
    const noAnimation = animated ? '' : '&noanim=1';
    await page.goto(
      `http://127.0.0.1:${port}/?debug=1&boardRenderer=pixi${noAnimation}`,
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(() => {
      const debug = (window as any).__boardVisualDebug;
      return (window as any).__uiInitialized === true
        && debug?.getBackendKind?.() === 'pixi'
        && debug?.getBackendDiagnostics?.()?.contextRecovery?.state === 'idle';
    }, undefined, { timeout: 30000 });
    await page.evaluate(async () => {
      const root = window as any;
      if (document.fonts?.ready) await document.fonts.ready;
      root.renderBoard?.();
      await root.__boardVisualDebug.waitForIdle();
      let previous = root.__boardVisualDebug.getVisualFrameDigest();
      let stableSamples = 0;
      const deadline = performance.now() + 3000;
      while (stableSamples < 3 && performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => setTimeout(resolve, 40));
        await root.__boardVisualDebug.waitForIdle();
        const current = root.__boardVisualDebug.getVisualFrameDigest();
        if (current === previous) stableSamples += 1;
        else stableSamples = 0;
        previous = current;
      }
      if (stableSamples < 3) throw new Error('Pixi checkpoint did not settle before context-loss fixture');
    });
    return { context, page };
  }

  async function triggerContextLoss(page: Page, restore: boolean): Promise<void> {
    await page.evaluate((shouldRestore) => {
      const canvas = document.querySelector('#board canvas') as HTMLCanvasElement | null;
      if (!canvas) throw new Error('Pixi canvas is unavailable');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is unavailable');
      if (shouldRestore) {
        canvas.addEventListener('webglcontextlost', () => {
          setTimeout(() => extension.restoreContext(), 80);
        }, { once: true });
      }
      extension.loseContext();
    }, restore);
  }

  async function runPlaybackLoss(page: Page, restore: boolean): Promise<any> {
    return page.evaluate(async (shouldRestore) => {
      const root = window as any;
      const debug = root.__boardVisualDebug;
      const engine = root.require('ui/animation-engine');
      const canvas = document.querySelector('#board canvas') as HTMLCanvasElement | null;
      if (!engine || !canvas) throw new Error('Animated context recovery fixture is unavailable');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is unavailable');

      let soundCount = 0;
      let logCount = 0;
      const originalSound = engine.handleSoundEffect;
      const originalAddLog = root.addLog;
      engine.handleSoundEffect = async () => { soundCount += 1; };
      root.addLog = () => { logCount += 1; };
      const events = [
        {
          type: 'place',
          phase: 1,
          targets: [{
            r: 2,
            col: 2,
            owner: 'black',
            after: { color: 1 },
            cause: 'SYSTEM',
            reason: 'standard_place',
            meta: { placementKind: 'normal_placement' }
          }]
        },
        { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'stone_place' }] },
        { type: 'log', phase: 1, message: 'context-recovery-log-once' }
      ];
      const lost = new Promise<void>((resolve) => {
        canvas.addEventListener('webglcontextlost', () => {
          resolve();
          if (shouldRestore) setTimeout(() => extension.restoreContext(), 80);
        }, { once: true });
      });
      try {
        const playback = engine.play(events);
        setTimeout(() => extension.loseContext(), 20);
        await lost;
        await playback;
        await debug.waitForIdle();
        return {
          soundCount,
          logCount,
          backend: debug.getBackendKind(),
          writerMode: debug.getWriterMode(),
          diagnostics: debug.getBackendDiagnostics(),
          displayObjects: debug.getDisplayObjectCounts()
        };
      } finally {
        engine.handleSoundEffect = originalSound;
        root.addLog = originalAddLog;
      }
    }, restore);
  }

  test('restores an idle checkpoint on the same Pixi backend', async () => {
    const session = await openPixi();
    try {
      const before = await session.page.evaluate(() => (window as any).__boardVisualDebug.getVisualFrameDigest());
      await triggerContextLoss(session.page, true);
      await session.page.waitForFunction(() => {
        const debug = (window as any).__boardVisualDebug;
        const recovery = debug?.getBackendDiagnostics?.()?.contextRecovery;
        return recovery?.restoreSuccessCount >= 1
          && recovery?.state === 'idle'
          && debug?.getWriterMode?.() === 'idle';
      }, undefined, { timeout: 15000 });
      const after = await session.page.evaluate(() => ({
        backend: (window as any).__boardVisualDebug.getBackendKind(),
        digest: (window as any).__boardVisualDebug.getVisualFrameDigest(),
        diagnostics: (window as any).__boardVisualDebug.getBackendDiagnostics()
      }));
      expect(after.backend).toBe('pixi');
      expect(after.digest).toBe(before);
      expect(after.diagnostics.domCellCount).toBe(0);
    } finally {
      await stopPlaywrightPage(session.page);
      await session.context.close();
    }
  }, 30000);

  test('replays only the active board phase after WebGL restore', async () => {
    const session = await openPixi(true);
    try {
      const result = await runPlaybackLoss(session.page, true);
      expect(result).toMatchObject({
        soundCount: 1,
        logCount: 1,
        backend: 'pixi',
        writerMode: 'idle'
      });
      expect(result.diagnostics.contextRecovery.restoreSuccessCount).toBeGreaterThanOrEqual(1);
      expect(result.diagnostics.domCellCount).toBe(0);
    } finally {
      await stopPlaywrightPage(session.page);
      await session.context.close();
    }
  }, 30000);

  test('switches once to DOM compatibility after an idle five-second timeout', async () => {
    const session = await openPixi();
    try {
      await triggerContextLoss(session.page, false);
      await session.page.waitForFunction(() => {
        const debug = (window as any).__boardVisualDebug;
        return debug?.getBackendKind?.() === 'dom'
          && debug?.getWriterMode?.() === 'idle';
      }, undefined, { timeout: 12000 });
      const result = await session.page.evaluate(() => ({
        backend: (window as any).__boardVisualDebug.getBackendKind(),
        canvasCount: document.querySelectorAll('#board canvas').length,
        reloadRequired: !!document.querySelector('[data-reload-required="true"]')
      }));
      expect(result).toEqual({ backend: 'dom', canvasCount: 0, reloadRequired: false });
    } finally {
      await stopPlaywrightPage(session.page);
      await session.context.close();
    }
  }, 30000);

  test('replays the active board phase once on timed DOM fallback without duplicating global effects', async () => {
    const session = await openPixi(true);
    try {
      const result = await runPlaybackLoss(session.page, false);
      expect(result).toMatchObject({
        soundCount: 1,
        logCount: 1,
        backend: 'dom',
        writerMode: 'idle'
      });
      expect(result.diagnostics.domCellCount).toBeGreaterThan(0);
      expect(result.displayObjects).toEqual({
        total: result.diagnostics.domCellCount,
        active: result.diagnostics.domCellCount,
        pooled: 0
      });
      expect(await session.page.locator('#board canvas').count()).toBe(0);
      expect(await session.page.locator('[data-reload-required="true"]').count()).toBe(0);
    } finally {
      await stopPlaywrightPage(session.page);
      await session.context.close();
    }
  }, 30000);
});
