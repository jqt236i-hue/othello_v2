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
  const currentTemp = path.join(__dirname, `current-board.capture.${process.pid}.png`);
  const diffTemp = path.join(__dirname, `diff-board.capture.${process.pid}.png`);
  const threshold = process.env.VISUAL_DIFF_THRESHOLD ? parseInt(process.env.VISUAL_DIFF_THRESHOLD, 10) : 4000; // pixels
  // Deliberately opt-in: only use after reviewing a deterministic capture.
  const updateBaseline = process.env.VISUAL_UPDATE_BASELINE === '1';

  function removeIfExists(filePath) {
    try { fs.rmSync(filePath, { force: true }); } catch (e) {}
  }

  function publishFailureArtifacts(options = {}) {
    try {
      if (fs.existsSync(currentTemp)) fs.copyFileSync(currentTemp, current);
    } catch (e) {}
    try {
      if (options.diff === true && fs.existsSync(diffTemp)) fs.copyFileSync(diffTemp, diffOut);
    } catch (e) {}
  }

  function cleanupTempArtifacts() {
    removeIfExists(currentTemp);
    removeIfExists(diffTemp);
  }

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

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const actualPort = server.address().port;
  console.log('[viz-check] local static server started on', actualPort);

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    const localUrl = `http://127.0.0.1:${actualPort}/?debug=1&noanim=1`;
    console.log('[viz-check] navigating to', localUrl);
    await page.goto(localUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => (
      window.gameState
      && Array.isArray(window.gameState.board)
      && window.gameState.board.length === 8
      && window.cardState
    ), { timeout: 10000 });

    // ?debug=1 only authorizes debug controls. Enable them and apply the fixture
    // through the same UI path a developer uses, so the captured board is fixed.
    const debugModeBtn = page.locator('#debugModeBtn');
    await debugModeBtn.waitFor({ state: 'visible', timeout: 10000 });
    if (await debugModeBtn.getAttribute('aria-pressed') !== 'true') {
      await debugModeBtn.click({ timeout: 10000 });
    }
    const visualTestBtn = page.locator('#visualTestBtn');
    await visualTestBtn.waitFor({ state: 'visible', timeout: 10000 });
    await visualTestBtn.click({ timeout: 10000 });
    await page.waitForFunction(() => {
      const board = window.gameState && window.gameState.board;
      const markers = window.cardState && window.cardState.markers;
      return Array.isArray(board)
        && board.length === 8
        && board.every((row) => Array.isArray(row) && row.length === 8)
        && board[0][0] !== 0
        && board[0][1] !== 0
        && board[7][0] !== 0
        && board[7][1] !== 0
        && Array.isArray(markers)
        && markers.length === 15;
    }, { timeout: 10000 });

    try { await page.evaluate(() => { if (typeof window.forceFullRender === 'function' && window.boardEl) window.forceFullRender(window.boardEl); }); } catch (e) {}
    try {
      await page.waitForFunction(() => document.documentElement.classList.contains('stone-images-loaded'), { timeout: 5000 });
    } catch (e) {}
    const sidePanel = page.locator('#side-panel');
    if (await sidePanel.getAttribute('aria-hidden') !== 'true') {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => {
        const panel = document.getElementById('side-panel');
        return !!panel && panel.classList.contains('side-panel-collapsed') && panel.getAttribute('aria-hidden') === 'true';
      }, { timeout: 5000 });
    }
    await page.waitForTimeout(500);

    const board = await page.$('#board');
    if (!board) throw new Error('Could not find #board element');
    cleanupTempArtifacts();
    await board.screenshot({ path: currentTemp });
    console.log('[viz-check] captured', currentTemp);
    await browser.close();

    if (updateBaseline || !fs.existsSync(baseline)) {
      // Create a missing baseline, or explicitly promote a reviewed capture.
      fs.copyFileSync(currentTemp, baseline);
      cleanupTempArtifacts();
      console.log(`[viz-check] baseline ${updateBaseline ? 'updated' : 'created'} at`, baseline);
      server.close();
      process.exit(0);
    }

    // Compare baseline vs current
    const img1 = PNG.sync.read(fs.readFileSync(baseline));
    const img2 = PNG.sync.read(fs.readFileSync(currentTemp));
    const { width, height } = img1;
    if (width !== img2.width || height !== img2.height) {
      console.error('[viz-check] image size mismatch');
      publishFailureArtifacts();
      cleanupTempArtifacts();
      server.close();
      process.exit(2);
    }
    const diff = new PNG({ width, height });
    const num = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.12 });
    fs.writeFileSync(diffTemp, PNG.sync.write(diff));
    console.log('[viz-check] diff pixels:', num, '(threshold:', threshold + ')');
    server.close();
    if (num > threshold) {
      console.error('[viz-check] visual regression detected');
      publishFailureArtifacts({ diff: true });
      cleanupTempArtifacts();
      process.exit(3);
    }
    cleanupTempArtifacts();
    console.log('[viz-check] visual check passed');
    process.exit(0);
  } catch (e) {
    console.error('[viz-check] error', e && e.message);
    publishFailureArtifacts();
    cleanupTempArtifacts();
    server.close();
    process.exit(2);
  }
})();
