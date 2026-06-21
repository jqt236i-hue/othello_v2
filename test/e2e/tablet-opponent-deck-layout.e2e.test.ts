import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightPage, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } from './e2e-runtime-helpers.js';

describe('tablet opponent deck layout', () => {
  let serverProc: any;
  let browser: any;
  let serverPort: number | null = null;
  let page: any = null;

  beforeAll(async () => {
    serverProc = startStaticServer(0);
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

  test('iPad 4:3 layout keeps opponent deck clear of opponent charge display', async () => {
    page = await browser.newPage({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1&simAspect=4:3`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(() => document.documentElement.classList.contains('layout-profile-tablet-4x3'), {
      timeout: 10000
    });

    const metrics = await page.evaluate(() => {
      const deck = document.getElementById('deck-white')?.getBoundingClientRect();
      const charge = document.getElementById('charge-white')?.getBoundingClientRect();
      if (!deck || !charge) {
        throw new Error('opponent deck or charge display is missing');
      }
      return {
        deckBottom: deck.bottom,
        chargeTop: charge.top,
        intersects: deck.left < charge.right
          && deck.right > charge.left
          && deck.top < charge.bottom
          && deck.bottom > charge.top
      };
    });

    expect(metrics.intersects).toBe(false);
    expect(metrics.chargeTop - metrics.deckBottom).toBeGreaterThanOrEqual(4);
  }, 30000);
});
