const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PNG = require('pngjs').PNG;
let pixelmatch = require('pixelmatch'); if (pixelmatch && pixelmatch.default) pixelmatch = pixelmatch.default;

(async () => {
  const root = path.resolve(__dirname, '..', '..');
  // Use an ephemeral port by default or honor VIS_PORT env when provided
  const port = process.env.VIS_PORT ? parseInt(process.env.VIS_PORT, 10) : 0;
  const baseline = path.join(__dirname, 'baseline-board.png');
  const current = path.join(__dirname, 'current-board.png');
  const diffOut = path.join(__dirname, 'diff-board.png');
  const threshold = process.env.VISUAL_DIFF_THRESHOLD ? parseInt(process.env.VISUAL_DIFF_THRESHOLD, 10) : 500; // pixels

  // Start minimal static server
  const http = require('http');
  const urlModule = require('url');
  const pathModule = require('path');
  const rootDir = root;

  const server = http.createServer((req, res) => {
    const u = urlModule.parse(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/index.html';
    const filePath = pathModule.join(rootDir, p);
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      res.statusCode = 404;
      res.end('Not found');
    });
    const ext = pathModule.extname(filePath).toLowerCase();
    const typeMap = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
    res.setHeader('Content-Type', typeMap[ext] || 'application/octet-stream');
    stream.pipe(res);
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', () => { const actualPort = server.address().port; resolve(); }));
  console.log('[viz-check] local static server started on', server.address().port);

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const localUrl = `http://127.0.0.1:${port}/?debug=1`;
    console.log('[viz-check] navigating to', localUrl);
    await page.goto(localUrl, { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    // Ensure test board is applied if debug helpers available
    try {
      await page.evaluate(async () => {
        if (typeof window.ensureDebugActionsLoaded === 'function') {
          return new Promise((resolve) => {
            window.ensureDebugActionsLoaded(() => { try { if (typeof DebugActions !== 'undefined' && DebugActions && typeof DebugActions.applyVisualTestBoard === 'function') DebugActions.applyVisualTestBoard(window.gameState, window.cardState); } catch (e) {} resolve(); });
          });
        } else if (typeof DebugActions !== 'undefined' && DebugActions && typeof DebugActions.applyVisualTestBoard === 'function') {
          DebugActions.applyVisualTestBoard(window.gameState, window.cardState);
        }
      });
    } catch (e) { /* ignore */ }

    try { await page.evaluate(() => { if (typeof window.forceFullRender === 'function' && window.boardEl) window.forceFullRender(window.boardEl); }); } catch (e) {}
    await page.waitForTimeout(500);

    const board = await page.$('#board');
    if (!board) throw new Error('Could not find #board element');
    await board.screenshot({ path: current });
    console.log('[viz-check] saved', current);
    await browser.close();

    if (!fs.existsSync(baseline)) {
      // No baseline: promote current to baseline
      fs.copyFileSync(current, baseline);
      console.log('[viz-check] baseline created at', baseline);
      server.close();
      process.exit(0);
    }

    // Compare baseline vs current
    const img1 = PNG.sync.read(fs.readFileSync(baseline));
    const img2 = PNG.sync.read(fs.readFileSync(current));
    const { width, height } = img1;
    if (width !== img2.width || height !== img2.height) {
      console.error('[viz-check] image size mismatch');
      server.close();
      process.exit(2);
    }
    const diff = new PNG({ width, height });
    const num = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.12 });
    fs.writeFileSync(diffOut, PNG.sync.write(diff));
    console.log('[viz-check] diff pixels:', num, '(threshold:', threshold + ')');
    server.close();
    if (num > threshold) {
      console.error('[viz-check] visual regression detected');
      process.exit(3);
    }
    console.log('[viz-check] visual check passed');
    process.exit(0);
  } catch (e) {
    console.error('[viz-check] error', e && e.message);
    server.close();
    process.exit(2);
  }
})();