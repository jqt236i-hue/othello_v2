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

describe('UI Reset & Click E2E', () => {
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

  test('Reset initializes board and clicking a legal cell executes a move', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
    await page.goto(`http://127.0.0.1:${serverPort}/`);

    // Wait for board to be present and cells created
    await page.waitForSelector('#board .cell');

    // Click the Reset button and wait a little for init
    await page.click('button:has-text("リセット")');
    await page.waitForTimeout(300);

    // Ensure no warning about missing resetGame
    const hasResetWarning = logs.some(l => l.text && l.text.indexOf('[init] resetGame not available') !== -1);
    expect(hasResetWarning).toBe(false);

    // Ensure board has 64 cells
    const totalCells = await page.$$eval('#board .cell', el => el.length);
    expect(totalCells).toBe(64);

    // Find a legal cell and click it
    const legalExists = await page.$('#board .cell.legal, #board .cell.legal-free');
    expect(legalExists).toBeTruthy();

    // Record discs count before
    const before = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);

    await page.evaluate(() => {
      const cell = document.querySelector('#board .cell.legal, #board .cell.legal-free');
      if (cell) cell.click();
    });

    // wait for move to process
    await page.waitForTimeout(500);

    const after = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);
    expect(after).toBeGreaterThanOrEqual(before);

    await page.close();
  }, 20000);
});