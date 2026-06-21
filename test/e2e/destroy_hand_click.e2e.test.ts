import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } from './e2e-runtime-helpers.js';

declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('Destroy hand card then place E2E', () => {
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

  test('destroying a hand card does not block same-turn normal placement', async () => {
    if (!browser || serverPort === null) throw new Error('E2E runtime is not initialized');
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await closeMaintenanceNoticeIfPresent(page);

    await page.waitForSelector('#board .cell');
    await page.waitForFunction(() => {
      const root = window as unknown as { gameState?: { board?: unknown[] } };
      return !!(root.gameState && Array.isArray(root.gameState.board) && root.gameState.board.length === 8);
    }, { timeout: 10000 });

    await page.click('button:has-text("リセット")');
    await page.waitForTimeout(300);
    await page.waitForFunction(() => {
      const root = window as unknown as { isProcessing?: boolean; isCardAnimating?: boolean };
      return root.isProcessing !== true && root.isCardAnimating !== true;
    }, { timeout: 10000 });
    await page.evaluate(() => {
      const root = window as unknown as {
        cardState?: {
          hands?: { black?: string[]; white?: string[] };
          charge?: { black?: number; white?: number };
          selectedCardId?: string | null;
          selectedCardOwnerKey?: string | null;
          hasDestroyedCardThisTurnByPlayer?: { black?: boolean; white?: boolean };
          hasUsedCardThisTurnByPlayer?: { black?: boolean; white?: boolean };
        };
        renderCardUI?: () => void;
      };
      if (!root.cardState) return;
      root.cardState.hands = root.cardState.hands || { black: [], white: [] };
      root.cardState.hands.black = ['chest_01'];
      root.cardState.charge = root.cardState.charge || {};
      root.cardState.charge.black = 100;
      root.cardState.selectedCardId = null;
      root.cardState.selectedCardOwnerKey = null;
      root.cardState.hasDestroyedCardThisTurnByPlayer = root.cardState.hasDestroyedCardThisTurnByPlayer || {};
      root.cardState.hasDestroyedCardThisTurnByPlayer.black = false;
      root.cardState.hasUsedCardThisTurnByPlayer = root.cardState.hasUsedCardThisTurnByPlayer || {};
      root.cardState.hasUsedCardThisTurnByPlayer.black = false;
      if (typeof root.renderCardUI === 'function') root.renderCardUI();
    });
    await page.waitForSelector('#hand-black .card-item.clickable[data-card-id="chest_01"]', { timeout: 10000 });

    const handCount = await page.locator('#hand-black .card-item.clickable').count();
    expect(handCount).toBeGreaterThan(0);
    const destroyableCardIndex = await page.evaluate(() => {
      const root = window as unknown as {
        SpecialCardRegistry?: { isInviolableSpecialCardId?: (cardId: unknown) => boolean };
      };
      const cards = Array.from(document.querySelectorAll('#hand-black .card-item.clickable')) as HTMLElement[];
      return cards.findIndex((cardEl) => {
        const cardId = cardEl.dataset.cardId || '';
        const registry = root.SpecialCardRegistry;
        if (registry && typeof registry.isInviolableSpecialCardId === 'function') {
          return registry.isInviolableSpecialCardId(cardId) !== true;
        }
        return true;
      });
    });
    expect(destroyableCardIndex).toBeGreaterThanOrEqual(0);

    const beforeDestroy = await page.evaluate(() => {
      const root = window as unknown as { cardState?: { discard?: unknown[] } };
      return Array.isArray(root.cardState?.discard) ? root.cardState!.discard!.length : 0;
    });

    await page.locator('#hand-black .card-item.clickable').nth(destroyableCardIndex).click({ force: true });
    await page.locator('#destroy-card-btn').click({ force: true });

    await page.waitForFunction((previousDiscardCount: number) => {
      const root = window as unknown as {
        cardState?: {
          discard?: unknown[];
          hasDestroyedCardThisTurnByPlayer?: { black?: boolean };
        };
        isProcessing?: boolean;
        isCardAnimating?: boolean;
      };
      const discardCount = Array.isArray(root.cardState?.discard) ? root.cardState!.discard!.length : 0;
      const hasDestroyed = root.cardState?.hasDestroyedCardThisTurnByPlayer?.black === true;
      return discardCount > previousDiscardCount
        && hasDestroyed
        && root.isProcessing !== true
        && root.isCardAnimating !== true;
    }, beforeDestroy, { timeout: 10000 });

    const legalTarget = await page.evaluate(() => {
      const el = document.querySelector('#board .cell.legal, #board .cell.legal-free') as HTMLElement | null;
      return { row: (el && el.dataset.row) || '', col: (el && el.dataset.col) || '' };
    });
    expect(legalTarget.row).not.toBe('');
    expect(legalTarget.col).not.toBe('');

    const beforePlace = await page.evaluate(() => {
      const root = window as unknown as { gameState?: { turnNumber?: number } };
      return {
        discCount: document.querySelectorAll('#board .disc.black, #board .disc.white').length,
        turnNumber: (root.gameState && root.gameState.turnNumber) || 0
      };
    });

    const targetSelector = `#board .cell[data-row="${legalTarget.row}"][data-col="${legalTarget.col}"]`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.locator(targetSelector).click({ force: true });
      await page.waitForTimeout(1200);
      const progressed = await page.evaluate(({ discCount, turnNumber }: { discCount: number; turnNumber: number }) => {
        const nextDiscCount = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
        const root = window as unknown as { gameState?: { turnNumber?: number } };
        const nextTurnNumber = (root.gameState && root.gameState.turnNumber) || 0;
        return nextDiscCount > discCount && nextTurnNumber > turnNumber;
      }, beforePlace);
      if (progressed) break;
    }

    await page.waitForFunction(({ discCount, turnNumber }: { discCount: number; turnNumber: number }) => {
      try {
        const nextDiscCount = document.querySelectorAll('#board .disc.black, #board .disc.white').length;
        const root = window as unknown as { gameState?: { turnNumber?: number } };
        const nextTurnNumber = (root.gameState && root.gameState.turnNumber) || 0;
        return nextDiscCount > discCount && nextTurnNumber > turnNumber;
      } catch (e) {
        return false;
      }
    }, beforePlace, { timeout: 10000 });

    const afterPlace = await page.evaluate(() => {
      const root = window as unknown as {
        gameState?: { turnNumber?: number };
        cardState?: { discard?: unknown[] };
      };
      return {
        discCount: document.querySelectorAll('#board .disc.black, #board .disc.white').length,
        turnNumber: (root.gameState && root.gameState.turnNumber) || 0,
        discardCount: Array.isArray(root.cardState?.discard) ? root.cardState!.discard!.length : 0
      };
    });

    expect(afterPlace.discCount).toBeGreaterThan(beforePlace.discCount);
    expect(afterPlace.turnNumber).toBeGreaterThan(beforePlace.turnNumber);
    expect(afterPlace.discardCount).toBeGreaterThan(beforeDestroy);

    await page.close();
  }, 30000);
});
