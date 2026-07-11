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
  closeMaintenanceNoticeIfPresent,
  closeSidePanelIfPresent
} = require('./e2e-runtime-helpers.js');

describe('Network special-card authority E2E', () => {
  let staticServer: any;
  let matchServer: any;
  let browser: any;
  let staticPort: number;
  let matchPort: number;

  beforeAll(async () => {
    staticServer = startStaticServer(0);
    matchServer = startLocalMatchServer(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    staticPort = staticServer.address().port;
    matchPort = matchServer.address().port;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await stopPlaywrightBrowser(browser, 10000);
    browser = null;
    await stopStaticServer(matchServer);
    matchServer = null;
    await stopStaticServer(staticServer);
    staticServer = null;
  }, 30000);

  test('a browser client cannot inject a special-card hand into a network room', async () => {
    const page = await browser.newPage();
    try {
      const appUrl = `http://127.0.0.1:${staticPort}/?debug=1&matchServer=http://127.0.0.1:${matchPort}`;
      const matchUrl = `http://127.0.0.1:${matchPort}`;
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await closeMaintenanceNoticeIfPresent(page);
      await page.waitForFunction(() => (
        !!(window as any).gameState
        && !!(window as any).cardState
        && !!(window as any).NetworkMatchClient
      ), null, { timeout: 15000 });
      await closeSidePanelIfPresent(page);

      const result = await page.evaluate(async (serverUrl) => {
        const root = window as any;
        const client = root.NetworkMatchClient;
        client.setServerUrl(serverUrl);
        const created = await client.createRoom({ serverUrl, playerName: 'authority-check' });
        if (!created || created.ok !== true) return { created };
        const before = Array.isArray(root.cardState?.hands?.black)
          ? root.cardState.hands.black.slice()
          : [];
        const publish = await client.publishSnapshot({
          actionType: 'debug_fill_hand',
          playbackEvents: [],
          action: { type: 'debug_fill_hand', playerKey: 'black', cardIds: ['gold_stone'] }
        });
        const after = Array.isArray(root.cardState?.hands?.black)
          ? root.cardState.hands.black.slice()
          : [];
        return { created, publish, before, after };
      }, matchUrl);

      expect(result.created).toEqual(expect.objectContaining({ ok: true }));
      expect(result.publish).toEqual(expect.objectContaining({
        ok: false,
        reason: 'NETWORK_DEBUG_DISABLED'
      }));
      expect(result.after).toEqual(result.before);
    } finally {
      await stopPlaywrightPage(page, 10000);
    }
  }, 30000);
});
