import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
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
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(serverProc);
    serverProc = null;
  }, 30000);

  test('game progresses multiple turns with CPU responses', async () => {
    const page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    await closeMaintenanceNoticeIfPresent(page);

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
