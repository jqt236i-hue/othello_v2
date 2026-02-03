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

describe('Multi-turn progression E2E', () => {
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

  test('game progresses multiple turns with CPU responses', async () => {
    const page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);

    // Wait for board initialised
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });

    // Reset and ensure initial state
    await page.click('button:has-text("リセット")');
    await page.waitForTimeout(300);

    // Run for up to N turns, tracking changes
    const maxCycles = 6;
    let successfulTurns = 0;

    for (let i = 0; i < maxCycles; i++) {
      const beforeCount = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);
      const beforePlayer = await page.evaluate(() => window.gameState && window.gameState.currentPlayer);

      // If it's human's turn, click a legal cell; else wait for CPU to act
      if (beforePlayer === 1) {
        const legal = await page.$('#board .cell.legal, #board .cell.legal-free');
        if (legal) {
          await page.evaluate(() => {
            const cell = document.querySelector('#board .cell.legal, #board .cell.legal-free');
            if (cell) cell.click();
          });

          try {
            await page.waitForFunction((b, p) => {
              try {
                const b2 = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
                if (typeof window.gameState !== 'undefined' && window.gameState.currentPlayer !== p) return true;
                return b2 > b;
              } catch (e) { return false; }
            }, { timeout: 6000 }, beforeCount, beforePlayer);
            successfulTurns++;
          } catch (e) {
            // no progress observed in this cycle
          }
        } else {
          await page.waitForTimeout(300);
        }
      } else {
        // CPU's turn: wait for player flip or disc change
        try {
          await page.waitForFunction((p) => {
            try {
              const b2 = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
              if (typeof window.gameState !== 'undefined' && window.gameState.currentPlayer !== p) return true;
              return b2 > 0 && p !== window.gameState.currentPlayer;
            } catch (e) { return false; }
          }, { timeout: 8000 }, beforePlayer);
          successfulTurns++;
        } catch (e) {
          // no progress observed this cycle
        }
      }

      // Short delay to allow UI to stabilize
      await page.waitForTimeout(200);
    }

    expect(successfulTurns).toBeGreaterThanOrEqual(3);
    await page.close();
  }, 120000);
});
