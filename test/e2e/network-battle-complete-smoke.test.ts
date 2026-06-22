import { chromium } from 'playwright';

declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

const {
  startStaticServer,
  startLocalMatchServer,
  stopStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage,
  closeMaintenanceNoticeIfPresent
} = require('./e2e-runtime-helpers.js');

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBootstrap(page: any): Promise<void> {
  await page.waitForFunction(
    () => !!(
      (window as any).gameState
      && Array.isArray((window as any).gameState.board)
      && (window as any).cardState
      && (window as any).NetworkMatchClient
    ),
    null,
    { timeout: 20000 }
  );
}

function attachDiagnostics(page: any, label: string) {
  const diagnostics = {
    label,
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
    publishStatuses: [] as Array<{ status: number; url: string }>,
    matchRequestFailures: [] as Array<{ url: string; failure: string }>
  };
  page.on('console', (message: any) => {
    if (typeof message.type === 'function' && message.type() === 'error') {
      diagnostics.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error: any) => {
    diagnostics.pageErrors.push(error && error.message ? error.message : String(error));
  });
  page.on('response', (response: any) => {
    const url = response.url();
    if (url.includes('/api/match/publish')) {
      diagnostics.publishStatuses.push({ status: response.status(), url });
    }
  });
  page.on('requestfailed', (request: any) => {
    const url = request.url();
    if (!url.includes('/api/match/')) return;
    diagnostics.matchRequestFailures.push({
      url,
      failure: request.failure() ? request.failure().errorText : 'request_failed'
    });
  });
  return diagnostics;
}

async function openNetworkDialog(page: any): Promise<void> {
  await page.locator('#modeNetworkBtn').click();
  await page.waitForSelector('#networkOverlay[aria-hidden="false"]', { timeout: 10000 });
  await page.waitForSelector('#networkPlayerNameInput', { timeout: 10000, state: 'visible' });
}

async function createDebugRoom(page: any, matchUrl: string, playerName: string): Promise<string> {
  await openNetworkDialog(page);
  const result = await page.evaluate(async ({ serverUrl, name }) => {
    const client = (window as any).NetworkMatchClient;
    client.setServerUrl(serverUrl);
    return client.createRoom({
      serverUrl,
      playerName: name,
      networkDebugEnabled: true
    });
  }, { serverUrl: matchUrl, name: playerName });
  if (!result || result.ok !== true || !/^[A-Z0-9]{3}$/.test(String(result.roomId || ''))) {
    throw new Error(`create room failed: ${JSON.stringify(result || {})}`);
  }
  await page.waitForFunction(
    () => !!(
      (window as any).NetworkMatchClient
      && (window as any).NetworkMatchClient.isActive()
      && (window as any).NetworkMatchClient.getSeatKey() === 'black'
    ),
    null,
    { timeout: 15000 }
  );
  await page.locator('#networkCloseBtn').click();
  await page.waitForSelector('#networkOverlay[aria-hidden="true"]', { timeout: 10000 });
  return String(result.roomId);
}

async function joinRoom(page: any, matchUrl: string, roomId: string, playerName: string): Promise<void> {
  await openNetworkDialog(page);
  const result = await page.evaluate(async ({ serverUrl, targetRoomId, name }) => {
    const client = (window as any).NetworkMatchClient;
    client.setServerUrl(serverUrl);
    return client.joinRoom(targetRoomId, {
      serverUrl,
      playerName: name
    });
  }, { serverUrl: matchUrl, targetRoomId: roomId, name: playerName });
  if (!result || result.ok !== true) {
    throw new Error(`join room failed: ${JSON.stringify(result || {})}`);
  }
  await page.waitForFunction(
    () => !!(
      (window as any).NetworkMatchClient
      && (window as any).NetworkMatchClient.isActive()
      && (window as any).NetworkMatchClient.getSeatKey() === 'white'
    ),
    null,
    { timeout: 15000 }
  );
  await page.locator('#networkCloseBtn').click();
  await page.waitForSelector('#networkOverlay[aria-hidden="true"]', { timeout: 10000 });
}

async function waitForIdle(page: any, timeoutMs = 20000): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const root = window as any;
      const timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
        ? root.NetworkPresentationTimeline.getDiagnostics()
        : null;
      return root.isProcessing !== true
        && root.isCardAnimating !== true
        && root.VisualPlaybackActive !== true
        && !(root.AnimationEngine && root.AnimationEngine.isPlaying === true)
        && (!timeline || (
          timeline.playing !== true
          && timeline.paused !== true
          && Number(timeline.pendingFrameCount || 0) === 0
        ));
    }, null, { timeout: timeoutMs });
  } catch (_error) {
    const diagnostics = await page.evaluate(() => {
      const root = window as any;
      let timeline: any = null;
      let playback: any = null;
      try {
        timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
          ? root.NetworkPresentationTimeline.getDiagnostics()
          : null;
      } catch (error) {
        timeline = { error: String(error) };
      }
      try {
        const playbackState = root.PlaybackStateManager || (
          typeof root.require === 'function'
            ? root.require('ui/playback-state-manager.js')
            : null
        );
        playback = playbackState ? {
          processing: typeof playbackState.getProcessing === 'function' ? playbackState.getProcessing() : null,
          cardAnimating: typeof playbackState.getCardAnimating === 'function' ? playbackState.getCardAnimating() : null,
          playbackActive: typeof playbackState.getPlaybackActive === 'function' ? playbackState.getPlaybackActive() : null,
          hasClaimedVisualPlayback: typeof playbackState.hasClaimedVisualPlayback === 'function'
            ? playbackState.hasClaimedVisualPlayback()
            : null,
          hasSelectionSettlementLock: typeof playbackState.hasSelectionSettlementLock === 'function'
            ? playbackState.hasSelectionSettlementLock()
            : null,
          selectionEntry: typeof playbackState.getSelectionEntryPlaybackContext === 'function'
            ? playbackState.getSelectionEntryPlaybackContext()
            : null
        } : null;
      } catch (error) {
        playback = { error: String(error) };
      }
      return {
        isProcessing: root.isProcessing === true,
        isCardAnimating: root.isCardAnimating === true,
        visualPlaybackActive: root.VisualPlaybackActive === true,
        animationEnginePlaying: !!(root.AnimationEngine && root.AnimationEngine.isPlaying === true),
        timeline,
        playback,
        pending: root.cardState && root.cardState.pendingEffectByPlayer || null,
        currentPlayer: root.gameState && root.gameState.currentPlayer,
        turnNumber: root.gameState && root.gameState.turnNumber,
        telemetry: root.NetworkMatchClient && typeof root.NetworkMatchClient.getNetworkTelemetry === 'function'
          ? root.NetworkMatchClient.getNetworkTelemetry()
          : null
      };
    }).catch((error: any) => ({ diagnosticError: String(error) }));
    throw new Error(`waitForIdle timeout: ${JSON.stringify(diagnostics)}`);
  }
}

async function syncLatestState(page: any): Promise<void> {
  await page.evaluate(async () => {
    const client = (window as any).NetworkMatchClient;
    if (client && typeof client.syncLatestState === 'function') {
      await client.syncLatestState();
    }
  });
}

async function syncBoth(hostPage: any, guestPage: any): Promise<void> {
  await Promise.all([syncLatestState(hostPage), syncLatestState(guestPage)]);
  await Promise.all([waitForIdle(hostPage), waitForIdle(guestPage)]);
}

async function waitForSameCanonicalState(hostPage: any, guestPage: any, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  let lastHost: any = null;
  let lastGuest: any = null;
  while (Date.now() - start < timeoutMs) {
    await syncBoth(hostPage, guestPage);
    lastHost = await readCanonicalState(hostPage);
    lastGuest = await readCanonicalState(guestPage);
    if (
      lastHost.hash === lastGuest.hash
      && lastHost.stateVersion === lastGuest.stateVersion
      && lastHost.renderStateVersion === lastGuest.renderStateVersion
      && lastHost.busy.processing === false
      && lastHost.busy.cardAnimating === false
      && lastHost.busy.playback === false
      && lastGuest.busy.processing === false
      && lastGuest.busy.cardAnimating === false
      && lastGuest.busy.playback === false
    ) {
      return;
    }
    await wait(250);
  }
  throw new Error(`canonical states did not converge: ${JSON.stringify({ host: lastHost, guest: lastGuest })}`);
}

async function readCanonicalState(page: any): Promise<any> {
  return page.evaluate(() => {
    const root = window as any;
    const board = Array.isArray(root.gameState && root.gameState.board)
      ? root.gameState.board.map((row: any) => Array.isArray(row) ? row.slice() : row)
      : [];
    const markers = Array.isArray(root.cardState && root.cardState.markers)
      ? root.cardState.markers.map((marker: any) => ({
        kind: marker && marker.kind || null,
        row: Number(marker && marker.row),
        col: Number(marker && marker.col),
        owner: marker && marker.owner || null,
        type: marker && marker.data && marker.data.type || null
      })).filter((marker: any) => Number.isFinite(marker.row) && Number.isFinite(marker.col))
        .sort((a: any, b: any) => (
          String(a.kind || '').localeCompare(String(b.kind || ''))
          || String(a.type || '').localeCompare(String(b.type || ''))
          || String(a.owner || '').localeCompare(String(b.owner || ''))
          || a.row - b.row
          || a.col - b.col
        ))
      : [];
    const renderSnapshot = root.NetworkVisualStateStore && typeof root.NetworkVisualStateStore.getRenderSnapshot === 'function'
      ? root.NetworkVisualStateStore.getRenderSnapshot()
      : null;
    const timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
      ? root.NetworkPresentationTimeline.getDiagnostics()
      : null;
    const hashPayload = {
      board,
      markers,
      currentPlayer: root.gameState ? root.gameState.currentPlayer : null,
      turnNumber: root.gameState ? root.gameState.turnNumber : null
    };
    return {
      hash: JSON.stringify(hashPayload),
      stateVersion: root.NetworkMatchClient && typeof root.NetworkMatchClient.getStateVersion === 'function'
        ? root.NetworkMatchClient.getStateVersion()
        : null,
      renderStateVersion: renderSnapshot && Number.isFinite(Number(renderSnapshot.stateVersion))
        ? Number(renderSnapshot.stateVersion)
        : null,
      currentPlayer: root.gameState ? root.gameState.currentPlayer : null,
      turnNumber: root.gameState ? root.gameState.turnNumber : null,
      board,
      markers,
      timeline,
      busy: {
        processing: !!root.isProcessing,
        cardAnimating: !!root.isCardAnimating,
        playback: !!root.VisualPlaybackActive
      },
      pending: root.cardState && root.cardState.pendingEffectByPlayer
        ? {
          black: root.cardState.pendingEffectByPlayer.black,
          white: root.cardState.pendingEffectByPlayer.white
        }
        : null
    };
  });
}

async function getFirstLegalMove(page: any): Promise<{ row: number; col: number }> {
  await waitForIdle(page);
  await page.waitForFunction(() => {
    const root = window as any;
    const context = (
      root.CardLogic
      && typeof root.CardLogic.getCardContext === 'function'
    )
      ? root.CardLogic.getCardContext(root.cardState)
      : { protectedStones: [], permaProtectedStones: [] };
    const logicMoves = typeof root.getLegalMoves === 'function'
      ? root.getLegalMoves(root.gameState, context.protectedStones, context.permaProtectedStones)
      : [];
    return Array.isArray(logicMoves) && logicMoves.length > 0;
  }, null, { timeout: 15000 });
  const move = await page.evaluate(() => {
    const root = window as any;
    const context = (
      root.CardLogic
      && typeof root.CardLogic.getCardContext === 'function'
    )
      ? root.CardLogic.getCardContext(root.cardState)
      : { protectedStones: [], permaProtectedStones: [] };
    const logicMoves = typeof root.getLegalMoves === 'function'
      ? root.getLegalMoves(root.gameState, context.protectedStones, context.permaProtectedStones)
      : [];
    const first = Array.isArray(logicMoves) ? logicMoves[0] : null;
    return first ? { row: Number(first.row), col: Number(first.col) } : null;
  });
  if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) {
    throw new Error(`no legal move available: ${JSON.stringify(move)}`);
  }
  return move;
}

async function playFirstLegalMove(page: any): Promise<{ row: number; col: number }> {
  const move = await getFirstLegalMove(page);
  await page.click(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
  await waitForIdle(page);
  return move;
}

async function fillDebugHandForSeat(page: any, seatKey: 'black' | 'white'): Promise<void> {
  const result = await page.evaluate(async (playerKey) => {
    const root = window as any;
    root.DEBUG_UNLIMITED_USAGE = true;
    root.DEBUG_HUMAN_VS_HUMAN = true;
    if (root.__uiImpl_turn_manager) {
      root.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
      root.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
    }
    root.cardState.charge = root.cardState.charge || {};
    root.cardState.charge[playerKey] = 100;
    root.cardState.hasUsedCardThisTurnByPlayer = root.cardState.hasUsedCardThisTurnByPlayer || {};
    root.cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
    const client = root.NetworkMatchClient;
    if (!client || typeof client.publishSnapshot !== 'function') {
      return { ok: false, reason: 'client_unavailable' };
    }
    if (client.getSeatKey && client.getSeatKey() !== playerKey) {
      return { ok: false, reason: `seat_mismatch:${client.getSeatKey()}` };
    }
    const publish = await client.publishSnapshot({
      actionType: 'debug_fill_hand',
      playbackEvents: [],
      action: { type: 'debug_fill_hand' }
    });
    if (typeof root.renderCardUI === 'function') root.renderCardUI();
    return { ok: !(publish && publish.ok === false), publish };
  }, seatKey);
  if (!result || result.ok !== true) {
    throw new Error(`fillDebugHandForSeat failed: ${JSON.stringify(result || {})}`);
  }
  await page.waitForFunction((playerKey) => {
    const root = window as any;
    const hand = root.cardState && root.cardState.hands && root.cardState.hands[playerKey];
    return Array.isArray(hand)
      && hand.includes('guard_01')
      && hand.includes('gold_stone');
  }, seatKey, { timeout: 15000 });
}

async function useCard(page: any, seatKey: 'black' | 'white', cardId: string): Promise<void> {
  await page.evaluate(({ playerKey, selectedCardId }) => {
    const root = window as any;
    root.cardState.selectedCardId = selectedCardId;
    root.cardState.selectedCardOwnerKey = playerKey;
    if (typeof root.renderCardUI === 'function') root.renderCardUI();
    if (typeof root.useSelectedCard === 'function') root.useSelectedCard();
  }, { playerKey: seatKey, selectedCardId: cardId });
}

async function waitForTurnManagerInputIdle(page: any, timeoutMs = 20000): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const root = window as any;
      let animationLocked = false;
      try {
        const turnManager = typeof root.require === 'function'
          ? root.require('game/turn-manager.js')
          : null;
        if (turnManager && typeof turnManager.isAnimationInProgress === 'function') {
          animationLocked = turnManager.isAnimationInProgress() === true;
        } else if (typeof root.isAnimationInProgress === 'function') {
          animationLocked = root.isAnimationInProgress() === true;
        }
      } catch (_error) {
        animationLocked = true;
      }
      const timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
        ? root.NetworkPresentationTimeline.getDiagnostics()
        : null;
      return !animationLocked
        && root.isProcessing !== true
        && root.isCardAnimating !== true
        && root.VisualPlaybackActive !== true
        && !(root.AnimationEngine && root.AnimationEngine.isPlaying === true)
        && (!timeline || (
          timeline.playing !== true
          && timeline.paused !== true
          && Number(timeline.pendingFrameCount || 0) === 0
        ));
    }, null, { timeout: timeoutMs });
  } catch (_error) {
    const diagnostics = await page.evaluate(() => {
      const root = window as any;
      let timeline: any = null;
      let turnManagerAnimationLocked: any = null;
      try {
        const turnManager = typeof root.require === 'function'
          ? root.require('game/turn-manager.js')
          : null;
        turnManagerAnimationLocked = turnManager && typeof turnManager.isAnimationInProgress === 'function'
          ? turnManager.isAnimationInProgress()
          : null;
      } catch (error) {
        turnManagerAnimationLocked = String(error);
      }
      try {
        timeline = root.NetworkPresentationTimeline && typeof root.NetworkPresentationTimeline.getDiagnostics === 'function'
          ? root.NetworkPresentationTimeline.getDiagnostics()
          : null;
      } catch (error) {
        timeline = { error: String(error) };
      }
      return {
        turnManagerAnimationLocked,
        isProcessing: root.isProcessing === true,
        isCardAnimating: root.isCardAnimating === true,
        visualPlaybackActive: root.VisualPlaybackActive === true,
        animationEnginePlaying: !!(root.AnimationEngine && root.AnimationEngine.isPlaying === true),
        timeline,
        pending: root.cardState && root.cardState.pendingEffectByPlayer || null,
        telemetry: root.NetworkMatchClient && typeof root.NetworkMatchClient.getNetworkTelemetry === 'function'
          ? root.NetworkMatchClient.getNetworkTelemetry()
          : null
      };
    }).catch((error: any) => ({ diagnosticError: String(error) }));
    throw new Error(`waitForTurnManagerInputIdle timeout: ${JSON.stringify(diagnostics)}`);
  }
}

async function findPendingSelectionTarget(
  page: any,
  seatKey: 'black' | 'white',
  preferredBoardValue?: number
): Promise<{ row: number; col: number }> {
  const point = await page.evaluate(({ playerKey, preferredValue }) => {
    const root = window as any;
    const board = root.gameState && root.gameState.board;
    const targets = (
      root.CardLogic
      && typeof root.CardLogic.getSelectableTargets === 'function'
    )
      ? root.CardLogic.getSelectableTargets(root.cardState, root.gameState, playerKey)
      : [];
    if (!Array.isArray(board) || !Array.isArray(targets) || targets.length <= 0) return null;
    const normalizedPreferredValue = Number(preferredValue);
    const preferred = targets.find((target: any) => (
      target
      && Number.isInteger(Number(target.row))
      && Number.isInteger(Number(target.col))
      && board[Number(target.row)]
      && Number.isFinite(normalizedPreferredValue)
      && board[Number(target.row)][Number(target.col)] === normalizedPreferredValue
    )) || targets[0];
    if (preferred) {
      return { row: Number(preferred.row), col: Number(preferred.col) };
    }
    return null;
  }, { playerKey: seatKey, preferredValue: preferredBoardValue });
  if (!point || !Number.isInteger(point.row) || !Number.isInteger(point.col)) {
    throw new Error(`pending selection target not found for ${seatKey}`);
  }
  return point;
}

async function clickBoardCell(page: any, row: number, col: number): Promise<void> {
  const handled = await page.evaluate(async ({ targetRow, targetCol }) => {
    const root = window as any;
    if (typeof root.handleCellClick !== 'function') return false;
    const result = root.handleCellClick(targetRow, targetCol);
    if (result && typeof result.then === 'function') await result;
    return true;
  }, { targetRow: row, targetCol: col });
  if (handled === true) return;
  await page.locator(`.cell[data-row="${row}"][data-col="${col}"]`).click({ force: true, timeout: 10000 });
}

async function waitForPendingSelectionInputReady(
  page: any,
  seatKey: 'black' | 'white',
  pendingTypes: string[],
  timeoutMs = 5000
): Promise<void> {
  const payload = { playerKey: seatKey, types: pendingTypes.map((type) => String(type || '').toUpperCase()) };
  try {
    await page.waitForFunction(({ playerKey, types }) => {
      const root = window as any;
      const pending = root.cardState && root.cardState.pendingEffectByPlayer
        ? root.cardState.pendingEffectByPlayer[playerKey]
        : null;
      const pendingType = String(pending && pending.type || '').trim().toUpperCase();
      if (!pending || pending.stage !== 'selectTarget' || !types.includes(pendingType)) return false;

      let allowsSelectionEntry = false;
      try {
        const playbackState = root.PlaybackStateManager || (
          typeof root.require === 'function'
            ? root.require('ui/playback-state-manager.js')
            : null
        );
        allowsSelectionEntry = !!(
          playbackState
          && typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function'
          && playbackState.shouldAllowSelectionEntryDuringPlayback({
            playerKey,
            pendingType
          }) === true
        );
      } catch (_error) {
        allowsSelectionEntry = false;
      }

      if (allowsSelectionEntry) return true;
      return root.isProcessing !== true
        && root.isCardAnimating !== true
        && root.VisualPlaybackActive !== true;
    }, payload, { timeout: timeoutMs });
  } catch (_error) {
    const diagnostics = await page.evaluate(({ playerKey }) => {
      const root = window as any;
      const pending = root.cardState && root.cardState.pendingEffectByPlayer
        ? root.cardState.pendingEffectByPlayer[playerKey]
        : null;
      const pendingType = String(pending && pending.type || '').trim().toUpperCase();
      let playbackDiagnostics: any = null;
      let turnManagerAnimationLocked: any = null;
      try {
        const playbackState = root.PlaybackStateManager || (
          typeof root.require === 'function'
            ? root.require('ui/playback-state-manager.js')
            : null
        );
        playbackDiagnostics = playbackState ? {
          busy: typeof playbackState.getBusyState === 'function' ? playbackState.getBusyState() : null,
          selectionEntry: typeof playbackState.getSelectionEntryPlaybackContext === 'function'
            ? playbackState.getSelectionEntryPlaybackContext()
            : null,
          allowsSelectionEntry: typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function'
            ? playbackState.shouldAllowSelectionEntryDuringPlayback({ playerKey, pendingType })
            : null
        } : null;
      } catch (error) {
        playbackDiagnostics = { error: String(error) };
      }
      try {
        const turnManager = typeof root.require === 'function'
          ? root.require('game/turn-manager.js')
          : null;
        turnManagerAnimationLocked = turnManager && typeof turnManager.isAnimationInProgress === 'function'
          ? turnManager.isAnimationInProgress()
          : null;
      } catch (error) {
        turnManagerAnimationLocked = String(error);
      }
      return {
        pending,
        pendingType,
        isProcessing: root.isProcessing === true,
        isCardAnimating: root.isCardAnimating === true,
        visualPlaybackActive: root.VisualPlaybackActive === true,
        animationEnginePlaying: !!(root.AnimationEngine && root.AnimationEngine.isPlaying === true),
        turnManagerAnimationLocked,
        playbackDiagnostics,
        networkTelemetry: root.NetworkMatchClient && typeof root.NetworkMatchClient.getNetworkTelemetry === 'function'
          ? root.NetworkMatchClient.getNetworkTelemetry()
          : null
      };
    }, payload);
    throw new Error(`waitForPendingSelectionInputReady timeout: ${JSON.stringify(diagnostics)}`);
  }
}

async function useGuardPendingCard(page: any, seatKey: 'black' | 'white'): Promise<{ row: number; col: number }> {
  await fillDebugHandForSeat(page, seatKey);
  await useCard(page, seatKey, 'guard_01');
  await page.waitForFunction((playerKey) => {
    const root = window as any;
    const pending = root.cardState && root.cardState.pendingEffectByPlayer
      ? root.cardState.pendingEffectByPlayer[playerKey]
      : null;
    return !!(
      pending
      && (pending.type === 'GUARD_WILL' || pending.type === 'GUARDIAN_GOD')
      && document.querySelector('#board.selection-mode')
    );
  }, seatKey, { timeout: 15000 });
  await waitForPendingSelectionInputReady(page, seatKey, ['GUARD_WILL', 'GUARDIAN_GOD']);
  const target = await findPendingSelectionTarget(page, seatKey, seatKey === 'black' ? 1 : -1);
  await clickBoardCell(page, target.row, target.col);
  await page.waitForFunction(({ playerKey, row, col }) => {
    const root = window as any;
    return !!(
      root.cardState
      && root.cardState.pendingEffectByPlayer
      && root.cardState.pendingEffectByPlayer[playerKey] === null
      && Array.isArray(root.cardState.markers)
      && root.cardState.markers.some((marker: any) => (
        marker
        && marker.row === row
        && marker.col === col
        && marker.data
        && marker.data.type === 'GUARD'
      ))
      && root.isProcessing !== true
      && root.isCardAnimating !== true
      && root.VisualPlaybackActive !== true
    );
  }, { playerKey: seatKey, row: target.row, col: target.col }, { timeout: 20000 });
  return target;
}

async function useGoldStoneDestroyPlayback(page: any, seatKey: 'black' | 'white'): Promise<{ row: number; col: number }> {
  await fillDebugHandForSeat(page, seatKey);
  await useCard(page, seatKey, 'gold_stone');
  await waitForTurnManagerInputIdle(page);
  const move = await getFirstLegalMove(page);
  await clickBoardCell(page, move.row, move.col);
  await page.waitForFunction(({ row, col }) => {
    const root = window as any;
    return !!(
      root.gameState
      && root.gameState.board
      && root.gameState.board[row]
      && root.gameState.board[row][col] === 0
      && root.isProcessing !== true
      && root.isCardAnimating !== true
      && root.VisualPlaybackActive !== true
    );
  }, move, { timeout: 20000 });
  await waitForIdle(page);
  return move;
}

async function forceReconnect(context: any, page: any): Promise<void> {
  const traceCountBefore = await page.evaluate(() => {
    const trace = (window as any).__networkDebugTrace;
    return trace && typeof trace.entries === 'function' ? trace.entries().length : 0;
  });
  await context.setOffline(true);
  await wait(800);
  await context.setOffline(false);
  await syncLatestState(page);
  await page.waitForFunction((before) => {
    const trace = (window as any).__networkDebugTrace;
    const entries = trace && typeof trace.entries === 'function' ? trace.entries() : [];
    return entries.length > before && entries.some((entry: any) => (
      entry.source === 'state_sync'
      || entry.source === 'stream'
      || entry.type === 'network_presentation_timeline_gap_recovered'
    ));
  }, traceCountBefore, { timeout: 15000 });
  await waitForIdle(page);
}

async function collectTraceDiagnostics(page: any): Promise<any> {
  return page.evaluate(() => {
    const root = window as any;
    const trace = root.__networkDebugTrace && typeof root.__networkDebugTrace.entries === 'function'
      ? root.__networkDebugTrace.entries()
      : [];
    const telemetry = root.NetworkMatchClient && typeof root.NetworkMatchClient.getNetworkTelemetry === 'function'
      ? root.NetworkMatchClient.getNetworkTelemetry()
      : null;
    const playbackBySeq: Record<string, number> = {};
    for (const entry of trace) {
      if (!entry || !String(entry.type || '').startsWith('network_playback_dispatcher')) continue;
      if (!Number.isFinite(Number(entry.visualSeq))) continue;
      const key = String(Number(entry.visualSeq));
      playbackBySeq[key] = Number.isFinite(playbackBySeq[key]) ? playbackBySeq[key] + 1 : 1;
    }
    const duplicateVisualSeqPlayback = Object.keys(playbackBySeq)
      .filter((key) => playbackBySeq[key] > 1)
      .map((key) => ({ visualSeq: Number(key), count: playbackBySeq[key] }));
    const directBoardWritesDuringPlayback = trace.filter((entry: any) => (
      entry
      && entry.type === 'board_request'
      && entry.boardWriter
      && !['network_timeline'].includes(String(entry.boardWriter))
    ));
    return {
      trace,
      telemetry,
      duplicateVisualSeqPlayback,
      directBoardWritesDuringPlayback,
      busy: {
        processing: !!root.isProcessing,
        cardAnimating: !!root.isCardAnimating,
        playback: !!root.VisualPlaybackActive
      }
    };
  });
}

function assertPageDiagnosticsClean(diagnostics: any): void {
  const network500s = diagnostics.publishStatuses.filter((entry: any) => entry.status >= 500);
  const unexpected409s = diagnostics.publishStatuses.filter((entry: any) => entry.status === 409);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(network500s).toEqual([]);
  expect(unexpected409s).toEqual([]);
}

function assertTraceClean(traceDiagnostics: any): void {
  expect(traceDiagnostics.directBoardWritesDuringPlayback).toEqual([]);
  expect(traceDiagnostics.duplicateVisualSeqPlayback).toEqual([]);
  expect(traceDiagnostics.busy).toEqual({
    processing: false,
    cardAnimating: false,
    playback: false
  });
}

describe('Network battle complete smoke E2E', () => {
  let staticServer: any;
  let matchServer: any;
  let hostBrowser: any;
  let guestBrowser: any;
  let staticPort: number;
  let matchPort: number;

  beforeAll(async () => {
    staticServer = startStaticServer(0);
    matchServer = startLocalMatchServer(0);
    await wait(500);
    staticPort = staticServer.address().port;
    matchPort = matchServer.address().port;
    hostBrowser = await chromium.launch({ headless: true });
    guestBrowser = await chromium.launch({ headless: true });
  }, 60000);

  afterAll(async () => {
    await stopPlaywrightBrowser(guestBrowser, 10000);
    guestBrowser = null;
    await stopPlaywrightBrowser(hostBrowser, 10000);
    hostBrowser = null;
    await stopStaticServer(matchServer);
    matchServer = null;
    await stopStaticServer(staticServer);
    staticServer = null;
  }, 60000);

  test('two clients stay synchronized through normal moves, pending selection, destroy playback, reconnect, and continuation', async () => {
    const hostContext = await hostBrowser.newContext();
    const guestContext = await guestBrowser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const hostDiagnostics = attachDiagnostics(hostPage, 'host');
    const guestDiagnostics = attachDiagnostics(guestPage, 'guest');
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;
    const matchUrl = `http://127.0.0.1:${matchPort}`;

    try {
      await Promise.all([
        hostPage.goto(appUrl, { waitUntil: 'domcontentloaded' }),
        guestPage.goto(appUrl, { waitUntil: 'domcontentloaded' })
      ]);
      await Promise.all([
        closeMaintenanceNoticeIfPresent(hostPage),
        closeMaintenanceNoticeIfPresent(guestPage)
      ]);
      await Promise.all([waitForBootstrap(hostPage), waitForBootstrap(guestPage)]);

      const roomId = await createDebugRoom(hostPage, matchUrl, '黒主');
      expect(roomId).toMatch(/^[A-Z0-9]{3}$/);
      await joinRoom(guestPage, matchUrl, roomId, '白主');
      await hostPage.waitForFunction(
        () => !!(
          (window as any).NetworkMatchClient
          && (window as any).NetworkMatchClient.getRoomSeats
          && (window as any).NetworkMatchClient.getRoomSeats().white === true
        ),
        null,
        { timeout: 15000 }
      );
      await waitForSameCanonicalState(hostPage, guestPage);

      await playFirstLegalMove(hostPage);
      await waitForSameCanonicalState(hostPage, guestPage);
      expect((await readCanonicalState(hostPage)).currentPlayer).toBe(-1);

      await playFirstLegalMove(guestPage);
      await waitForSameCanonicalState(hostPage, guestPage);
      expect((await readCanonicalState(hostPage)).currentPlayer).toBe(1);

      const guarded = await useGuardPendingCard(hostPage, 'black');
      await waitForSameCanonicalState(hostPage, guestPage);
      const afterGuard = await readCanonicalState(hostPage);
      expect(afterGuard.pending.black).toBeNull();
      expect(afterGuard.markers.some((marker: any) => (
        marker.row === guarded.row
        && marker.col === guarded.col
        && marker.type === 'GUARD'
      ))).toBe(true);

      const destroyed = await useGoldStoneDestroyPlayback(hostPage, 'black');
      await waitForSameCanonicalState(hostPage, guestPage);
      const afterGoldStone = await readCanonicalState(hostPage);
      expect(afterGoldStone.board[destroyed.row][destroyed.col]).toBe(0);

      await forceReconnect(guestContext, guestPage);
      await waitForSameCanonicalState(hostPage, guestPage);

      const postReconnect = await readCanonicalState(hostPage);
      await playFirstLegalMove(postReconnect.currentPlayer === 1 ? hostPage : guestPage);
      await waitForSameCanonicalState(hostPage, guestPage);

      const finalHost = await readCanonicalState(hostPage);
      const finalGuest = await readCanonicalState(guestPage);
      expect(finalGuest.hash).toBe(finalHost.hash);
      expect(finalGuest.stateVersion).toBe(finalHost.stateVersion);

      assertPageDiagnosticsClean(hostDiagnostics);
      assertPageDiagnosticsClean(guestDiagnostics);
      assertTraceClean(await collectTraceDiagnostics(hostPage));
      assertTraceClean(await collectTraceDiagnostics(guestPage));
    } finally {
      await stopPlaywrightPage(hostPage, 5000);
      await stopPlaywrightPage(guestPage, 5000);
      await hostContext.close().catch(() => undefined);
      await guestContext.close().catch(() => undefined);
    }
  }, 120000);
});
