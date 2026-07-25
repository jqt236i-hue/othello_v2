import { chromium, type Browser, type Page } from 'playwright';
import {
  closeMaintenanceNoticeIfPresent,
  startStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  stopStaticServer
} from './e2e-runtime-helpers.js';

describe('network room list refresh hit target', () => {
  let server: ReturnType<typeof startStaticServer> | null = null;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let port = 0;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) {
      await new Promise<void>((resolve) => server!.once('listening', resolve));
    }
    port = server.address().port;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightPage(page, 10000);
    page = null;
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(server);
    server = null;
  }, 30000);

  test('PC表示で更新ボタン全体が部屋一覧に覆われずクリックできる', async () => {
    if (!browser) throw new Error('browser is not initialized');

    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/api/match/list**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, rooms: [] })
      });
    });

    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(
      () => (window as any).__uiInitialized === true,
      undefined,
      { timeout: 30000 }
    );

    const initialListRequest = page.waitForRequest(
      (request) => request.url().includes('/api/match/list'),
      { timeout: 10000 }
    );
    await page.locator('#modeNetworkBtn').click();
    await initialListRequest;
    await page.locator('#networkRoomListRefreshBtn').waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const button = document.getElementById('networkRoomListRefreshBtn');
      return !!button && getComputedStyle(button).fontSize !== '';
    });
    const hitTarget = await page.evaluate(() => {
      const button = document.getElementById('networkRoomListRefreshBtn');
      const viewport = document.getElementById('networkRoomListViewport');
      if (!button || !viewport) {
        throw new Error('network room refresh controls are missing');
      }
      const buttonRect = button.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const centerX = buttonRect.left + buttonRect.width / 2;
      const centerY = buttonRect.top + buttonRect.height / 2;
      const centerHit = document.elementFromPoint(centerX, centerY);
      return {
        buttonBottom: buttonRect.bottom,
        viewportTop: viewportRect.top,
        centerHitIsButton: centerHit === button || button.contains(centerHit)
      };
    });

    expect(hitTarget.buttonBottom).toBeLessThanOrEqual(hitTarget.viewportTop + 0.5);
    expect(hitTarget.centerHitIsButton).toBe(true);

    const refreshListRequest = page.waitForRequest(
      (request) => request.url().includes('/api/match/list'),
      { timeout: 10000 }
    );
    await page.locator('#networkRoomListRefreshBtn').click();
    await refreshListRequest;
  }, 60000);
});
