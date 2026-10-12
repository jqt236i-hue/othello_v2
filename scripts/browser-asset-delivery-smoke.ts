import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';

const RuntimeHelpers = require(path.join(process.cwd(), 'test', 'e2e', 'e2e-runtime-helpers.js'));

interface BackgroundProbe {
  sourcePath: string;
  finalStyle: string;
  pngRequests: string[];
  webpRequests: string[];
}

function decodedPathname(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch (_error) {
    return String(url || '');
  }
}

async function waitForServer(server: any): Promise<number> {
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server did not expose a TCP port');
  return address.port;
}

async function openDefaultPage(browser: Browser, baseUrl: string): Promise<{
  context: BrowserContext;
  page: Page;
  requestedUrls: string[];
  pageErrors: string[];
  consoleErrors: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const requestedUrls: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await RuntimeHelpers.closeMaintenanceNoticeIfPresent(page);
  await page.waitForFunction(() => (
    (window as any).__uiInitialized === true
    && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
  ), null, { timeout: 30000 });
  await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready);
  return { context, page, requestedUrls, pageErrors, consoleErrors };
}

async function applyBackground(page: Page, sourcePath: string): Promise<string> {
  await page.evaluate((pathValue) => {
    const root = window as any;
    const codec = root.require('ui/assets/optimized-image-codec');
    const mapping = root.require('ui/assets/optimized-ui-images.generated').OPTIMIZED_UI_IMAGES;
    if (!codec || typeof codec.applyOptimizedImageWithFallback !== 'function' || !mapping[pathValue]) {
      throw new Error('default background image codec or mapping is unavailable');
    }
    const target = document.createElement('div');
    target.id = 'assetDeliveryBackgroundProbe';
    target.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:64px;z-index:-1;';
    document.body.appendChild(target);
    // Probe the remaining default's PNG/WebP pair without restoring retired skins.
    codec.applyOptimizedImageWithFallback(root, target.style, 'background-image', pathValue, mapping, { strictMime: false });
  }, sourcePath);
  await page.waitForFunction(() => {
    const target = document.getElementById('assetDeliveryBackgroundProbe');
    return !!target && /\.(?:webp|png)"?\)/.test(target.style.backgroundImage);
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  return page.$eval('#assetDeliveryBackgroundProbe', (target) => (target as HTMLElement).style.backgroundImage);
}

function summarizeBackgroundRequests(
  requestedUrls: string[],
  sourcePath: string,
  finalStyle: string
): BackgroundProbe {
  const sourceBase = path.posix.basename(sourcePath).replace(/\.png$/i, '');
  const matching = requestedUrls.filter((url) => decodedPathname(url).includes(`/${sourceBase}.`));
  return {
    sourcePath,
    finalStyle,
    pngRequests: matching.filter((url) => /\.png(?:\?|$)/i.test(url)),
    webpRequests: matching.filter((url) => /\.webp(?:\?|$)/i.test(url))
  };
}

async function runBackgroundSuccessProbe(browser: Browser, baseUrl: string): Promise<BackgroundProbe> {
  const runtime = await openDefaultPage(browser, baseUrl);
  const sourcePath = 'assets/images/background/デフォルト25.png';
  try {
    const finalStyle = await applyBackground(runtime.page, sourcePath);
    // The sole default is already loaded at boot; codec reuse must not require
    // a duplicate request. Include that original download in the success probe.
    return summarizeBackgroundRequests(runtime.requestedUrls, sourcePath, finalStyle);
  } finally {
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

async function runBackgroundFallbackProbe(browser: Browser, baseUrl: string): Promise<BackgroundProbe> {
  const runtime = await openDefaultPage(browser, baseUrl);
  const sourcePath = 'assets/images/background/デフォルト25.png';
  const webpPattern = /\/assets\/images\/background\/[^/]+\.webp(?:\?.*)?$/;
  await runtime.page.route(webpPattern, (route) => route.abort('failed'));
  try {
    const startIndex = runtime.requestedUrls.length;
    const finalStyle = await applyBackground(runtime.page, sourcePath);
    return summarizeBackgroundRequests(runtime.requestedUrls.slice(startIndex), sourcePath, finalStyle);
  } finally {
    await runtime.page.unroute(webpPattern).catch(() => undefined);
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

async function runBrowserAssetDeliverySmoke(options: { log?: boolean } = {}): Promise<any> {
  const server = RuntimeHelpers.startStaticServer(0);
  let browser: Browser | null = null;
  try {
    const port = await waitForServer(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true });
    const fontRuntime = await openDefaultPage(browser, baseUrl);
    const fontRequests = fontRuntime.requestedUrls.filter((url) => /\.(?:woff2|ttf)(?:\?|$)/i.test(url));
    const registryRequests = fontRuntime.requestedUrls.filter((url) => url.includes('module-registry'));
    const pageErrors = fontRuntime.pageErrors.slice();
    const consoleErrors = fontRuntime.consoleErrors.slice();
    await RuntimeHelpers.stopPlaywrightPage(fontRuntime.page);
    await fontRuntime.context.close().catch(() => undefined);

    const optimized = await runBackgroundSuccessProbe(browser, baseUrl);
    const fallback = await runBackgroundFallbackProbe(browser, baseUrl);
    const errors: string[] = [];
    if (!fontRequests.some((url) => /\.woff2(?:\?|$)/i.test(url))) errors.push('no WOFF2 font was requested');
    if (fontRequests.some((url) => /\.ttf(?:\?|$)/i.test(url))) errors.push('legacy TTF font was requested');
    if (registryRequests.length > 0) errors.push('Vite default requested a compatibility registry');
    if (!/\.webp"?\)/i.test(optimized.finalStyle)) errors.push(`optimized background did not settle on WebP: ${optimized.finalStyle}`);
    if (optimized.webpRequests.length < 1) errors.push('optimized background did not request WebP');
    if (optimized.pngRequests.length !== 0) errors.push(`optimized background requested PNG ${optimized.pngRequests.length} time(s)`);
    if (!/\.png"?\)/i.test(fallback.finalStyle)) errors.push(`failed WebP did not settle on PNG: ${fallback.finalStyle}`);
    if (fallback.pngRequests.length !== 1) errors.push(`PNG fallback request count ${fallback.pngRequests.length} != 1`);
    pageErrors.forEach((error) => errors.push(`page error: ${error}`));
    consoleErrors.forEach((error) => errors.push(`console error: ${error}`));
    const report = {
      ok: errors.length === 0,
      errors,
      fontRequests,
      registryRequests,
      optimized,
      fallback
    };
    if (options.log !== false) console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (browser) await RuntimeHelpers.stopPlaywrightBrowser(browser);
    await RuntimeHelpers.stopStaticServer(server);
  }
}

if (require.main === module) {
  runBrowserAssetDeliverySmoke().then((report) => {
    if (!report.ok) {
      console.error(`[browser-asset-delivery-smoke] failed: ${report.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-asset-delivery-smoke] success');
  }).catch((error) => {
    console.error(`[browser-asset-delivery-smoke] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  decodedPathname,
  summarizeBackgroundRequests,
  runBrowserAssetDeliverySmoke
};
