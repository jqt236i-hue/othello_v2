import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import {
  DEFAULT_STATIC_ASSET_CACHE_CONTROL,
  loadStaticAssetHeaders,
  resolveStaticAssetHeaders
} from './static-asset-headers';

const ROOT = process.cwd();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join('; ');

function mimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.wasm': return 'application/wasm';
    case '.woff2': return 'font/woff2';
    case '.webp': return 'image/webp';
    case '.png': return 'image/png';
    case '.svg': return 'image/svg+xml';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.onnx': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

// Production serves files through Workers Static Assets: the root _headers
// rules apply by path, and every other file gets the platform default.
const STATIC_ASSET_HEADER_RULES = loadStaticAssetHeaders(ROOT);

function cacheControl(pathname: string): string {
  return resolveStaticAssetHeaders(STATIC_ASSET_HEADER_RULES, pathname)['cache-control']
    || DEFAULT_STATIC_ASSET_CACHE_CONTROL;
}

function isRevalidated(value: string): boolean {
  return /\bno-cache\b/.test(value) || (/\bmax-age=0\b/.test(value) && /\bmust-revalidate\b/.test(value));
}

function resolveRequestFile(requestUrl: string): { filePath: string; pathname: string; url: URL } | null {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.resolve(ROOT, `.${pathname.replace(/\//g, path.sep)}`);
  const rootPrefix = `${path.resolve(ROOT)}${path.sep}`;
  if (filePath !== path.resolve(ROOT, 'index.html') && !filePath.startsWith(rootPrefix)) return null;
  return { filePath, pathname, url };
}

function createProductionLikeServer(): http.Server {
  return http.createServer((request, response) => {
    const resolved = resolveRequestFile(request.url || '/');
    if (!resolved || !fs.existsSync(resolved.filePath) || !fs.statSync(resolved.filePath).isFile()) {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Security-Policy': CSP,
        'Cache-Control': 'no-cache, must-revalidate'
      });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeType(resolved.filePath),
      'Content-Security-Policy': CSP,
      'Cache-Control': cacheControl(resolved.pathname),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(resolved.filePath).pipe(response);
  });
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('production-like server did not expose a port');
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function exerciseWorkerWasm(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const root = window as any;
    await root.loadLazyRuntimeGroup('onnx');
    if (!root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__) {
      throw new Error('ONNX Worker executor was not installed under CSP');
    }
    const runtime = root.require('game/ai/policy-onnx-runtime');
    if (!runtime || typeof runtime.loadFromUrl !== 'function') {
      throw new Error('policy ONNX runtime is unavailable under CSP');
    }
    runtime.clearModel();
    runtime.configure({ enabled: true, minLevel: 6, enableWebGpuExecution: false });
    const loaded = await runtime.loadFromUrl(
      new URL('data/models/policy-net.onnx', document.baseURI).href,
      new URL('data/models/policy-net.onnx.meta.json', document.baseURI).href,
      window.fetch.bind(window)
    );
    if (!loaded) {
      const status = typeof runtime.getStatus === 'function' ? runtime.getStatus() : null;
      throw new Error(`policy ONNX model did not load under CSP: ${JSON.stringify(status)}`);
    }
    return {
      executor: true,
      runtimeStatus: typeof runtime.getStatus === 'function' ? runtime.getStatus() : null,
      capabilities: root.__CARD_REVERSI_BROWSER_CAPABILITIES__ || null
    };
  });
}

async function waitForProductionReady(
  page: Page,
  backend: 'dom' | 'pixi',
  pageErrors: string[],
  consoleErrors: string[]
): Promise<void> {
  try {
    await page.waitForFunction(() => (
      (window as any).__uiInitialized === true
      && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
    ), null, { timeout: 30000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const root = window as any;
      return {
        uiInitialized: root.__uiInitialized === true,
        bootState: document.documentElement.getAttribute('data-browser-boot-state'),
        bootError: document.getElementById('browserViteBootError')?.textContent || '',
        metrics: root.__CARD_REVERSI_BROWSER_METRICS__ || null,
        capabilities: root.__CARD_REVERSI_BROWSER_CAPABILITIES__ || null,
        pixiPreload: root.__CARD_REVERSI_PIXI_PRELOAD_STATE__ || null,
        cspViolations: root.__deliveryCspViolations || []
      };
    }).catch((diagnosticError) => ({ diagnosticError: String(diagnosticError) }));
    throw new Error([
      `${backend} production UI did not become ready`,
      error instanceof Error ? error.message : String(error),
      `diagnostics=${JSON.stringify(diagnostics)}`,
      `pageErrors=${JSON.stringify(pageErrors.filter((entry) => entry.startsWith(`${backend}:`)))}`,
      `consoleErrors=${JSON.stringify(consoleErrors.filter((entry) => entry.startsWith(`${backend}:`)))}`
    ].join('; '));
  }
}

async function runBrowserProductionDeliverySmoke(options: { log?: boolean } = {}): Promise<any> {
  const server = createProductionLikeServer();
  let browser: Browser | null = null;
  try {
    const baseUrl = await listen(server);
    browser = await chromium.launch({ headless: true });
    const violations: any[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const responses: any[] = [];
    const backendProbes: any[] = [];
    let workerWasm: any = null;
    for (const backend of ['dom', 'pixi'] as const) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(() => {
        (window as any).__deliveryCspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          (window as any).__deliveryCspViolations.push({
            blockedURI: event.blockedURI,
            violatedDirective: event.violatedDirective,
            effectiveDirective: event.effectiveDirective
          });
        });
      });
      page.on('pageerror', (error) => pageErrors.push(`${backend}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(`${backend}: ${message.text()}`);
      });
      page.on('response', (response) => {
        const url = response.url();
        const responsePathname = new URL(url).pathname;
        if (/\.(?:html|js|mjs|css|wasm|woff2|webp)(?:\?|$)/i.test(url) || responsePathname === '/') {
          responses.push({
            backend,
            url,
            status: response.status(),
            contentType: response.headers()['content-type'] || '',
            cacheControl: response.headers()['cache-control'] || '',
            csp: response.headers()['content-security-policy'] || ''
          });
        }
      });
      await page.goto(`${baseUrl}/?debug=1&boardRenderer=${backend}&noanim=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForProductionReady(page, backend, pageErrors, consoleErrors);
      const backendProbe = await page.evaluate(() => {
        const root = window as any;
        const diagnostics = root.__boardVisualDebug?.getBackendDiagnostics?.() || {};
        return {
          backend: root.__boardVisualDebug?.getBackendKind?.() || null,
          canvasCount: Number(diagnostics.canvasCount || 0),
          contextCount: Number(diagnostics.contextCount || 0),
          domCellCount: Number(diagnostics.domCellCount || 0),
          harnessGlobalPresent: Object.prototype.hasOwnProperty.call(root, '__boardPerfHarness'),
          controlsPresent: !!document.querySelector('[data-board-perf-controls], #board-performance-controls')
        };
      });
      backendProbes.push({ expected: backend, ...backendProbe });
      if (backend === 'pixi') workerWasm = await exerciseWorkerWasm(page);
      await page.waitForTimeout(250);
      violations.push(...await page.evaluate(() => (window as any).__deliveryCspViolations || []));
      await page.close();
    }

    const errors: string[] = [];
    const documentResponse = responses.find((entry) => new URL(entry.url).pathname === '/');
    if (!documentResponse || documentResponse.csp !== CSP) errors.push('default document did not receive the production CSP');
    if (!documentResponse || !isRevalidated(documentResponse.cacheControl)) errors.push('default HTML is not revalidated');
    const hashedAssets = responses.filter((entry) => /\/vite-dist\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[A-Za-z0-9]+(?:\?|$)/i.test(entry.url));
    if (hashedAssets.length === 0) errors.push('no hashed Vite assets were observed');
    if (hashedAssets.some((entry) => !entry.cacheControl.includes('immutable'))) errors.push('a hashed Vite asset was not immutable');
    const cssResponses = responses.filter((entry) => /\.css\?v=\d+$/i.test(entry.url));
    if (cssResponses.length === 0) errors.push('no versioned CSS response was observed');
    if (!cssResponses.some((entry) => entry.cacheControl.includes('immutable'))) errors.push('no versioned CSS response was immutable');
    const unversioned = responses.filter((entry) => !/\?v=\d+$/.test(entry.url)
      && !new URL(entry.url).pathname.startsWith('/vite-dist/assets/'));
    if (unversioned.some((entry) => entry.cacheControl.includes('immutable'))) errors.push('an unversioned response was immutable');
    const moduleResponses = responses.filter((entry) => /\.(?:js|mjs)(?:\?|$)/i.test(entry.url));
    if (moduleResponses.some((entry) => !entry.contentType.startsWith('text/javascript'))) errors.push('a JavaScript module has the wrong MIME type');
    const wasmResponses = responses.filter((entry) => /\.wasm(?:\?|$)/i.test(entry.url));
    if (wasmResponses.length === 0) errors.push('ONNX Worker did not request a WASM runtime');
    if (wasmResponses.some((entry) => entry.contentType !== 'application/wasm')) errors.push('a WASM response has the wrong MIME type');
    if (violations.length > 0) errors.push(`CSP violations: ${JSON.stringify(violations)}`);
    for (const probe of backendProbes) {
      if (probe.backend !== probe.expected) errors.push(`${probe.expected} production delivery selected ${probe.backend}`);
      if (probe.expected === 'pixi' && (probe.canvasCount !== 1 || probe.contextCount !== 1 || probe.domCellCount !== 0)) {
        errors.push('Pixi production delivery did not keep an exclusive one-context canvas surface');
      }
      if (probe.expected === 'dom' && (probe.canvasCount !== 0 || probe.domCellCount !== 64)) {
        errors.push('DOM production delivery did not keep an exclusive 64-cell board surface');
      }
      if (probe.harnessGlobalPresent || probe.controlsPresent) errors.push(`${probe.expected} normal production delivery leaked performance harness state`);
    }
    pageErrors.forEach((error) => errors.push(`page error: ${error}`));
    consoleErrors.forEach((error) => errors.push(`console error: ${error}`));
    const report = { ok: errors.length === 0, errors, workerWasm, backendProbes, violations, responses };
    if (options.log !== false) console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await closeServer(server);
  }
}

if (require.main === module) {
  runBrowserProductionDeliverySmoke().then((report) => {
    if (!report.ok) {
      console.error(`[browser-production-delivery-smoke] failed: ${report.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-production-delivery-smoke] success');
  }).catch((error) => {
    console.error(`[browser-production-delivery-smoke] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  CSP,
  cacheControl,
  mimeType,
  resolveRequestFile,
  runBrowserProductionDeliverySmoke
};
