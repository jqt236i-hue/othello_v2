import * as fs from 'fs';
import * as path from 'path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page
} from 'playwright';

import {
  assertHardwareAcceleratedGraphics,
  createDesktopChromiumLaunchOptions,
  readDesktopGraphicsEnvironment
} from '../browser-performance-environment';
import {
  computeBrowserArtifactManifest,
  createBoardPerformanceServer,
  listenPerformanceServer,
  readCandidateCommit,
  readGitDirtyPaths,
  type BrowserArtifactManifest
} from '../capture-pixijs-playfield-performance';
import {
  UX_OPTIMIZATION_CAPTURE_POLICY,
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_FIXTURE_DIGEST,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIO_DIGEST,
  sha256StableJson,
  type UxOptimizationProfile,
  type UxOptimizationScenarioCaptureDefinition
} from './ux-optimization-monitor-contract';
import {
  UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL,
  installUxOptimizationBrowserProbe,
  normalizeBrowserProbeSnapshot
} from './ux-optimization-browser-probe';

const DEFAULT_ARTIFACT_ROOT = 'worker-public';
const DEFAULT_OUTPUT = 'artifacts/ux-optimization-monitor/latest.json';
const DEFAULT_BASELINE_DIRECTORY = 'artifacts/ux-optimization-monitor/baseline';
const BOOT_SCENARIO_IDS = new Set([
  'boot.pixi.cold',
  'boot.pixi.warm',
  'boot.classic-pixi.cold'
]);

interface CaptureOptions {
  readonly rootDir?: string;
  readonly profile?: UxOptimizationProfile;
  readonly allowDirty?: boolean;
  readonly outputPath?: string | null;
  readonly launch?: typeof chromium.launch;
  readonly log?: boolean;
}

interface CaptureCliOptions {
  readonly profile: UxOptimizationProfile;
  readonly allowDirty: boolean;
  readonly outputPath: string | null;
}

interface BrowserErrorEvidence {
  readonly kind: 'page' | 'console' | 'resource';
  readonly path: string;
  readonly message?: string;
}

interface BootRuntime {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly errors: BrowserErrorEvidence[];
  readonly responsePaths: string[];
}

interface BaselineArtifactArchive {
  readonly path: string;
  readonly manifestPath: string;
  readonly sha256: string;
  readonly fileCount: number;
}

function relativeResourcePath(urlValue: string, baseUrl: string): string {
  try {
    const url = new URL(urlValue);
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin) return '';
    return url.pathname.replace(/^\/+/, '');
  } catch (_error) {
    return '';
  }
}

export function archiveBaselineBrowserArtifact(
  rootDir: string,
  artifact: BrowserArtifactManifest,
  candidateCommit: string
): BaselineArtifactArchive {
  const baselineDirectory = path.join(rootDir, DEFAULT_BASELINE_DIRECTORY);
  const archiveName = `browser-artifact-${artifact.sha256}`;
  const archiveRoot = path.join(baselineDirectory, archiveName);
  const manifestPath = path.join(baselineDirectory, `${archiveName}.manifest.json`);
  fs.mkdirSync(baselineDirectory, { recursive: true });
  if (!fs.existsSync(archiveRoot)) {
    fs.cpSync(artifact.root, archiveRoot, {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  }
  const archivedArtifact = computeBrowserArtifactManifest(archiveRoot);
  if (archivedArtifact.sha256 !== artifact.sha256
      || archivedArtifact.fileCount !== artifact.fileCount) {
    throw new Error('Baseline browser artifact archive does not match the captured artifact');
  }
  const manifest = Object.freeze({
    schemaVersion: 'ux_preserving_runtime_optimization_artifact_archive.v1',
    candidateCommit,
    browserArtifactSha256: archivedArtifact.sha256,
    fileCount: archivedArtifact.fileCount,
    files: archivedArtifact.files
  });
  if (fs.existsSync(manifestPath)) {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (sha256StableJson(existing) !== sha256StableJson(manifest)) {
      throw new Error(`Baseline artifact manifest already exists with different content: ${manifestPath}`);
    }
  } else {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  return Object.freeze({
    path: path.relative(rootDir, archiveRoot).split(path.sep).join('/'),
    manifestPath: path.relative(rootDir, manifestPath).split(path.sep).join('/'),
    sha256: archivedArtifact.sha256,
    fileCount: archivedArtifact.fileCount
  });
}

function createPendingScenarioCapture(
  definition: UxOptimizationScenarioCaptureDefinition
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: definition.id,
    lane: definition.lane,
    backend: definition.backend,
    cacheProfile: definition.cacheProfile,
    captureStatus: 'pending-optimization',
    phases: Object.freeze([]),
    resources: Object.freeze([]),
    errors: Object.freeze([]),
    metrics: Object.freeze({})
  });
}

export function createInitialScenarioCaptures(): readonly Readonly<Record<string, unknown>>[] {
  return Object.freeze(UX_OPTIMIZATION_SCENARIO_CAPTURES.map(createPendingScenarioCapture));
}

export function buildBootCaptureUrl(
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): string {
  const pathname = definition.lane === 'classic' ? '/index.classic.html' : '/';
  const params = new URLSearchParams({
    debug: '1',
    uxMonitor: '1',
    boardRenderer: 'pixi',
    noanim: '1'
  });
  return `${baseUrl}${pathname}?${params.toString()}`;
}

async function markProbePhase(page: Page, phase: string): Promise<void> {
  await page.evaluate(({ key, name }) => {
    const probe = (window as any)[key];
    if (!probe || typeof probe.markPhase !== 'function') {
      throw new Error('UX optimization probe is unavailable');
    }
    probe.markPhase(name);
  }, { key: UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL, name: phase });
}

async function closeMaintenanceNotice(page: Page): Promise<void> {
  await page.evaluate(() => {
    const notice = document.getElementById('maintenanceNotice');
    if (!notice || notice.getAttribute('aria-hidden') === 'true') return;
    const closeButton = document.getElementById('maintenanceNoticeCloseBtn') as
      | HTMLButtonElement
      | null;
    if (closeButton) closeButton.click();
  });
}

async function openBootRuntime(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition,
  reuseContext?: BrowserContext
): Promise<BootRuntime> {
  const context = reuseContext || await browser.newContext({
    viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
    deviceScaleFactor: UX_OPTIMIZATION_CAPTURE_POLICY.dpr
  });
  const page = await context.newPage();
  const errors: BrowserErrorEvidence[] = [];
  const responsePaths: string[] = [];
  page.on('pageerror', (error) => {
    errors.push({ kind: 'page', path: 'document', message: error.message });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    errors.push({ kind: 'console', path: 'document', message: message.text() });
  });
  page.on('response', (response) => {
    const resourcePath = relativeResourcePath(response.url(), baseUrl);
    if (resourcePath) responsePaths.push(resourcePath);
    if (!response.ok()) {
      errors.push({
        kind: 'resource',
        path: resourcePath || 'external',
        message: String(response.status())
      });
    }
  });
  await page.addInitScript(installUxOptimizationBrowserProbe);
  await page.goto(buildBootCaptureUrl(baseUrl, definition), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  });
  await markProbePhase(page, 'styles-ready');
  await markProbePhase(page, 'backend-selected');
  await markProbePhase(page, 'first-frame-preparing');
  try {
    await page.waitForFunction((lane) => (
      (window as any).__uiInitialized === true
        && (
          lane === 'classic'
            || document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
        )
    ), definition.lane, { timeout: 60_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      uiInitialized: (window as any).__uiInitialized === true,
      bootState: document.documentElement.getAttribute('data-browser-boot-state'),
      bootLane: document.documentElement.getAttribute('data-browser-boot-lane'),
      browserLane: document.documentElement.getAttribute('data-browser-lane'),
      backend: (window as any).__boardVisualDebug?.getBackendKind?.() || null,
      bootError: document.getElementById('browserViteBootError')?.textContent || ''
    })).catch(() => null);
    throw new Error(
      `UX monitor browser did not become ready: ${error instanceof Error ? error.message : error}; `
        + `state=${JSON.stringify(state)}; errors=${JSON.stringify(errors)}`
    );
  }
  await closeMaintenanceNotice(page);
  await markProbePhase(page, 'first-frame-committed');
  await page.evaluate(async () => {
    const bootstrap = (window as any).UIBootstrap;
    const controller = bootstrap && typeof bootstrap.getBoardVisualController === 'function'
      ? bootstrap.getBoardVisualController()
      : null;
    if (controller && typeof controller.waitForIdle === 'function') {
      await controller.waitForIdle();
    }
  });
  await markProbePhase(page, 'board-idle');
  return { context, page, errors, responsePaths };
}

async function closeBootRuntime(runtime: BootRuntime, closeContext: boolean): Promise<void> {
  try {
    await runtime.page.evaluate((key) => {
      const probe = (window as any)[key];
      if (probe && typeof probe.dispose === 'function') probe.dispose();
    }, UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL);
  } catch (_error) {
    // Page teardown remains mandatory even if probe cleanup cannot run.
  }
  await runtime.page.close().catch(() => undefined);
  if (closeContext) await runtime.context.close().catch(() => undefined);
}

async function captureBootScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition,
  reuseContext?: BrowserContext
): Promise<{
  readonly capture: Readonly<Record<string, unknown>>;
  readonly context: BrowserContext;
}> {
  const runtime = await openBootRuntime(browser, baseUrl, definition, reuseContext);
  try {
    const rawSnapshot = await runtime.page.evaluate((key) => {
      const probe = (window as any)[key];
      if (!probe || typeof probe.snapshot !== 'function') {
        throw new Error('UX optimization probe snapshot is unavailable');
      }
      return probe.snapshot();
    }, UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL);
    const snapshot = normalizeBrowserProbeSnapshot(rawSnapshot);
    const metrics = await runtime.page.evaluate(() => {
      const countChildren = (selector: string): number => {
        const root = document.querySelector(selector);
        return root ? root.querySelectorAll('*').length : 0;
      };
      const backend = (window as any).__boardVisualDebug?.getBackendKind?.()
        || document.documentElement.getAttribute('data-board-visual-backend')
        || 'none';
      return {
        backend: String(backend),
        totalDomElements: document.querySelectorAll('*').length,
        featureInnerDomCounts: {
          result: countChildren('#result-overlay'),
          profile: countChildren('#profileOverlay'),
          rulesHelp: countChildren('#rules-help-panel'),
          deckBuilder: countChildren('#deckBuilderOverlay'),
          network: countChildren('#networkOverlay')
        },
        uiInitialized: (window as any).__uiInitialized === true,
        bootState: document.documentElement.getAttribute('data-browser-boot-state')
      };
    });
    const observedResponsePaths = Array.from(new Set(runtime.responsePaths)).sort();
    const timedPaths = new Set(snapshot.resources.map((resource) => resource.path));
    const untimedResponseResources = observedResponsePaths
      .filter((resourcePath) => !timedPaths.has(resourcePath))
      .map((resourcePath) => Object.freeze({
        path: resourcePath,
        initiatorType: 'response',
        startMs: 0,
        endMs: 0,
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 0
      }));
    return {
      context: runtime.context,
      capture: Object.freeze({
        id: definition.id,
        lane: definition.lane,
        backend: definition.backend,
        cacheProfile: definition.cacheProfile,
        captureStatus: 'complete',
        phases: snapshot.phases,
        resources: Object.freeze([...snapshot.resources, ...untimedResponseResources]),
        errors: Object.freeze(runtime.errors.slice()),
        metrics: Object.freeze({
          ...metrics,
          capturedAtMs: snapshot.capturedAtMs,
          timeOrigin: snapshot.timeOrigin,
          cls: snapshot.cls,
          longTasks: snapshot.longTasks,
          rafIntervalsMs: snapshot.rafIntervalsMs,
          visibility: snapshot.visibility,
          focused: snapshot.focused,
          capabilities: snapshot.capabilities
        })
      })
    };
  } finally {
    await closeBootRuntime(runtime, reuseContext === undefined);
  }
}

async function captureNormalPlayIsolation(
  browser: Browser,
  baseUrl: string
): Promise<Readonly<Record<string, unknown>>> {
  const context = await browser.newContext({
    viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
    deviceScaleFactor: UX_OPTIMIZATION_CAPTURE_POLICY.dpr
  });
  const page = await context.newPage();
  const requestedPaths: string[] = [];
  page.on('request', (request) => {
    const resourcePath = relativeResourcePath(request.url(), baseUrl);
    if (resourcePath) requestedPaths.push(resourcePath);
  });
  try {
    await page.goto(`${baseUrl}/?boardRenderer=pixi&noanim=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    await page.waitForFunction(() => (
      (window as any).__uiInitialized === true
        && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
    ), null, { timeout: 60_000 });
    return Object.freeze(await page.evaluate(({ key, paths }) => ({
      probeGlobalPresent: Object.prototype.hasOwnProperty.call(window, key),
      boardPerfHarnessPresent: Object.prototype.hasOwnProperty.call(window, '__boardPerfHarness'),
      monitorQueryPresent: new URLSearchParams(location.search).has('uxMonitor'),
      requestedDiagnosticsPayload: paths.some((entry: string) => (
        entry.includes('diagnostic') || entry.includes('performance-harness')
      ))
    }), { key: UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL, paths: requestedPaths }));
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

export async function captureUxOptimizationMonitor(
  options: CaptureOptions = {}
): Promise<Readonly<Record<string, unknown>>> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const profile = options.profile || 'quick';
  const dirtyPaths = readGitDirtyPaths(rootDir);
  if (dirtyPaths.length > 0 && options.allowDirty !== true) {
    throw new Error(`UX optimization capture requires a clean checkout:\n${dirtyPaths.join('\n')}`);
  }
  const candidateCommit = readCandidateCommit(rootDir);
  const artifact = computeBrowserArtifactManifest(
    path.join(rootDir, DEFAULT_ARTIFACT_ROOT)
  );
  const server = createBoardPerformanceServer({
    artifactRoot: artifact.root,
    candidateCommit,
    artifactManifest: artifact,
    captureProfile: profile === 'standard' ? 'desktop' : 'development'
  });
  let browser: Browser | null = null;
  try {
    const port = await listenPerformanceServer(server);
    const baseUrl = `http://127.0.0.1:${port}`;
    const launch = options.launch || chromium.launch.bind(chromium);
    browser = await launch(createDesktopChromiumLaunchOptions());
    const graphics = await readDesktopGraphicsEnvironment(browser);
    if (profile === 'standard') assertHardwareAcceleratedGraphics(graphics);
    const scenarioCaptures = createInitialScenarioCaptures().slice() as Record<string, unknown>[];
    const replaceScenario = (capture: Readonly<Record<string, unknown>>): void => {
      const index = scenarioCaptures.findIndex((entry) => (
        entry.id === capture.id
          && entry.lane === capture.lane
          && entry.backend === capture.backend
      ));
      if (index < 0) throw new Error(`Unexpected scenario capture: ${String(capture.id)}`);
      scenarioCaptures[index] = capture as Record<string, unknown>;
    };

    const coldDefinition = UX_OPTIMIZATION_SCENARIO_CAPTURES.find(
      (entry) => entry.id === 'boot.pixi.cold' && entry.lane === 'vite'
    ) as UxOptimizationScenarioCaptureDefinition;
    const viteBootContext = await browser.newContext({
      viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
      deviceScaleFactor: UX_OPTIMIZATION_CAPTURE_POLICY.dpr
    });
    const cold = await captureBootScenario(
      browser,
      baseUrl,
      coldDefinition,
      viteBootContext
    );
    replaceScenario(cold.capture);

    const warmDefinition = UX_OPTIMIZATION_SCENARIO_CAPTURES.find(
      (entry) => entry.id === 'boot.pixi.warm' && entry.lane === 'vite'
    ) as UxOptimizationScenarioCaptureDefinition;
    const warm = await captureBootScenario(
      browser,
      baseUrl,
      warmDefinition,
      viteBootContext
    );
    replaceScenario(warm.capture);
    await viteBootContext.close().catch(() => undefined);

    const classicDefinition = UX_OPTIMIZATION_SCENARIO_CAPTURES.find(
      (entry) => entry.id === 'boot.classic-pixi.cold' && entry.lane === 'classic'
    ) as UxOptimizationScenarioCaptureDefinition;
    const classic = await captureBootScenario(browser, baseUrl, classicDefinition);
    replaceScenario(classic.capture);

    const normalPlayIsolation = await captureNormalPlayIsolation(browser, baseUrl);
    const baselineArtifactArchive = profile === 'baseline' && dirtyPaths.length === 0
      ? archiveBaselineBrowserArtifact(rootDir, artifact, candidateCommit)
      : null;
    const environment = Object.freeze({
      node: process.version,
      os: process.platform,
      arch: process.arch,
      browserVersion: browser.version(),
      viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
      dpr: UX_OPTIMIZATION_CAPTURE_POLICY.dpr,
      graphics
    });
    const report = Object.freeze({
      schemaVersion: UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      profile,
      identity: Object.freeze({
        candidateCommit,
        dirty: dirtyPaths.length > 0,
        dirtyPaths: Object.freeze(dirtyPaths.slice()),
        browserArtifactSha256: artifact.sha256,
        artifactFileCount: artifact.fileCount,
        fixtureDigest: UX_OPTIMIZATION_FIXTURE_DIGEST,
        scenarioDigest: UX_OPTIMIZATION_SCENARIO_DIGEST,
        capturePolicyDigest: UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
        environment
      }),
      pendingOptimizationIds: Object.freeze(UX_OPTIMIZATION_IDS.slice()),
      baselineArtifactArchive,
      normalPlayIsolation,
      scenarios: Object.freeze(scenarioCaptures),
      deviceValidated: false,
      captureDigest: sha256StableJson({
        candidateCommit,
        artifact: artifact.sha256,
        profile,
        scenarioCaptures
      })
    });
    if (options.outputPath !== null) {
      const outputPath = path.resolve(rootDir, options.outputPath || DEFAULT_OUTPUT);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      if (options.log !== false) {
        process.stdout.write(`[ux-optimization] wrote ${path.relative(rootDir, outputPath)}\n`);
      }
    }
    return report;
  } finally {
    await browser?.close().catch(() => undefined);
    await new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
  }
}

export function parseCaptureArgs(argv: readonly string[]): CaptureCliOptions {
  let profile: UxOptimizationProfile = 'quick';
  let allowDirty = false;
  let outputPath: string | null = DEFAULT_OUTPUT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profile') {
      const value = String(argv[++index] || '') as UxOptimizationProfile;
      if (!['baseline', 'quick', 'standard', 'ci'].includes(value)) {
        throw new Error(`Invalid profile: ${value}`);
      }
      profile = value;
    } else if (arg === '--allow-dirty') {
      allowDirty = true;
    } else if (arg === '--output') {
      outputPath = String(argv[++index] || '');
      if (!outputPath) throw new Error('--output requires a path');
    } else if (arg === '--no-output') {
      outputPath = null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { profile, allowDirty, outputPath };
}

if (require.main === module) {
  let options: CaptureCliOptions;
  try {
    options = parseCaptureArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
  captureUxOptimizationMonitor(options).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
    process.exit(1);
  });
}

export const UX_OPTIMIZATION_BOOT_SCENARIO_IDS = BOOT_SCENARIO_IDS;
