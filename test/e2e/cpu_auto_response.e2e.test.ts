import { chromium } from 'playwright';
import type { Browser, ConsoleMessage } from 'playwright';
import {
  startStaticServer,
  stopStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  closeMaintenanceNoticeIfPresent
} from './e2e-runtime-helpers.js';

declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('CPU auto-response E2E', () => {
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

  test.each([
    ['classic', 'index.html'],
    ['vite', 'vite-dist/index.vite.html']
  ])('%s lane: player move triggers CPU turn and CPU performs an action', async (lane: string, entry: string) => {
    if (!browser || serverPort === null) throw new Error('E2E runtime is not initialized');
    const page = await browser.newPage();
    try {
      const consoles: Array<{ type: string; text: string }> = [];
      page.on('console', (msg: ConsoleMessage) => {
        try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
      });

      await page.goto(`http://127.0.0.1:${serverPort}/${entry}`);
      await closeMaintenanceNoticeIfPresent(page);

      await page.waitForFunction(
        (expectedLane: string) => {
          const root = window as any;
          const htmlLane = String(document.documentElement.getAttribute('data-browser-lane') || '');
          const bootState = String(document.documentElement.getAttribute('data-browser-boot-state') || '');
          return root.__uiInitialized === true
            && String(root.__CARD_REVERSI_BROWSER_LANE__ || '') === expectedLane
            && htmlLane === expectedLane
            && (expectedLane !== 'vite' || bootState === 'ready');
        },
        lane,
        { timeout: 30000 }
      );
      const runtimeLane = await page.evaluate(() => ({
        global: String((window as any).__CARD_REVERSI_BROWSER_LANE__ || ''),
        html: String(document.documentElement.getAttribute('data-browser-lane') || ''),
        bootState: String(document.documentElement.getAttribute('data-browser-boot-state') || '')
      }));
      expect(runtimeLane.global).toBe(lane);
      expect(runtimeLane.html).toBe(lane);
      if (lane === 'vite') expect(runtimeLane.bootState).toBe('ready');

      // Wait for board initialised
      await page.waitForFunction(() => {
        const root = window as unknown as { gameState?: { board?: unknown[] } };
        return !!(root.gameState && Array.isArray(root.gameState.board) && root.gameState.board.length === 8);
      }, undefined, { timeout: 10000 });

      // Lv3 is the first normal policy path eligible for Dedicated Worker candidate scoring.
      await page.waitForSelector('#smartWhite option[value="3"]', { state: 'attached', timeout: 10000 });
      await page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>('#smartWhite');
        if (!select) throw new Error('CPU level select is unavailable');
        select.value = '3';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Click Reset to ensure known starting state
      await page.click('button:has-text("リセット")');
      await page.waitForFunction(() => {
        const root = window as unknown as {
          cardState?: { hands?: { black?: unknown[] } };
          isProcessing?: boolean;
          isCardAnimating?: boolean;
        };
        const blackHand = root.cardState && root.cardState.hands && root.cardState.hands.black;
        return Array.isArray(blackHand)
          && blackHand.length > 0
          && root.isProcessing !== true
          && root.isCardAnimating !== true;
      }, undefined, { timeout: 10000 });
      await page.waitForTimeout(1200);

      // Keep the CPU on the normal placement path rather than a random opening-hand card
      // or pending selection path.
      await page.evaluate(() => {
        const root = window as any;
        root.cardState.hands.white = [];
        root.cardState.decks.white = [];
      });

      // Ensure a legal cell exists and click it
      await page.waitForSelector('#board .cell.legal, #board .cell.legal-free', { timeout: 5000 });

      // Record disc counts before move
      const before = await page.$$eval('#board .disc.black, #board .disc.white', (els: Element[]) => els.length);
      const beforeTurnNumber = await page.evaluate(() => {
        const root = window as unknown as { gameState?: { turnNumber?: number } };
        return (root.gameState && root.gameState.turnNumber) || 0;
      });

      await page.locator('#board .cell.legal, #board .cell.legal-free').first().click();

      // Wait for both the human move and CPU response to add stones.
      await page.waitForFunction(({ beforeCount, beforeTurn }: { beforeCount: number; beforeTurn: number }) => {
        try {
          const root = window as unknown as { gameState?: { currentPlayer?: number; turnNumber?: number } };
          const currentDiscCount = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
          const currentTurn = (root.gameState && root.gameState.turnNumber) || 0;
          return currentDiscCount >= beforeCount + 2 && currentTurn > beforeTurn;
        } catch (e) { return false; }
      }, { beforeCount: before, beforeTurn: beforeTurnNumber }, { timeout: 15000 });

      // Also check disc count eventually increased (either by human or CPU)
      const after = await page.$$eval('#board .disc.black, #board .disc.white', (els: Element[]) => els.length);
      const afterTurnNumber = await page.evaluate(() => {
        const root = window as unknown as { gameState?: { turnNumber?: number } };
        return (root.gameState && root.gameState.turnNumber) || 0;
      });

      expect(after).toBeGreaterThan(before);
      expect(after).toBeGreaterThanOrEqual(before + 2);
      expect(afterTurnNumber).toBeGreaterThan(beforeTurnNumber);
    } finally {
      await stopPlaywrightPage(page, 10000);
    }
  }, 60000);
}); 
