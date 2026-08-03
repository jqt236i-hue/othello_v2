import { chromium } from 'playwright';
declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;
declare const window: any;
declare const document: any;
const { startStaticServer, stopStaticServer, stopPlaywrightBrowser, closeMaintenanceNoticeIfPresent, closeSidePanelIfPresent } = require('./e2e-runtime-helpers.js');
function startServer(port = 0) {
  return startStaticServer(port);
}

async function openPixiDebugLane(page: any, serverPort: number, noanim = false): Promise<void> {
  const animationQuery = noanim ? '&noanim=1' : '';
  await page.goto(
    `http://127.0.0.1:${serverPort}/?debug=1&boardRenderer=pixi${animationQuery}`,
    { waitUntil: 'domcontentloaded' }
  );
  await closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => {
    const root = window as any;
    return root.__uiInitialized === true
      && !!root.__boardVisualDebug
      && root.__boardVisualDebug.getBackendKind() === 'pixi';
  }, undefined, { timeout: 30000 });
  await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());
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

    await openPixiDebugLane(page, serverPort);

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

  test('意志の凍結 freezes every eligible special-stone cell in the Pixi board', async () => {
    const page = await browser.newPage();
    await openPixiDebugLane(page, serverPort);
    await page.waitForFunction(
      () => !!(window.gameState && window.cardState && window.CardLogic && typeof window.useSelectedCard === 'function'),
      { timeout: 10000 }
    );
    await page.click('#debugModeBtn');
    await closeSidePanelIfPresent(page);

    const setup = await page.evaluate(() => {
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      if (window.__uiImpl_turn_manager) {
        window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
        window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
      }
      window.gameState.currentPlayer = 1;
      window.gameState.board[2][2] = 1;
      window.gameState.board[3][3] = -1;
      window.gameState.board[4][4] = -1;
      window.gameState.board[5][5] = 1;
      window.cardState.markers = [
        { id: 9101, kind: 'specialStone', row: 2, col: 2, owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 4 } },
        { id: 9102, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'GHOST', remainingOwnerTurns: 4 } },
        { id: 9103, kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'TRAP', hidden: true, remainingOwnerTurns: 2 } },
        { id: 9104, kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 } }
      ];
      window.cardState._nextMarkerId = 9200;
      window.cardState._nextCreatedSeq = 9200;
      window.cardState.hands.black = ['mass_freeze_will_01'];
      window.cardState.charge.black = 100;
      window.cardState.selectedCardId = 'mass_freeze_will_01';
      window.cardState.selectedCardOwnerKey = 'black';
      window.cardState.hasUsedCardThisTurnByPlayer.black = false;
      if (typeof window.renderCardUI === 'function') window.renderCardUI();
      const usable = window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black') || [];
      return { usable: usable.includes('mass_freeze_will_01') };
    });
    expect(setup.usable).toBe(true);

    await page.evaluate(() => {
      window.__massFreezeAnimationOrder = {
        cardGhostObserved: false,
        freezeObserved: false,
        cardGhostPresentAtFreeze: null
      };
      let probeHandle = 0;
      const probe = () => {
        const cardGhostPresent = !!document.querySelector('.card-use-ghost');
        if (cardGhostPresent) window.__massFreezeAnimationOrder.cardGhostObserved = true;
        const debug = window.__boardVisualDebug;
        const rendered = [[2, 2], [3, 3], [4, 4], [5, 5]].map(([row, col]) => (
          debug && debug.getRenderedCell(row, col)
        ));
        const freezeRendered = rendered.every((cell: any) => (
          cell
          && cell.stone
          && cell.stone.visible === true
          && Array.isArray(cell.stone.renderedMarkerKinds)
          && cell.stone.renderedMarkerKinds.includes('frozen')
          && Array.isArray(cell.stone.statusLabels)
          && cell.stone.statusLabels.some((entry: any) => entry.kind === 'freeze' && entry.value === '5')
        ));
        if (!window.__massFreezeAnimationOrder.freezeObserved && freezeRendered) {
          window.__massFreezeAnimationOrder.freezeObserved = true;
          window.__massFreezeAnimationOrder.cardGhostPresentAtFreeze = cardGhostPresent;
          cancelAnimationFrame(probeHandle);
          return;
        }
        probeHandle = requestAnimationFrame(probe);
      };
      probeHandle = requestAnimationFrame(probe);
    });
    await page.evaluate(() => window.useSelectedCard());
    await page.waitForFunction(() => {
      const markers = Array.isArray(window.cardState && window.cardState.markers) ? window.cardState.markers : [];
      return markers.filter((marker: any) => marker && marker.data && marker.data.type === 'FREEZE').length === 4;
    }, undefined, { timeout: 20000 });
    await page.waitForFunction(() => {
      const debug = window.__boardVisualDebug;
      return [[2, 2], [3, 3], [4, 4], [5, 5]].every(([row, col]) => {
        const cell = debug && debug.getRenderedCell(row, col);
        return cell
          && cell.stone
          && cell.stone.renderedMarkerKinds.includes('frozen')
          && cell.stone.statusLabels.some((entry: any) => entry.kind === 'freeze' && entry.value === '5');
      });
    }, undefined, { timeout: 20000 });
    // The Pixi controller can settle the committed frame between two browser
    // tasks. Let the rAF order probe observe that frame before reading it back.
    await page.waitForFunction(
      () => window.__massFreezeAnimationOrder?.freezeObserved === true,
      undefined,
      { timeout: 5000 }
    );
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => {
      const freezes = window.cardState.markers.filter((marker: any) => marker && marker.data && marker.data.type === 'FREEZE');
      const rendered = freezes.map((marker: any) => window.__boardVisualDebug.getRenderedCell(marker.row, marker.col));
      return {
        coordinates: freezes.map((marker: any) => `${marker.row},${marker.col}`),
        owners: freezes.map((marker: any) => marker.owner),
        turns: freezes.map((marker: any) => marker.data.remainingOwnerTurns),
        renderedFreezeCount: rendered.filter((cell: any) => (
          cell
          && cell.stone
          && Array.isArray(cell.stone.renderedMarkerKinds)
          && cell.stone.renderedMarkerKinds.includes('frozen')
        )).length,
        renderedTurns: rendered.map((cell: any) => {
          const label = cell && cell.stone && Array.isArray(cell.stone.statusLabels)
            ? cell.stone.statusLabels.find((entry: any) => entry.kind === 'freeze')
            : null;
          return label ? label.value : null;
        }),
        animationOrder: window.__massFreezeAnimationOrder,
        frameDigest: window.__boardVisualDebug.getVisualFrameDigest(),
        backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics()
      };
    });
    expect(result.coordinates).toEqual(['2,2', '3,3', '4,4', '5,5']);
    expect(result.owners).toEqual(['black', 'black', 'black', 'black']);
    expect(result.turns).toEqual([5, 5, 5, 5]);
    expect(result.renderedFreezeCount).toBe(4);
    expect(result.renderedTurns).toEqual(['5', '5', '5', '5']);
    expect(result.animationOrder).toEqual({
      cardGhostObserved: true,
      freezeObserved: true,
      cardGhostPresentAtFreeze: false
    });
    expect(result.frameDigest).toEqual(expect.any(String));
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      state: 'ready'
    }));
    await page.close();
  }, 60000);

  test('debug mode keeps hand cards physically clickable for selection and use', async () => {
    const page = await browser.newPage();
    const consoles: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: any) => {
      try { consoles.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ }
    });

    await openPixiDebugLane(page, serverPort);
    await page.waitForFunction(() => !!(window.gameState && window.cardState && typeof window.renderCardUI === 'function'), { timeout: 10000 });
    await page.waitForTimeout(1200);

    await page.click('#debugModeBtn');
    await page.waitForTimeout(600);
    await closeSidePanelIfPresent(page);
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

  test('毒殺の意志は空きマスと既存石を対象に使用ボタンから選択へ進める', async () => {
    const page = await browser.newPage();
    await openPixiDebugLane(page, serverPort, true);
    await page.waitForFunction(
      () => !!(window.gameState && window.cardState && window.CardLogic && typeof window.renderCardUI === 'function'),
      { timeout: 10000 }
    );
    await closeSidePanelIfPresent(page);

    const targetState = await page.evaluate(() => {
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      window.gameState.currentPlayer = 1;
      window.cardState.hands = { black: ['poison_will_01'], white: [] };
      window.cardState.charge = { black: 8, white: 0 };
      window.cardState.selectedCardId = null;
      window.cardState.selectedCardOwnerKey = null;
      window.cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
      window.cardState.pendingEffectByPlayer = { black: null, white: null };
      window.isProcessing = false;
      window.isCardAnimating = false;
      window.renderCardUI();
      const targets = window.CardLogic.getPoisonTargets(window.cardState, window.gameState, 'black');
      return {
        hasEmpty: targets.some((cell: any) => cell.row === 0 && cell.col === 0),
        hasOccupied: targets.some((cell: any) => cell.row === 3 && cell.col === 3),
        usable: window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black').includes('poison_will_01')
      };
    });

    expect(targetState).toEqual({ hasEmpty: true, hasOccupied: true, usable: true });
    await page.locator('#hand-black .card-item[data-card-id="poison_will_01"]').click();
    await page.waitForFunction(() => {
      const button = document.getElementById('use-card-btn') as HTMLButtonElement | null;
      return button && button.disabled === false;
    });
    await page.click('#use-card-btn');
    await page.waitForFunction(() => {
      const pending = window.cardState.pendingEffectByPlayer && window.cardState.pendingEffectByPlayer.black;
      return pending && pending.type === 'POISON_WILL' && pending.stage === 'selectTarget';
    });
    const poisonTarget = await page.evaluate(() => window.__boardVisualDebug.getCellClientRect(3, 3));
    expect(poisonTarget).toEqual(expect.objectContaining({
      width: expect.any(Number),
      height: expect.any(Number)
    }));
    expect(poisonTarget.width).toBeGreaterThan(0);
    expect(poisonTarget.height).toBeGreaterThan(0);
    await page.mouse.click(
      poisonTarget.left + poisonTarget.width / 2,
      poisonTarget.top + poisonTarget.height / 2
    );
    await page.waitForFunction(() => {
      const cell = window.__boardVisualDebug.getRenderedCell(3, 3);
      return cell
        && cell.stone
        && cell.stone.specialType === 'POISONED'
        && Array.isArray(cell.stone.statusLabels)
        && cell.stone.statusLabels.some((entry: any) => entry.kind === 'poison' && entry.value === '5');
    });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const poisonTimer = await page.evaluate(() => {
      const cell = window.__boardVisualDebug.getRenderedCell(3, 3);
      if (!cell || !cell.stone) return null;
      return {
        specialType: cell.stone.specialType,
        renderedMarkerKinds: cell.stone.renderedMarkerKinds,
        statusLabels: cell.stone.statusLabels,
        timerLabel: cell.stone.timerLabel,
        badgeLabel: cell.stone.badgeLabel,
        frameDigest: window.__boardVisualDebug.getVisualFrameDigest(),
        backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics()
      };
    });
    expect(poisonTimer).not.toBeNull();
    if (!poisonTimer) throw new Error('poison lethal timer was not rendered');
    expect(poisonTimer.specialType).toBe('POISONED');
    expect(poisonTimer.renderedMarkerKinds).toContain('poisoned');
    expect(poisonTimer.statusLabels).toContainEqual({ kind: 'poison', value: '5' });
    expect([poisonTimer.timerLabel, poisonTimer.badgeLabel]).toContain('5');
    expect(poisonTimer.frameDigest).toEqual(expect.any(String));
    expect(poisonTimer.backendDiagnostics).toEqual(expect.objectContaining({ domCellCount: 0 }));

    await page.close();
  }, 60000);

  test('8x7盤面の盤面拡張は元盤面を動かさず外側へ1マスを取り付ける', async () => {
    const page = await browser.newPage({ viewport: { width: 912, height: 831 } });
    const invalidMoveWarnings: string[] = [];
    page.on('console', (message: any) => {
      const text = message.text();
      if (text.includes('[MOVE] Invalid move attempted')) invalidMoveWarnings.push(text);
    });
    await openPixiDebugLane(page, serverPort, true);
    await closeSidePanelIfPresent(page);
    await page.waitForFunction(() => !!(
      window.gameState &&
      window.cardState &&
      window.CardLogic &&
      typeof window.renderBoard === 'function' &&
      typeof window.handleCellClick === 'function'
    ), { timeout: 15000 });

    await page.evaluate(async () => {
      const core = window.require('game/logic/core');
      window.gameState = core.createGameState({ rows: 8, cols: 7, shape: 'rectangle' });
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      window.MATCH_MODE = 'cpu';
      window.LOCAL_PLAYER_KEY = 'black';
      for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
        window[key] = window[key] || {};
        window[key].DEBUG_UNLIMITED_USAGE = true;
        window[key].DEBUG_HUMAN_VS_HUMAN = true;
        window[key].MATCH_MODE = 'cpu';
      }
      window.gameState.currentPlayer = 1;
      window.gameState.boardExpansion = {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: []
      };
      window.cardState.pendingEffectByPlayer = {
        black: { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget', cardId: 'board_expand_01' },
        white: null
      };
      window.cardState.hasUsedCardThisTurnByPlayer = { black: true, white: false };
      window.cardState.lastUsedCardByPlayer = { black: 'board_expand_01', white: null };
      window.isProcessing = false;
      window.isCardAnimating = false;
      window.VisualPlaybackActive = false;
      window.renderBoard();
    });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    await page.waitForFunction(() => {
      const anchor = window.__boardVisualDebug.getRenderedCell(0, 0);
      return anchor && anchor.hint && anchor.hint.directionKeys.length === 2;
    });
    const beforeExpansion = await page.evaluate(() => ({
      anchor: window.__boardVisualDebug.getRenderedCell(0, 0),
      anchorRect: window.__boardVisualDebug.getCellClientRect(0, 0),
      centerRect: window.__boardVisualDebug.getCellClientRect(3, 3),
      oppositeRect: window.__boardVisualDebug.getCellClientRect(7, 6),
      frameDigest: window.__boardVisualDebug.getVisualFrameDigest(),
      framePresentation: (() => {
        const board = document.getElementById('board');
        const frame = document.getElementById('board-frame');
        if (!board || !frame) return null;
        const canvas = board.querySelector('canvas');
        const boardRect = board.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const canvasRect = canvas && canvas.getBoundingClientRect();
        const frameStyle = getComputedStyle(frame);
        const frameArtStyle = getComputedStyle(frame, '::before');
        return {
          boardRect: {
            left: boardRect.left,
            top: boardRect.top,
            width: boardRect.width,
            height: boardRect.height
          },
          frameRect: {
            left: frameRect.left,
            top: frameRect.top,
            width: frameRect.width,
            height: frameRect.height
          },
          canvasRect: canvasRect ? {
            left: canvasRect.left,
            top: canvasRect.top,
            width: canvasRect.width,
            height: canvasRect.height
          } : null,
          boardHasRenderVoid: board.classList.contains('board-has-void-cells'),
          frameHasBaseVoid: frame.classList.contains('board-has-base-void-cells'),
          frameHasLegacyVoid: frame.classList.contains('board-has-void-cells'),
          frameBackgroundImage: frameStyle.backgroundImage,
          frameBoxShadow: frameStyle.boxShadow,
          artDisplay: frameArtStyle.display,
          artBackgroundImage: frameArtStyle.backgroundImage
        };
      })()
    }));
    expect(beforeExpansion.anchor.hint.directionKeys).toEqual(['up', 'left']);
    expect(beforeExpansion.anchorRect.width).toBeGreaterThan(0);
    expect(beforeExpansion.anchorRect.height).toBeGreaterThan(0);
    expect(beforeExpansion.framePresentation).toEqual(expect.objectContaining({
      boardHasRenderVoid: false,
      frameHasBaseVoid: false,
      frameHasLegacyVoid: false,
      artDisplay: 'block'
    }));
    expect(beforeExpansion.framePresentation.artBackgroundImage).toContain('url(');
    expect(beforeExpansion.framePresentation.frameBackgroundImage).not.toBe('none');
    expect(beforeExpansion.framePresentation.frameBoxShadow).not.toBe('none');
    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(1000);

    // A rapid second click must not fall through to the board after the first
    // click removes the direction control.
    await page.mouse.dblclick(
      beforeExpansion.anchorRect.left + beforeExpansion.anchorRect.width * 0.2,
      beforeExpansion.anchorRect.top + beforeExpansion.anchorRect.height * 0.5,
      { delay: 30 }
    );
    await page.waitForFunction(() => {
      const cells = window.gameState && window.gameState.boardExpansion && window.gameState.boardExpansion.cells;
      return Array.isArray(cells) && cells.some((cell) => cell && cell.row === 0 && cell.col === -1);
    }, null, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());
    await page.waitForFunction(() => {
      const expanded = window.__boardVisualDebug.getRenderedCell(0, -1);
      return expanded && expanded.kind === 'playable';
    }, null, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => ({
      pending: window.cardState.pendingEffectByPlayer.black,
      cells: window.gameState.boardExpansion.cells,
      anchor: window.__boardVisualDebug.getRenderedCell(0, 0),
      expanded: window.__boardVisualDebug.getRenderedCell(0, -1),
      expandedRect: window.__boardVisualDebug.getCellClientRect(0, -1),
      anchorRect: window.__boardVisualDebug.getCellClientRect(0, 0),
      centerRect: window.__boardVisualDebug.getCellClientRect(3, 3),
      oppositeRect: window.__boardVisualDebug.getCellClientRect(7, 6),
      frameDigest: window.__boardVisualDebug.getVisualFrameDigest(),
      backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics(),
      framePresentation: (() => {
        const board = document.getElementById('board');
        const frame = document.getElementById('board-frame');
        if (!board || !frame) return null;
        const canvas = board.querySelector('canvas');
        const boardRect = board.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const canvasRect = canvas && canvas.getBoundingClientRect();
        const frameStyle = getComputedStyle(frame);
        const frameArtStyle = getComputedStyle(frame, '::before');
        return {
          boardRect: {
            left: boardRect.left,
            top: boardRect.top,
            width: boardRect.width,
            height: boardRect.height
          },
          frameRect: {
            left: frameRect.left,
            top: frameRect.top,
            width: frameRect.width,
            height: frameRect.height
          },
          canvasRect: canvasRect ? {
            left: canvasRect.left,
            top: canvasRect.top,
            width: canvasRect.width,
            height: canvasRect.height
          } : null,
          boardHasRenderVoid: board.classList.contains('board-has-void-cells'),
          frameHasBaseVoid: frame.classList.contains('board-has-base-void-cells'),
          frameHasLegacyVoid: frame.classList.contains('board-has-void-cells'),
          frameBackgroundImage: frameStyle.backgroundImage,
          frameBoxShadow: frameStyle.boxShadow,
          artDisplay: frameArtStyle.display,
          artBackgroundImage: frameArtStyle.backgroundImage
        };
      })()
    }));
    expect(result.pending).toBeNull();
    expect(result.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: -1 })
    ]));
    expect(result.cells.some((cell: any) => cell.row === -1 && cell.col === 0)).toBe(false);
    expect(result.expanded).toEqual(expect.objectContaining({
      key: '0,-1',
      kind: 'playable'
    }));
    expect(result.expandedRect.width).toBeGreaterThan(0);
    expect(result.framePresentation.boardRect).toEqual(beforeExpansion.framePresentation.boardRect);
    expect(result.framePresentation.frameRect).toEqual(beforeExpansion.framePresentation.frameRect);
    expect(result.framePresentation.canvasRect).not.toBeNull();
    expect(beforeExpansion.framePresentation.canvasRect).not.toBeNull();
    for (const key of ['anchorRect', 'centerRect', 'oppositeRect'] as const) {
      expect(result[key].left).toBeCloseTo(beforeExpansion[key].left, 4);
      expect(result[key].top).toBeCloseTo(beforeExpansion[key].top, 4);
      expect(result[key].width).toBeCloseTo(beforeExpansion[key].width, 4);
      expect(result[key].height).toBeCloseTo(beforeExpansion[key].height, 4);
    }
    expect(result.expandedRect.right).toBeCloseTo(beforeExpansion.anchorRect.left, 4);
    expect(result.expandedRect.top).toBeCloseTo(beforeExpansion.anchorRect.top, 4);
    expect(result.expandedRect.left).toBeLessThan(beforeExpansion.framePresentation.boardRect.left);
    const beforePaintedAnchor = {
      left: beforeExpansion.framePresentation.canvasRect.left + beforeExpansion.anchor.position.x,
      top: beforeExpansion.framePresentation.canvasRect.top + beforeExpansion.anchor.position.y
    };
    const afterPaintedAnchor = {
      left: result.framePresentation.canvasRect.left + result.anchor.position.x,
      top: result.framePresentation.canvasRect.top + result.anchor.position.y
    };
    expect(afterPaintedAnchor.left).toBeCloseTo(beforePaintedAnchor.left, 4);
    expect(afterPaintedAnchor.top).toBeCloseTo(beforePaintedAnchor.top, 4);
    expect(afterPaintedAnchor.left).toBeCloseTo(result.anchorRect.left, 4);
    expect(afterPaintedAnchor.top).toBeCloseTo(result.anchorRect.top, 4);
    expect(result.frameDigest).not.toBe(beforeExpansion.frameDigest);
    expect(result.framePresentation).toEqual(expect.objectContaining({
      boardHasRenderVoid: true,
      frameHasBaseVoid: false,
      frameHasLegacyVoid: false,
      artDisplay: 'block'
    }));
    expect(result.framePresentation.artBackgroundImage).toContain('url(');
    expect(result.framePresentation.frameBackgroundImage).not.toBe('none');
    expect(result.framePresentation.frameBoxShadow).not.toBe('none');
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      playback: expect.objectContaining({ inFlightEffectCount: 0 }),
      timeline: expect.objectContaining({ state: 'idle' })
    }));
    expect(invalidMoveWarnings).toEqual([]);

    const expandedScreenshot = await page.screenshot();
    expect(expandedScreenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
  }, 60000);

  test('盤面拡張神は1角目選択後に使用ボタンから3マス拡張を確定できる', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await openPixiDebugLane(page, serverPort, true);
    await closeSidePanelIfPresent(page);
    await page.waitForFunction(() => !!(
      window.gameState
      && window.cardState
      && typeof window.renderBoard === 'function'
      && typeof window.updateCardDetailPanel === 'function'
      && typeof window.handleCellClick === 'function'
    ), { timeout: 15000 });

    await page.evaluate(() => {
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      window.MATCH_MODE = 'cpu';
      window.LOCAL_PLAYER_KEY = 'black';
      for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
        window[key] = window[key] || {};
        window[key].DEBUG_UNLIMITED_USAGE = true;
        window[key].DEBUG_HUMAN_VS_HUMAN = true;
        window[key].MATCH_MODE = 'cpu';
      }
      window.gameState.currentPlayer = 1;
      window.gameState.boardExpansion = {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: []
      };
      window.cardState.selectedCardId = null;
      window.cardState.pendingEffectByPlayer = {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedCount: 0,
          maxSelections: 2,
          selectedTargets: []
        },
        white: null
      };
      window.cardState.hasUsedCardThisTurnByPlayer = { black: true, white: false };
      window.cardState.lastUsedCardByPlayer = { black: 'board_expand_god_01', white: null };
      window.isProcessing = false;
      window.isCardAnimating = false;
      window.VisualPlaybackActive = false;
      window.renderBoard();
      window.updateCardDetailPanel();
    });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const upperLeftButton = page.locator('.board-accessibility-direction-button[data-cell-key="0,0"][data-direction="up-left"]');
    expect(await upperLeftButton.count()).toBe(1);
    await upperLeftButton.click();
    await page.waitForFunction(() => {
      const pending = window.cardState.pendingEffectByPlayer.black;
      const useButton = document.getElementById('use-card-btn');
      return pending
        && Array.isArray(pending.selectedTargets)
        && pending.selectedTargets.length === 1
        && useButton
        && useButton.textContent === '1角で確定'
        && useButton.disabled === false;
    }, null, { timeout: 10000 });

    await page.evaluate(() => {
      const useButton = document.getElementById('use-card-btn');
      if (!useButton) throw new Error('1角で確定ボタンが見つかりません');
      useButton.click();
    });
    await page.waitForFunction(() => {
      const cells = window.gameState && window.gameState.boardExpansion && window.gameState.boardExpansion.cells;
      return window.cardState.pendingEffectByPlayer.black === null
        && Array.isArray(cells)
        && cells.length === 3;
    }, null, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => ({
      pending: window.cardState.pendingEffectByPlayer.black,
      cells: window.gameState.boardExpansion.cells,
      renderedCells: [
        window.__boardVisualDebug.getRenderedCell(-1, -1),
        window.__boardVisualDebug.getRenderedCell(-1, 0),
        window.__boardVisualDebug.getRenderedCell(0, -1)
      ],
      backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics()
    }));

    expect(result.pending).toBeNull();
    expect(result.cells).toHaveLength(3);
    expect(result.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: -1 }),
      expect.objectContaining({ row: -1, col: 0 }),
      expect.objectContaining({ row: 0, col: -1 })
    ]));
    expect(result.renderedCells).toEqual([
      expect.objectContaining({ key: '-1,-1', kind: 'playable' }),
      expect.objectContaining({ key: '-1,0', kind: 'playable' }),
      expect.objectContaining({ key: '0,-1', kind: 'playable' })
    ]);
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      playback: expect.objectContaining({ inFlightEffectCount: 0 }),
      timeline: expect.objectContaining({ state: 'idle' })
    }));

    const confirmedScreenshot = await page.screenshot();
    expect(confirmedScreenshot.byteLength).toBeGreaterThan(1000);

    await page.close();
  }, 60000);

  test('盤面拡張神の6マス同時追加後も通常8x8の画像フレームを保持する', async () => {
    // Keep this at the compact layout seen in production reports: the
    // expansion must not displace the original 8x8 board when side gutters
    // are tight.
    const page = await browser.newPage({ viewport: { width: 720, height: 625 } });
    await openPixiDebugLane(page, serverPort, true);
    await closeSidePanelIfPresent(page);
    await page.waitForFunction(() => !!(
      window.gameState
      && window.cardState
      && typeof window.renderBoard === 'function'
      && typeof window.handleCellClick === 'function'
    ), { timeout: 15000 });

    await page.evaluate(() => {
      window.DEBUG_UNLIMITED_USAGE = true;
      window.DEBUG_HUMAN_VS_HUMAN = true;
      window.MATCH_MODE = 'cpu';
      window.LOCAL_PLAYER_KEY = 'black';
      for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
        window[key] = window[key] || {};
        window[key].DEBUG_UNLIMITED_USAGE = true;
        window[key].DEBUG_HUMAN_VS_HUMAN = true;
        window[key].MATCH_MODE = 'cpu';
      }
      window.gameState.currentPlayer = 1;
      window.gameState.boardExpansion = {
        active: false,
        side: null,
        row: null,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: []
      };
      window.cardState.pendingEffectByPlayer = {
        black: {
          type: 'BOARD_EXPANSION_GOD',
          stage: 'selectTarget',
          cardId: 'board_expand_god_01',
          selectedCount: 0,
          maxSelections: 2,
          selectedTargets: []
        },
        white: null
      };
      window.cardState.hasUsedCardThisTurnByPlayer = { black: true, white: false };
      window.cardState.lastUsedCardByPlayer = { black: 'board_expand_god_01', white: null };
      window.isProcessing = false;
      window.isCardAnimating = false;
      window.VisualPlaybackActive = false;
      window.renderBoard();
    });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const beforeLayout = await page.evaluate(() => {
      const board = document.getElementById('board');
      const viewport = document.getElementById('board-scroll-viewport');
      const anchorRect = window.__boardVisualDebug.getCellClientRect(3, 3);
      if (!board || !viewport || !anchorRect) return null;
      const boardRect = board.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const viewportStyle = getComputedStyle(viewport);
      return {
        boardRect: {
          left: boardRect.left,
          top: boardRect.top,
          width: boardRect.width,
          height: boardRect.height,
          centerX: boardRect.left + boardRect.width / 2,
          centerY: boardRect.top + boardRect.height / 2
        },
        viewport: {
          clientWidth: viewport.clientWidth,
          clientHeight: viewport.clientHeight,
          rectWidth: viewportRect.width,
          rectHeight: viewportRect.height,
          scrollWidth: viewport.scrollWidth,
          scrollHeight: viewport.scrollHeight,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          overflowX: viewportStyle.overflowX,
          overflowY: viewportStyle.overflowY
        },
        anchorRect
      };
    });
    expect(beforeLayout).not.toBeNull();
    if (!beforeLayout) throw new Error('initial Pixi board layout was unavailable');

    const upperLeftButton = page.locator('.board-accessibility-direction-button[data-cell-key="0,0"][data-direction="up-left"]');
    expect(await upperLeftButton.count()).toBe(1);
    await upperLeftButton.click();
    await page.waitForFunction(() => {
      const pending = window.cardState.pendingEffectByPlayer.black;
      return pending
        && Array.isArray(pending.selectedTargets)
        && pending.selectedTargets.some((target: any) => target.row === 0 && target.col === 0);
    }, null, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const lowerRightButton = page.locator('.board-accessibility-direction-button[data-cell-key="7,7"][data-direction="down-right"]');
    expect(await lowerRightButton.count()).toBe(1);
    await lowerRightButton.click();
    await page.waitForFunction(() => {
      const cells = window.gameState && window.gameState.boardExpansion && window.gameState.boardExpansion.cells;
      return Array.isArray(cells) && cells.length === 6;
    }, null, { timeout: 10000 });
    await page.evaluate(async () => window.__boardVisualDebug.waitForIdle());

    const result = await page.evaluate(() => {
      const board = document.getElementById('board');
      const frame = document.getElementById('board-frame');
      if (!board || !frame) return null;
      const frameStyle = getComputedStyle(frame);
      const frameArtStyle = getComputedStyle(frame, '::before');
      return {
        pending: window.cardState.pendingEffectByPlayer.black,
        cells: window.gameState.boardExpansion.cells,
        renderedCells: [
          window.__boardVisualDebug.getRenderedCell(-1, -1),
          window.__boardVisualDebug.getRenderedCell(8, 8)
        ],
        boardHasRenderVoid: board.classList.contains('board-has-void-cells'),
        frameHasBaseVoid: frame.classList.contains('board-has-base-void-cells'),
        frameHasLegacyVoid: frame.classList.contains('board-has-void-cells'),
        frameBackgroundImage: frameStyle.backgroundImage,
        frameBoxShadow: frameStyle.boxShadow,
        artDisplay: frameArtStyle.display,
        artBackgroundImage: frameArtStyle.backgroundImage,
        layout: (() => {
          const viewport = document.getElementById('board-scroll-viewport');
          const anchorRect = window.__boardVisualDebug.getCellClientRect(3, 3);
          if (!viewport || !anchorRect) return null;
          const boardRect = board.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const viewportStyle = getComputedStyle(viewport);
          return {
            boardRect: {
              left: boardRect.left,
              top: boardRect.top,
              width: boardRect.width,
              height: boardRect.height,
              centerX: boardRect.left + boardRect.width / 2,
              centerY: boardRect.top + boardRect.height / 2
            },
            viewport: {
              clientWidth: viewport.clientWidth,
              clientHeight: viewport.clientHeight,
              rectWidth: viewportRect.width,
              rectHeight: viewportRect.height,
              scrollWidth: viewport.scrollWidth,
              scrollHeight: viewport.scrollHeight,
              scrollLeft: viewport.scrollLeft,
              scrollTop: viewport.scrollTop,
              overflowX: viewportStyle.overflowX,
              overflowY: viewportStyle.overflowY
            },
            anchorRect
          };
        })(),
        backendDiagnostics: window.__boardVisualDebug.getBackendDiagnostics()
      };
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error('board expansion god frame result was unavailable');
    expect(result.pending).toBeNull();
    expect(result.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: -1 }),
      expect.objectContaining({ row: 8, col: 8 })
    ]));
    expect(result.renderedCells).toEqual([
      expect.objectContaining({ key: '-1,-1', kind: 'playable' }),
      expect.objectContaining({ key: '8,8', kind: 'playable' })
    ]);
    expect(result).toEqual(expect.objectContaining({
      boardHasRenderVoid: true,
      frameHasBaseVoid: false,
      frameHasLegacyVoid: false,
      artDisplay: 'block'
    }));
    expect(result.artBackgroundImage).toContain('url(');
    expect(result.frameBackgroundImage).not.toBe('none');
    expect(result.frameBoxShadow).not.toBe('none');
    expect(result.layout).not.toBeNull();
    expect(result.layout.viewport).toEqual(expect.objectContaining({
      clientWidth: beforeLayout.viewport.clientWidth,
      clientHeight: beforeLayout.viewport.clientHeight,
      overflowX: 'hidden',
      overflowY: 'hidden'
    }));
    expect(result.layout.viewport.rectWidth).toBeCloseTo(beforeLayout.viewport.rectWidth, 4);
    expect(result.layout.viewport.rectHeight).toBeCloseTo(beforeLayout.viewport.rectHeight, 4);
    expect(result.layout.viewport.clientWidth).toBeCloseTo(result.layout.viewport.rectWidth, 0);
    expect(result.layout.viewport.clientHeight).toBeCloseTo(result.layout.viewport.rectHeight, 0);
    expect(result.layout.viewport.scrollWidth).toBeGreaterThan(result.layout.viewport.clientWidth);
    expect(result.layout.viewport.scrollHeight).toBeGreaterThan(result.layout.viewport.clientHeight);
    expect(result.layout.viewport.scrollLeft).toBeGreaterThan(0);
    expect(result.layout.viewport.scrollTop).toBeGreaterThan(0);
    expect(result.layout.boardRect.centerX).toBeCloseTo(beforeLayout.boardRect.centerX, 4);
    expect(result.layout.boardRect.centerY).toBeCloseTo(beforeLayout.boardRect.centerY, 4);
    expect(result.layout.anchorRect.left).toBeCloseTo(beforeLayout.anchorRect.left, 4);
    expect(result.layout.anchorRect.top).toBeCloseTo(beforeLayout.anchorRect.top, 4);
    expect(result.layout.anchorRect.width).toBeCloseTo(beforeLayout.anchorRect.width, 4);
    expect(result.layout.anchorRect.height).toBeCloseTo(beforeLayout.anchorRect.height, 4);
    expect(result.backendDiagnostics).toEqual(expect.objectContaining({
      domCellCount: 0,
      scene: expect.objectContaining({
        viewportClippedLayerNames: ['surface', 'cell', 'marker', 'stone', 'hint'],
        viewportClipRect: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number)
        })
      }),
      playback: expect.objectContaining({ inFlightEffectCount: 0 }),
      timeline: expect.objectContaining({ state: 'idle' })
    }));
    expect(result.backendDiagnostics.scene.viewportClipRect.x).toBeGreaterThan(0);
    expect(result.backendDiagnostics.scene.viewportClipRect.y).toBeGreaterThan(0);
    expect(result.backendDiagnostics.scene.viewportClipRect.width)
      .toBeCloseTo(result.layout.viewport.clientWidth, 0);
    expect(result.backendDiagnostics.scene.viewportClipRect.height)
      .toBeCloseTo(result.layout.viewport.clientHeight, 0);

    const screenshot = await page.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(1000);
    await page.close();
  }, 60000);
});
