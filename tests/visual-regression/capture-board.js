const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const url = process.env.TEST_URL || 'http://localhost:8081/?debug=1';
  const outDir = 'tests/visual-regression';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // Start a minimal static server on port 8123 (local only)
  const http = require('http');
  const urlModule = require('url');
  const pathModule = require('path');
  const root = pathModule.resolve(__dirname, '..', '..');
  // Use an ephemeral port by default or honor VIS_PORT env when provided (avoids EADDRINUSE in CI/local runs)
  const port = process.env.VIS_PORT ? parseInt(process.env.VIS_PORT, 10) : 0;

  const server = http.createServer((req, res) => {
    const u = urlModule.parse(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/index.html';
    const filePath = pathModule.join(root, p);
    const stream = require('fs').createReadStream(filePath);
    stream.on('error', (err) => {
      res.statusCode = 404;
      res.end('Not found');
    });
    const ext = pathModule.extname(filePath).toLowerCase();
    const typeMap = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
    res.setHeader('Content-Type', typeMap[ext] || 'application/octet-stream');
    stream.pipe(res);
  });

  await new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => { const actualPort = server.address().port; console.log('[viz] local static server started on', actualPort); resolve(); });
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const localUrl = `http://127.0.0.1:${server.address().port}/?debug=1`;
  console.log('[viz] navigating to', localUrl);
  await page.goto(localUrl, { waitUntil: 'load' });

  // Wait for game to initialize
  await page.waitForTimeout(2000);

  // Ensure debug actions are loaded and apply visual test board
  try {
    await page.evaluate(async () => {
      if (typeof window.ensureDebugActionsLoaded === 'function') {
        return new Promise((resolve) => {
          window.ensureDebugActionsLoaded(() => {
            try {
              if (typeof DebugActions !== 'undefined' && DebugActions && typeof DebugActions.applyVisualTestBoard === 'function') {
                DebugActions.applyVisualTestBoard(window.gameState, window.cardState);
              }
            } catch (e) {}
            resolve();
          });
        });
      } else if (typeof DebugActions !== 'undefined' && DebugActions && typeof DebugActions.applyVisualTestBoard === 'function') {
        DebugActions.applyVisualTestBoard(window.gameState, window.cardState);
      }
    });
  } catch (e) {
    console.warn('[viz] applyVisualTestBoard failed', e);
  }

  // Force render and wait for animations
  try { await page.evaluate(() => { if (typeof window.forceFullRender === 'function' && window.boardEl) window.forceFullRender(window.boardEl); }); } catch (e) {}
  await page.waitForTimeout(500);

  // take screenshot of board element
  const board = await page.$('#board');
  if (!board) {
    console.error('[viz] Could not find #board element');
    await browser.close();
    process.exit(2);
  }
  const path = outDir + '/baseline-board.png';
  await board.screenshot({ path });
  console.log('[viz] saved', path);
  await browser.close();
  // ensure the static server is closed cleanly
  await new Promise((resolve) => server.close(resolve));
})();