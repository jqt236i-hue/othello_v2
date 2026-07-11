import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser } from 'playwright';

const DEFAULT_NETWORK_MODE_READY_BUDGET_MS = 15000;
const OPTIONAL_REGISTRY_NAME = 'module-registry.optional.js';
const ONNX_RUNTIME_PATH_FRAGMENT = 'onnxruntime-web/dist/ort.min.js';

interface BootModuleMetadata {
  required: string[];
  optional: string[];
  optionalPrefixes?: string[];
}

interface BootRegistryMetrics {
  moduleRegistryBytes: number;
  optionalRegistryBytes: number;
  combinedRegistryBytes: number;
  requiredBootModuleCount: number;
  optionalBootModuleCount: number;
  combinedBootModuleCount: number;
}

interface BootPerformanceSample extends BootRegistryMetrics {
  optionalRegistryLoadedAtStartup: boolean;
  onnxScriptLoadedAtStartup: boolean;
  networkModeReadyMs: number;
}

interface BootPerformanceEvaluationOptions {
  networkModeReadyBudgetMs?: number;
}

interface BootPerformanceEvaluation {
  ok: boolean;
  errors: string[];
}

interface BrowserBootPerformanceCheckOptions {
  rootDir?: string;
  networkModeReadyBudgetMs?: number;
  launch?: typeof chromium.launch;
  log?: boolean;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function extractBootModuleMetadataFromRegistryText(text: string): BootModuleMetadata {
  const source = String(text || '');
  const marker = 'window.__CARD_REVERSI_BOOT_MODULES__';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return { required: [], optional: [], optionalPrefixes: [] };
  }
  const equalsIndex = source.indexOf('=', markerIndex + marker.length);
  if (equalsIndex < 0) {
    return { required: [], optional: [], optionalPrefixes: [] };
  }
  const semicolonIndex = source.indexOf(';', equalsIndex + 1);
  if (semicolonIndex < 0) {
    return { required: [], optional: [], optionalPrefixes: [] };
  }
  try {
    const parsed = JSON.parse(source.slice(equalsIndex + 1, semicolonIndex).trim());
    return {
      required: normalizeList(parsed && parsed.required),
      optional: normalizeList(parsed && parsed.optional),
      optionalPrefixes: normalizeList(parsed && parsed.optionalPrefixes)
    };
  } catch (_error) {
    return { required: [], optional: [], optionalPrefixes: [] };
  }
}

function uniqueCount(values: string[]): number {
  return new Set(normalizeList(values)).size;
}

function computeRegistryMetricsFromTexts(startupRegistryText: string, optionalRegistryText: string): BootRegistryMetrics {
  const startupMetadata = extractBootModuleMetadataFromRegistryText(startupRegistryText);
  const optionalMetadata = extractBootModuleMetadataFromRegistryText(optionalRegistryText);
  return {
    moduleRegistryBytes: Buffer.byteLength(String(startupRegistryText || ''), 'utf8'),
    optionalRegistryBytes: Buffer.byteLength(String(optionalRegistryText || ''), 'utf8'),
    combinedRegistryBytes: Buffer.byteLength(String(startupRegistryText || ''), 'utf8')
      + Buffer.byteLength(String(optionalRegistryText || ''), 'utf8'),
    requiredBootModuleCount: uniqueCount(startupMetadata.required),
    optionalBootModuleCount: uniqueCount(optionalMetadata.optional),
    combinedBootModuleCount: uniqueCount(startupMetadata.required) + uniqueCount(optionalMetadata.optional)
  };
}

function readRegistryMetrics(rootDir?: string): BootRegistryMetrics {
  const repoRoot = path.resolve(rootDir || process.cwd());
  const startupRegistryPath = path.join(repoRoot, 'public', 'module-registry.js');
  const optionalRegistryPath = path.join(repoRoot, 'public', OPTIONAL_REGISTRY_NAME);
  const startupRegistryText = fs.readFileSync(startupRegistryPath, 'utf8');
  const optionalRegistryText = fs.existsSync(optionalRegistryPath)
    ? fs.readFileSync(optionalRegistryPath, 'utf8')
    : '';
  return computeRegistryMetricsFromTexts(startupRegistryText, optionalRegistryText);
}

function evaluateBootPerformanceSample(
  sample: BootPerformanceSample,
  options?: BootPerformanceEvaluationOptions
): BootPerformanceEvaluation {
  const errors: string[] = [];
  const readyBudget = Number.isFinite(Number(options && options.networkModeReadyBudgetMs))
    ? Number(options && options.networkModeReadyBudgetMs)
    : DEFAULT_NETWORK_MODE_READY_BUDGET_MS;

  if (!Number.isFinite(sample.moduleRegistryBytes) || sample.moduleRegistryBytes <= 0) {
    errors.push('startup registry is missing or empty');
  }
  if (!Number.isFinite(sample.optionalRegistryBytes) || sample.optionalRegistryBytes <= 0) {
    errors.push('optional registry is missing or empty');
  }
  if (Number.isFinite(sample.combinedRegistryBytes)
      && sample.combinedRegistryBytes > 0
      && Number.isFinite(sample.moduleRegistryBytes)
      && sample.moduleRegistryBytes >= sample.combinedRegistryBytes) {
    errors.push('startup registry is not smaller than the combined split registry');
  }
  if (!Number.isFinite(sample.requiredBootModuleCount) || sample.requiredBootModuleCount <= 0) {
    errors.push('required boot module metadata is missing');
  }
  if (!Number.isFinite(sample.optionalBootModuleCount) || sample.optionalBootModuleCount <= 0) {
    errors.push('optional boot module metadata is missing');
  }
  if (Number.isFinite(sample.combinedBootModuleCount)
      && sample.combinedBootModuleCount > 0
      && Number.isFinite(sample.requiredBootModuleCount)
      && sample.requiredBootModuleCount >= sample.combinedBootModuleCount) {
    errors.push('required boot module count is not smaller than the combined split module count');
  }
  if (sample.optionalRegistryLoadedAtStartup === true) {
    errors.push('optional registry was loaded during startup');
  }
  if (sample.onnxScriptLoadedAtStartup === true) {
    errors.push('ONNX runtime was loaded during startup');
  }
  if (!Number.isFinite(sample.networkModeReadyMs) || sample.networkModeReadyMs < 0) {
    errors.push('network mode readiness time is invalid');
  } else if (sample.networkModeReadyMs > readyBudget) {
    errors.push(`network mode readiness exceeded ${readyBudget}ms: ${sample.networkModeReadyMs}ms`);
  }

  return { ok: errors.length === 0, errors };
}

function resolveMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.onnx') return 'application/octet-stream';
  return 'application/octet-stream';
}

function createStaticServer(rootDir: string): http.Server {
  const normalizedRoot = path.resolve(rootDir);
  return http.createServer((req, res) => {
    const rawPath = String((req && req.url) || '/').split('?')[0] || '/';
    let decoded = '/index.html';
    try {
      decoded = decodeURIComponent(rawPath === '/' ? '/index.html' : rawPath);
    } catch (_error) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    const filePath = path.resolve(normalizedRoot, `.${decoded}`);
    const rootWithSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
    if (filePath !== normalizedRoot && !filePath.startsWith(rootWithSep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', resolveMimeType(filePath));
      res.end(data);
    });
  });
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('error', onError);
      reject(error);
    };
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  const address = server.address() as any;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: http.Server | null | undefined): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function closeMaintenanceNoticeIfPresent(page: any): Promise<void> {
  await page.evaluate(() => {
    const notice = document.getElementById('maintenanceNotice');
    if (!notice) return;
    const isOpen = notice.classList.contains('is-open') && notice.getAttribute('aria-hidden') !== 'true';
    if (!isOpen) return;
    const button = document.getElementById('maintenanceNoticeCloseBtn') as HTMLButtonElement | null;
    if (button && typeof button.click === 'function') {
      button.click();
      return;
    }
    notice.classList.remove('is-open');
    notice.setAttribute('aria-hidden', 'true');
  });
  await page.waitForFunction(() => {
    const notice = document.getElementById('maintenanceNotice');
    return !notice
      || !notice.classList.contains('is-open')
      || notice.getAttribute('aria-hidden') === 'true';
  }, null, { timeout: 5000 });
}

async function closeSidePanelIfPresent(page: any): Promise<void> {
  await page.evaluate(() => {
    const panel = document.getElementById('side-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('is-open') && panel.getAttribute('aria-hidden') !== 'true';
    if (!isOpen) return;
    const toggle = document.getElementById('sidePanelToggleBtn') as HTMLButtonElement | null;
    if (toggle && typeof toggle.click === 'function') {
      toggle.click();
      return;
    }
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  });
  await page.waitForFunction(() => {
    const panel = document.getElementById('side-panel');
    return !panel
      || !panel.classList.contains('is-open')
      || panel.getAttribute('aria-hidden') === 'true';
  }, null, { timeout: 5000 });
}

async function runBrowserBootPerformanceCheck(options?: BrowserBootPerformanceCheckOptions): Promise<{
  sample: BootPerformanceSample;
  evaluation: BootPerformanceEvaluation;
  requestedUrls: string[];
}> {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootDir = path.resolve(opts.rootDir || process.cwd());
  const server = createStaticServer(rootDir);
  let browser: Browser | null = null;
  try {
    const baseUrl = await listen(server);
    const registryMetrics = readRegistryMetrics(rootDir);
    const requestedUrls: string[] = [];
    const launch = typeof opts.launch === 'function' ? opts.launch : chromium.launch.bind(chromium);
    browser = await launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.on('request', (request) => {
      requestedUrls.push(request.url());
    });

    const startedAt = Date.now();
    await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await closeMaintenanceNoticeIfPresent(page);
    await closeSidePanelIfPresent(page);
    await page.waitForSelector('#modeNetworkBtn', { state: 'visible', timeout: 30000 });
    await page.click('#modeNetworkBtn', { timeout: 10000 });
    await page.waitForFunction(() => {
      const overlay = document.getElementById('networkOverlay');
      return !!overlay && overlay.getAttribute('aria-hidden') === 'false';
    }, null, { timeout: 10000 });
    const networkModeReadyMs = Date.now() - startedAt;

    await page.waitForTimeout(500);
    const runtimeProbe = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).map((script) => script.src || script.getAttribute('src') || '');
      return {
        scripts,
        hasOrt: typeof (window as any).ort !== 'undefined'
      };
    });

    const allScriptSignals = requestedUrls.concat(runtimeProbe.scripts || []);
    const sample: BootPerformanceSample = {
      ...registryMetrics,
      optionalRegistryLoadedAtStartup: allScriptSignals.some((url) => String(url || '').includes(OPTIONAL_REGISTRY_NAME)),
      onnxScriptLoadedAtStartup: runtimeProbe.hasOrt === true
        || allScriptSignals.some((url) => String(url || '').includes(ONNX_RUNTIME_PATH_FRAGMENT)),
      networkModeReadyMs
    };
    const evaluation = evaluateBootPerformanceSample(sample, {
      networkModeReadyBudgetMs: opts.networkModeReadyBudgetMs
    });

    if (opts.log !== false) {
      console.log(JSON.stringify({
        sample,
        evaluation,
        requestedScripts: allScriptSignals.filter((url) => /\.js(?:\?|$)/.test(String(url || '')))
      }, null, 2));
    }
    return { sample, evaluation, requestedUrls };
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

if (require.main === module) {
  runBrowserBootPerformanceCheck().then((result) => {
    if (!result.evaluation.ok) {
      console.error(`[browser-boot-performance-check] failed: ${result.evaluation.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-boot-performance-check] success');
  }).catch((error) => {
    console.error(`[browser-boot-performance-check] failed: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  computeRegistryMetricsFromTexts,
  evaluateBootPerformanceSample,
  extractBootModuleMetadataFromRegistryText,
  readRegistryMetrics,
  runBrowserBootPerformanceCheck
};
