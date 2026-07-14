import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';

const RuntimeHelpers = require(path.join(process.cwd(), 'test', 'e2e', 'e2e-runtime-helpers.js'));
const OPTIONAL_GROUPS = ['gacha', 'cosmetic', 'leaderboard', 'commentary', 'cpu', 'onnx'] as const;
type OptionalGroup = typeof OPTIONAL_GROUPS[number];

interface FeatureProbe {
  group: OptionalGroup;
  requestedOptionalPayloads: string[];
  expectedPayloadRequests: number;
  opened?: boolean;
  reopened?: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  resourceErrors: string[];
}

const UI_FEATURES: Partial<Record<OptionalGroup, { button: string; panel: string; close: string }>> = {
  gacha: { button: '#gachaOpenBtn', panel: '#gachaOverlay', close: '#gachaCloseBtn' },
  cosmetic: { button: '#handSkinBtn', panel: '#handSkinPanel', close: '#handSkinCloseBtn' },
  leaderboard: { button: '#leaderboardOpenBtn', panel: '#leaderboardOverlay', close: '#leaderboardCloseBtn' }
};

function optionalPayloadGroupFromUrl(url: string): string {
  const match = String(url || '').match(/\/optional-(gacha|cosmetic|leaderboard|commentary|cpu|onnx)(?:-[^/?]+)?\.mjs(?:\?|$)/);
  return match ? match[1] : '';
}

function evaluateFeatureProbe(probe: FeatureProbe): string[] {
  const errors: string[] = [];
  const expected = probe.group;
  const wrong = probe.requestedOptionalPayloads.filter((group) => group !== expected);
  const expectedCount = probe.requestedOptionalPayloads.filter((group) => group === expected).length;
  if (wrong.length > 0) errors.push(`${expected} loaded unrelated optional payloads: ${wrong.join(', ')}`);
  if (expectedCount !== probe.expectedPayloadRequests) {
    errors.push(`${expected} payload request count ${expectedCount} != ${probe.expectedPayloadRequests}`);
  }
  if (probe.opened === false) errors.push(`${expected} first action did not open its UI`);
  if (probe.reopened === false) errors.push(`${expected} second action did not reopen its UI`);
  probe.pageErrors.forEach((error) => errors.push(`${expected} page error: ${error}`));
  probe.consoleErrors.forEach((error) => errors.push(`${expected} console error: ${error}`));
  probe.resourceErrors.forEach((error) => errors.push(`${expected} resource error: ${error}`));
  return errors;
}

async function waitForServer(server: any): Promise<number> {
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server did not expose a TCP port');
  return address.port;
}

async function openVitePage(browser: Browser, baseUrl: string): Promise<{
  context: BrowserContext;
  page: Page;
  requestedUrls: string[];
  pageErrors: string[];
  consoleErrors: string[];
  resourceErrors: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const requestedUrls: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const resourceErrors: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (!response.ok()) resourceErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${baseUrl}/?debug=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await RuntimeHelpers.closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => (
    (window as any).__uiInitialized === true
    && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
  ), null, { timeout: 30000 });
  const startupRegistryRequests = requestedUrls.filter((url) => url.includes('module-registry'));
  if (startupRegistryRequests.length > 0) {
    throw new Error(`compatibility registry loaded at Vite startup: ${startupRegistryRequests.join(', ')}`);
  }
  const startupOptional = requestedUrls.map(optionalPayloadGroupFromUrl).filter(Boolean);
  if (startupOptional.length > 0) {
    throw new Error(`optional payload loaded at Vite startup: ${startupOptional.join(', ')}`);
  }
  return { context, page, requestedUrls, pageErrors, consoleErrors, resourceErrors };
}

async function waitForPanel(page: Page, selector: string, open: boolean): Promise<void> {
  await page.waitForFunction(({ panelSelector, expectedOpen }) => {
    const panel = document.querySelector(panelSelector) as HTMLElement | null;
    if (!panel) return false;
    const isOpen = panel.getAttribute('aria-hidden') === 'false' || panel.classList.contains('is-open');
    return isOpen === expectedOpen;
  }, { panelSelector: selector, expectedOpen: open }, { timeout: 15000 });
}

async function clickDom(page: Page, selector: string): Promise<void> {
  await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector) as HTMLButtonElement | null;
    if (!target) throw new Error(`missing optional feature control: ${targetSelector}`);
    target.click();
  }, selector);
}

async function probeUiFeature(browser: Browser, baseUrl: string, group: OptionalGroup): Promise<FeatureProbe> {
  const runtime = await openVitePage(browser, baseUrl);
  const spec = UI_FEATURES[group];
  if (!spec) throw new Error(`missing UI feature probe: ${group}`);
  let stage = 'double-open';
  try {
    if (group === 'leaderboard') {
      await runtime.page.route('**/api/leaderboard/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ entries: [], updatedAt: 0 })
        });
      });
    }
    await runtime.page.evaluate(({ selector, doubleClick }) => {
      const button = document.querySelector(selector) as HTMLButtonElement | null;
      if (!button) throw new Error(`missing optional feature button: ${selector}`);
      button.click();
      if (doubleClick) button.click();
    }, { selector: spec.button, doubleClick: group !== 'leaderboard' });
    await waitForPanel(runtime.page, spec.panel, true);
    const opened = true;
    stage = 'close';
    await clickDom(runtime.page, spec.close);
    await waitForPanel(runtime.page, spec.panel, false);
    stage = 'reopen';
    await clickDom(runtime.page, spec.button);
    await waitForPanel(runtime.page, spec.panel, true);
    const reopened = true;
    await runtime.page.waitForTimeout(100);
    return {
      group,
      requestedOptionalPayloads: runtime.requestedUrls.map(optionalPayloadGroupFromUrl).filter(Boolean),
      expectedPayloadRequests: 1,
      opened,
      reopened,
      pageErrors: runtime.pageErrors,
      consoleErrors: runtime.consoleErrors,
      resourceErrors: runtime.resourceErrors
    };
  } catch (error) {
    throw new Error(`${group} ${stage} failed: ${error instanceof Error ? error.message : error}`);
  } finally {
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

async function probeRuntimeFeature(browser: Browser, baseUrl: string, group: OptionalGroup): Promise<FeatureProbe> {
  const runtime = await openVitePage(browser, baseUrl);
  try {
    await runtime.page.evaluate(async (featureGroup) => {
      const load = (window as any).loadLazyRuntimeGroup;
      if (typeof load !== 'function') throw new Error('loadLazyRuntimeGroup is unavailable');
      await Promise.all([load(featureGroup), load(featureGroup)]);
      await load(featureGroup);
    }, group);
    await runtime.page.waitForTimeout(100);
    return {
      group,
      requestedOptionalPayloads: runtime.requestedUrls.map(optionalPayloadGroupFromUrl).filter(Boolean),
      expectedPayloadRequests: 1,
      pageErrors: runtime.pageErrors,
      consoleErrors: runtime.consoleErrors,
      resourceErrors: runtime.resourceErrors
    };
  } finally {
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

async function probeFailureRetry(browser: Browser, baseUrl: string): Promise<FeatureProbe> {
  const runtime = await openVitePage(browser, baseUrl);
  let routedRequests = 0;
  const gachaPayloadPattern = /\/optional-gacha-[^/]+\.mjs(?:\?.*)?$/;
  await runtime.page.route(gachaPayloadPattern, async (route) => {
    routedRequests += 1;
    if (routedRequests === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    await clickDom(runtime.page, '#gachaOpenBtn');
    await runtime.page.waitForFunction(() => !!(
      (window as any).__CARD_REVERSI_VITE_OPTIONAL_LOADER__?.getLastError('gacha')
    ), null, { timeout: 10000 });
    const failedOpen = await runtime.page.$eval('#gachaOverlay', (panel) => (
      panel.getAttribute('aria-hidden') === 'false' || panel.classList.contains('is-open')
    ));
    await clickDom(runtime.page, '#gachaOpenBtn');
    await waitForPanel(runtime.page, '#gachaOverlay', true);
    await runtime.page.waitForTimeout(100);
    return {
      group: 'gacha',
      requestedOptionalPayloads: runtime.requestedUrls.map(optionalPayloadGroupFromUrl).filter(Boolean),
      expectedPayloadRequests: 2,
      opened: failedOpen === false,
      reopened: true,
      pageErrors: runtime.pageErrors,
      // The first rejected action is expected to report exactly one scoped console error.
      consoleErrors: runtime.consoleErrors.filter((error) => (
        !error.includes('[gacha] lazy runtime load failed')
        && !error.includes('Failed to load resource: net::ERR_FAILED')
      )),
      resourceErrors: runtime.resourceErrors.filter((error) => !error.includes('optional-gacha-'))
    };
  } finally {
    await runtime.page.unroute(gachaPayloadPattern).catch(() => undefined);
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

async function runBrowserOptionalFeatureSmoke(options: { log?: boolean } = {}): Promise<any> {
  const server = RuntimeHelpers.startStaticServer(0);
  let browser: Browser | null = null;
  try {
    const port = await waitForServer(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true });
    const probes: FeatureProbe[] = [];
    for (const group of ['gacha', 'cosmetic', 'leaderboard'] as OptionalGroup[]) {
      probes.push(await probeUiFeature(browser, baseUrl, group));
    }
    for (const group of ['commentary', 'cpu', 'onnx'] as OptionalGroup[]) {
      probes.push(await probeRuntimeFeature(browser, baseUrl, group));
    }
    const retryProbe = await probeFailureRetry(browser, baseUrl);
    const errors = probes.flatMap(evaluateFeatureProbe).concat(evaluateFeatureProbe(retryProbe));
    const report = { ok: errors.length === 0, errors, probes, retryProbe };
    if (options.log !== false) console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (browser) await RuntimeHelpers.stopPlaywrightBrowser(browser);
    await RuntimeHelpers.stopStaticServer(server);
  }
}

if (require.main === module) {
  runBrowserOptionalFeatureSmoke().then((report) => {
    if (!report.ok) {
      console.error(`[browser-optional-feature-smoke] failed: ${report.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-optional-feature-smoke] success');
  }).catch((error) => {
    console.error(`[browser-optional-feature-smoke] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  OPTIONAL_GROUPS,
  optionalPayloadGroupFromUrl,
  evaluateFeatureProbe,
  runBrowserOptionalFeatureSmoke
};
