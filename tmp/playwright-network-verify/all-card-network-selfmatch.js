const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startStaticServer, stopStaticServer, stopPlaywrightBrowser, stopPlaywrightPage } = require('../../test/e2e/e2e-runtime-helpers');
const { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } = require('../../scripts/local-match-server');
const Shared = require('../../shared-constants');
const CardLogic = require('../../game/logic/cards');
const DebugActions = require('../../game/debug/debug-actions');

global.CardLogic = CardLogic;

const OUT_DIR = path.resolve(__dirname, 'artifacts');
const RESULTS_PATH = path.join(OUT_DIR, 'all-card-network-results.json');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'screenshots');
const BLACK = typeof Shared.BLACK === 'number' ? Shared.BLACK : 1;
const WHITE = typeof Shared.WHITE === 'number' ? Shared.WHITE : -1;
const EMPTY = typeof Shared.EMPTY === 'number' ? Shared.EMPTY : 0;
const ENABLED_CARDS = (Shared.CARD_DEFS || []).filter((card) => card && card.id && card.enabled !== false);
const WHITE_HAND_FALLBACK = ENABLED_CARDS
  .map((card) => String(card.id || ''))
  .filter(Boolean)
  .filter((id, index, arr) => arr.indexOf(id) === index);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9_\-.]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'unknown';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listen(server, host) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve());
  });
}

async function closeServer(server) {
  if (!server || typeof server.close !== 'function') return;
  await new Promise((resolve) => server.close(() => resolve()));
}

function buildWhiteHand(cardId, desiredCount = 5) {
  const result = [];
  for (const id of WHITE_HAND_FALLBACK) {
    if (!id || id === cardId) continue;
    result.push(id);
    if (result.length >= desiredCount) break;
  }
  return result;
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

function applyNoLegalBehindScenario(snapshot, cardDef) {
  const gameState = snapshot.gameState;
  const cardState = snapshot.cardState;
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  gameState.board[7][7] = BLACK;
  gameState.board[0][0] = WHITE;
  gameState.board[0][1] = WHITE;
  gameState.board[1][0] = WHITE;
  gameState.board[1][1] = WHITE;
  gameState.currentPlayer = BLACK;
  gameState.turnNumber = 20;
  gameState.consecutivePasses = 0;

  cardState.markers = [];
  resetTransientCardState(cardState);
  cardState.hands = {
    black: [cardDef.id],
    white: buildWhiteHand(cardDef.id, 5)
  };
  if (typeof CardLogic.ensureCardCopyState === 'function') {
    CardLogic.ensureCardCopyState(cardState);
  }
}

function applySalvationScenario(snapshot, cardDef) {
  applyDefaultScenario(snapshot, cardDef);
  snapshot.cardState.prevOpponentTurnDestroyedStonesByPlayer.black = [{ row: 2, col: 2 }];
}

function applyEqualityScenario(snapshot, cardDef) {
  const gameState = snapshot.gameState;
  const cardState = snapshot.cardState;
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  gameState.currentPlayer = BLACK;
  gameState.turnNumber = 20;
  gameState.consecutivePasses = 0;

  gameState.board[0][0] = BLACK;
  [
    [0, 1], [0, 2], [0, 3],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7]
  ].forEach(([row, col]) => {
    gameState.board[row][col] = WHITE;
  });

  cardState.markers = [];
  resetTransientCardState(cardState);
  cardState.hands = {
    black: [cardDef.id],
    white: buildWhiteHand(cardDef.id, 5)
  };
  if (typeof CardLogic.ensureCardCopyState === 'function') {
    CardLogic.ensureCardCopyState(cardState);
  }
}

function applyScenario(snapshot, cardDef) {
  switch (String(cardDef && cardDef.type || '')) {
    case 'LAST_RESORT':
      applyNoLegalBehindScenario(snapshot, cardDef);
      break;
    case 'SALVATION_WILL':
      applySalvationScenario(snapshot, cardDef);
      break;
    case 'EQUALITY_WILL':
      applyEqualityScenario(snapshot, cardDef);
      break;
    default:
      applyDefaultScenario(snapshot, cardDef);
      break;
  }
}

function patchSnapshotForCard(roomId, baselineSnapshot, cardDef) {
  const applied = patchRoomSnapshotForTests(roomId, (room) => {
    const nextSnapshot = deepClone(baselineSnapshot);
    applyScenario(nextSnapshot, cardDef);
    room.stateVersion = Number.isFinite(Number(room.stateVersion))
      ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
      : 1;
    nextSnapshot.stateVersion = room.stateVersion;
    room.snapshot = nextSnapshot;
  });
  if (!applied) {
    throw new Error(`room_not_found:${roomId}`);
  }
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
    try { window.DEBUG_UNLIMITED_USAGE = true; } catch (e) { /* ignore */ }
    try { window.DEBUG_HUMAN_VS_HUMAN = true; } catch (e) { /* ignore */ }
    try {
      if (window.__uiImpl_turn_manager) {
        window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
        window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
      }
    } catch (e) { /* ignore */ }
    try { if (typeof window.setDebugModeEnabled === 'function') window.setDebugModeEnabled(true); } catch (e) { /* ignore */ }
    try { if (typeof window.setNetworkDebugModeAccess === 'function') window.setNetworkDebugModeAccess(true); } catch (e) { /* ignore */ }
  });
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
    const controllerMap = (window.cardState && window.cardState.fateWillControllerByTurnOwner) || {};
    const controllerKey = controllerMap[currentPlayerKey] || currentPlayerKey;
    const pending = safePendingMap[currentPlayerKey] || null;
    const selectedTargets = pending && Array.isArray(pending.selectedTargets)
      ? pending.selectedTargets
          .filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col))
          .map((target) => ({ row: target.row, col: target.col }))
      : [];
    const firstTarget = pending && pending.firstTarget
      && Number.isInteger(pending.firstTarget.row)
      && Number.isInteger(pending.firstTarget.col)
      ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
      : null;
    return {
      roomId: window.NetworkMatchClient && typeof window.NetworkMatchClient.getRoomId === 'function'
        ? window.NetworkMatchClient.getRoomId()
        : '',
      seatKey: window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function'
        ? window.NetworkMatchClient.getSeatKey()
        : '',
      stateVersion: window.NetworkMatchClient && typeof window.NetworkMatchClient.getStateVersion === 'function'
        ? window.NetworkMatchClient.getStateVersion()
        : null,
      currentPlayerKey,
      controllerKey,
      turnNumber: window.gameState && Number.isFinite(Number(window.gameState.turnNumber))
        ? Number(window.gameState.turnNumber)
        : null,
      gameOver: typeof window.isGameOver === 'function' ? !!window.isGameOver(window.gameState) : false,
      pendingType: pending && pending.type ? pending.type : null,
      pendingStage: pending && pending.stage ? pending.stage : null,
      pendingOffers: pending && Array.isArray(pending.offers) ? pending.offers.length : 0,
      pendingFirstTarget: firstTarget,
      pendingCardId: pending && typeof pending.cardId === 'string' ? pending.cardId : null,
      pendingSourceHandIndex: pending && Number.isFinite(Number(pending.sourceHandIndex))
        ? Number(pending.sourceHandIndex)
        : null,
      pendingSelectedCount: pending && Number.isFinite(Number(pending.selectedCount))
        ? Number(pending.selectedCount)
        : selectedTargets.length,
      pendingSelectedTargets: selectedTargets,
      boardHash: JSON.stringify(window.gameState && window.gameState.board),
      lastUsedBlack: window.cardState && window.cardState.lastUsedCardByPlayer
        ? (window.cardState.lastUsedCardByPlayer.black || null)
        : null,
      lastUsedWhite: window.cardState && window.cardState.lastUsedCardByPlayer
        ? (window.cardState.lastUsedCardByPlayer.white || null)
        : null
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
      && blackState.boardHash === whiteState.boardHash;
    if (synced) {
      return { blackState, whiteState };
    }
    await sleep(250);
  }
  throw new Error('sync_timeout');
}

function didObservableStateAdvance(beforeState, afterState) {
  if (!beforeState || !afterState) return false;
  return (
    beforeState.stateVersion !== afterState.stateVersion
    || beforeState.currentPlayerKey !== afterState.currentPlayerKey
    || beforeState.controllerKey !== afterState.controllerKey
    || beforeState.turnNumber !== afterState.turnNumber
    || beforeState.pendingType !== afterState.pendingType
    || beforeState.pendingStage !== afterState.pendingStage
    || beforeState.pendingOffers !== afterState.pendingOffers
    || beforeState.boardHash !== afterState.boardHash
    || beforeState.lastUsedBlack !== afterState.lastUsedBlack
    || beforeState.lastUsedWhite !== afterState.lastUsedWhite
  );
}

function serializePendingSelection(state) {
  if (!state) return '';
  return JSON.stringify({
    pendingType: state.pendingType || null,
    pendingStage: state.pendingStage || null,
    pendingFirstTarget: state.pendingFirstTarget || null,
    pendingSelectedCount: Number.isFinite(Number(state.pendingSelectedCount)) ? Number(state.pendingSelectedCount) : 0,
    pendingSelectedTargets: Array.isArray(state.pendingSelectedTargets)
      ? state.pendingSelectedTargets.map((target) => ({ row: target.row, col: target.col }))
      : []
  });
}

function didLocalPendingSelectionProgress(beforeState, afterState) {
  if (!beforeState || !afterState) return false;
  if (didObservableStateAdvance(beforeState, afterState)) return false;
  return serializePendingSelection(beforeState) !== serializePendingSelection(afterState);
}

async function waitForPagesSyncedAfterAction(blackPage, whitePage, beforeState, timeoutMs = 25000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const synced = await waitForPagesSynced(blackPage, whitePage, Math.min(8000, timeoutMs));
    if (didObservableStateAdvance(beforeState, synced.blackState)) {
      return synced;
    }
    await sleep(250);
  }
  throw new Error('action_advance_timeout');
}

async function waitForActingPageProgress(page, beforeState, timeoutMs = 4000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    await waitForIdle(page, Math.min(2000, timeoutMs));
    const afterState = await readClientState(page);
    if (didObservableStateAdvance(beforeState, afterState)) {
      return { kind: 'observable', afterState };
    }
    if (didLocalPendingSelectionProgress(beforeState, afterState)) {
      return { kind: 'local_pending', afterState };
    }
    await sleep(100);
  }
  return null;
}

async function waitForPendingSelectionProgress(actingPage, otherPage, beforeState, timeoutMs = 9000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    await waitForIdle(actingPage, Math.min(2000, timeoutMs)).catch(() => undefined);
    if (otherPage) {
      await waitForIdle(otherPage, Math.min(2000, timeoutMs)).catch(() => undefined);
    }
    const [actingState, otherState] = await Promise.all([
      readClientState(actingPage),
      otherPage ? readClientState(otherPage) : Promise.resolve(null)
    ]);
    if (didObservableStateAdvance(beforeState, actingState)) {
      return { kind: 'observable', afterState: actingState };
    }
    if (didLocalPendingSelectionProgress(beforeState, actingState)) {
      return { kind: 'selection', afterState: actingState };
    }
    if (otherState && serializePendingSelection(beforeState) !== serializePendingSelection(otherState)) {
      return { kind: 'selection', afterState: otherState };
    }
    await sleep(100);
  }
  return null;
}

async function syncBothPages(blackPage, whitePage) {
  await Promise.all([
    blackPage.evaluate(() => window.NetworkMatchClient.syncLatestState()),
    whitePage.evaluate(() => window.NetworkMatchClient.syncLatestState())
  ]);
  return waitForPagesSynced(blackPage, whitePage);
}

async function captureFailure(cardRecord, blackPage, whitePage, suffix) {
  ensureDir(SCREENSHOT_DIR);
  const base = `${sanitizeName(cardRecord.id)}_${sanitizeName(suffix)}`;
  const blackShot = path.join(SCREENSHOT_DIR, `${base}_black.png`);
  const whiteShot = path.join(SCREENSHOT_DIR, `${base}_white.png`);
  await Promise.all([
    blackPage.screenshot({ path: blackShot, fullPage: true }).catch(() => undefined),
    whitePage.screenshot({ path: whiteShot, fullPage: true }).catch(() => undefined)
  ]);
  cardRecord.artifacts = {
    blackScreenshot: blackShot,
    whiteScreenshot: whiteShot
  };
}

async function chooseOverlayCard(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById('heaven-blessing-overlay');
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    const overlayActive = !!(overlay && overlay.classList.contains('active'));
    const playbackBusy = !!(
      window.isProcessing
      || window.isCardAnimating
      || window.VisualPlaybackActive
      || (window.AnimationEngine && window.AnimationEngine.isPlaying === true)
    );
    return overlayActive && selectBtn && selectBtn.disabled === false && !playbackBusy;
  }, { timeout: 15000 });
  await page.locator('#heaven-blessing-offers .card-item').first().click({ timeout: 5000 });
  await page.waitForFunction(() => {
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    return !!(selectBtn && selectBtn.disabled === false);
  }, { timeout: 5000 });
  await page.locator('#heaven-blessing-select-btn').click({ timeout: 5000 });
  return { action: 'overlay_select' };
}

function orderPendingTargets(state, targets) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  if (list.length <= 1 || !state) return list;
  const pendingType = String(state.pendingType || '');
  if (pendingType === 'BOARD_EXPANSION_GOD') {
    const first = state.pendingSelectedTargets && state.pendingSelectedTargets[0]
      ? state.pendingSelectedTargets[0]
      : null;
    if (first) {
      return list.sort((a, b) => {
        const aDiagonal = a.row !== first.row && a.col !== first.col ? 1 : 0;
        const bDiagonal = b.row !== first.row && b.col !== first.col ? 1 : 0;
        if (aDiagonal !== bDiagonal) return bDiagonal - aDiagonal;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
    }
  }
  if (pendingType === 'POSITION_SWAP_WILL') {
    const first = state.pendingFirstTarget;
    if (first) {
      return list.sort((a, b) => {
        const distanceA = Math.abs(a.row - first.row) + Math.abs(a.col - first.col);
        const distanceB = Math.abs(b.row - first.row) + Math.abs(b.col - first.col);
        if (distanceA !== distanceB) return distanceB - distanceA;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
    }
  }
  return list;
}

async function chooseBoardTarget(actingPage, otherPage) {
  const beforeState = await readClientState(actingPage);
  const choice = await actingPage.evaluate(() => {
    const currentPlayerKey = (typeof getPlayerKey === 'function')
      ? getPlayerKey(window.gameState.currentPlayer)
      : (window.gameState.currentPlayer === 1 ? 'black' : 'white');
    const targets = (window.CardLogic && typeof window.CardLogic.getSelectableTargets === 'function')
      ? (window.CardLogic.getSelectableTargets(window.cardState, window.gameState, currentPlayerKey) || [])
      : [];
    return {
      ok: Array.isArray(targets) && targets.length > 0,
      targets: Array.isArray(targets)
        ? targets
            .filter((target) => target && Number.isInteger(target.row) && Number.isInteger(target.col))
            .map((target) => ({ row: target.row, col: target.col }))
        : []
    };
  });
  if (!choice || choice.ok !== true || !Array.isArray(choice.targets) || choice.targets.length === 0) {
    throw new Error(choice && choice.reason ? choice.reason : 'pending_target_failed');
  }
  const orderedTargets = orderPendingTargets(beforeState, choice.targets);
  for (const target of orderedTargets) {
    await actingPage.evaluate(({ row, col }) => {
      window.handleCellClick(row, col);
    }, target);
    const progress = await waitForPendingSelectionProgress(actingPage, otherPage, beforeState, 9000);
    if (progress) {
      return {
        action: 'pending_target',
        row: target.row,
        col: target.col,
        localOnlyProgress: progress.kind === 'local_pending',
        afterState: progress.afterState || null
      };
    }
  }
  throw new Error('pending_target_failed');
}

async function performMoveOrPass(page) {
  const result = await page.evaluate(() => {
    const legalMoves = (typeof getLegalMoves === 'function')
      ? (getLegalMoves(window.gameState) || [])
      : [];
    if (Array.isArray(legalMoves) && legalMoves.length > 0) {
      const move = legalMoves[0];
      window.handleCellClick(move.row, move.col);
      return { ok: true, action: 'place', row: move.row, col: move.col };
    }
    if (typeof window.passCurrentTurn === 'function') {
      window.passCurrentTurn();
      return { ok: true, action: 'pass' };
    }
    return { ok: false, reason: 'no_move_or_pass_entry' };
  });
  if (!result || result.ok !== true) {
    throw new Error(result && result.reason ? result.reason : 'move_or_pass_failed');
  }
  return result;
}

async function useCard(page, cardId) {
  const result = await page.evaluate((targetCardId) => {
    const usableIds = (window.CardLogic && typeof window.CardLogic.getUsableCardIds === 'function')
      ? (window.CardLogic.getUsableCardIds(window.cardState, window.gameState, 'black', { skipCostAndTurnLimit: true }) || [])
      : [];
    if (!usableIds.includes(targetCardId)) {
      return { ok: false, reason: 'target_not_usable', usableIds };
    }
    window.cardState.selectedCardId = targetCardId;
    window.cardState.selectedCardOwnerKey = 'black';
    window.useSelectedCard();
    return { ok: true, usableIdsCount: usableIds.length };
  }, cardId);
  if (!result || result.ok !== true) {
    const reason = result && result.reason ? result.reason : 'use_failed';
    const error = new Error(reason);
    error.details = result || null;
    throw error;
  }
  return result;
}

async function driveControllerStep(controllerKey, blackPage, whitePage) {
  const actingPage = controllerKey === 'white' ? whitePage : blackPage;
  const otherPage = controllerKey === 'white' ? blackPage : whitePage;
  const state = await readClientState(actingPage);
  if (state.pendingStage === 'selectTarget') {
    if (state.pendingType === 'HEAVEN_BLESSING' || state.pendingType === 'CONDEMN_WILL') {
      return chooseOverlayCard(actingPage);
    }
    return chooseBoardTarget(actingPage, otherPage);
  }
  return performMoveOrPass(actingPage);
}

async function advanceUntilBlackResponsibilityEnds(blackPage, whitePage, actionLog, maxSteps = 10) {
  let localPreviewState = null;
  for (let step = 0; step < maxSteps; step += 1) {
    let sharedState = null;
    if (localPreviewState) {
      await waitForIdle(blackPage, 8000).catch(() => undefined);
      const blackState = await readClientState(blackPage);
      const stillBlackControlled = blackState.currentPlayerKey === 'black' || blackState.controllerKey === 'black';
      if (blackState.gameOver) return { done: true, reason: 'game_over' };
      if (stillBlackControlled && blackState.pendingStage === 'selectTarget') {
        sharedState = blackState;
      } else {
        localPreviewState = null;
      }
    }
    if (!sharedState) {
      const synced = await waitForPagesSynced(blackPage, whitePage);
      sharedState = synced.blackState;
    }
    if (sharedState.gameOver) return { done: true, reason: 'game_over' };
    const stillBlackControlled = sharedState.currentPlayerKey === 'black' || sharedState.controllerKey === 'black';
    if (!stillBlackControlled) return { done: true, reason: 'turn_passed' };
    const stepResult = await driveControllerStep('black', blackPage, whitePage);
    actionLog.push(stepResult);
    if (stepResult && stepResult.localOnlyProgress) {
      localPreviewState = stepResult.afterState || await readClientState(blackPage);
      await waitForIdle(blackPage, 8000);
      continue;
    }
    localPreviewState = null;
    await waitForPagesSyncedAfterAction(blackPage, whitePage, sharedState);
  }
  throw new Error('black_turn_did_not_finish');
}

async function performFollowupAction(blackPage, whitePage, actionLog) {
  let localPreviewState = null;
  for (let step = 0; step < 10; step += 1) {
    let sharedState = null;
    let controllerKey = 'black';
    if (localPreviewState) {
      const actingPage = localPreviewState.controllerKey === 'white' || localPreviewState.currentPlayerKey === 'white'
        ? whitePage
        : blackPage;
      await waitForIdle(actingPage, 8000).catch(() => undefined);
      const localState = await readClientState(actingPage);
      if (localState.gameOver) {
        return { skipped: true, reason: 'game_over' };
      }
      const localControllerKey = localState.controllerKey || localState.currentPlayerKey || 'black';
      if (localState.pendingStage === 'selectTarget') {
        sharedState = localState;
        controllerKey = localControllerKey;
      } else {
        localPreviewState = null;
      }
    }
    if (!sharedState) {
      const synced = await waitForPagesSynced(blackPage, whitePage);
      sharedState = synced.blackState;
      if (sharedState.gameOver) {
        return { skipped: true, reason: 'game_over' };
      }
      controllerKey = sharedState.controllerKey || sharedState.currentPlayerKey || 'black';
    }
    const result = await driveControllerStep(controllerKey, blackPage, whitePage);
    actionLog.push(result);
    if (result && result.localOnlyProgress) {
      const actingPage = controllerKey === 'white' ? whitePage : blackPage;
      localPreviewState = result.afterState || await readClientState(actingPage);
      await waitForIdle(actingPage, 8000);
      continue;
    }
    await waitForPagesSyncedAfterAction(blackPage, whitePage, sharedState);
    return result;
  }
  throw new Error('followup_action_did_not_settle');
}

function persistResults(payload) {
  ensureDir(OUT_DIR);
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function resolveRequestedCards() {
  const args = process.argv.slice(2);
  const requestedIds = [];
  let limit = null;
  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index] || '').trim();
    if (token === '--card' && args[index + 1]) {
      requestedIds.push(String(args[index + 1]).trim());
      index += 1;
      continue;
    }
    if (token === '--limit' && args[index + 1]) {
      const parsed = Number(args[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.max(1, Math.trunc(parsed));
      }
      index += 1;
    }
  }
  let cards = ENABLED_CARDS.slice();
  if (requestedIds.length) {
    const requestedSet = new Set(requestedIds);
    cards = cards.filter((card) => requestedSet.has(card.id));
  }
  if (limit !== null) {
    cards = cards.slice(0, limit);
  }
  return cards;
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(SCREENSHOT_DIR);
  const requestedCards = resolveRequestedCards();

  const staticServer = startStaticServer(0);
  const matchServer = createLocalMatchServer();
  let blackBrowser = null;
  let whiteBrowser = null;
  let blackPage = null;
  let whitePage = null;
  const run = {
    startedAt: new Date().toISOString(),
    cards: [],
    summary: {
      total: requestedCards.length,
      ok: 0,
      failed: 0
    }
  };

  try {
    await sleep(500);
    await listen(matchServer, '127.0.0.1');
    const staticPort = staticServer.address().port;
    const matchPort = matchServer.address().port;
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1`;
    const matchUrl = `http://127.0.0.1:${matchPort}`;

    blackBrowser = await chromium.launch({ headless: false, args: ['--window-size=1440,1024'] });
    whiteBrowser = await chromium.launch({ headless: false, args: ['--window-size=1440,1024'] });
    blackPage = await blackBrowser.newPage({ viewport: { width: 1440, height: 1024 } });
    whitePage = await whiteBrowser.newPage({ viewport: { width: 1440, height: 1024 } });

    const blackConsole = [];
    const whiteConsole = [];
    blackPage.on('console', (msg) => { try { blackConsole.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ } });
    whitePage.on('console', (msg) => { try { whiteConsole.push({ type: msg.type(), text: msg.text() }); } catch (e) { /* ignore */ } });

    for (const cardDef of requestedCards) {
      const cardRecord = {
        id: cardDef.id,
        type: cardDef.type,
        name: cardDef.name,
        status: 'running',
        actionLog: []
      };
      run.cards.push(cardRecord);
      persistResults(run);
      process.stdout.write(`\n[all-card] ${cardDef.id} (${cardDef.type})\n`);

      try {
        blackConsole.length = 0;
        whiteConsole.length = 0;
        await Promise.all([
          waitForAppReady(blackPage, appUrl),
          waitForAppReady(whitePage, appUrl)
        ]);

        const createRes = await blackPage.evaluate((serverUrl) => (
          window.NetworkMatchClient.createRoom({
            playerName: 'SelfBlack',
            serverUrl,
            networkDebugEnabled: true
          })
        ), matchUrl);
        if (!createRes || createRes.ok !== true || !createRes.roomId) {
          throw new Error(`create_room_failed:${JSON.stringify(createRes)}`);
        }

        const joinRes = await whitePage.evaluate(({ roomId, serverUrl }) => (
          window.NetworkMatchClient.joinRoom(roomId, {
            playerName: 'SelfWhite',
            serverUrl
          })
        ), { roomId: createRes.roomId, serverUrl: matchUrl });
        if (!joinRes || joinRes.ok !== true) {
          throw new Error(`join_room_failed:${JSON.stringify(joinRes)}`);
        }

        await Promise.all([
          blackPage.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 }),
          whitePage.waitForFunction(() => window.NetworkMatchClient.hasTwoPlayers() === true, { timeout: 15000 })
        ]);
        await waitForPagesSynced(blackPage, whitePage);

        let baselineSnapshot = null;
        const captured = patchRoomSnapshotForTests(createRes.roomId, (room) => {
          baselineSnapshot = deepClone(room.snapshot);
        });
        if (!captured || !baselineSnapshot) {
          throw new Error('baseline_snapshot_capture_failed');
        }

        patchSnapshotForCard(createRes.roomId, baselineSnapshot, cardDef);
        await syncBothPages(blackPage, whitePage);
        const preState = await readClientState(blackPage);
        cardRecord.preStateVersion = preState.stateVersion;

        await useCard(blackPage, cardDef.id);
        await waitForPagesSyncedAfterAction(blackPage, whitePage, preState);
        await advanceUntilBlackResponsibilityEnds(blackPage, whitePage, cardRecord.actionLog);
        await performFollowupAction(blackPage, whitePage, cardRecord.actionLog);

        const synced = await waitForPagesSynced(blackPage, whitePage);
        cardRecord.status = 'ok';
        cardRecord.finalStateVersion = synced.blackState.stateVersion;
        cardRecord.finalCurrentPlayerKey = synced.blackState.currentPlayerKey;
        run.summary.ok += 1;
        process.stdout.write(`[ok] ${cardDef.id}\n`);
      } catch (error) {
        cardRecord.status = 'failed';
        cardRecord.error = error && error.message ? error.message : String(error);
        cardRecord.errorDetails = error && error.details ? error.details : null;
        cardRecord.blackState = await readClientState(blackPage).catch(() => null);
        cardRecord.whiteState = await readClientState(whitePage).catch(() => null);
        cardRecord.blackConsoleTail = blackConsole.slice(-20);
        cardRecord.whiteConsoleTail = whiteConsole.slice(-20);
        await captureFailure(cardRecord, blackPage, whitePage, cardDef.id);
        run.summary.failed += 1;
        process.stdout.write(`[failed] ${cardDef.id}: ${cardRecord.error}\n`);
      }

      persistResults(run);
    }

    run.finishedAt = new Date().toISOString();
    persistResults(run);
  } finally {
    await stopPlaywrightPage(blackPage, 5000).catch(() => undefined);
    await stopPlaywrightPage(whitePage, 5000).catch(() => undefined);
    await stopPlaywrightBrowser(blackBrowser, 10000).catch(() => undefined);
    await stopPlaywrightBrowser(whiteBrowser, 10000).catch(() => undefined);
    await closeServer(matchServer).catch(() => undefined);
    await stopStaticServer(staticServer).catch(() => undefined);
    resetRoomsForTests();
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
