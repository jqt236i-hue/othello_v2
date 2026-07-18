import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightPage, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent, closeSidePanelIfPresent } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
}

async function waitForViteReady(page) {
  await page.waitForFunction(() => {
    const root = window as any;
    return root.__uiInitialized === true
      && root.__CARD_REVERSI_BROWSER_LANE__ === 'vite'
      && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
      && Array.isArray(root.gameState?.board);
  }, undefined, { timeout: 30000 });
}

describe('CPU level difference E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  let page = null;
  beforeAll(async () => {
    serverProc = startServer(0);
    await new Promise(resolve => setTimeout(resolve, 500));
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

  test('white CPU reflects higher level in logs after reset and chooses at that level', async () => {
    page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=dom&noanim=1`, { waitUntil: 'domcontentloaded' });
    await closeMaintenanceNoticeIfPresent(page);
    await waitForViteReady(page);

    // Wait for selects
    await page.waitForSelector('#smartBlack', { state: 'attached' });
    await page.waitForSelector('#smartWhite', { state: 'attached' });

    // Set levels: black=1, white=3
    await page.selectOption('#smartBlack', '1').catch(() => {});
    await page.selectOption('#smartWhite', '3').catch(() => {});

    // Force change event to propagate
    await page.evaluate(() => {
      const b = document.getElementById('smartBlack');
      const w = document.getElementById('smartWhite');
      if (b) b.dispatchEvent(new Event('change'));
      if (w) w.dispatchEvent(new Event('change'));
    });

    await closeSidePanelIfPresent(page);

    // Click reset to apply
    await page.click('#resetBtn');

    // Wait for console entry confirming White level change
    try {
      await page.waitForEvent('console', { timeout: 3000, predicate: m => m.text().includes('[CPU Level]') && m.text().includes('White') });
    } catch (e) {
      // fallback: inspect collected consoles
    }

    const levelChangeLine = consoles.find(c => c.text && c.text.indexOf('[CPU Level] White changed to level 3') !== -1);
    expect(levelChangeLine).toBeDefined();
    expect(levelChangeLine.text.indexOf('White changed to level 3') !== -1).toBeTruthy();

    // Wait for a legal move and click it
    await page.waitForSelector('#board .cell.legal, #board .cell.legal-free', { timeout: 5000 });
    await page.locator('#board .cell.legal, #board .cell.legal-free').first().click();

    // Wait for CPU log indicating white decision and level
    let cpuLogFound = false;
    try {
      await page.waitForEvent('console', { timeout: 10000, predicate: m => m.text().includes('[CPU]') && m.text().includes('white') && m.text().includes('Lv') });
      cpuLogFound = true;
    } catch (e) { cpuLogFound = false; }

    // fallback: inspect collected consoles
    if (!cpuLogFound) {
      cpuLogFound = consoles.some(c => c.text && c.text.indexOf('[CPU]') !== -1 && c.text.indexOf('white') !== -1 && c.text.indexOf('Lv') !== -1);
    }

    expect(cpuLogFound).toBe(true);

    await page.close();
    page = null;
  }, 30000);

  test('white draw uses CPU hand image from level selects even when window cpuSmartness is not mirrored', async () => {
    page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'domcontentloaded' });
    await closeMaintenanceNoticeIfPresent(page);
    await waitForViteReady(page);
    await page.waitForSelector('#smartBlack', { state: 'attached' });
    await page.waitForSelector('#smartWhite', { state: 'attached' });
    await page.waitForSelector('#autoToggleBtn');

    await page.evaluate(() => {
      localStorage.setItem('othello.handSkin', 'default');
      window.__handProbe = [];
      const origDraw = window.playDrawCardHandAnimation;
      window.playDrawCardHandAnimation = async function(payload) {
        const result = origDraw.apply(this, arguments);
        await Promise.resolve();
        window.__handProbe.push({
          player: payload && payload.player ? payload.player : null,
          src: document.getElementById('handImage')?.getAttribute('src') || null,
          skinId: document.getElementById('handImage')?.getAttribute('data-hand-skin-id') || null,
          mirroredCpuSmartness: (typeof window.cpuSmartness === 'undefined') ? null : window.cpuSmartness
        });
        return result;
      };
    });

    await page.evaluate(() => {
      const b = document.getElementById('smartBlack') as HTMLSelectElement | null;
      const w = document.getElementById('smartWhite') as HTMLSelectElement | null;
      if (b) {
        b.value = '1';
        b.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (w) {
        w.value = '4';
        w.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(await page.evaluate(() => typeof window.cpuSmartness)).toBe('undefined');

    await closeSidePanelIfPresent(page);
    await page.click('#resetBtn');
    await page.click('#autoToggleBtn');

    await page.waitForFunction(
      () => Array.isArray(window.__handProbe) && window.__handProbe.some((entry) => entry && entry.player === 'white' && entry.skinId === 'cpu-lv4'),
      null,
      { timeout: 15000 }
    );

    const whiteDraw = await page.evaluate(() => {
      return window.__handProbe.find((entry) => entry && entry.player === 'white' && entry.skinId === 'cpu-lv4') || null;
    });

    expect(whiteDraw).toBeTruthy();
    expect(whiteDraw.src).toContain('assets/images/hand-skin/lv4.png');
    expect(whiteDraw.mirroredCpuSmartness).toBeNull();

    await page.close();
    page = null;
  }, 30000);
});
