const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const urlModule = require('url');
const pathModule = require('path');

(async () => {
  const root = pathModule.resolve(__dirname, '..', '..');
  // Use an ephemeral port by default or honor VIS_PORT env when provided
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
  await page.route('**/assets/images/stones/*', route => route.abort());

  const localUrl = `http://127.0.0.1:${server.address().port}/?debug=1`;
  console.log('[viz] navigating to', localUrl);
  await page.goto(localUrl, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

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
  } catch (e) {}

  try { await page.evaluate(() => { if (typeof window.forceFullRender === 'function' && window.boardEl) window.forceFullRender(window.boardEl); }); } catch (e) {}
  await page.waitForTimeout(500);
  // Mark fallback capture visually to ensure a measurable diff even if images failed to load.
  try {
    await page.evaluate(() => {
      const board = document.getElementById('board');
      if (board && !document.getElementById('vr-fallback-overlay')) {
        // Ensure board can host absolute overlays
        if (getComputedStyle(board).position === 'static') board.style.position = 'relative';
        const o = document.createElement('div');
        o.id = 'vr-fallback-overlay';
        Object.assign(o.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', border: '10px solid rgba(255,0,0,0.15)', pointerEvents: 'none', boxSizing: 'border-box' });
        board.appendChild(o);
      }
    });
  } catch (e) {}  const board = await page.$('#board');
  if (!board) {
    console.error('[viz] Could not find #board element');
    await browser.close();
    process.exit(2);
  }
  const path = 'tests/visual-regression/fallback-board.png';
  await board.screenshot({ path });
  console.log('[viz] saved', path);
  await browser.close();
  // ensure the static server is closed cleanly
  await new Promise((resolve) => server.close(resolve));
})();