import { chromium } from 'playwright';
import type { Browser, ConsoleMessage } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser } from './e2e-runtime-helpers.js';

declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('UI Reset & Click E2E', () => {
  let serverProc: ReturnType<typeof startServer> | null;
  let browser: Browser | null;
  let serverPort: number | null = null;
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
    if (!browser || serverPort === null) throw new Error('E2E runtime is not initialized');
    const page = await browser.newPage();
    const logs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => logs.push({ type: msg.type(), text: msg.text() }));
    await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for board and game state to be ready
    await page.waitForSelector('#board .cell');
    await page.waitForFunction(() => {
      const root = window as unknown as { gameState?: { board?: unknown[] } };
      return !!(root.gameState && Array.isArray(root.gameState.board) && root.gameState.board.length === 8);
    }, { timeout: 10000 });

    // Click the Reset button and wait a little for init
    await page.click('button:has-text("リセット")');
    await page.waitForTimeout(300);

    // Ensure no warning about missing resetGame
    const hasResetWarning = logs.some(l => l.text && l.text.indexOf('[init] resetGame not available') !== -1);
    expect(hasResetWarning).toBe(false);

    // Ensure board has 64 cells
    const totalCells = await page.$$eval('#board .cell', (els: Element[]) => els.length);
    expect(totalCells).toBe(64);

    // Find a legal cell and click it
    const legalExists = await page.$('#board .cell.legal, #board .cell.legal-free');
    expect(legalExists).toBeTruthy();

    // Record board progress signals before the click
    const before = await page.$$eval('#board .disc.black, #board .disc.white', (els: Element[]) => els.length);
    const beforeTurnNumber = await page.evaluate(() => {
      const root = window as unknown as { gameState?: { turnNumber?: number } };
      return (root.gameState && root.gameState.turnNumber) || 0;
    });

    await page.locator('#board .cell.legal, #board .cell.legal-free').first().click();

    await page.waitForFunction(({ beforeDiscCount, beforeTurn }: { beforeDiscCount: number; beforeTurn: number }) => {
      try {
        const currentDiscCount = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
        const root = window as unknown as { gameState?: { turnNumber?: number } };
        const currentTurn = (root.gameState && root.gameState.turnNumber) || 0;
        return currentDiscCount > beforeDiscCount && currentTurn > beforeTurn;
      } catch (e) {
        return false;
      }
    }, { beforeDiscCount: before, beforeTurn: beforeTurnNumber }, { timeout: 6000 });

    const after = await page.$$eval('#board .disc.black, #board .disc.white', (els: Element[]) => els.length);
    const afterTurnNumber = await page.evaluate(() => {
      const root = window as unknown as { gameState?: { turnNumber?: number } };
      return (root.gameState && root.gameState.turnNumber) || 0;
    });

    expect(after).toBeGreaterThan(before);
    expect(afterTurnNumber).toBeGreaterThan(beforeTurnNumber);

    await page.close();
  }, 30000);
});
