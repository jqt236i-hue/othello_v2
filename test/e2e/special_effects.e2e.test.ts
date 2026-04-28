import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('Special effects E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
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

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });

    // Wait for debug module available
    // Ensure DebugActions is loaded (inject if missing)
    const dbgLoaded = await page.evaluate(() => {
      try { return typeof window.DebugActions === 'object' && typeof window.DebugActions.applyVisualTestBoard === 'function'; } catch (e) { return false; }
    });
    if (!dbgLoaded) {
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = 'game/debug/debug-actions.js';
          s.async = false;
          s.onload = () => setTimeout(resolve, 50);
          s.onerror = () => setTimeout(resolve, 50);
          document.head.appendChild(s);
        });
      });
      await page.waitForFunction(() => typeof window.DebugActions === 'object' && typeof window.DebugActions.applyVisualTestBoard === 'function', { timeout: 10000 });
    }

    // Apply test board and force render / visuals
    await page.evaluate(() => {
      try {
        window.DebugActions.applyVisualTestBoard(window.gameState, window.cardState);
      } catch (e) { /* ignore */ }
      try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { if (typeof renderBoard === 'function') renderBoard(); }
      try { if (typeof preloadWorkStoneImages === 'function') preloadWorkStoneImages(); } catch (e) { /* ignore */ }
      try { if (typeof ensureWorkVisualsApplied === 'function') ensureWorkVisualsApplied(); } catch (e) { /* ignore */ }
    });

    // Poll DOM for work visuals being applied (retry loop for robustness)
    const workApplied = await (async () => {
      const maxMs = 20000;
      const interval = 300;
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        const ok = await page.evaluate(() => {
          try {
            const disc = document.querySelector('.cell[data-row="4"][data-col="2"] .disc');
            if (!disc) return false;
            if (disc.classList.contains('work-stone')) return true;
            if (disc.querySelector('.special-stone-img')) return true;
            const imgVar = (disc.style && disc.style.getPropertyValue) ? disc.style.getPropertyValue('--special-stone-image') : null;
            if (imgVar && String(imgVar).trim().length) return true;
            return false;
          } catch (e) { return false; }
        });
        if (ok) return true;
        await new Promise(r => setTimeout(r, interval));
      }
      return false;
    })();

    if (!workApplied) {
      // give one final try to run the helper directly
      await page.evaluate(() => { try { if (typeof ensureWorkVisualsApplied === 'function') ensureWorkVisualsApplied(); } catch (e) {} });
      // re-check once
      await new Promise(r => setTimeout(r, 500));
    }

    // Check for bomb overlay presence with some tolerance
    const bombExists = await page.evaluate(() => {
      try {
        const bombs = Array.from(document.querySelectorAll('.disc.bomb, .disc.bomb-black, .disc.bomb-white'));
        if (bombs.length) return true;
        return !!document.querySelector('.disc .bomb-timer');
      } catch (e) { return false; }
    });

    const workPresent = await page.evaluate(() => {
      try {
        const disc = document.querySelector('.cell[data-row="4"][data-col="2"] .disc');
        if (!disc) return false;
        if (disc.classList.contains('work-stone')) return true;
        if (disc.querySelector('.special-stone-img')) return true;
        const imgVar = (disc.style && disc.style.getPropertyValue) ? disc.style.getPropertyValue('--special-stone-image') : null;
        if (imgVar && String(imgVar).trim().length) return true;
        return false;
      } catch (e) { return false; }
    });

    expect(workPresent).toBe(true);
    expect(bombExists).toBe(true);

    await page.close();
  }, 120000);
});
