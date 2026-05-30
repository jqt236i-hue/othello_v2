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
  stopPlaywrightPage
} = require('./e2e-runtime-helpers.js');

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBootstrap(page: any) {
  await page.waitForFunction(
    () => !!(
      window.gameState
      && Array.isArray(window.gameState.board)
      && window.cardState
    ),
    { timeout: 15000 }
  );
}

async function openNetworkDialog(page: any) {
  await page.locator('#modeNetworkBtn').click();
  await page.waitForSelector('#networkPlayerNameInput', { timeout: 10000, state: 'visible' });
}

async function createDebugRoom(page: any, playerName: string) {
  await openNetworkDialog(page);
  await page.waitForFunction(
    () => !!(
      window.NetworkMatchClient
      && window.NetworkMatchClient.createRoom
    ),
    { timeout: 15000 }
  );
  await page.getByPlaceholder('名前を入力してください', { exact: true }).fill(playerName);
  await page.getByRole('checkbox', { name: '部屋作成時にデバッグモードを有効化' }).check();
  await page.getByRole('button', { name: '部屋作成' }).click();
  await page.waitForFunction(
    () => {
      const input = document.querySelector('input[placeholder="部屋番号（3桁）"]') as HTMLInputElement | null;
      return !!(window.NetworkMatchClient && window.NetworkMatchClient.isActive && window.NetworkMatchClient.isActive() && input && /^[A-Z0-9]{3}$/.test(input.value));
    },
    { timeout: 15000 }
  );
  const roomId = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="部屋番号（3桁）"]') as HTMLInputElement | null;
    return input ? input.value : '';
  });
  await page.locator('#networkCloseBtn').click();
  await page.waitForSelector('#networkPlayerNameInput', { state: 'hidden', timeout: 10000 });
  return roomId;
}

async function joinRoom(page: any, roomId: string, playerName: string) {
  await openNetworkDialog(page);
  await page.waitForFunction(
    () => !!(
      window.NetworkMatchClient
      && window.NetworkMatchClient.joinRoom
    ),
    { timeout: 15000 }
  );
  await page.getByPlaceholder('名前を入力してください', { exact: true }).fill(playerName);
  await page.getByPlaceholder('部屋番号（3桁）', { exact: true }).fill(roomId);
  await page.getByRole('button', { name: '参加' }).click();
  await page.waitForFunction(
    () => !!(
      window.NetworkMatchClient
      && window.NetworkMatchClient.isActive
      && window.NetworkMatchClient.isActive()
      && window.NetworkMatchClient.getSeatKey
      && window.NetworkMatchClient.getSeatKey() === 'white'
    ),
    { timeout: 15000 }
  );
  await page.locator('#networkCloseBtn').click();
  await page.waitForSelector('#networkPlayerNameInput', { state: 'hidden', timeout: 10000 });
}

async function fillDebugHand(page: any) {
  return fillDebugHandForSeat(page, 'black');
}

async function fillDebugHandForSeat(page: any, seatKey: 'black' | 'white') {
  await page.waitForFunction(
    () => !!(
      typeof window.useSelectedCard === 'function'
      && window.cardState
    ),
    { timeout: 15000 }
  );
  await page.evaluate((playerKey) => {
    window.DEBUG_UNLIMITED_USAGE = true;
    window.DEBUG_HUMAN_VS_HUMAN = true;
    if (window.__uiImpl_turn_manager) {
      window.__uiImpl_turn_manager.DEBUG_UNLIMITED_USAGE = true;
      window.__uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN = true;
    }
    window.cardState.charge = window.cardState.charge || {};
    window.cardState.charge[playerKey] = 100;
    window.cardState.hasUsedCardThisTurnByPlayer = window.cardState.hasUsedCardThisTurnByPlayer || {};
    window.cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
    window.cardState.lastUsedCardByPlayer = window.cardState.lastUsedCardByPlayer || {};
    window.cardState.lastUsedCardByPlayer[playerKey] = null;
    window.isProcessing = false;
    window.isCardAnimating = false;
    window.VisualPlaybackActive = false;
    if (typeof window.renderCardUI === 'function') window.renderCardUI();
  }, seatKey);
  await page.waitForFunction(
    (playerKey) => Array.isArray(window.cardState && window.cardState.hands && window.cardState.hands[playerKey])
      && window.cardState.hands[playerKey].includes('gold_stone'),
    seatKey,
    { timeout: 15000 }
  );
}

async function usePlacementCard(page: any, cardId: string, row: number, col: number) {
  await useCard(page, 'black', cardId);
  await page.click(`.cell[data-row="${row}"][data-col="${col}"]`);
}

async function useCard(page: any, seatKey: 'black' | 'white', cardId: string) {
  await page.evaluate(({ selectedCardId, playerKey }) => {
    window.cardState.selectedCardId = selectedCardId;
    window.cardState.selectedCardOwnerKey = playerKey;
    if (typeof window.renderCardUI === 'function') window.renderCardUI();
    if (typeof window.useSelectedCard === 'function') window.useSelectedCard();
  }, { selectedCardId: cardId, playerKey: seatKey });
}

async function readCellState(page: any, row: number, col: number) {
  return page.evaluate(({ row: targetRow, col: targetCol }) => {
    const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    return {
      boardValue: window.gameState && window.gameState.board && window.gameState.board[targetRow]
        ? window.gameState.board[targetRow][targetCol]
        : null,
      hasDisc: !!disc,
      discClass: disc ? disc.className : '',
      pendingBlack: window.cardState && window.cardState.pendingEffectByPlayer
        ? window.cardState.pendingEffectByPlayer.black
        : null,
      busy: {
        processing: !!window.isProcessing,
        cardAnimating: !!window.isCardAnimating,
        playback: !!window.VisualPlaybackActive
      },
      currentPlayer: window.gameState ? window.gameState.currentPlayer : null,
      turnNumber: window.gameState ? window.gameState.turnNumber : null
    };
  }, { row, col });
}

async function getFirstLegalMove(page: any) {
  return page.evaluate(() => {
    const hintedCell = document.querySelector('.cell.legal');
    const hintedMove = hintedCell
      ? {
          row: Number(hintedCell.getAttribute('data-row')),
          col: Number(hintedCell.getAttribute('data-col'))
        }
      : null;
    const context = (
      window.CardLogic
      && typeof window.CardLogic.getCardContext === 'function'
    )
      ? window.CardLogic.getCardContext(window.cardState)
      : { protectedStones: [], permaProtectedStones: [] };
    const logicMoves = typeof window.getLegalMoves === 'function'
      ? window.getLegalMoves(window.gameState, context.protectedStones, context.permaProtectedStones)
      : [];
    const firstLogicMove = Array.isArray(logicMoves) && logicMoves.length > 0
      ? { row: Number(logicMoves[0].row), col: Number(logicMoves[0].col) }
      : null;
    return {
      hintedMove: hintedMove && Number.isInteger(hintedMove.row) && Number.isInteger(hintedMove.col)
        ? hintedMove
        : null,
      firstLogicMove: firstLogicMove && Number.isInteger(firstLogicMove.row) && Number.isInteger(firstLogicMove.col)
        ? firstLogicMove
        : null,
      logicMoveCount: Array.isArray(logicMoves) ? logicMoves.length : 0
    };
  });
}

async function readProliferationState(page: any) {
  return page.evaluate(() => {
    const markers = Array.isArray(window.cardState && window.cardState.markers)
      ? window.cardState.markers.filter((marker) => (
          marker
          && marker.data
          && marker.data.type === 'PROLIFERATION'
        )).map((marker) => ({
          row: Number(marker.row),
          col: Number(marker.col),
          owner: marker.owner,
          remainingOwnerTurns: marker.data.remainingOwnerTurns
        }))
      : [];
    return {
      currentPlayer: window.gameState ? window.gameState.currentPlayer : null,
      turnNumber: window.gameState ? window.gameState.turnNumber : null,
      pendingWhite: window.cardState && window.cardState.pendingEffectByPlayer
        ? window.cardState.pendingEffectByPlayer.white
        : null,
      busy: {
        processing: !!window.isProcessing,
        cardAnimating: !!window.isCardAnimating,
        playback: !!window.VisualPlaybackActive
      },
      markers,
      boardByMarker: markers.map((marker) => ({
        row: marker.row,
        col: marker.col,
        boardValue: window.gameState && window.gameState.board && window.gameState.board[marker.row]
          ? window.gameState.board[marker.row][marker.col]
          : null
      }))
    };
  });
}

describe('Network special cards E2E', () => {
  let staticServer: any;
  let matchServer: any;
  let browser: any;
  let staticPort: number;
  let matchPort: number;

  beforeAll(async () => {
    staticServer = startStaticServer(0);
    matchServer = startLocalMatchServer(0);
    await wait(500);
    staticPort = staticServer.address().port;
    matchPort = matchServer.address().port;
    browser = await chromium.launch();
  }, 40000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(matchServer);
    matchServer = null;
    await stopStaticServer(staticServer);
    staticServer = null;
  }, 40000);

  test('GOLD_STONE self-destroy settles to an empty cell on both network clients', async () => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;

    try {
      await hostPage.goto(appUrl);
      await guestPage.goto(appUrl);
      await waitForBootstrap(hostPage);
      await waitForBootstrap(guestPage);

      const roomId = await createDebugRoom(hostPage, '黒主');
      expect(roomId).toMatch(/^[A-Z0-9]{3}$/);

      await joinRoom(guestPage, roomId, '白主');
      await hostPage.waitForFunction(
        () => !!(
          window.NetworkMatchClient
          && window.NetworkMatchClient.getRoomSeats
          && window.NetworkMatchClient.getRoomSeats().white === true
        ),
        { timeout: 15000 }
      );

      await fillDebugHand(hostPage);
      await usePlacementCard(hostPage, 'gold_stone', 2, 3);

      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.gameState.board
          && window.gameState.board[2][3] === 0
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.gameState.board
          && window.gameState.board[2][3] === 0
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );

      const hostCell = await readCellState(hostPage, 2, 3);
      const guestCell = await readCellState(guestPage, 2, 3);

      expect(hostCell).toEqual(expect.objectContaining({
        boardValue: 0,
        hasDisc: false,
        pendingBlack: null,
        currentPlayer: -1
      }));
      expect(hostCell.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
      expect(guestCell).toEqual(expect.objectContaining({
        boardValue: 0,
        hasDisc: false,
        currentPlayer: -1
      }));
      expect(guestCell.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
    } finally {
      await stopPlaywrightPage(hostPage, 5000);
      await stopPlaywrightPage(guestPage, 5000);
      await hostContext.close().catch(() => undefined);
      await guestContext.close().catch(() => undefined);
    }
  }, 90000);

  test('BOARD_SHRINK_GOD keeps first target and completes second-stage direction selection', async () => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;

    try {
      await hostPage.goto(appUrl);
      await guestPage.goto(appUrl);
      await waitForBootstrap(hostPage);
      await waitForBootstrap(guestPage);

      const roomId = await createDebugRoom(hostPage, '黒主');
      await joinRoom(guestPage, roomId, '白主');
      await hostPage.waitForFunction(
        () => !!(
          window.NetworkMatchClient
          && window.NetworkMatchClient.getRoomSeats
          && window.NetworkMatchClient.getRoomSeats().white === true
        ),
        { timeout: 15000 }
      );

      await fillDebugHand(hostPage);
      await hostPage.evaluate(() => {
        window.cardState.selectedCardId = 'board_shrink_god_01';
        window.cardState.selectedCardOwnerKey = 'black';
        if (typeof window.renderCardUI === 'function') window.renderCardUI();
        if (typeof window.useSelectedCard === 'function') window.useSelectedCard();
      });

      await hostPage.click('.cell[data-row="0"][data-col="0"]');
      await hostPage.waitForFunction(
        () => !!(
          window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.black
          && window.cardState.pendingEffectByPlayer.black.type === 'BOARD_SHRINK_GOD'
          && window.cardState.pendingEffectByPlayer.black.firstTarget
          && window.cardState.pendingEffectByPlayer.black.firstTarget.row === 0
          && window.cardState.pendingEffectByPlayer.black.firstTarget.col === 0
        ),
        { timeout: 15000 }
      );
      const shrinkPendingDiagnostics = await hostPage.evaluate(() => {
        const playerKey = window.getPlayerKey ? window.getPlayerKey(window.gameState.currentPlayer) : 'black';
        const pending = window.cardState?.pendingEffectByPlayer?.[playerKey] ?? null;
        const selectableTargets = (
          window.CardLogic
          && typeof window.CardLogic.getSelectableTargets === 'function'
        )
          ? window.CardLogic.getSelectableTargets(window.cardState, window.gameState, playerKey)
          : null;
        const cell = document.querySelector('.cell[data-row="0"][data-col="1"]');
        const firstCell = document.querySelector('.cell[data-row="0"][data-col="0"]');
        return {
          currentPlayer: window.gameState?.currentPlayer ?? null,
          playerKey,
          seatKey: window.NetworkMatchClient?.getSeatKey?.() ?? null,
          matchMode: typeof window.getCurrentMatchMode === 'function'
            ? window.getCurrentMatchMode()
            : window.MATCH_MODE,
          selectionMode: !!document.querySelector('#board.selection-mode'),
          isProcessing: !!window.isProcessing,
          isCardAnimating: !!window.isCardAnimating,
          playbackActive: !!window.VisualPlaybackActive,
          pending,
          selectableTargets,
          firstCellClassName: firstCell ? firstCell.className : null,
          cellClassName: cell ? cell.className : null,
          directionHint: cell ? cell.getAttribute('data-board-shrink-god-direction-hint') : null,
        };
      });
      expect(shrinkPendingDiagnostics.selectionMode).toBe(true);
      expect(shrinkPendingDiagnostics.pending?.firstTarget).toEqual({ row: 0, col: 0 });
      expect(Array.isArray(shrinkPendingDiagnostics.selectableTargets)).toBe(true);
      expect(shrinkPendingDiagnostics.selectableTargets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 0, col: 1 }),
          expect.objectContaining({ row: 1, col: 0 })
        ])
      );
      await hostPage.waitForFunction(
        () => {
          const firstCell = document.querySelector('.cell[data-row="0"][data-col="0"]');
          const directionCell = document.querySelector('.cell[data-row="0"][data-col="1"]');
          return !!(
            firstCell
            && directionCell
            && /\beffect-target-highlight-positive\b/.test(firstCell.className)
            && /\bselectable-friendly\b/.test(directionCell.className)
            && directionCell.getAttribute('data-board-shrink-god-direction-hint') === 'right'
          );
        },
        { timeout: 15000 }
      );
      await hostPage.click('.cell[data-row="0"][data-col="1"]');
      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.black === null
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );

      const hostState = await hostPage.evaluate(() => ({
        pendingBlack: window.cardState.pendingEffectByPlayer.black,
        busy: {
          processing: !!window.isProcessing,
          cardAnimating: !!window.isCardAnimating,
          playback: !!window.VisualPlaybackActive
        },
        currentPlayer: window.gameState.currentPlayer,
        turnNumber: window.gameState.turnNumber
      }));
      const guestState = await guestPage.evaluate(() => ({
        pendingBlack: window.cardState.pendingEffectByPlayer.black,
        busy: {
          processing: !!window.isProcessing,
          cardAnimating: !!window.isCardAnimating,
          playback: !!window.VisualPlaybackActive
        },
        currentPlayer: window.gameState.currentPlayer,
        turnNumber: window.gameState.turnNumber
      }));

      expect(hostState.pendingBlack).toBeNull();
      expect(hostState.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
      expect(hostState.currentPlayer).toBe(1);
      expect(guestState.pendingBlack).toBeNull();
      expect(guestState.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
      expect(guestState.currentPlayer).toBe(1);
      expect(guestState.turnNumber).toBe(hostState.turnNumber);
    } finally {
      await stopPlaywrightPage(hostPage, 5000);
      await stopPlaywrightPage(guestPage, 5000);
      await hostContext.close().catch(() => undefined);
      await guestContext.close().catch(() => undefined);
    }
  }, 90000);

  test('GUARD_WILL settles and still allows the guarded player to place a normal move', async () => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;

    try {
      await hostPage.goto(appUrl);
      await guestPage.goto(appUrl);
      await waitForBootstrap(hostPage);
      await waitForBootstrap(guestPage);

      const roomId = await createDebugRoom(hostPage, '黒主');
      await joinRoom(guestPage, roomId, '白主');
      await hostPage.waitForFunction(
        () => !!(
          window.NetworkMatchClient
          && window.NetworkMatchClient.getRoomSeats
          && window.NetworkMatchClient.getRoomSeats().white === true
        ),
        { timeout: 15000 }
      );

      await fillDebugHand(hostPage);
      await hostPage.evaluate(() => {
        window.cardState.selectedCardId = 'guard_01';
        window.cardState.selectedCardOwnerKey = 'black';
        if (typeof window.renderCardUI === 'function') window.renderCardUI();
        if (typeof window.useSelectedCard === 'function') window.useSelectedCard();
      });

      await hostPage.click('.cell[data-row="3"][data-col="4"]');
      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.black === null
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
          && Array.isArray(window.cardState.markers)
          && window.cardState.markers.some((marker) => (
            marker
            && marker.row === 3
            && marker.col === 4
            && marker.data
            && marker.data.type === 'GUARD'
          ))
        ),
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.black === null
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
          && Array.isArray(window.cardState.markers)
          && window.cardState.markers.some((marker) => (
            marker
            && marker.row === 3
            && marker.col === 4
            && marker.data
            && marker.data.type === 'GUARD'
          ))
        ),
        { timeout: 20000 }
      );

      const firstLegalMove = await getFirstLegalMove(hostPage);
      expect(firstLegalMove.firstLogicMove).toEqual(expect.objectContaining({
        row: expect.any(Number),
        col: expect.any(Number)
      }));
      expect(firstLegalMove.logicMoveCount).toBeGreaterThan(0);

      const moveToPlay = firstLegalMove.hintedMove || firstLegalMove.firstLogicMove;
      await hostPage.click(`.cell[data-row="${moveToPlay.row}"][data-col="${moveToPlay.col}"]`);
      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
    } finally {
      await stopPlaywrightPage(hostPage, 5000);
      await stopPlaywrightPage(guestPage, 5000);
      await hostContext.close().catch(() => undefined);
      await guestContext.close().catch(() => undefined);
    }
  }, 90000);

  test('PROLIFERATION_WILL survives DESTROY_ONE_STONE and still hands off the turn on both network clients', async () => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;

    try {
      await hostPage.goto(appUrl);
      await guestPage.goto(appUrl);
      await waitForBootstrap(hostPage);
      await waitForBootstrap(guestPage);

      const roomId = await createDebugRoom(hostPage, '黒主');
      await joinRoom(guestPage, roomId, '白主');
      await hostPage.waitForFunction(
        () => !!(
          window.NetworkMatchClient
          && window.NetworkMatchClient.getRoomSeats
          && window.NetworkMatchClient.getRoomSeats().white === true
        ),
        { timeout: 15000 }
      );

      await fillDebugHandForSeat(hostPage, 'black');
      await fillDebugHandForSeat(guestPage, 'white');
      await usePlacementCard(hostPage, 'proliferation_01', 2, 3);

      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.gameState.board
          && window.gameState.board[2][3] === 1
          && Array.isArray(window.cardState && window.cardState.markers)
          && window.cardState.markers.some((marker) => (
            marker
            && marker.row === 2
            && marker.col === 3
            && marker.data
            && marker.data.type === 'PROLIFERATION'
          ))
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === -1
          && window.gameState.board
          && window.gameState.board[2][3] === 1
          && Array.isArray(window.cardState && window.cardState.markers)
          && window.cardState.markers.some((marker) => (
            marker
            && marker.row === 2
            && marker.col === 3
            && marker.data
            && marker.data.type === 'PROLIFERATION'
          ))
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );

      await useCard(guestPage, 'white', 'destroy_01');
      await guestPage.waitForFunction(
        () => !!(
          window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.white
          && window.cardState.pendingEffectByPlayer.white.type === 'DESTROY_ONE_STONE'
          && window.cardState.pendingEffectByPlayer.white.stage === 'selectTarget'
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
      await guestPage.click('.cell[data-row="2"][data-col="3"]');

      await hostPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.white === null
          && Array.isArray(window.cardState.markers)
          && window.cardState.markers.filter((marker) => (
            marker
            && marker.data
            && marker.data.type === 'PROLIFERATION'
          )).length >= 2
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        () => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.cardState
          && window.cardState.pendingEffectByPlayer
          && window.cardState.pendingEffectByPlayer.white === null
          && Array.isArray(window.cardState.markers)
          && window.cardState.markers.filter((marker) => (
            marker
            && marker.data
            && marker.data.type === 'PROLIFERATION'
          )).length >= 2
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { timeout: 20000 }
      );

      const hostState = await readProliferationState(hostPage);
      const guestState = await readProliferationState(guestPage);

      expect(hostState.pendingWhite).toBeNull();
      expect(hostState.currentPlayer).toBe(1);
      expect(hostState.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
      expect(hostState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 2, col: 3, owner: 'black' })
      ]));
      expect(hostState.markers.length).toBeGreaterThanOrEqual(2);
      expect(hostState.boardByMarker.every((entry: any) => entry.boardValue === 1)).toBe(true);

      expect(guestState.pendingWhite).toBeNull();
      expect(guestState.currentPlayer).toBe(1);
      expect(guestState.busy).toEqual({
        processing: false,
        cardAnimating: false,
        playback: false
      });
      expect(guestState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 2, col: 3, owner: 'black' })
      ]));
      expect(guestState.markers.length).toBeGreaterThanOrEqual(2);
      expect(guestState.boardByMarker.every((entry: any) => entry.boardValue === 1)).toBe(true);
      expect(guestState.turnNumber).toBe(hostState.turnNumber);
    } finally {
      await stopPlaywrightPage(hostPage, 5000);
      await stopPlaywrightPage(guestPage, 5000);
      await hostContext.close().catch(() => undefined);
      await guestContext.close().catch(() => undefined);
    }
  }, 90000);
});
