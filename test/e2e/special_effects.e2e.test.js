const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

function startServer(port = 0) {
  const root = path.resolve(__dirname, '..', '..');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(root, decodeURIComponent(reqPath));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.end(data);
    });
  });
  server.listen(port);
  return server;
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
    if (browser) await browser.close();
    if (serverProc && typeof serverProc.close === 'function') {
      await new Promise(resolve => serverProc.close(resolve));
    }
  });

  test('work stones and bombs render special visuals', async () => {
    const page = await browser.newPage();

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);

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
            const discs = Array.from(document.querySelectorAll('.disc'));
            for (const d of discs) {
              if (d.classList.contains('work-stone')) return true;
              if (d.querySelector('.special-stone-img')) return true;
              const imgVar = (d.style && d.style.getPropertyValue) ? d.style.getPropertyValue('--special-stone-image') : null;
              if (imgVar && String(imgVar).trim().length) return true;
            }
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
        // check that at least one disc has work-stone class or special-stone-img
        const discs = Array.from(document.querySelectorAll('.disc'));
        for (const d of discs) {
          if (d.classList.contains('work-stone')) return true;
          if (d.querySelector('.special-stone-img')) return true;
          const imgVar = (d.style && d.style.getPropertyValue) ? d.style.getPropertyValue('--special-stone-image') : null;
          if (imgVar && String(imgVar).trim().length) return true;
        }
        return false;
      } catch (e) { return false; }
    });

    expect(workPresent).toBe(true);
    expect(bombExists).toBe(true);

    await page.close();
  }, 120000);
});