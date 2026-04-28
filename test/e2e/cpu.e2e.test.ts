import { chromium } from 'playwright';
import { startStaticServer, stopStaticServer, stopPlaywrightBrowser } from './e2e-runtime-helpers.js';

function startServer(port = 0) {
  return startStaticServer(port);
}

describe('CPU E2E', () => {
  let serverProc;
  let browser;
  let serverPort = null;
  beforeAll(async () => {
    serverProc = startServer(0); // request OS-assigned free port to avoid EADDRINUSE
    // give server time to start
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

  test('computeCpuAction returns a valid action object in browser', async () => {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${serverPort}/?debug=1`);
    // Wait for global computeCpuAction to be available
    await page.waitForFunction(() => typeof window.computeCpuAction === 'function');

    // Wait for the game state to be initialized (resetGame / init sequence)
    await page.waitForFunction(() => {
      try { return !!(window.gameState && Array.isArray(window.gameState.board) && window.gameState.board.length === 8); } catch (e) { return false; }
    }, { timeout: 10000 });

    // Poll until computeCpuAction returns an action with an expected type (avoids race where internals not initialized yet)
    await page.waitForFunction(() => {
      try {
        const a = window.computeCpuAction && window.computeCpuAction('white');
        return a && (['move','useCard','pass'].indexOf(a.type) !== -1);
      } catch (e) { return false; }
    }, { timeout: 10000 });

    const action = await page.evaluate(() => {
      try { return window.computeCpuAction('white'); } catch (e) { return { error: String(e && e.message) }; }
    });

    expect(action).toBeDefined();
    expect(['move','useCard','pass']).toContain(action.type);
  }, 20000);
});
