import { chromium, firefox, webkit, type Browser } from 'playwright';
import {
  startStaticServer, stopStaticServer, stopPlaywrightBrowser,
  closeMaintenanceNoticeIfPresent
} from './e2e-runtime-helpers.js';

describe.each([['Chromium', chromium], ['Firefox', firefox], ['WebKit', webkit]] as const)('%s board size keyboard input E2E', (_name, browserType) => {
  let server: ReturnType<typeof startStaticServer>;
  let browser: Browser;
  let port: number;

  beforeAll(async () => {
    server = startStaticServer(0);
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    port = address.port;
    browser = await browserType.launch();
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser);
    await stopStaticServer(server);
  }, 30000);

  test.each(['local', 'network'])('%s dimensions accept 10 and 12 typed one digit at a time', async (mode) => {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await closeMaintenanceNoticeIfPresent(page);
      await page.waitForFunction(() => document.documentElement.getAttribute('data-browser-boot-state') === 'ready');
      if (mode === 'local') {
        await page.locator('#sidePanelToggleBtn').click();
        await page.locator('#boardSizeOpenBtn').click();
      } else {
        await page.locator('#modeNetworkBtn').click();
        await page.locator('#networkRoomSettingsBtn').click();
      }
      const prefix = mode === 'local' ? 'boardSize' : 'networkBoardSize';

      for (const [axis, value] of [['Rows', '10'], ['Cols', '12']]) {
        const input = page.locator(`#${prefix}${axis}Input`);
        await input.fill('');
        expect(await input.inputValue()).toBe('');
        await input.pressSequentially(value);
        await input.press('Tab');
        expect(await input.inputValue()).toBe(value);
      }
      if (mode === 'local') {
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.locator('#resetBtn').click();
        await page.waitForFunction(() => {
          const root = window as any;
          return root.gameState?.board?.length === 10 && root.gameState.board[0]?.length === 12;
        }, undefined, { timeout: 10000 });
      }
      expect(pageErrors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30000);
});

