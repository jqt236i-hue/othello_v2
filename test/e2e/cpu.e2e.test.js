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
      // minimal content type handling
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.end(data);
    });
  });
  // Bind to a dynamic port (0) by default to avoid EADDRINUSE flakes in CI
  server.listen(port);
  return server;
}

describe('CPU E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  beforeAll(async () => {
    serverProc = startServer(0); // request OS-assigned free port to avoid EADDRINUSE
    // give server time to start
    await new Promise(resolve => setTimeout(resolve, 500));
    serverPort = serverProc.address().port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (serverProc && typeof serverProc.close === 'function') {
      // close the server cleanly
      await new Promise(resolve => serverProc.close(resolve));
    }
  });

  test('computeCpuAction returns a valid action object in browser', async () => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    // Wait for global computeCpuAction to be available
    await page.waitForFunction(() => typeof window.computeCpuAction === 'function');

    // Wait for the game state to be initialized (resetGame / init sequence)
    await page.waitForFunction(() => {
      try { return !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8); } catch (e) { return false; }
    }, { timeout: 10000 });

    // Poll until computeCpuAction returns an action with an expected type (avoids race where internals not initialized yet)
    await page.waitForFunction(() => {
      try {
        const a = window.computeCpuAction && window.computeCpuAction('white');
        return a && (['move','useCard','pass'].indexOf(a.type) !== -1);
      } catch (e) { return false; }
    }, { timeout: 10000 });

    const action = await page.evaluate(() => {
      try { return window.computeCpuAction('white'); } catch (e) { return { error: String(e && e.message) }; }
    });

    expect(action).toBeDefined();
    expect(['move','useCard','pass']).toContain(action.type);
  }, 20000);
});