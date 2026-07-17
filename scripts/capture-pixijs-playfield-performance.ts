import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

import {
  BOARD_PERFORMANCE_EVENT_DIGEST,
  BOARD_PERFORMANCE_FIXTURE_DIGEST,
  BOARD_PERFORMANCE_META_SCHEMA_VERSION,
  BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS,
  BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
  expectedCaptureOrder,
  stablePerformanceJson,
  summarizeRafIntervals
} from '../ui/board-visual/performance-harness';

const PhaseZeroBaselineCapture: any = require('./capture-pixijs-playfield-baseline');

const DESKTOP_CAPTURE_SCHEMA_VERSION = 'pixijs_playfield_desktop_capture.v1';
const REFERENCE_DEVICE_SCHEMA_VERSION = 'pixijs_playfield_reference_devices.v1';
const DEFAULT_ARTIFACT_ROOT = 'worker-public';
const DEFAULT_REFERENCE_DEVICE_PATH = 'docs/perf/pixijs-playfield-mobile/reference-devices.json';
const DEFAULT_DESKTOP_OUTPUT = 'artifacts/pixijs-playfield-performance/desktop-capture.json';

const VITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
].join('; ');

// The classic rollback lane still compiles its generated CommonJS registry
// through public/runtime.js. Keep that pre-existing CSP requirement isolated
// from the Vite production lane; Pixi's own renderer remains patched by the
// official CSP-safe replacement in both lanes.
const CLASSIC_CSP = VITE_CSP.replace(
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
);

export interface BrowserArtifactEntry {
  readonly path: string;
  readonly sha256: string;
}

export interface BrowserArtifactManifest {
  readonly root: string;
  readonly fileCount: number;
  readonly files: readonly BrowserArtifactEntry[];
  readonly sha256: string;
}

interface ReferenceDevice {
  readonly id: string;
  readonly platform: 'android' | 'ios';
  readonly ready: boolean;
  readonly model: string;
  readonly osVersion: string;
  readonly osBuild: string;
  readonly browser: string;
  readonly browserVersion: string;
  readonly screen: Readonly<{ width: number; height: number }>;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly dpr: number;
  readonly refreshSetting: string;
  readonly orientation: string;
  readonly powerMode: string;
}

interface ReferenceDeviceManifest {
  readonly schemaVersion: string;
  readonly devices: readonly ReferenceDevice[];
}

interface PerformanceServerOptions {
  readonly artifactRoot: string;
  readonly candidateCommit: string;
  readonly artifactManifest: BrowserArtifactManifest;
  readonly captureProfile: 'physical' | 'desktop' | 'development';
  readonly referenceDevices?: readonly ReferenceDevice[];
}

interface DesktopCaptureOptions {
  readonly rootDir?: string;
  readonly allowDirty?: boolean;
  readonly quick?: boolean;
  readonly outputPath?: string | null;
  readonly log?: boolean;
  readonly launch?: typeof chromium.launch;
}

export interface DesktopGraphicsEnvironment {
  readonly hardwareAccelerated: boolean;
  readonly glRenderer: string;
  readonly glVendor: string;
  readonly displayType: string;
  readonly gpuCompositing: string;
  readonly webgl: string;
  readonly devices: readonly Readonly<{
    vendorId: number;
    deviceId: number;
    deviceString: string;
    driverVendor: string;
    driverVersion: string;
  }>[];
}

export function createDesktopChromiumLaunchOptions(
  platform = process.platform
): Parameters<typeof chromium.launch>[0] {
  return platform === 'win32'
    ? { headless: true, args: ['--use-gl=angle', '--use-angle=d3d11'] }
    : { headless: true };
}

export function normalizeChromiumGraphicsInfo(value: any): DesktopGraphicsEnvironment {
  const gpu = value?.gpu || {};
  const auxiliary = gpu.auxAttributes || {};
  const featureStatus = gpu.featureStatus || {};
  const glRenderer = String(auxiliary.glRenderer || '');
  const glVendor = String(auxiliary.glVendor || '');
  const displayType = String(auxiliary.displayType || '');
  const gpuCompositing = String(featureStatus.gpu_compositing || '');
  const webgl = String(featureStatus.webgl || '');
  const softwareRenderer = /swiftshader|llvmpipe|software(?: rasterizer)?/i.test(`${glRenderer} ${glVendor}`);
  const hardwareAccelerated = glRenderer.length > 0
    && !softwareRenderer
    && /^enabled/.test(gpuCompositing)
    && /^enabled/.test(webgl);
  const devices = Array.isArray(gpu.devices)
    ? gpu.devices.map((device: any) => Object.freeze({
      vendorId: Number(device?.vendorId) || 0,
      deviceId: Number(device?.deviceId) || 0,
      deviceString: String(device?.deviceString || ''),
      driverVendor: String(device?.driverVendor || ''),
      driverVersion: String(device?.driverVersion || '')
    }))
    : [];
  return Object.freeze({
    hardwareAccelerated,
    glRenderer,
    glVendor,
    displayType,
    gpuCompositing,
    webgl,
    devices: Object.freeze(devices)
  });
}

async function readDesktopGraphicsEnvironment(browser: Browser): Promise<DesktopGraphicsEnvironment> {
  const session = await browser.newBrowserCDPSession();
  try {
    return normalizeChromiumGraphicsInfo(await session.send('SystemInfo.getInfo'));
  } finally {
    await session.detach();
  }
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function walkFiles(root: string, current = root, output: string[] = []): string[] {
  const entries = fs.readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) walkFiles(root, absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

export function computeBrowserArtifactManifest(artifactRoot: string): BrowserArtifactManifest {
  const resolvedRoot = path.resolve(artifactRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Browser artifact directory is unavailable: ${resolvedRoot}`);
  }
  const files = Object.freeze(walkFiles(resolvedRoot).map((absolute) => Object.freeze({
    path: normalizePath(path.relative(resolvedRoot, absolute)),
    sha256: sha256(fs.readFileSync(absolute))
  })).sort((left, right) => left.path.localeCompare(right.path, 'en')));
  if (!files.some((entry) => entry.path === 'index.html')) {
    throw new Error('Browser artifact does not contain production index.html');
  }
  if (!files.some((entry) => entry.path === 'index.classic.html')) {
    throw new Error('Browser artifact does not contain classic index.classic.html');
  }
  return Object.freeze({
    root: resolvedRoot,
    fileCount: files.length,
    files,
    sha256: sha256(stablePerformanceJson(files))
  });
}

export function readCandidateCommit(rootDir: string): string {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Unable to resolve a full candidate commit SHA');
  return commit;
}

export function readGitDirtyPaths(rootDir: string): readonly string[] {
  const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return Object.freeze(output.split(/\r?\n/).filter(Boolean));
}

function positiveNumber(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function validateReferenceDeviceManifest(value: unknown): ReferenceDeviceManifest {
  const manifest = value as any;
  if (!manifest || manifest.schemaVersion !== REFERENCE_DEVICE_SCHEMA_VERSION || !Array.isArray(manifest.devices)) {
    throw new Error(`reference-devices.json must use ${REFERENCE_DEVICE_SCHEMA_VERSION}`);
  }
  if (manifest.devices.length !== 2) throw new Error('Exactly two reference devices are required');
  const platforms = new Set<string>();
  const ids = new Set<string>();
  for (const raw of manifest.devices) {
    const device = raw as ReferenceDevice;
    if (!device || device.ready !== true) throw new Error(`Reference device ${device?.id || '<unknown>'} is not ready`);
    if (device.platform !== 'android' && device.platform !== 'ios') throw new Error('Reference platform must be android or ios');
    if (platforms.has(device.platform)) throw new Error(`Duplicate reference platform: ${device.platform}`);
    if (!device.id || ids.has(device.id) || !/^[a-z0-9][a-z0-9_-]*$/.test(device.id)) {
      throw new Error(`Reference device id is invalid or duplicated: ${device.id}`);
    }
    for (const field of ['model', 'osVersion', 'osBuild', 'browser', 'browserVersion', 'refreshSetting', 'orientation', 'powerMode'] as const) {
      if (!String(device[field] || '').trim()) throw new Error(`Reference device ${device.id} is missing ${field}`);
    }
    if (!positiveNumber(device.screen?.width) || !positiveNumber(device.screen?.height)
      || !positiveNumber(device.viewport?.width) || !positiveNumber(device.viewport?.height)
      || !positiveNumber(device.dpr)) {
      throw new Error(`Reference device ${device.id} has incomplete screen/viewport/DPR data`);
    }
    platforms.add(device.platform);
    ids.add(device.id);
  }
  if (!platforms.has('android') || !platforms.has('ios')) {
    throw new Error('One physical Android and one physical iPhone are required');
  }
  return Object.freeze({
    schemaVersion: REFERENCE_DEVICE_SCHEMA_VERSION,
    devices: Object.freeze(manifest.devices.map((device: ReferenceDevice) => Object.freeze({
      ...device,
      screen: Object.freeze({ ...device.screen }),
      viewport: Object.freeze({ ...device.viewport })
    })))
  });
}

export function readReferenceDeviceManifest(filePath: string): ReferenceDeviceManifest {
  if (!fs.existsSync(filePath)) throw new Error(`Reference device manifest is unavailable: ${filePath}`);
  return validateReferenceDeviceManifest(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function mimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.wasm': return 'application/wasm';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.webp': return 'image/webp';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    default: return 'application/octet-stream';
  }
}

function contentSecurityPolicyForRequest(request: http.IncomingMessage): string {
  let pathname = '';
  try { pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname; }
  catch (_error) { /* Vite is the fail-closed default */ }
  return pathname.endsWith('/index.classic.html') || laneFromRequest(request) === 'classic'
    ? CLASSIC_CSP
    : VITE_CSP;
}

function writeHeaders(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  artifactDigest: string,
  extra: Record<string, string> = {}
): void {
  response.setHeader('Content-Security-Policy', contentSecurityPolicyForRequest(request));
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Board-Perf-Artifact-Sha256', artifactDigest);
  for (const [name, value] of Object.entries(extra)) response.setHeader(name, value);
}

function deviceProbeHtml(): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Card Reversi reference device probe</title></head><body>
<h1>Reference device browser probe</h1>
<p>計測時と同じ向き・アドレスバー状態にしてから Copy JSON を押してください。</p>
<button id="copy" type="button">Copy JSON</button><pre id="output"></pre>
<script>
(() => {
  const read = () => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: { width: screen.width, height: screen.height, availWidth: screen.availWidth, availHeight: screen.availHeight },
    viewport: { width: innerWidth, height: innerHeight },
    visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
    dpr: devicePixelRatio,
    orientation: screen.orientation ? screen.orientation.type : '',
    capturedAt: new Date().toISOString()
  });
  const render = () => { document.getElementById('output').textContent = JSON.stringify(read(), null, 2); };
  addEventListener('resize', render); addEventListener('orientationchange', render); render();
  document.getElementById('copy').addEventListener('click', async () => {
    const text = JSON.stringify(read(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return; }
    const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select();
    document.execCommand('copy'); area.remove();
  });
})();
</script></body></html>`;
}

function laneFromRequest(request: http.IncomingMessage): 'classic' | 'vite' {
  const referer = String(request.headers.referer || '');
  try {
    return new URL(referer).pathname.endsWith('/index.classic.html') ? 'classic' : 'vite';
  } catch (_error) {
    return 'vite';
  }
}

function resolveStaticFile(artifactRoot: string, requestUrl: string): string | null {
  let pathname: string;
  try {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  } catch (_error) {
    return null;
  }
  const resolvedRoot = path.resolve(artifactRoot);
  const candidate = path.resolve(resolvedRoot, `.${pathname.replace(/\//g, path.sep)}`);
  const prefix = `${resolvedRoot}${path.sep}`;
  if (candidate !== path.join(resolvedRoot, 'index.html') && !candidate.startsWith(prefix)) return null;
  return candidate;
}

export function createBoardPerformanceServer(options: PerformanceServerOptions): http.Server {
  const devices = new Map((options.referenceDevices || []).map((device) => [device.id, device]));
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/__board_perf_probe.html') {
      writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'text/html; charset=utf-8' });
      response.statusCode = 200;
      response.end(request.method === 'HEAD' ? '' : deviceProbeHtml());
      return;
    }
    if (requestUrl.pathname === '/__board_perf_meta.json') {
      const referenceDeviceId = requestUrl.searchParams.get('referenceDevice') || '';
      const referenceDevice = referenceDeviceId ? devices.get(referenceDeviceId) : undefined;
      if (options.captureProfile === 'physical' && !referenceDevice) {
        writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'application/json; charset=utf-8' });
        response.statusCode = 400;
        response.end(JSON.stringify({ error: 'unknown-reference-device' }));
        return;
      }
      const payload = {
        schemaVersion: BOARD_PERFORMANCE_META_SCHEMA_VERSION,
        candidateCommit: options.candidateCommit,
        browserArtifactSha256: options.artifactManifest.sha256,
        artifactFileCount: options.artifactManifest.fileCount,
        fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
        eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
        lane: laneFromRequest(request),
        captureProfile: options.captureProfile,
        referenceDevice: referenceDevice || {},
        captureOrder: expectedCaptureOrder(options.candidateCommit)
      };
      writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'application/json; charset=utf-8' });
      response.statusCode = 200;
      response.end(JSON.stringify(payload));
      return;
    }
    if (requestUrl.pathname === '/api/match/list') {
      writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{"ok":true,"rooms":[]}');
      return;
    }
    if (requestUrl.pathname === '/api/leaderboard/list') {
      writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{"ok":true,"entries":[],"updatedAt":0}');
      return;
    }
    const filePath = resolveStaticFile(options.artifactRoot, request.url || '/');
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.statusCode = 404;
      response.end('Not found');
      return;
    }
    writeHeaders(request, response, options.artifactManifest.sha256, { 'Content-Type': mimeType(filePath) });
    response.statusCode = 200;
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
}

export async function listenPerformanceServer(server: http.Server, host = '127.0.0.1', port = 0): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Performance server did not expose a TCP port');
  return address.port;
}

async function closeServer(server: http.Server | null): Promise<void> {
  if (!server?.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

export function buildPhysicalCaptureUrls(
  baseUrl: string,
  candidateCommit: string,
  deviceId: string
): readonly Readonly<{ sequenceIndex: 1 | 2; backend: 'dom' | 'pixi'; url: string }>[] {
  const captureOrder = expectedCaptureOrder(candidateCommit);
  const backends: readonly ('dom' | 'pixi')[] = captureOrder === 'dom-first' ? ['dom', 'pixi'] : ['pixi', 'dom'];
  return Object.freeze(backends.map((backend, index) => {
    const params = new URLSearchParams({
      debug: '1',
      boardPerf: '1',
      boardRenderer: backend,
      referenceDevice: deviceId,
      captureOrder,
      captureIndex: String(index + 1),
      cooldownMs: String(BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS)
    });
    return Object.freeze({
      sequenceIndex: (index + 1) as 1 | 2,
      backend,
      url: `${baseUrl}/?${params.toString()}`
    });
  }));
}

function desktopHarnessUrl(baseUrl: string, lane: 'classic' | 'vite', backend: 'dom' | 'pixi'): string {
  const pathname = lane === 'classic' ? '/index.classic.html' : '/';
  return `${baseUrl}${pathname}?debug=1&boardPerf=1&boardRenderer=${backend}`;
}

async function capturePageReport(
  browser: Browser,
  url: string,
  quick: boolean,
  log: boolean
): Promise<any> {
  const page: Page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  if (log) page.on('console', (message) => {
    if (message.type() === 'error') process.stderr.write(`[board-perf browser] ${message.text()}\n`);
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    try {
      await page.waitForFunction(() => (
        (window as any).__uiInitialized === true
        && !!(window as any).__boardPerfHarness
      ), null, { timeout: 60_000 });
    } catch (error: any) {
      const state = await page.evaluate(() => ({
        uiInitialized: (window as any).__uiInitialized,
        bootState: document.documentElement.getAttribute('data-browser-boot-state'),
        bootLane: document.documentElement.getAttribute('data-browser-boot-lane'),
        harnessInstalled: !!(window as any).__boardPerfHarness,
        controlsStatus: document.querySelector('#board-performance-controls [data-role="status"]')?.textContent || null,
        backend: (window as any).__boardVisualDebug?.getBackendKind?.() || null,
        boardReady: (window as any).__boardVisualDebug?.isReady?.() || null
      })).catch(() => null);
      throw new Error(`${error?.message || error}; pageState=${JSON.stringify(state)}; pageErrors=${pageErrors.join(' | ')}`);
    }
    const report = await page.evaluate(async (developmentQuick) => {
      const api = (window as any).__boardPerfHarness;
      if (!api) throw new Error('Board performance harness was not installed');
      return api.runSuite(developmentQuick ? {
        warmupCount: 1,
        basicSampleCount: 2,
        heavySampleCount: 1,
        microSampleCount: 3,
        nominalRafSampleCount: 8,
        stabilityDurationMs: 500,
        stabilitySampleIntervalMs: 50,
        sameModelApplyCount: 2,
        resetCount: 2,
        skinSwitchCount: 2
      } : undefined);
    }, quick);
    if (pageErrors.length) throw new Error(`Performance page errors: ${pageErrors.join(' | ')}`);
    return report;
  } finally {
    await page.close();
  }
}

function scenario(report: any, id: string): any {
  const value = report?.scenarios?.find((entry: any) => entry.id === id);
  if (!value) throw new Error(`Performance report is missing scenario ${id}`);
  return value;
}

function ratioWithin(candidate: number, baseline: number, allowance: number): boolean {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline)) return false;
  if (baseline === 0) return candidate === 0;
  return candidate <= baseline * allowance;
}

function comparisonCheck(name: string, pass: boolean, detail: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze({ name, pass, ...detail });
}

export function evaluateDesktopPerformancePair(dom: any, pixi: any): Readonly<Record<string, unknown>> {
  const checks: Readonly<Record<string, unknown>>[] = [];
  for (const key of ['candidateCommit', 'browserArtifactSha256', 'fixtureDigest', 'eventDigest', 'lane']) {
    checks.push(comparisonCheck(`identity.${key}`, dom?.[key] === pixi?.[key], { dom: dom?.[key], pixi: pixi?.[key] }));
  }
  const environmentMatches = stablePerformanceJson({
    userAgent: dom?.environment?.userAgent,
    viewport: dom?.environment?.viewport,
    dpr: dom?.environment?.dpr
  }) === stablePerformanceJson({
    userAgent: pixi?.environment?.userAgent,
    viewport: pixi?.environment?.viewport,
    dpr: pixi?.environment?.dpr
  });
  checks.push(comparisonCheck('identity.environment', environmentMatches, {}));

  const domBasic = scenario(dom, 'basic.multi-flip-8x8');
  const pixiBasic = scenario(pixi, 'basic.multi-flip-8x8');
  const pixiNominal = Number(pixi.nominal.nominalFrameIntervalMs);
  const domTarget = Number(dom.nominal.nominalFrameIntervalMs) + 1;
  const pixiTarget = pixiNominal + 1;
  const domBasicP95 = Number(domBasic.summary.raf.p95);
  const pixiBasicP95 = Number(pixiBasic.summary.raf.p95);
  checks.push(comparisonCheck('basic.pixi-frame-target', pixiBasicP95 <= pixiTarget, { actual: pixiBasicP95, target: pixiTarget }));
  checks.push(comparisonCheck('basic.pixi-jank', Number(pixiBasic.summary.raf.jankRatio) <= 0.05, { actual: pixiBasic.summary.raf.jankRatio }));
  checks.push(comparisonCheck('basic.pixi-stall50', Number(pixiBasic.summary.raf.rafStall50msCount) === 0, { actual: pixiBasic.summary.raf.rafStall50msCount }));
  checks.push(comparisonCheck(
    'basic.dom-comparison',
    domBasicP95 > domTarget ? pixiBasicP95 <= domBasicP95 * 0.8 : ratioWithin(pixiBasicP95, domBasicP95, 1.05),
    { domP95: domBasicP95, pixiP95: pixiBasicP95, domTarget }
  ));

  const micro = scenario(pixi, 'micro.full-marker-16x16');
  const microModelValues = micro.rawSamples.map((sample: any) => Number(sample.modelBuildMs));
  const microApplyValues = micro.rawSamples.map((sample: any) => Number(sample.backendApplySyncMs));
  const microHitValues = micro.rawSamples.map((sample: any) => Number(sample.hitTestMs));
  checks.push(comparisonCheck('micro.model-under-50ms', microModelValues.every((value: number) => value < 50), { max: Math.max(...microModelValues) }));
  checks.push(comparisonCheck('micro.apply-under-50ms', microApplyValues.every((value: number) => value < 50), { max: Math.max(...microApplyValues) }));
  checks.push(comparisonCheck('micro.hit-under-50ms', microHitValues.every((value: number) => value < 50), { max: Math.max(...microHitValues) }));

  for (const scenarioId of [
    'basic.multi-flip-8x8',
    'heavy.move-8x8',
    'heavy.destroy-spawn-8x8',
    'heavy.status-8x8',
    'heavy.destroy-source-8x8',
    'heavy.theory-manifest-8x8'
  ]) {
    const domScenario = scenario(dom, scenarioId);
    const pixiScenario = scenario(pixi, scenarioId);
    for (const metric of ['wholeTurnSettlementMs', 'presentationStartLatencyMs']) {
      const domP95 = Number(domScenario.summary[metric].p95);
      const pixiP95 = Number(pixiScenario.summary[metric].p95);
      checks.push(comparisonCheck(`${scenarioId}.${metric}.dom-comparison`, ratioWithin(pixiP95, domP95, 1.05), { domP95, pixiP95 }));
    }
  }
  const pass = checks.every((check: any) => check.pass === true);
  return Object.freeze({ pass, checks: Object.freeze(checks) });
}

function assertCapturedReport(report: any, expectedLane: string, expectedBackend: string, artifact: BrowserArtifactManifest, commit: string): void {
  if (report?.schemaVersion !== BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION) throw new Error('Browser returned an invalid performance report schema');
  if (report.lane !== expectedLane || report.backend !== expectedBackend) throw new Error('Browser report lane/backend mismatch');
  if (report.candidateCommit !== commit || report.browserArtifactSha256 !== artifact.sha256) throw new Error('Browser report candidate/artifact mismatch');
  if (report.fixtureDigest !== BOARD_PERFORMANCE_FIXTURE_DIGEST || report.eventDigest !== BOARD_PERFORMANCE_EVENT_DIGEST) {
    throw new Error('Browser report fixture/event digest mismatch');
  }
}

export async function captureDesktopPerformance(options: DesktopCaptureOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dirty = readGitDirtyPaths(rootDir);
  if (dirty.length && options.allowDirty !== true) {
    throw new Error(`Performance evidence requires a clean candidate checkout:\n${dirty.join('\n')}`);
  }
  const commit = readCandidateCommit(rootDir);
  const artifact = computeBrowserArtifactManifest(path.join(rootDir, DEFAULT_ARTIFACT_ROOT));
  const profile = options.quick ? 'development' : 'desktop';
  const server = createBoardPerformanceServer({
    artifactRoot: artifact.root,
    artifactManifest: artifact,
    candidateCommit: commit,
    captureProfile: profile
  });
  let browser: Browser | null = null;
  try {
    const port = await listenPerformanceServer(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    const launch = options.launch || chromium.launch.bind(chromium);
    browser = await launch(createDesktopChromiumLaunchOptions());
    const graphics = await readDesktopGraphicsEnvironment(browser);
    if (!graphics.hardwareAccelerated) {
      throw new Error(`Desktop performance capture requires hardware-accelerated WebGL; renderer=${graphics.glRenderer || 'unknown'}`);
    }
    const reports: any[] = [];
    const backendOrder = expectedCaptureOrder(commit) === 'dom-first' ? ['dom', 'pixi'] : ['pixi', 'dom'];
    for (const lane of ['classic', 'vite'] as const) {
      for (const backend of backendOrder as readonly ('dom' | 'pixi')[]) {
        if (options.log !== false) process.stdout.write(`[board-perf] ${lane}/${backend} capture start\n`);
        const report = await capturePageReport(browser, desktopHarnessUrl(baseUrl, lane, backend), options.quick === true, options.log !== false);
        assertCapturedReport(report, lane, backend, artifact, commit);
        reports.push(report);
      }
    }
    const comparisons = (['classic', 'vite'] as const).map((lane) => {
      const dom = reports.find((report) => report.lane === lane && report.backend === 'dom');
      const pixi = reports.find((report) => report.lane === lane && report.backend === 'pixi');
      return Object.freeze({ lane, ...evaluateDesktopPerformancePair(dom, pixi) });
    });
    const crossLaneIdentity = reports.every((report) => report.candidateCommit === commit
      && report.browserArtifactSha256 === artifact.sha256
      && report.fixtureDigest === BOARD_PERFORMANCE_FIXTURE_DIGEST
      && report.eventDigest === BOARD_PERFORMANCE_EVENT_DIGEST);
    const phaseZeroBaselinePath = path.join(rootDir, 'docs/perf/pixijs-playfield-baseline.json');
    if (!fs.existsSync(phaseZeroBaselinePath)) throw new Error('Immutable Phase 0 playfield baseline is unavailable');
    const phaseZeroBaselineBody = fs.readFileSync(phaseZeroBaselinePath);
    const phaseZeroBaseline = JSON.parse(phaseZeroBaselineBody.toString('utf8'));
    const phaseZeroModelApplyComparison = PhaseZeroBaselineCapture.buildPhaseZeroPixiComparison(
      phaseZeroBaseline,
      reports,
      sha256(phaseZeroBaselineBody)
    );
    const currentBrowserVersion = browser.version();
    const phaseZeroEnvironmentChecks = Object.freeze([
      Object.freeze({ name: 'platform', pass: phaseZeroBaseline.environment?.platform === process.platform, baseline: phaseZeroBaseline.environment?.platform, current: process.platform }),
      Object.freeze({ name: 'arch', pass: phaseZeroBaseline.environment?.arch === process.arch, baseline: phaseZeroBaseline.environment?.arch, current: process.arch }),
      Object.freeze({ name: 'viewport', pass: stablePerformanceJson(phaseZeroBaseline.environment?.viewport) === stablePerformanceJson({ width: 1366, height: 900 }), baseline: phaseZeroBaseline.environment?.viewport, current: { width: 1366, height: 900 } }),
      Object.freeze({ name: 'dpr', pass: Number(phaseZeroBaseline.environment?.dpr) === 1, baseline: phaseZeroBaseline.environment?.dpr, current: 1 }),
      ...(['classic', 'vite'] as const).map((lane) => Object.freeze({
        name: `${lane}.browserVersion`,
        pass: phaseZeroBaseline.environment?.browserVersions?.[lane] === currentBrowserVersion,
        baseline: phaseZeroBaseline.environment?.browserVersions?.[lane],
        current: currentBrowserVersion
      }))
    ]);
    const phaseZeroEnvironmentMatch = phaseZeroEnvironmentChecks.every((check) => check.pass);
    const capture = Object.freeze({
      schemaVersion: DESKTOP_CAPTURE_SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      candidateCommit: commit,
      browserArtifact: artifact,
      fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
      eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
      profile,
      standardRun: options.quick !== true,
      environment: Object.freeze({
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        browserVersion: currentBrowserVersion,
        viewport: { width: 1366, height: 900 },
        dpr: 1,
        graphics
      }),
      phaseZeroModelApplyComparison,
      phaseZeroEnvironment: Object.freeze({ pass: phaseZeroEnvironmentMatch, checks: phaseZeroEnvironmentChecks }),
      reports: Object.freeze(reports),
      comparisons: Object.freeze(comparisons),
      crossLaneIdentity,
      pass: crossLaneIdentity
        && phaseZeroEnvironmentMatch
        && comparisons.every((comparison: any) => comparison.pass === true)
    });
    if (options.outputPath !== null) {
      const outputPath = path.resolve(rootDir, options.outputPath || DEFAULT_DESKTOP_OUTPUT);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
      if (options.log !== false) process.stdout.write(`[board-perf] wrote ${normalizePath(path.relative(rootDir, outputPath))}\n`);
    }
    if (!options.quick && capture.pass !== true) throw Object.assign(new Error('Desktop DOM/Pixi performance gate failed'), { capture });
    return capture;
  } finally {
    await browser?.close();
    await closeServer(server);
  }
}

function localIpv4Addresses(): readonly string[] {
  const values = new Set<string>();
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const entry of interfaces || []) {
      if (entry.family === 'IPv4' && !entry.internal) values.add(entry.address);
    }
  }
  return Object.freeze(Array.from(values).sort());
}

export async function runManualHost(options: {
  rootDir?: string;
  host?: string;
  port?: number;
  allowDirty?: boolean;
  log?: boolean;
} = {}): Promise<Readonly<Record<string, unknown>>> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dirty = readGitDirtyPaths(rootDir);
  if (dirty.length && options.allowDirty !== true) {
    throw new Error(`Physical evidence host requires a clean candidate checkout:\n${dirty.join('\n')}`);
  }
  const commit = readCandidateCommit(rootDir);
  const artifact = computeBrowserArtifactManifest(path.join(rootDir, DEFAULT_ARTIFACT_ROOT));
  const referenceManifest = readReferenceDeviceManifest(path.join(rootDir, DEFAULT_REFERENCE_DEVICE_PATH));
  const host = options.host || '0.0.0.0';
  const server = createBoardPerformanceServer({
    artifactRoot: artifact.root,
    artifactManifest: artifact,
    candidateCommit: commit,
    captureProfile: 'physical',
    referenceDevices: referenceManifest.devices
  });
  const port = await listenPerformanceServer(server, host, options.port || 0);
  const hostnames = host === '0.0.0.0' ? localIpv4Addresses() : [host];
  const urls = hostnames.flatMap((hostname) => referenceManifest.devices.map((device) => Object.freeze({
    hostname,
    deviceId: device.id,
    platform: device.platform,
    captures: buildPhysicalCaptureUrls(`http://${hostname}:${port}`, commit, device.id)
  })));
  const receipt = Object.freeze({
    candidateCommit: commit,
    browserArtifactSha256: artifact.sha256,
    artifactFileCount: artifact.fileCount,
    captureOrder: expectedCaptureOrder(commit),
    cooldownMs: BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS,
    urls: Object.freeze(urls)
  });
  if (options.log !== false) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.stdout.write('[board-perf] read-only physical evidence host is running; press Ctrl+C to stop\n');
  }
  const shutdown = async () => closeServer(server);
  process.once('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
  process.once('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
  return receipt;
}

export async function runDeviceProbeHost(options: {
  rootDir?: string;
  host?: string;
  port?: number;
  log?: boolean;
} = {}): Promise<Readonly<Record<string, unknown>>> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const commit = readCandidateCommit(rootDir);
  const artifact = computeBrowserArtifactManifest(path.join(rootDir, DEFAULT_ARTIFACT_ROOT));
  const host = options.host || '0.0.0.0';
  const server = createBoardPerformanceServer({
    artifactRoot: artifact.root,
    artifactManifest: artifact,
    candidateCommit: commit,
    captureProfile: 'development'
  });
  const port = await listenPerformanceServer(server, host, options.port || 0);
  const hostnames = host === '0.0.0.0' ? localIpv4Addresses() : [host];
  const urls = hostnames.map((hostname) => `http://${hostname}:${port}/__board_perf_probe.html`);
  const receipt = Object.freeze({ candidateCommit: commit, browserArtifactSha256: artifact.sha256, urls: Object.freeze(urls) });
  if (options.log !== false) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.stdout.write('[board-perf] device probe host is running; press Ctrl+C to stop\n');
  }
  const shutdown = async () => closeServer(server);
  process.once('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
  process.once('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
  return receipt;
}

interface CliArgs {
  manualHost: string | null;
  probeHost: string | null;
  port: number;
  allowDirty: boolean;
  quick: boolean;
  outputPath: string | null | undefined;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const result: CliArgs = { manualHost: null, probeHost: null, port: 0, allowDirty: false, quick: false, outputPath: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manual-host') result.manualHost = argv[++index] || '0.0.0.0';
    else if (arg.startsWith('--manual-host=')) result.manualHost = arg.slice('--manual-host='.length) || '0.0.0.0';
    else if (arg === '--probe-host') result.probeHost = argv[++index] || '0.0.0.0';
    else if (arg.startsWith('--probe-host=')) result.probeHost = arg.slice('--probe-host='.length) || '0.0.0.0';
    else if (arg === '--port') result.port = Number(argv[++index] || 0);
    else if (arg === '--allow-dirty') result.allowDirty = true;
    else if (arg === '--quick') result.quick = true;
    else if (arg === '--no-output') result.outputPath = null;
    else if (arg === '--output') result.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535) throw new Error('Port must be an integer from 0 to 65535');
  if (result.manualHost && result.probeHost) throw new Error('--manual-host and --probe-host are mutually exclusive');
  return result;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const work = args.manualHost
    ? runManualHost({ host: args.manualHost, port: args.port, allowDirty: args.allowDirty })
    : args.probeHost
      ? runDeviceProbeHost({ host: args.probeHost, port: args.port })
      : captureDesktopPerformance({ allowDirty: args.allowDirty, quick: args.quick, outputPath: args.outputPath });
  work.catch((error: any) => {
    process.stderr.write(`[pixijs-playfield-performance] failed: ${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
