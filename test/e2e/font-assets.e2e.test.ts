import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import {
  closeMaintenanceNoticeIfPresent,
  startStaticServer,
  stopPlaywrightBrowser,
  stopStaticServer
} from './e2e-runtime-helpers.js';

describe('font subset/full fallback browser contract', () => {
  let server: ReturnType<typeof startStaticServer> | null = null;
  let browser: Browser | null = null;
  let port = 0;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) await new Promise<void>((resolve) => server!.once('listening', resolve));
    port = server.address().port;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(server);
    server = null;
  }, 30000);

  test.each([
    ['classic', 'index.html'],
    ['vite', 'vite-dist/index.vite.html']
  ])('%s uses subset glyphs and loads full WOFF2 only for the explicit fallback glyph', async (_lane, entry) => {
    if (!browser) throw new Error('browser is not initialized');
    const page = await browser.newPage();
    const requests: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(`http://127.0.0.1:${port}/${entry}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await closeMaintenanceNoticeIfPresent(page);
    try {
      await page.waitForFunction(
        () => (window as any).__uiInitialized === true,
        undefined,
        { timeout: 30000 }
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        uiInitialized: (window as any).__uiInitialized,
        bootState: document.documentElement.getAttribute('data-browser-boot-state'),
        bootError: document.getElementById('browserViteBootError')?.textContent || null
      })).catch(() => null);
      throw new Error(
        `browser boot timeout: ${JSON.stringify(state)}; ` +
        `pageErrors=${pageErrors.join(' | ')}; consoleErrors=${consoleErrors.join(' | ')}; ` +
        `cause=${error instanceof Error ? error.message : error}`
      );
    }
    const initial = await page.evaluate(async () => {
      await document.fonts.ready;
      const subsetFaces = await document.fonts.load(
        '400 16px "CR-Shippori Mincho Subset"',
        '布石'
      );
      const emojiFullFaces = await document.fonts.load(
        '400 16px "CR-Shippori Mincho Full"',
        '😀'
      );
      return {
        subsetFaceCount: subsetFaces.length,
        emojiFullFaceCount: emojiFullFaces.length
      };
    });

    const fullPattern = /\/shippori-mincho-400\.woff2(?:\?|$)/;
    expect(initial.subsetFaceCount).toBe(1);
    expect(initial.emojiFullFaceCount).toBe(0);
    expect(requests.filter((url) => fullPattern.test(url))).toHaveLength(0);

    const fallback = await page.evaluate(async () => {
      const fullFaces = await document.fonts.load(
        '400 16px "CR-Shippori Mincho Full"',
        '丈'
      );
      await document.fonts.load(
        '400 16px "CR-Shippori Mincho Subset"',
        '太'
      );
      await document.fonts.load(
        '400 16px "CR-Shippori Mincho Full"',
        '太丈'
      );
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable');
      context.font = '400 32px "CR-Shippori Mincho Subset", "CR-Shippori Mincho Full"';
      const mixedWidth = context.measureText('太丈').width;
      context.font = '400 32px "CR-Shippori Mincho Full"';
      const fullWidth = context.measureText('太丈').width;

      const probe = document.createElement('div');
      probe.className = 'card-name';
      probe.textContent = '時間停止の意志';
      probe.style.width = '28px';
      probe.style.display = 'block';
      probe.style.whiteSpace = 'nowrap';
      document.body.appendChild(probe);
      const schedule = (window as any).scheduleCardNameRefitAfterFontsReady;
      if (typeof schedule !== 'function') throw new Error('font-ready card-name scheduler is unavailable');
      const refit = await schedule(document, true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const fittedFontSize = probe.style.fontSize;
      probe.remove();
      return {
        fullFaceCount: fullFaces.length,
        mixedWidth,
        fullWidth,
        refit,
        fittedFontSize
      };
    });

    expect(fallback.fullFaceCount).toBe(1);
    expect(Math.abs(fallback.mixedWidth - fallback.fullWidth)).toBeLessThan(0.01);
    expect(fallback.refit).toBe(true);
    expect(fallback.fittedFontSize).toMatch(/^\d+px$/);
    expect(requests.filter((url) => fullPattern.test(url))).toHaveLength(1);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.close();
  }, 60000);
});
