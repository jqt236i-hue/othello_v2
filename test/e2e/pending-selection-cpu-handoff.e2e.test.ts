import { chromium } from 'playwright';

declare const require: any;
declare const describe: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const test: any;
declare const expect: any;

const {
  startStaticServer,
  stopStaticServer,
  stopPlaywrightBrowser,
  stopPlaywrightPage
} = require('./e2e-runtime-helpers.js');

const BLACK = 1;

const END_TURN_CASES = [
  { label: 'SWAP_WITH_ENEMY', cardId: 'swap_01', row: 3, col: 3 },
  { label: 'TRAP_WILL', cardId: 'trap_01', row: 3, col: 4 }
];

function waitForServer(server: any) {
  return new Promise((resolve) => server.on('listening', resolve));
}

async function openDebugPage(browser: any, port: number) {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/?debug=1&noanim=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  });
  await page.waitForFunction(
    () => !!(window.gameState && window.cardState && typeof window.useSelectedCard === 'function'),
    null,
    { timeout: 15000 }
  );
  return page;
}

async function installStandardDebugState(page: any, cardId: string, humanVsHuman: boolean) {
  await page.evaluate(({ selectedCardId, hvh }) => {
    const BLACK_VALUE = 1;
    const WHITE_VALUE = -1;
    window.CPU_TURN_DELAY_MS = 0;
    window.DEBUG_UNLIMITED_USAGE = true;
    window.DEBUG_HUMAN_VS_HUMAN = hvh === true;
    window.MATCH_MODE = 'cpu';
    for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
      window[key] = window[key] || {};
      window[key].DEBUG_UNLIMITED_USAGE = true;
      window[key].DEBUG_HUMAN_VS_HUMAN = hvh === true;
      window[key].MATCH_MODE = 'cpu';
      window[key].CPU_TURN_DELAY_MS = 0;
    }

    window.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    window.gameState.board[3][3] = WHITE_VALUE;
    window.gameState.board[3][4] = BLACK_VALUE;
    window.gameState.board[4][3] = BLACK_VALUE;
    window.gameState.board[4][4] = WHITE_VALUE;
    window.gameState.currentPlayer = BLACK_VALUE;
    window.gameState.turnNumber = 1;
    window.gameState.consecutivePasses = 0;
    window.gameState.gameOver = false;

    window.cardState.hands = { black: [selectedCardId], white: [] };
    window.cardState.decks = { black: [], white: [] };
    window.cardState.discard = [];
    window.cardState.charge = { black: 99, white: 99 };
    window.cardState.selectedCardId = selectedCardId;
    window.cardState.selectedCardOwnerKey = 'black';
    window.cardState.pendingEffectByPlayer = { black: null, white: null };
    window.cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
    window.cardState.lastUsedCardByPlayer = { black: null, white: null };
    window.cardState.turnIndex = 1;

    window.isProcessing = false;
    window.isCardAnimating = false;
    window.VisualPlaybackActive = false;
    if (typeof window.renderBoard === 'function') window.renderBoard();
    if (typeof window.renderCardUI === 'function') window.renderCardUI();
  }, { selectedCardId: cardId, hvh: humanVsHuman });
}

async function useSelectedCardAndClickTarget(page: any, pendingType: string, row: number, col: number) {
  await page.evaluate(() => {
    window.useSelectedCard();
    return true;
  });
  await page.waitForFunction((type) => {
    const pending = window.cardState
      && window.cardState.pendingEffectByPlayer
      && window.cardState.pendingEffectByPlayer.black;
    return pending && pending.type === type;
  }, pendingType, { timeout: 5000 });
  await page.click(`.cell[data-row="${row}"][data-col="${col}"]`, { timeout: 5000 });
}

async function readRuntimeState(page: any) {
  return page.evaluate(() => ({
    currentPlayer: window.gameState.currentPlayer,
    turnNumber: window.gameState.turnNumber,
    pending: window.cardState.pendingEffectByPlayer,
    busy: {
      processing: !!window.isProcessing,
      cardAnimating: !!window.isCardAnimating,
      playback: !!window.VisualPlaybackActive
    },
    cell33: window.gameState.board[3][3],
    blackCount: window.gameState.board.flat().filter((value) => value === 1).length,
    whiteCount: window.gameState.board.flat().filter((value) => value === -1).length
  }));
}

describe('pending selection CPU handoff E2E', () => {
  let server: any;
  let browser: any;
  let port: number;

  beforeAll(async () => {
    server = startStaticServer(0);
    await waitForServer(server);
    port = server.address().port;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser);
    await stopStaticServer(server);
  }, 30000);

  test.each(END_TURN_CASES)('$label returns to black after white CPU handoff', async ({ label, cardId, row, col }) => {
    const page = await openDebugPage(browser, port);
    try {
      await installStandardDebugState(page, cardId, false);
      await useSelectedCardAndClickTarget(page, label, row, col);

      await page.waitForFunction(
        () => window.gameState
          && window.gameState.currentPlayer === BLACK
          && Number(window.gameState.turnNumber || 0) >= 3,
        null,
        { timeout: 10000 }
      );

      const state = await readRuntimeState(page);
      expect(state.currentPlayer).toBe(BLACK);
      expect(state.turnNumber).toBeGreaterThanOrEqual(3);
      expect(state.pending).toEqual({ black: null, white: null });
      expect(state.busy).toEqual({ processing: false, cardAnimating: false, playback: false });
      expect(state.whiteCount).toBeGreaterThan(0);
    } finally {
      await stopPlaywrightPage(page);
    }
  }, 30000);

  test('DESTROY_ONE_STONE clears pending and keeps the placement turn', async () => {
    const page = await openDebugPage(browser, port);
    try {
      await installStandardDebugState(page, 'destroy_01', true);
      await useSelectedCardAndClickTarget(page, 'DESTROY_ONE_STONE', 3, 3);

      await page.waitForFunction(
        () => window.gameState
          && window.gameState.currentPlayer === BLACK
          && window.gameState.turnNumber === 1
          && window.gameState.board[3][3] === 0
          && !window.cardState.pendingEffectByPlayer.black
          && !window.isProcessing
          && !window.isCardAnimating,
        null,
        { timeout: 8000 }
      );

      const state = await readRuntimeState(page);
      expect(state.currentPlayer).toBe(BLACK);
      expect(state.turnNumber).toBe(1);
      expect(state.cell33).toBe(0);
      expect(state.pending).toEqual({ black: null, white: null });
      expect(state.busy).toEqual({ processing: false, cardAnimating: false, playback: false });
    } finally {
      await stopPlaywrightPage(page);
    }
  }, 30000);
});
