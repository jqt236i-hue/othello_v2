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

  test('iPad 4:3 layout keeps five-card hand clear of side controls', async () => {
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
      function fillHand(selector: string, ownerKey: string): void {
        const track = document.querySelector(`${selector} .hand-track`);
        if (!track) throw new Error(`${selector} track is missing`);
        track.innerHTML = '';
        for (let i = 0; i < 5; i += 1) {
          const card = document.createElement('div');
          card.className = 'card-item visible cost-tier-red clickable';
          card.dataset.ownerKey = ownerKey;
          card.dataset.handIndex = String(i);
          card.innerHTML = '<span class="card-name">盤界の執行者</span><div class="card-cost-badge cost-tier-red"><span class="cost-value">9</span><span class="cost-label">cost</span></div>';
          track.appendChild(card);
        }
      }
      function union(selector: string): DOMRect {
        const rects = Array.from(document.querySelectorAll(selector))
          .map((el) => el.getBoundingClientRect());
        if (!rects.length) throw new Error(`${selector} is missing`);
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top });
      }

      fillHand('#hand-black', 'black');
      fillHand('#hand-white', 'white');

      const blackCards = union('#hand-black .card-item');
      const whiteCards = union('#hand-white .card-item');
      const leftControls = document.getElementById('leftActionButtons')?.getBoundingClientRect();
      const quickControls = document.getElementById('quick-controls-bar')?.getBoundingClientRect();
      if (!leftControls || !quickControls) {
        throw new Error('side controls are missing');
      }

      return {
        blackToLeftVerticalGap: leftControls.top - blackCards.bottom,
        blackToQuickHorizontalGap: quickControls.left - blackCards.right,
        whiteTop: whiteCards.top
      };
    });

    expect(metrics.blackToLeftVerticalGap).toBeGreaterThanOrEqual(8);
    expect(metrics.blackToQuickHorizontalGap).toBeGreaterThanOrEqual(8);
    expect(metrics.whiteTop).toBeGreaterThanOrEqual(44);
  }, 30000);
});
