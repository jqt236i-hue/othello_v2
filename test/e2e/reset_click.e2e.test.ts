import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
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
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(serverProc);
    serverProc = null;
  }, 30000);

  test('Reset initializes board and clicking a legal cell executes a move', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
    await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for board and game state to be ready
    await page.waitForSelector('#board .cell');
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });

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

    // Record board progress signals before the click
    const before = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);
    const beforeTurnNumber = await page.evaluate(() => (window.gameState && window.gameState.turnNumber) || 0);

    await page.locator('#board .cell.legal, #board .cell.legal-free').first().click();

    await page.waitForFunction(({ beforeDiscCount, beforeTurn }) => {
      try {
        const currentDiscCount = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
        const currentTurn = (window.gameState && window.gameState.turnNumber) || 0;
        return currentDiscCount > beforeDiscCount || currentTurn > beforeTurn;
      } catch (e) {
        return false;
      }
    }, { beforeDiscCount: before, beforeTurn: beforeTurnNumber }, { timeout: 6000 });

    const after = await page.$$eval('#board .disc.black, #board .disc.white', els => els.length);
    const afterTurnNumber = await page.evaluate(() => (window.gameState && window.gameState.turnNumber) || 0);

    expect(after).toBeGreaterThan(before);
    expect(afterTurnNumber).toBeGreaterThan(beforeTurnNumber);

    await page.close();
  }, 30000);
});
