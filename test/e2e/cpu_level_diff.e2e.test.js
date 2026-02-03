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

describe('CPU level difference E2E', () => {
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

  test('white CPU reflects higher level in logs after reset and chooses at that level', async () => {
    const page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);

    // Wait for selects
    await page.waitForSelector('#smartBlack');
    await page.waitForSelector('#smartWhite');

    // Set levels: black=1, white=3
    await page.selectOption('#smartBlack', '1').catch(() => {});
    await page.selectOption('#smartWhite', '3').catch(() => {});

    // Force change event to propagate
    await page.evaluate(() => {
      const b = document.getElementById('smartBlack');
      const w = document.getElementById('smartWhite');
      if (b) b.dispatchEvent(new Event('change'));
      if (w) w.dispatchEvent(new Event('change'));
    });

    // Click reset to apply
    await page.click('button:has-text("リセット")');

    // Wait for console entry confirming White level change
    try {
      await page.waitForEvent('console', { timeout: 3000, predicate: m => m.text().includes('[CPU Level]') && m.text().includes('White') });
    } catch (e) {
      // fallback: inspect collected consoles
    }

    const levelChangeLine = consoles.find(c => c.text && c.text.indexOf('[CPU Level] White changed to level 3') !== -1);
    expect(levelChangeLine).toBeDefined();
    expect(levelChangeLine.text.indexOf('White changed to level 3') !== -1).toBeTruthy();

    // Wait for a legal move and click it
    await page.waitForSelector('#board .cell.legal, #board .cell.legal-free', { timeout: 5000 });
    await page.evaluate(() => { const c = document.querySelector('#board .cell.legal, #board .cell.legal-free'); if (c) c.click(); });

    // Wait for CPU log indicating white decision and level
    let cpuLogFound = false;
    try {
      await page.waitForEvent('console', { timeout: 10000, predicate: m => m.text().includes('[CPU]') && m.text().includes('white') && m.text().includes('Lv') });
      cpuLogFound = true;
    } catch (e) { cpuLogFound = false; }

    // fallback: inspect collected consoles
    if (!cpuLogFound) {
      cpuLogFound = consoles.some(c => c.text && c.text.indexOf('[CPU]') !== -1 && c.text.indexOf('white') !== -1 && c.text.indexOf('Lv') !== -1);
    }

    expect(cpuLogFound).toBe(true);

    await page.close();
  }, 30000);
});