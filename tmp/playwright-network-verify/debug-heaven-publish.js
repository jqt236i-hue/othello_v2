const { chromium } = require('playwright');
const { startStaticServer, stopStaticServer, stopPlaywrightBrowser, stopPlaywrightPage } = require('../../test/e2e/e2e-runtime-helpers');
const { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } = require('../../scripts/local-match-server');
const Shared = require('../../shared-constants');
const CardLogic = require('../../game/logic/cards');
const DebugActions = require('../../game/debug/debug-actions');

global.CardLogic = CardLogic;

const BLACK = typeof Shared.BLACK === 'number' ? Shared.BLACK : 1;
const WHITE = typeof Shared.WHITE === 'number' ? Shared.WHITE : -1;
const EMPTY = typeof Shared.EMPTY === 'number' ? Shared.EMPTY : 0;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function listen(server, host) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve());
  });
}

async function waitForAddress(server) {
  if (server && server.address && server.address()) return server.address();
  await new Promise((resolve, reject) => {
    if (!server) {
      reject(new Error('server_unavailable'));
      return;
    }
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server.address();
}

function buildWhiteHand(cardId, desiredCount = 5) {
  return (Shared.CARD_DEFS || [])
    .map((card) => String(card && card.id || ''))
    .filter(Boolean)
    .filter((id) => id !== cardId)
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, desiredCount);
}

function resetTransientCardState(cardState) {
  cardState.pendingEffectByPlayer = { black: null, white: null };
  cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
  cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
  cardState.lastUsedCardByPlayer = { black: null, white: null };
  cardState.extraPlaceRemainingByPlayer = { black: 0, white: 0 };
  cardState.doublePlaceRemainingByPlayer = { black: 0, white: 0 };
  cardState.turnToPlaceBoardBonusByPlayer = { black: null, white: null };
  cardState.turnToPlaceBoardBonus = null;
  cardState.selectedCardId = null;
  cardState.selectedCardOwnerKey = null;
  cardState.selectedCardUseSource = null;
  cardState.revealedHandByViewer = { black: [], white: [] };
  cardState.prevOpponentTurnDestroyedStonesByPlayer = { black: [], white: [] };
  cardState.fateWillControllerByTurnOwner = { black: null, white: null };
  cardState.boardBonusByCell = {};
  cardState.boardBonusConsumedByCell = {};
  cardState.debugNoDraw = true;
  cardState.turnIndex = 19;
  cardState.charge = { black: 99, white: 50 };
}

function applyDefaultScenario(snapshot, cardDef) {
  const gameState = snapshot.gameState;
  const cardState = snapshot.cardState;
  DebugActions.applyVisualTestBoard(gameState, cardState);
  resetTransientCardState(cardState);
  gameState.currentPlayer = BLACK;
  gameState.turnNumber = 20;
  gameState.consecutivePasses = 0;
  gameState.board[0][0] = WHITE;
  gameState.board[0][7] = WHITE;
  gameState.board[7][0] = WHITE;
  gameState.board[7][7] = WHITE;
  gameState.board[0][2] = WHITE;
  gameState.board[3][3] = BLACK;
  gameState.board[3][4] = WHITE;
  gameState.board[4][3] = WHITE;
  gameState.board[4][4] = BLACK;
  cardState.hands = {
    black: [cardDef.id],
    white: buildWhiteHand(cardDef.id, 5)
  };
  if (typeof CardLogic.ensureCardCopyState === 'function') {
    CardLogic.ensureCardCopyState(cardState);
  }
}

async function waitForIdle(page, timeoutMs = 25000) {
  await page.waitForFunction(() => {
    const playbackBusy = !!(
      window.isProcessing
      || window.isCardAnimating
      || window.VisualPlaybackActive
      || (window.AnimationEngine && window.AnimationEngine.isPlaying === true)
    );
    return !playbackBusy;
  }, { timeout: timeoutMs });
}

async function readClientState(page) {
  return page.evaluate(() => {
    const safePendingMap = (window.cardState && window.cardState.pendingEffectByPlayer) || {};
    const currentPlayerKey = (typeof getPlayerKey === 'function')
      ? getPlayerKey(window.gameState.currentPlayer)
      : (window.gameState.currentPlayer === 1 ? 'black' : 'white');
    const pending = safePendingMap[currentPlayerKey] || null;
    return {
      stateVersion: window.NetworkMatchClient && typeof window.NetworkMatchClient.getStateVersion === 'function'
        ? window.NetworkMatchClient.getStateVersion()
        : null,
      currentPlayerKey,
      turnNumber: window.gameState && Number.isFinite(Number(window.gameState.turnNumber))
        ? Number(window.gameState.turnNumber)
        : null,
      pendingType: pending && pending.type ? pending.type : null,
      boardHash: JSON.stringify(window.gameState && window.gameState.board)
    };
  });
}

async function waitForPagesSynced(blackPage, whitePage, timeoutMs = 25000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    await Promise.all([waitForIdle(blackPage, 8000), waitForIdle(whitePage, 8000)]);
    const [blackState, whiteState] = await Promise.all([
      readClientState(blackPage),
      readClientState(whitePage)
    ]);
    if (
      blackState
      && whiteState
      && blackState.stateVersion === whiteState.stateVersion
      && blackState.currentPlayerKey === whiteState.currentPlayerKey
      && blackState.pendingType === whiteState.pendingType
      && blackState.boardHash === whiteState.boardHash
    ) {
      return { blackState, whiteState };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('sync_timeout');
}

async function syncBothPages(blackPage, whitePage) {
  await Promise.all([
    blackPage.evaluate(() => window.NetworkMatchClient.syncLatestState()),
    whitePage.evaluate(() => window.NetworkMatchClient.syncLatestState())
  ]);
  return waitForPagesSynced(blackPage, whitePage);
}

async function waitForAppReady(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.NetworkMatchClient
    && window.gameState
    && window.cardState
    && typeof window.useSelectedCard === 'function'
    && typeof window.passCurrentTurn === 'function'
    && typeof window.handleCellClick === 'function'
    && window.CardLogic
    && typeof window.CardLogic.getUsableCardIds === 'function'
    && typeof window.CardLogic.getSelectableTargets === 'function'
  ), { timeout: 20000 });
  await page.evaluate(() => {
    try { window.DEBUG_UNLIMITED_USAGE = true; } catch (e) {}
    try { window.DEBUG_HUMAN_VS_HUMAN = true; } catch (e) {}
    try {
      if (window.__uiImpl_turn_manager) {
        window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
        window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
      }
    } catch (e) {}
    try { if (typeof window.setDebugModeEnabled === 'function') window.setDebugModeEnabled(true); } catch (e) {}
    try { if (typeof window.setNetworkDebugModeAccess === 'function') window.setNetworkDebugModeAccess(true); } catch (e) {}
  });
}

async function main() {
  const cardDef = Shared.CARD_DEFS.find((card) => card && card.id === 'heaven_01');
  const staticServer = startStaticServer(0);
  const matchServer = createLocalMatchServer();
  let browser = null;
  let whiteBrowser = null;
  let page = null;
  let whitePage = null;
  try {
    const staticPort = (await waitForAddress(staticServer)).port;
    const staticUrl = `http://127.0.0.1:${staticPort}/?debug=1`;
    await resetRoomsForTests();
    await listen(matchServer, '127.0.0.1');
    const matchPort = matchServer.address().port;
    const matchUrl = `http://127.0.0.1:${matchPort}`;

    browser = await chromium.launch({ headless: false });
    whiteBrowser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    whitePage = await whiteBrowser.newPage();

    const requestLog = [];
    const responseLog = [];
    const attach = (targetPage, label) => {
      targetPage.on('request', (request) => {
        const url = request.url();
        if (!url.includes('/api/match/publish')) return;
        requestLog.push({
          label,
          method: request.method(),
          postData: request.postDataJSON ? request.postDataJSON() : request.postData()
        });
      });
      targetPage.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/api/match/publish')) return;
        let bodyText = '';
        try { bodyText = await response.text(); } catch (e) {}
        responseLog.push({
          label,
          status: response.status(),
          bodyText
        });
      });
      targetPage.on('console', (msg) => {
        console.log(`[${label}:console:${msg.type()}] ${msg.text()}`);
      });
    };
    attach(page, 'black');
    attach(whitePage, 'white');

    await Promise.all([
      waitForAppReady(page, staticUrl),
      waitForAppReady(whitePage, staticUrl)
    ]);

    const createResult = await page.evaluate(async (serverUrl) => {
      return window.NetworkMatchClient.createRoom({ serverUrl, playerName: 'black' });
    }, matchUrl);
    const roomId = createResult.roomId;
    await whitePage.evaluate(async ({ serverUrl, roomId }) => {
      return window.NetworkMatchClient.joinRoom(roomId, { serverUrl, playerName: 'white' });
    }, { serverUrl: matchUrl, roomId });

    await Promise.all([
      page.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 }),
      whitePage.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 })
    ]);
    await waitForPagesSynced(page, whitePage);

    let baselineSnapshot = null;
    const captured = patchRoomSnapshotForTests(roomId, (room) => {
      baselineSnapshot = deepClone(room.snapshot);
    });
    if (!captured || !baselineSnapshot) {
      throw new Error('baseline_snapshot_capture_failed');
    }
    const applied = patchRoomSnapshotForTests(roomId, (room) => {
      const snapshot = deepClone(baselineSnapshot);
      applyDefaultScenario(snapshot, cardDef);
      room.stateVersion = Number.isFinite(Number(room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
        : 1;
      snapshot.stateVersion = room.stateVersion;
      room.snapshot = snapshot;
    });
    if (!applied) {
      throw new Error(`room_not_found:${roomId}`);
    }

    await syncBothPages(page, whitePage);
    await Promise.all([
      page.waitForFunction((cardId) => {
        const hand = window.cardState && window.cardState.hands && window.cardState.hands.black;
        return Array.isArray(hand) && hand[0] === cardId && window.gameState && window.gameState.turnNumber === 20;
      }, cardDef.id, { timeout: 15000 }),
      whitePage.waitForFunction(() => window.gameState && window.gameState.turnNumber === 20, { timeout: 15000 })
    ]);

    await page.evaluate((cardId) => {
      const usableIds = (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function')
        ? (window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black', { skipCostAndTurnLimit: true }) || [])
        : [];
      if (!usableIds.includes(cardId)) {
        throw new Error(`card_not_usable:${cardId}:${JSON.stringify(usableIds)}`);
      }
      window.cardState.selectedCardId = cardId;
      window.cardState.selectedCardOwnerKey = 'black';
      window.useSelectedCard();
    }, cardDef.id);
    const useCardSync = await waitForPagesSynced(page, whitePage);
    console.log('AFTER_USE_SYNC', JSON.stringify(useCardSync.blackState, null, 2));

    await page.waitForFunction(() => {
      const overlay = document.getElementById('heaven-blessing-overlay');
      const selectBtn = document.getElementById('heaven-blessing-select-btn');
      return !!(overlay && overlay.classList.contains('active') && selectBtn && selectBtn.disabled === false);
    }, { timeout: 15000 });
    await page.locator('#heaven-blessing-offers .card-item').first().click();
    await page.locator('#heaven-blessing-select-btn').click();

    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      const legalMoves = (typeof getLegalMoves === 'function') ? (getLegalMoves(window.gameState) || []) : [];
      const move = legalMoves[0];
      window.handleCellClick(move.row, move.col);
    });

    await page.waitForTimeout(4000);
    const blackState = await page.evaluate(() => ({
      stateVersion: window.NetworkMatchClient.getStateVersion(),
      currentPlayer: window.gameState.currentPlayer,
      selectedCardId: window.cardState.selectedCardId,
      pending: window.cardState.pendingEffectByPlayer.black,
      lastUsed: window.cardState.lastUsedCardByPlayer.black,
      legalMoves: (typeof getLegalMoves === 'function') ? (getLegalMoves(window.gameState) || []) : []
    }));

    console.log('BLACK_STATE', JSON.stringify(blackState, null, 2));
    console.log('REQUEST_LOG', JSON.stringify(requestLog, null, 2));
    console.log('RESPONSE_LOG', JSON.stringify(responseLog, null, 2));
  } finally {
    await stopPlaywrightPage(page);
    await stopPlaywrightPage(whitePage);
    await stopPlaywrightBrowser(browser);
    await stopPlaywrightBrowser(whiteBrowser);
    await new Promise((resolve) => matchServer.close(() => resolve()));
    await stopStaticServer(staticServer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
