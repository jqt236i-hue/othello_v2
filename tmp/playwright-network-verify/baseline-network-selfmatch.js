const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { stopPlaywrightBrowser, stopPlaywrightPage } = require('../../test/e2e/e2e-runtime-helpers');

const OUT_DIR = path.resolve(__dirname, 'artifacts');
const RESULT_PATH = path.join(OUT_DIR, 'baseline-network-selfmatch-result.json');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'baseline-network-selfmatch-screens');

function readArgValue(name, fallback = '') {
  const key = `--${name}`;
  const idx = process.argv.indexOf(key);
  if (idx >= 0 && idx + 1 < process.argv.length) return String(process.argv[idx + 1] || '').trim();
  return fallback;
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function persist(payload) {
  ensureDir(OUT_DIR);
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function launchBrowserWithFallback(preferredChannel) {
  const launchOptions = { headless: false, args: ['--window-size=1440,1024'] };
  if (preferredChannel) {
    try {
      const browser = await chromium.launch({ ...launchOptions, channel: preferredChannel });
      return { browser, channel: preferredChannel };
    } catch (error) {
      return { browser: await chromium.launch(launchOptions), channel: 'chromium-fallback', launchError: error && error.message ? error.message : String(error) };
    }
  }
  return { browser: await chromium.launch(launchOptions), channel: 'chromium' };
}

async function waitForAppReady(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    window.NetworkMatchClient
    && window.gameState
    && window.cardState
    && typeof window.handleCellClick === 'function'
    && typeof window.passCurrentTurn === 'function'
  ), { timeout: 20000 });
}

async function openNetworkOverlay(page) {
  await page.locator('#modeNetworkBtn').click({ timeout: 5000 });
  await page.waitForFunction(() => {
    const overlay = document.getElementById('networkOverlay');
    return !!(overlay && overlay.classList.contains('is-open'));
  }, { timeout: 5000 });
}

async function closeNetworkOverlay(page) {
  const isOpen = await page.evaluate(() => {
    const overlay = document.getElementById('networkOverlay');
    return !!(overlay && overlay.classList.contains('is-open'));
  }).catch(() => false);
  if (!isOpen) return;
  await page.locator('#networkCloseBtn').click({ timeout: 5000 });
  await page.waitForFunction(() => {
    const overlay = document.getElementById('networkOverlay');
    return !overlay || !overlay.classList.contains('is-open');
  }, { timeout: 5000 });
}

async function populateNetworkOverlay(page, options) {
  const config = options || {};
  await openNetworkOverlay(page);
  if (config.serverUrl) {
    const advancedOpen = await page.evaluate(() => {
      const details = document.getElementById('networkAdvancedSettings');
      return !!(details && details.open);
    }).catch(() => false);
    if (!advancedOpen) {
      await page.locator('#networkAdvancedSettings > summary').click({ timeout: 5000 });
    }
    await page.locator('#networkServerInput').fill(String(config.serverUrl || ''));
  }
  await page.locator('#networkPlayerNameInput').fill(String(config.playerName || ''));
  if (Object.prototype.hasOwnProperty.call(config, 'roomId')) {
    await page.locator('#networkRoomIdInput').fill(String(config.roomId || ''));
  }
}

async function createRoomViaUi(page, serverUrl, playerName) {
  await populateNetworkOverlay(page, { serverUrl, playerName });
  await page.locator('#networkCreateBtn').click({ timeout: 5000 });
  await page.waitForFunction(() => {
    const input = document.getElementById('networkRoomIdInput');
    return !!(input && /^[A-Z0-9]{3}$/.test(String(input.value || '').trim()));
  }, { timeout: 15000 });
  return page.evaluate(() => ({
    roomId: (document.getElementById('networkRoomIdInput') || {}).value || '',
    seatKey: window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
      ? window.NetworkMatchClient.getSeatKey()
      : '',
    networkActive: !!(window.NetworkMatchClient && typeof window.NetworkMatchClient.isActive === 'function' && window.NetworkMatchClient.isActive()),
    matchMode: typeof window.getCurrentMatchMode === 'function' ? window.getCurrentMatchMode() : window.MATCH_MODE
  }));
}

async function joinRoomViaUi(page, serverUrl, playerName, roomId) {
  await populateNetworkOverlay(page, { serverUrl, playerName, roomId });
  await page.locator('#networkJoinBtn').click({ timeout: 5000 });
  await page.waitForFunction(() => {
    return !!(window.NetworkMatchClient && typeof window.NetworkMatchClient.isActive === 'function' && window.NetworkMatchClient.isActive());
  }, { timeout: 15000 });
  return page.evaluate(() => ({
    roomId: window.NetworkMatchClient && typeof window.NetworkMatchClient.getRoomId === 'function'
      ? window.NetworkMatchClient.getRoomId()
      : '',
    seatKey: window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
      ? window.NetworkMatchClient.getSeatKey()
      : '',
    networkActive: !!(window.NetworkMatchClient && typeof window.NetworkMatchClient.isActive === 'function' && window.NetworkMatchClient.isActive()),
    matchMode: typeof window.getCurrentMatchMode === 'function' ? window.getCurrentMatchMode() : window.MATCH_MODE
  }));
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
    const board = window.gameState && Array.isArray(window.gameState.board) ? window.gameState.board : [];
    let blackCount = 0;
    let whiteCount = 0;
    for (let row = 0; row < board.length; row += 1) {
      const boardRow = Array.isArray(board[row]) ? board[row] : [];
      for (let col = 0; col < boardRow.length; col += 1) {
        if (boardRow[col] === 1) blackCount += 1;
        if (boardRow[col] === -1) whiteCount += 1;
      }
    }
    const currentPlayerKey = (typeof getPlayerKey === 'function')
      ? getPlayerKey(window.gameState.currentPlayer)
      : (window.gameState.currentPlayer === 1 ? 'black' : 'white');
    const resultOverlay = document.getElementById('result-overlay');
    const passBtn = document.getElementById('pass-btn');
    const pendingMap = window.cardState && window.cardState.pendingEffectByPlayer
      ? window.cardState.pendingEffectByPlayer
      : {};
    const pending = pendingMap[currentPlayerKey] || null;
    const matchMode = (typeof window.getCurrentMatchMode === 'function')
      ? window.getCurrentMatchMode()
      : window.MATCH_MODE;
    const localPlayerKey = (window.OwnerHelpers && typeof window.OwnerHelpers.resolveLocalPlayerKey === 'function')
      ? window.OwnerHelpers.resolveLocalPlayerKey(window)
      : (window.LOCAL_PLAYER_KEY || window.__LOCAL_PLAYER_KEY || window.BOARD_VIEWER_KEY || null);
    return {
      roomId: window.NetworkMatchClient && typeof window.NetworkMatchClient.getRoomId === 'function'
        ? window.NetworkMatchClient.getRoomId()
        : '',
      seatKey: window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
        ? window.NetworkMatchClient.getSeatKey()
        : '',
      networkActive: !!(window.NetworkMatchClient && typeof window.NetworkMatchClient.isActive === 'function' && window.NetworkMatchClient.isActive()),
      matchMode: matchMode || null,
      localPlayerKey: localPlayerKey || null,
      stateVersion: window.NetworkMatchClient && typeof window.NetworkMatchClient.getStateVersion === 'function'
        ? window.NetworkMatchClient.getStateVersion()
        : null,
      currentPlayerKey,
      turnNumber: Number.isFinite(Number(window.gameState && window.gameState.turnNumber))
        ? Number(window.gameState.turnNumber)
        : null,
      consecutivePasses: Number.isFinite(Number(window.gameState && window.gameState.consecutivePasses))
        ? Number(window.gameState.consecutivePasses)
        : null,
      gameOver: typeof window.isGameOver === 'function' ? !!window.isGameOver(window.gameState) : false,
      blackCount,
      whiteCount,
      boardHash: JSON.stringify(board),
      pendingType: pending && pending.type ? String(pending.type) : null,
      isProcessing: !!window.isProcessing,
      isCardAnimating: !!window.isCardAnimating,
      visualPlaybackActive: !!window.VisualPlaybackActive,
      animationPlaying: !!(window.AnimationEngine && window.AnimationEngine.isPlaying === true),
      passDisabled: !!(passBtn && passBtn.disabled),
      resultOverlayActive: !!(resultOverlay && resultOverlay.classList.contains('active')),
      resultTitle: resultOverlay
        ? ((resultOverlay.querySelector('.result-title') && resultOverlay.querySelector('.result-title').textContent) || '').trim()
        : ''
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
    const synced = blackState.stateVersion === whiteState.stateVersion
      && blackState.currentPlayerKey === whiteState.currentPlayerKey
      && blackState.turnNumber === whiteState.turnNumber
      && blackState.boardHash === whiteState.boardHash
      && blackState.blackCount === whiteState.blackCount
      && blackState.whiteCount === whiteState.whiteCount;
    if (synced) return { blackState, whiteState };
    await sleep(250);
  }
  throw new Error('sync_timeout');
}

function didStateAdvance(beforeState, afterState) {
  if (!beforeState || !afterState) return false;
  return beforeState.stateVersion !== afterState.stateVersion
    || beforeState.currentPlayerKey !== afterState.currentPlayerKey
    || beforeState.turnNumber !== afterState.turnNumber
    || beforeState.boardHash !== afterState.boardHash
    || beforeState.blackCount !== afterState.blackCount
    || beforeState.whiteCount !== afterState.whiteCount
    || beforeState.consecutivePasses !== afterState.consecutivePasses
    || beforeState.gameOver !== afterState.gameOver
    || beforeState.resultOverlayActive !== afterState.resultOverlayActive;
}

async function waitForPagesSyncedAfterAction(blackPage, whitePage, beforeState, timeoutMs = 25000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const synced = await waitForPagesSynced(blackPage, whitePage, Math.min(8000, timeoutMs));
    if (didStateAdvance(beforeState, synced.blackState)) return synced;
    await sleep(250);
  }
  throw new Error('action_advance_timeout');
}

async function chooseBaselineAction(page) {
  return page.evaluate(() => {
    const legalMoves = (typeof getLegalMoves === 'function')
      ? (getLegalMoves(window.gameState) || [])
      : [];
    if (Array.isArray(legalMoves) && legalMoves.length > 0) {
      const move = legalMoves[0];
      return { ok: true, action: 'place', row: Number(move.row), col: Number(move.col), legalMoveCount: legalMoves.length };
    }
    return { ok: true, action: 'pass', legalMoveCount: 0 };
  });
}

async function performBaselineAction(page, action) {
  await waitForIdle(page, 8000);
  if (action.action === 'place') {
    const selector = `.cell[data-row="${action.row}"][data-col="${action.col}"]`;
    await page.locator(selector).click({ timeout: 5000 });
    return;
  }
  await page.waitForFunction(() => {
    const passBtn = document.getElementById('pass-btn');
    return !!(passBtn && passBtn.disabled === false);
  }, { timeout: 5000 });
  await page.locator('#pass-btn').click({ timeout: 5000 });
}

async function waitForResultOverlay(page, timeoutMs = 15000) {
  await page.waitForFunction(() => {
    const el = document.getElementById('result-overlay');
    return !!(el && el.classList.contains('active'));
  }, { timeout: timeoutMs });
}

async function captureScreens(blackPage, whitePage, run, suffix) {
  ensureDir(SCREENSHOT_DIR);
  const blackPath = path.join(SCREENSHOT_DIR, `${suffix}_black.png`);
  const whitePath = path.join(SCREENSHOT_DIR, `${suffix}_white.png`);
  await Promise.all([
    blackPage.screenshot({ path: blackPath, fullPage: true }).catch(() => undefined),
    whitePage.screenshot({ path: whitePath, fullPage: true }).catch(() => undefined)
  ]);
  run.artifacts = run.artifacts || {};
  run.artifacts[`${suffix}Black`] = blackPath;
  run.artifacts[`${suffix}White`] = whitePath;
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(SCREENSHOT_DIR);

  const appUrl = readArgValue('appUrl', 'http://127.0.0.1:18000/?debug=1');
  const matchUrl = readArgValue('matchUrl', 'http://127.0.0.1:18787');
  const run = {
    startedAt: new Date().toISOString(),
    appUrl,
    matchUrl,
    actionLog: [],
    browsers: {},
    artifacts: {}
  };

  let blackBrowser = null;
  let whiteBrowser = null;
  let blackPage = null;
  let whitePage = null;
  const blackConsole = [];
  const whiteConsole = [];

  persist(run);

  try {
    const blackLaunch = await launchBrowserWithFallback('msedge');
    blackBrowser = blackLaunch.browser;
    run.browsers.black = {
      channel: blackLaunch.channel,
      launchError: blackLaunch.launchError || null
    };

    const whiteLaunch = await launchBrowserWithFallback('chrome');
    whiteBrowser = whiteLaunch.browser;
    run.browsers.white = {
      channel: whiteLaunch.channel,
      launchError: whiteLaunch.launchError || null
    };

    blackPage = await blackBrowser.newPage({ viewport: { width: 1440, height: 1024 } });
    whitePage = await whiteBrowser.newPage({ viewport: { width: 1440, height: 1024 } });
    blackPage.on('console', (msg) => { try { blackConsole.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ } });
    whitePage.on('console', (msg) => { try { whiteConsole.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ } });

    await Promise.all([
      waitForAppReady(blackPage, appUrl),
      waitForAppReady(whitePage, appUrl)
    ]);

    const createRes = await createRoomViaUi(blackPage, matchUrl, 'SelfBlack');
    if (!createRes || !createRes.roomId) {
      throw new Error(`create_room_failed:${JSON.stringify(createRes)}`);
    }
    run.roomId = createRes.roomId;
    run.createResponse = createRes;
    persist(run);

    const joinRes = await joinRoomViaUi(whitePage, matchUrl, 'SelfWhite', createRes.roomId);
    if (!joinRes || !joinRes.roomId) {
      throw new Error(`join_room_failed:${JSON.stringify(joinRes)}`);
    }
    run.joinResponse = joinRes;

    await Promise.all([
      blackPage.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 }),
      whitePage.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 })
    ]);
    await Promise.all([
      closeNetworkOverlay(blackPage),
      closeNetworkOverlay(whitePage)
    ]);

    let synced = await waitForPagesSynced(blackPage, whitePage);
    run.initialState = synced.blackState;
    persist(run);

    for (let step = 0; step < 80; step += 1) {
      if (synced.blackState.pendingType || synced.whiteState.pendingType) {
        throw new Error(`unexpected_pending:${synced.blackState.pendingType || synced.whiteState.pendingType}`);
      }
      if (synced.blackState.gameOver) break;

      const actorKey = synced.blackState.currentPlayerKey === 'white' ? 'white' : 'black';
      const actingPage = actorKey === 'white' ? whitePage : blackPage;
      const action = await chooseBaselineAction(actingPage);
      if (!action || action.ok !== true) {
        throw new Error(`action_plan_failed:${JSON.stringify(action)}`);
      }

      const actionRecord = {
        step,
        actorKey,
        action: action.action,
        row: action.action === 'place' ? action.row : null,
        col: action.action === 'place' ? action.col : null,
        legalMoveCount: action.legalMoveCount,
        before: synced.blackState
      };
      run.actionLog.push(actionRecord);
      persist(run);

      await performBaselineAction(actingPage, action);
      synced = await waitForPagesSyncedAfterAction(blackPage, whitePage, actionRecord.before, 30000);
      actionRecord.after = synced.blackState;
      persist(run);
    }

    await Promise.all([
      waitForIdle(blackPage, 10000),
      waitForIdle(whitePage, 10000)
    ]);

    synced = await waitForPagesSynced(blackPage, whitePage, 15000);
    run.finalState = synced.blackState;

    if (!synced.blackState.gameOver) {
      throw new Error('game_over_not_reached');
    }

    await Promise.all([
      waitForResultOverlay(blackPage, 20000),
      waitForResultOverlay(whitePage, 20000)
    ]);

    const [blackFinal, whiteFinal] = await Promise.all([
      readClientState(blackPage),
      readClientState(whitePage)
    ]);
    run.blackFinal = blackFinal;
    run.whiteFinal = whiteFinal;
    run.status = 'ok';
    run.finishedAt = new Date().toISOString();
    await captureScreens(blackPage, whitePage, run, 'final');
    persist(run);
  } catch (error) {
    run.status = 'failed';
    run.error = error && error.message ? error.message : String(error);
    run.finishedAt = new Date().toISOString();
    run.blackState = await readClientState(blackPage).catch(() => null);
    run.whiteState = await readClientState(whitePage).catch(() => null);
    run.blackConsoleTail = blackConsole.slice(-50);
    run.whiteConsoleTail = whiteConsole.slice(-50);
    await captureScreens(blackPage, whitePage, run, 'failure').catch(() => undefined);
    persist(run);
    throw error;
  } finally {
    await stopPlaywrightPage(blackPage, 5000).catch(() => undefined);
    await stopPlaywrightPage(whitePage, 5000).catch(() => undefined);
    await stopPlaywrightBrowser(blackBrowser, 10000).catch(() => undefined);
    await stopPlaywrightBrowser(whiteBrowser, 10000).catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
