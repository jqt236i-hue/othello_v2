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

describe('Card effects E2E', () => {
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

  test('using a card via DebugActions applies effect and logs usage', async () => {
    const page = await browser.newPage();
    const consoles = [];
    page.on('console', msg => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);

    // Wait for game state
    await page.waitForFunction(() => !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8), { timeout: 10000 });

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
      try { window.DEBUG_UNLIMITED_USAGE = true; window.DEBUG_HUMAN_VS_HUMAN = true; } catch (e) {}
      try { if (window.__uiImpl_turn_manager) { window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true; window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true; } } catch (e) {}
      try { window.DebugActions.fillDebugHand(window.cardState, { fillWhite: false }); } catch (e) { }
      // ensure sufficient charge and reset usage flags
      try { window.cardState.charge = window.cardState.charge || {}; window.cardState.charge.black = 100; } catch (e) {}
      try { window.cardState.hasUsedCardThisTurnByPlayer = window.cardState.hasUsedCardThisTurnByPlayer || {}; window.cardState.hasUsedCardThisTurnByPlayer.black = false; } catch (e) {}
      try { window.isProcessing = false; window.isCardAnimating = false; } catch (e) {}
      const usableIds = (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function')
        ? (window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black') || [])
        : [];
      const hand = (window.cardState && window.cardState.hands && Array.isArray(window.cardState.hands.black))
        ? window.cardState.hands.black
        : [];
      const selectedCardId = usableIds[0] || hand[0] || null;
      if (selectedCardId) {
        window.cardState.selectedCardId = selectedCardId;
      }
      return {
        selectedCardId,
        usableCount: usableIds.length,
        handCount: hand.length
      };
    });
    expect(setup.selectedCardId).toBeTruthy();
    expect(setup.usableCount).toBeGreaterThan(0);

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
        } catch (e) { return { ok: false, reason: e && e.message } }
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
        } catch (e) {}
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
});
