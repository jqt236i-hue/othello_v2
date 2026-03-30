const { chromium } = require('playwright');
const { startStaticServer, stopStaticServer, stopPlaywrightPage, stopPlaywrightBrowser } = require('./e2e-runtime-helpers');

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('CPU level difference E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  let page = null;
  beforeAll(async () => {
    serverProc = startServer(0);
    await new Promise(resolve => setTimeout(resolve, 500));
    serverPort = serverProc.address().port;
    browser = await chromium.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightPage(page, 10000);
    page = null;
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(serverProc);
    serverProc = null;
  }, 30000);

  test('white CPU reflects higher level in logs after reset and chooses at that level', async () => {
    page = await browser.newPage();
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
    await page.locator('#board .cell.legal, #board .cell.legal-free').first().click();

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
    page = null;
  }, 30000);
});
