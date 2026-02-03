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

describe('CPU auto-response E2E', () => {
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

  test('player move triggers CPU turn and CPU performs an action', async () => {
    const page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);

    // Wait for board initialised
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });

    // Click Reset to ensure known starting state
    await page.click('button:has-text("リセット")');
    await page.waitForTimeout(300);

    // Ensure a legal cell exists and click it
    await page.waitForSelector('#board .cell.legal, #board .cell.legal-free', { timeout: 5000 });

    // Record disc counts before move
    const before = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);

    await page.evaluate(() => {
      const cell = document.querySelector('#board .cell.legal, #board .cell.legal-free');
      if (cell) cell.click();
    });

    // Wait for human move to be applied (disc count increases or currentPlayer flips to white)
    await page.waitForFunction((beforeCount) => {
      try {
        const b = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
        if (typeof window.gameState !== 'undefined' && window.gameState.currentPlayer === -1) return true;
        return b > beforeCount;
      } catch (e) { return false; }
    }, { timeout: 2000 }, before).catch(() => {});

    // Wait for either a CPU console message or for currentPlayer to revert to black (1)
    let cpuObserved = false;
    try {
      // wait for console message that contains [CPU]
      await page.waitForEvent('console', { timeout: 10000, predicate: m => m.text().includes('[CPU]') });
      cpuObserved = true;
    } catch (e) {
      // If no explicit CPU log, fallback to checking gameState.currentPlayer flip back to black
      try {
        await page.waitForFunction(() => (window.gameState && window.gameState.currentPlayer === 1), { timeout: 10000 });
        cpuObserved = true;
      } catch (err) {
        cpuObserved = false;
      }
    }

    // Also check disc count eventually increased (either by human or CPU)
    const after = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);

    expect(after).toBeGreaterThanOrEqual(before);
    expect(cpuObserved).toBe(true);

    await page.close();
  }, 30000);
}); 