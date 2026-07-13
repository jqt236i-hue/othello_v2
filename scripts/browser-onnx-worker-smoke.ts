import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';

const RuntimeHelpers = require(path.join(process.cwd(), 'test', 'e2e', 'e2e-runtime-helpers.js'));

interface LaneProbe {
  lane: 'classic' | 'vite' | 'vite-worker-fallback';
  digest: string;
  outputLength: number;
  selectedMove: { row: number; col: number } | null;
  windowOrt: boolean;
  mainThreadOrtScripts: number;
  workerExecutor: boolean;
  startupWorkerRequests: string[];
  startupOrtRequests: string[];
  workerRequests: string[];
  ortRequests: string[];
  clientStatus: Record<string, unknown> | null;
  pageErrors: string[];
  consoleErrors: string[];
  resourceErrors: string[];
}

async function waitForServer(server: any): Promise<number> {
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server did not expose a TCP port');
  return address.port;
}

function requestUrlsMatching(urls: string[], pattern: RegExp): string[] {
  return urls.filter((url) => pattern.test(url));
}

async function openLane(browser: Browser, baseUrl: string, lane: 'classic' | 'vite'): Promise<{
  context: BrowserContext;
  page: Page;
  requestedUrls: string[];
  pageErrors: string[];
  consoleErrors: string[];
  resourceErrors: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
  const entry = lane === 'vite' ? 'vite-dist/index.vite.html' : 'index.html';
  await page.goto(`${baseUrl}/${entry}?debug=1&othelloOnnx=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await RuntimeHelpers.closeMaintenanceNoticeIfPresent(page);
  try {
    await page.waitForFunction((expectedLane) => {
      if ((window as any).__uiInitialized !== true) return false;
      const bootState = document.documentElement.getAttribute('data-browser-boot-state');
      return expectedLane === 'classic' ? (bootState === null || bootState === 'ready') : bootState === 'ready';
    }, lane, { timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      uiInitialized: (window as any).__uiInitialized,
      bootState: document.documentElement.getAttribute('data-browser-boot-state')
    })).catch(() => ({ uiInitialized: null, bootState: null }));
    throw new Error(
      `${lane} boot did not become ready: ${JSON.stringify(state)}; ` +
      `pageErrors=${pageErrors.join(' | ')}; consoleErrors=${consoleErrors.join(' | ')}; ` +
      `cause=${error instanceof Error ? error.message : error}`
    );
  }
  return { context, page, requestedUrls, pageErrors, consoleErrors, resourceErrors };
}

async function runLane(
  browser: Browser,
  baseUrl: string,
  lane: 'classic' | 'vite',
  options: { blockWorker?: boolean } = {}
): Promise<LaneProbe> {
  const runtime = await openLane(browser, baseUrl, lane);
  const startupWorkerRequests = requestUrlsMatching(runtime.requestedUrls, /\/worker-entry-[^/]+\.js(?:\?|$)/);
  const startupOrtRequests = requestUrlsMatching(runtime.requestedUrls, /\/onnxruntime-web\/dist\/ort(?:\.webgpu)?\.min\.js(?:\?|$)/);
  try {
    const result = await runtime.page.evaluate(async ({ blockWorker }) => {
      const root = window as any;
      if (blockWorker) {
        Object.defineProperty(root, 'Worker', {
          configurable: true,
          value: function BlockedWorker() {
            throw new DOMException('Worker blocked by test policy', 'SecurityError');
          }
        });
      }
      if (typeof root.loadLazyRuntimeGroup !== 'function') throw new Error('loadLazyRuntimeGroup is unavailable');
      await root.loadLazyRuntimeGroup('onnx');
      if (typeof root.require !== 'function') throw new Error('browser module runtime is unavailable');
      const policyRuntime = root.require('game/ai/policy-onnx-runtime');
      if (!policyRuntime || typeof policyRuntime.loadFromUrl !== 'function') {
        throw new Error('policy ONNX runtime is unavailable');
      }
      policyRuntime.clearModel();
      policyRuntime.configure({
        enabled: true,
        minLevel: 6,
        enableWebGpuExecution: false,
        ortApi: root.ort || null
      });
      const modelUrl = new URL('data/models/policy-net.onnx', document.baseURI).href;
      const metaUrl = new URL('data/models/policy-net.onnx.meta.json', document.baseURI).href;
      let loaded = false;
      if (root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__) {
        loaded = await policyRuntime.loadFromUrl(modelUrl, metaUrl, window.fetch.bind(window));
      } else {
        const [modelResponse, metaResponse] = await Promise.all([
          window.fetch(modelUrl, { cache: 'no-store' }),
          window.fetch(metaUrl, { cache: 'no-store' })
        ]);
        if (!modelResponse.ok || !metaResponse.ok) throw new Error('classic ONNX fixture fetch failed');
        const modelBytes = new Uint8Array(await modelResponse.arrayBuffer());
        const meta = await metaResponse.json();
        const session = await root.ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
        policyRuntime.__setLoadedForTest(session, meta);
        loaded = true;
      }
      if (!loaded) {
        const status = policyRuntime.getStatus && policyRuntime.getStatus();
        const clientStatus = root.__CARD_REVERSI_CPU_WORKER_CLIENT__?.getStatus?.() || null;
        throw new Error(
          `policy ONNX model did not load: ${status && status.lastError || 'unknown error'}; ` +
          `client=${JSON.stringify(clientStatus)}`
        );
      }
      const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
      board[3][3] = -1;
      board[3][4] = 1;
      board[4][3] = 1;
      board[4][4] = -1;
      const candidateMoves = [
        { row: 2, col: 3 },
        { row: 3, col: 2 },
        { row: 4, col: 5 },
        { row: 5, col: 4 }
      ];
      const context = {
        board,
        playerKey: 'white',
        level: 6,
        legalMovesCount: candidateMoves.length,
        candidateMoves
      };
      const outputs = await policyRuntime.runInference(context);
      const tensor = outputs && (outputs.place_logits || outputs.logits || outputs[Object.keys(outputs)[0]]);
      if (!tensor || !(tensor.data instanceof Float32Array)) throw new Error('policy ONNX output is unavailable');
      const bytes = new Uint8Array(tensor.data.buffer, tensor.data.byteOffset, tensor.data.byteLength);
      const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const digest = Array.from(digestBytes).map((value) => value.toString(16).padStart(2, '0')).join('');
      const selected = await policyRuntime.chooseMove(candidateMoves, context);
      const selectedMove = selected && Number.isFinite(selected.row) && Number.isFinite(selected.col)
        ? { row: Number(selected.row), col: Number(selected.col) }
        : null;
      return {
        digest,
        outputLength: tensor.data.length,
        selectedMove,
        windowOrt: !!root.ort,
        workerExecutor: !!root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__,
        mainThreadOrtScripts: document.querySelectorAll('script[src*="onnxruntime-web/dist/ort"]').length,
        clientStatus: root.__CARD_REVERSI_CPU_WORKER_CLIENT__
          ? root.__CARD_REVERSI_CPU_WORKER_CLIENT__.getStatus()
          : null
      };
    }, { blockWorker: options.blockWorker === true });
    await runtime.page.waitForTimeout(100);
    return {
      lane: options.blockWorker ? 'vite-worker-fallback' : lane,
      ...result,
      startupWorkerRequests,
      startupOrtRequests,
      workerRequests: requestUrlsMatching(runtime.requestedUrls, /\/worker-entry-[^/]+\.js(?:\?|$)/),
      ortRequests: requestUrlsMatching(runtime.requestedUrls, /\/onnxruntime-web\/dist\/ort(?:\.webgpu)?\.min\.js(?:\?|$)/),
      pageErrors: runtime.pageErrors,
      consoleErrors: runtime.consoleErrors,
      resourceErrors: runtime.resourceErrors
    };
  } finally {
    await RuntimeHelpers.stopPlaywrightPage(runtime.page);
    await runtime.context.close().catch(() => undefined);
  }
}

function evaluateOnnxWorkerSmoke(classic: LaneProbe, vite: LaneProbe): string[] {
  const errors: string[] = [];
  if (classic.digest !== vite.digest) errors.push('classic/Vite ONNX output digest mismatch');
  if (classic.outputLength !== vite.outputLength) errors.push('classic/Vite ONNX output length mismatch');
  if (JSON.stringify(classic.selectedMove) !== JSON.stringify(vite.selectedMove)) {
    errors.push('classic/Vite selected move mismatch');
  }
  if (!classic.windowOrt) errors.push('classic lane did not expose the expected main-thread ORT API');
  if (!vite.workerExecutor) errors.push('Vite lane did not retain the ready Worker executor');
  if (vite.windowOrt) errors.push('Vite lane exposed ORT on the main thread');
  if (vite.mainThreadOrtScripts !== 0) errors.push('Vite lane appended a main-thread ORT script');
  if (vite.startupWorkerRequests.length !== 0) errors.push('Vite lane created its CPU Worker during startup');
  if (vite.startupOrtRequests.length !== 0) errors.push('Vite lane loaded ORT during startup');
  if (vite.workerRequests.length !== 1) errors.push(`Vite Worker request count ${vite.workerRequests.length} != 1`);
  if (vite.ortRequests.length !== 1) errors.push(`Vite Worker ORT request count ${vite.ortRequests.length} != 1`);
  if (!vite.clientStatus || Number(vite.clientStatus.workerCreatedCount) !== 1) {
    errors.push('Vite CPU Worker client did not report exactly one Worker');
  }
  if (!vite.clientStatus || Number(vite.clientStatus.pendingRequests) !== 0) {
    errors.push('Vite CPU Worker client retained pending requests');
  }
  for (const probe of [classic, vite]) {
    probe.pageErrors.forEach((error) => errors.push(`${probe.lane} page error: ${error}`));
    probe.consoleErrors.forEach((error) => errors.push(`${probe.lane} console error: ${error}`));
    probe.resourceErrors.forEach((error) => errors.push(`${probe.lane} resource error: ${error}`));
  }
  return errors;
}

function evaluateOnnxWorkerFallbackSmoke(classic: LaneProbe, fallback: LaneProbe): string[] {
  const errors: string[] = [];
  if (fallback.digest !== classic.digest) errors.push('Worker fallback/classic ONNX output digest mismatch');
  if (fallback.outputLength !== classic.outputLength) errors.push('Worker fallback/classic ONNX output length mismatch');
  if (JSON.stringify(fallback.selectedMove) !== JSON.stringify(classic.selectedMove)) {
    errors.push('Worker fallback/classic selected move mismatch');
  }
  if (!fallback.windowOrt) errors.push('Worker fallback did not load main-thread ORT');
  if (fallback.workerExecutor) errors.push('Worker fallback retained the unavailable Worker executor');
  if (fallback.mainThreadOrtScripts !== 1) {
    errors.push(`Worker fallback main-thread ORT script count ${fallback.mainThreadOrtScripts} != 1`);
  }
  if (fallback.workerRequests.length !== 0) {
    errors.push(`Worker fallback unexpectedly fetched ${fallback.workerRequests.length} Worker script(s)`);
  }
  if (fallback.ortRequests.length !== 1) {
    errors.push(`Worker fallback ORT request count ${fallback.ortRequests.length} != 1`);
  }
  if (fallback.clientStatus) errors.push('Worker fallback exposed a failed CPU Worker client');
  fallback.pageErrors.forEach((error) => errors.push(`${fallback.lane} page error: ${error}`));
  fallback.consoleErrors.forEach((error) => errors.push(`${fallback.lane} console error: ${error}`));
  fallback.resourceErrors.forEach((error) => errors.push(`${fallback.lane} resource error: ${error}`));
  return errors;
}

async function runBrowserOnnxWorkerSmoke(options: { log?: boolean } = {}): Promise<any> {
  const server = RuntimeHelpers.startStaticServer(0);
  let browser: Browser | null = null;
  try {
    const port = await waitForServer(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ headless: true });
    const classic = await runLane(browser, baseUrl, 'classic');
    const vite = await runLane(browser, baseUrl, 'vite');
    const fallback = await runLane(browser, baseUrl, 'vite', { blockWorker: true });
    const errors = evaluateOnnxWorkerSmoke(classic, vite).concat(
      evaluateOnnxWorkerFallbackSmoke(classic, fallback)
    );
    const report = { ok: errors.length === 0, errors, classic, vite, fallback };
    if (options.log !== false) console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (browser) await RuntimeHelpers.stopPlaywrightBrowser(browser);
    await RuntimeHelpers.stopStaticServer(server);
  }
}

if (require.main === module) {
  runBrowserOnnxWorkerSmoke().then((report) => {
    if (!report.ok) {
      console.error(`[browser-onnx-worker-smoke] failed: ${report.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-onnx-worker-smoke] success');
  }).catch((error) => {
    console.error(`[browser-onnx-worker-smoke] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  evaluateOnnxWorkerSmoke,
  evaluateOnnxWorkerFallbackSmoke,
  runBrowserOnnxWorkerSmoke
};
