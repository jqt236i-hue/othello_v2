import { chromium } from 'playwright';
declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;
declare const window: any;
declare const document: any;
const { startStaticServer, stopStaticServer, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent } = require('./e2e-runtime-helpers.js');
function startServer(port = 0) {
  return startStaticServer(port);
}

describe('Card effects E2E', () => {
  let serverProc: any;
  let browser: any;
  let serverPort: any = null;
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

  test('using a card via DebugActions applies effect and logs usage', async () => {
    const page = await browser.newPage();
    const consoles: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: any) => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    await closeMaintenanceNoticeIfPresent(page);

    // Wait for game state
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });
    await page.click('button:has-text("DEBUG: OFF")');

    // Ensure debug helper is present
    await page.waitForFunction(() => typeof window.DebugActions === 'object' && typeof window.DebugActions.fillDebugHand === 'function', { timeout: 5000 });
    await page.waitForFunction(
      () => typeof window.CardLogic === 'object'
        && typeof window.CardLogic.getUsableCardIds === 'function'
        && typeof window.useSelectedCard === 'function',
      { timeout: 5000 }
    );

    // Ensure debug flags, fill debug hand and pick first card; ensure charge and flags allow use
    const setup = await page.evaluate(() => {
      try { window.DEBUG_UNLIMITED_USAGE = true; window.DEBUG_HUMAN_VS_HUMAN = true; } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      try { if (window.__uiImpl_turn_manager) { window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true; window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true; } } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      try { window.DebugActions.fillDebugHand(window.cardState, { fillWhite: false }); } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      try {
        window.cardState.hands = window.cardState.hands || { black: [], white: [] };
        window.cardState.hands.black = ['chest_01'];
        window.cardState.selectedCardId = null;
        window.cardState.selectedCardOwnerKey = null;
        window.cardState.lastUsedCardByPlayer = window.cardState.lastUsedCardByPlayer || {};
        window.cardState.lastUsedCardByPlayer.black = null;
      } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      // ensure sufficient charge and reset usage flags
      try { window.cardState.charge = window.cardState.charge || {}; window.cardState.charge.black = 100; } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      try { window.cardState.hasUsedCardThisTurnByPlayer = window.cardState.hasUsedCardThisTurnByPlayer || {}; window.cardState.hasUsedCardThisTurnByPlayer.black = false; } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      try { window.isProcessing = false; window.isCardAnimating = false; } catch (e) { /* Intentionally empty: DOM guard in page.evaluate */ }
      const usableIds = (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function')
        ? (window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black') || [])
        : [];
      const immediateUsableIds = usableIds.filter((cardId: string) => {
        const def = (window.CardLogic && typeof window.CardLogic.getCardDef === 'function')
          ? window.CardLogic.getCardDef(cardId)
          : null;
        const type = def && def.type ? def.type : null;
        if (!type) return true;
        if (!window.PendingCoordinator || typeof window.PendingCoordinator.requiresPendingTarget !== 'function') {
          return true;
        }
        return window.PendingCoordinator.requiresPendingTarget(type) !== true;
      });
      const hand = (window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands.black))
        ? window.cardState.hands.black
        : [];
      const selectedCardId = immediateUsableIds.includes('chest_01') ? 'chest_01' : (immediateUsableIds[0] || usableIds[0] || hand[0] || null);
      const selectedCardDef = selectedCardId && window.CardLogic && typeof window.CardLogic.getCardDef === 'function'
        ? window.CardLogic.getCardDef(selectedCardId)
        : null;
      if (selectedCardId) {
        window.cardState.selectedCardId = selectedCardId;
      }
      return {
        selectedCardId,
        selectedCardType: selectedCardDef && selectedCardDef.type ? selectedCardDef.type : null,
        usableCount: usableIds.length,
        immediateUsableCount: immediateUsableIds.length,
        handCount: hand.length
      };
    });
    expect(setup.selectedCardId).toBeTruthy();
    expect(setup.usableCount).toBeGreaterThan(0);
    expect(setup.immediateUsableCount).toBeGreaterThan(0);

    // wait until selectedCardId is set
    await page.waitForFunction(() => window.cardState && window.cardState.selectedCardId !== null, { timeout: 2000 });

    // Capture charge before using
    const beforeCharge = await page.evaluate(() => (window.cardState && window.cardState.charge) ? (window.cardState.charge.black || 0) : 0);
    const beforeDiscard = await page.evaluate(() => Array.isArray(window.cardState && window.cardState.discard) ? window.cardState.discard.length : 0);

    // Use the same entry point as the browser UI after selecting a currently usable card.
    const applyRes = await page.evaluate(() => {
      try {
        const id = window.cardState && window.cardState.selectedCardId;
        if (!id) return { ok: false, reason: 'no_selected' };
        try {
          window.useSelectedCard();
          return { ok: true, id };
        } catch (e: any) { return { ok: false, reason: e && e.message } }
      } catch (e) { return { ok: false, reason: 'eval_error' } }
    });
    expect(applyRes.ok).toBeTruthy();

    // give async handlers a moment
    await page.waitForTimeout(1000);

    // Wait until one of: lastUsedCardByPlayer populated, hasUsedCardThisTurnByPlayer set,
    // discard updated, or usage log present.
    await page.waitForFunction(() => {
      try {
        const cs = window.cardState || {};
        if (cs.lastUsedCardByPlayer && cs.lastUsedCardByPlayer.black) return true;
        if (cs.hasUsedCardThisTurnByPlayer && cs.hasUsedCardThisTurnByPlayer.black) return true;
        if (Array.isArray(cs.discard) && cs.discard.length > 0) return true;
        // logs: rely on DOM log element if present
        try {
          const logs = document.querySelectorAll('#log .logEntry');
          for (const l of logs) { if (l.textContent && l.textContent.indexOf('がカードを使用') !== -1) return true; }
        } catch (e) { /* Intentionally empty: DOM query guard */ }
      } catch (e) { return false; }
      return false;
    }, { timeout: 20000 });

    // Evaluate results
    const used = await page.evaluate(() => (window.cardState.lastUsedCardByPlayer && window.cardState.lastUsedCardByPlayer.black) || null);
    const usedFlag = await page.evaluate(() => (window.cardState.hasUsedCardThisTurnByPlayer && window.cardState.hasUsedCardThisTurnByPlayer.black) || false);
    const afterCharge = await page.evaluate(() => (window.cardState.charge && typeof window.cardState.charge.black === 'number') ? window.cardState.charge.black : null);
    const afterDiscard = await page.evaluate(() => Array.isArray(window.cardState && window.cardState.discard) ? window.cardState.discard.length : 0);
    const hasLog = consoles.some(c => c.text && c.text.indexOf('がカードを使用') !== -1);

    expect(used || usedFlag || afterDiscard > beforeDiscard || (typeof afterCharge === 'number' && afterCharge < beforeCharge) || hasLog).toBeTruthy();
    await page.close();
  }, 60000);

  test('debug mode keeps hand cards physically clickable for selection and use', async () => {
    const page = await browser.newPage();
    const consoles: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: any) => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(() => !!(window.gameState && window.cardState && typeof window.renderCardUI === 'function'), { timeout: 10000 });
    await page.waitForTimeout(1200);

    await page.click('#debugModeBtn');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      if (window.__uiImpl_turn_manager) {
        window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
        window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
      }
      window.cardState.hands = window.cardState.hands || { black: [], white: [] };
      window.cardState.hands.black = ['chest_01'];
      window.cardState.charge = window.cardState.charge || {};
      window.cardState.charge.black = 100;
      window.cardState.selectedCardId = null;
      window.cardState.selectedCardOwnerKey = null;
      window.cardState.hasUsedCardThisTurnByPlayer = window.cardState.hasUsedCardThisTurnByPlayer || {};
      window.cardState.hasUsedCardThisTurnByPlayer.black = false;
      window.cardState.lastUsedCardByPlayer = window.cardState.lastUsedCardByPlayer || {};
      window.cardState.lastUsedCardByPlayer.black = null;
      if (typeof window.renderCardUI === 'function') window.renderCardUI();
    });
    await page.waitForSelector('#hand-black .card-item.clickable[data-card-id="chest_01"]', { timeout: 10000 });

    const beforeClick = await page.evaluate(() => {
      const clickables = Array.from(document.querySelectorAll('#hand-black .card-item.clickable')) as HTMLElement[];
      const usableIds = (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function')
        ? (window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black') || [])
        : [];
      const immediateUsableIds = usableIds.filter((cardId: string) => {
        const def = (window.CardLogic && typeof window.CardLogic.getCardDef === 'function')
          ? window.CardLogic.getCardDef(cardId)
          : null;
        const type = def && def.type ? def.type : null;
        if (!type) return true;
        if (!window.PendingCoordinator || typeof window.PendingCoordinator.requiresPendingTarget !== 'function') {
          return true;
        }
        return window.PendingCoordinator.requiresPendingTarget(type) !== true;
      });
      const target = (clickables.find((el: any) => el.dataset.cardId === 'chest_01') as HTMLElement | undefined)
        || (clickables.find((el: any) => immediateUsableIds.includes(el.dataset.cardId)) as HTMLElement | undefined)
        || (clickables.find((el: any) => usableIds.includes(el.dataset.cardId)) as HTMLElement | undefined)
        || clickables[0]
        || null;
      if (target) {
        target.setAttribute('data-e2e-target', 'debug-usable-card');
      }
      const rect = target ? target.getBoundingClientRect() : null;
      return {
        selectedCardId: window.cardState && window.cardState.selectedCardId,
        targetWidth: rect ? rect.width : 0,
        clickableCount: clickables.length,
        chosenCardId: target ? target.dataset.cardId : null,
        immediateUsableCount: immediateUsableIds.length
      };
    });

    expect(beforeClick.clickableCount).toBeGreaterThan(0);
    expect(beforeClick.targetWidth).toBeGreaterThan(0);
    expect(beforeClick.chosenCardId).toBeTruthy();
    expect(beforeClick.immediateUsableCount).toBeGreaterThan(0);

    await page.locator('#hand-black .card-item[data-e2e-target="debug-usable-card"]').click();
    await page.waitForTimeout(250);

    const afterSelect = await page.evaluate(() => ({
      selectedCardId: window.cardState && window.cardState.selectedCardId,
      selectedCardOwnerKey: window.cardState && window.cardState.selectedCardOwnerKey,
      useDisabled: document.getElementById('use-card-btn') && document.getElementById('use-card-btn').disabled
    }));

    expect(afterSelect.selectedCardId).toBeTruthy();
    expect(afterSelect.selectedCardOwnerKey).toBe('black');
    expect(afterSelect.useDisabled).toBe(false);

    await page.click('#use-card-btn');
    await page.waitForFunction(() => {
      const lastUsedBlack = window.cardState && window.cardState.lastUsedCardByPlayer && window.cardState.lastUsedCardByPlayer.black;
      return !!lastUsedBlack;
    }, { timeout: 10000 });

    const afterUse = await page.evaluate(() => ({
      lastUsedBlack: window.cardState && window.cardState.lastUsedCardByPlayer && window.cardState.lastUsedCardByPlayer.black,
        recentLogs: Array.from(document.querySelectorAll('#log .logEntry')).slice(-5).map((el: any) => el.textContent)
    }));

    expect(afterUse.lastUsedBlack).toBeTruthy();
    expect(afterUse.recentLogs.some((entry: string) => entry.indexOf('黒がカードを使用') !== -1)
      || consoles.some((entry) => entry.text.indexOf('黒がカードを使用') !== -1)).toBe(true);

    await page.close();
  }, 60000);
});
