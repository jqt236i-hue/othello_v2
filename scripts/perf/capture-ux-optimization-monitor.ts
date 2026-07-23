import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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
const COMPLETED_OPTIMIZATION_IDS = new Set([
  'special-stone-demand-loading',
  'lock-only-hint-paint',
  'logical-image-deduplication',
  'help-image-lazy-loading',
  'dom-compat-stylesheet-lazy-loading',
  'lossless-webp-admission',
  'feature-result',
  'feature-profile',
  'feature-rules-help',
  'feature-deck-builder',
  'feature-network'
]);
const SPECIAL_STONE_PATH_PREFIX = 'assets/images/special-stones/';
const DOM_COMPAT_STYLESHEET_PATH = 'styles-board-dom-compat.css';
const RESULT_STYLESHEET_PATH = 'styles-layout-result.css';
const PROFILE_STYLESHEET_PATH = 'styles-profile.css';
const RULES_HELP_STYLESHEET_PATHS = Object.freeze([
  'styles-feature-rules-help-layout-info.css',
  'styles-feature-rules-help-cards.css',
  'styles-feature-rules-help-responsive.css'
]);
const DECK_BUILDER_STYLESHEET_PATHS = Object.freeze([
  'styles-feature-deck-builder.css',
  'styles-feature-deck-builder-responsive.css'
]);
const NETWORK_STYLESHEET_PATHS = Object.freeze([
  'styles-feature-network-layout-controls.css',
  'styles-feature-network.css',
  'styles-feature-network-responsive.css'
]);
const DEFAULT_FRAME_PNG_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.png';
const DEFAULT_FRAME_WEBP_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.webp';
const INITIAL_HELP_IMAGE_PATHS = Object.freeze([
  'assets/images/help/player-guide/card-reversi-player-guide-slide-01.png',
  'assets/images/help/protection-penetration/protection-penetration-quick-reference.png'
]);
const CLASSIC_PIXI_RUNTIME_PATHS = Object.freeze([
  '/public/vendor/pixi-8.18.1.min.js',
  '/public/vendor/pixi-unsafe-eval-8.18.1.min.js'
]);

export interface CaptureOptions {
  readonly rootDir?: string;
  readonly profile?: UxOptimizationProfile;
  readonly allowDirty?: boolean;
  readonly outputPath?: string | null;
  readonly launch?: typeof chromium.launch;
  readonly log?: boolean;
  readonly artifactRoot?: string;
  readonly candidateCommit?: string;
  readonly bootOnly?: boolean;
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
  readonly requestPaths: string[];
  readonly responsePaths: string[];
}

interface OpenRuntimeOptions {
  readonly boardRenderer?: 'pixi' | 'dom';
  readonly beforeGoto?: (page: Page) => Promise<void>;
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
  definition: UxOptimizationScenarioCaptureDefinition,
  boardRenderer: 'pixi' | 'dom' = 'pixi'
): string {
  const pathname = definition.lane === 'classic' ? '/index.classic.html' : '/';
  const params = new URLSearchParams({
    debug: '1',
    uxMonitor: '1',
    boardRenderer,
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

async function closeSidePanelForFeatureCapture(page: Page): Promise<void> {
  const isOpen = await page.evaluate(() => (
    document.getElementById('side-panel')?.classList.contains('is-open') === true
  ));
  if (!isOpen) return;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    document.getElementById('side-panel')?.classList.contains('is-open') !== true
  ), null, { timeout: 10_000 });
}

async function openBootRuntime(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition,
  reuseContext?: BrowserContext,
  options: OpenRuntimeOptions = {}
): Promise<BootRuntime> {
  const context = reuseContext || await browser.newContext({
    viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
    deviceScaleFactor: UX_OPTIMIZATION_CAPTURE_POLICY.dpr
  });
  const page = await context.newPage();
  const errors: BrowserErrorEvidence[] = [];
  const requestPaths: string[] = [];
  const responsePaths: string[] = [];
  page.on('pageerror', (error) => {
    errors.push({ kind: 'page', path: 'document', message: error.message });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    errors.push({ kind: 'console', path: 'document', message: message.text() });
  });
  page.on('request', (request) => {
    const resourcePath = relativeResourcePath(request.url(), baseUrl);
    if (resourcePath) requestPaths.push(resourcePath);
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
  await options.beforeGoto?.(page);
  await page.goto(buildBootCaptureUrl(
    baseUrl,
    definition,
    options.boardRenderer || 'pixi'
  ), {
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
  return { context, page, errors, requestPaths, responsePaths };
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
      const backendDiagnostics = (window as any).__boardVisualDebug?.getBackendDiagnostics?.() || null;
      return {
        backend: String(backend),
        neededSpecialAssetIds: Array.isArray(backendDiagnostics?.neededSpecialAssetIds)
          ? backendDiagnostics.neededSpecialAssetIds.map(String).sort()
          : [],
        totalDomElements: document.querySelectorAll('*').length,
        featureInnerDomCounts: {
          result: countChildren('#result-overlay'),
          profile: countChildren('#profileModal'),
          rulesHelp: countChildren('#rules-help-panel'),
          deckBuilder: countChildren('#deckBuilderModal'),
          network:
            countChildren('#networkModal')
            + countChildren('#networkChatPanel')
        },
        initialHelpImageSrcCount: [
          document.getElementById('rules-help-guide-slide-img'),
          document.getElementById('rules-help-protection-map-img')
        ].filter((image) => image?.hasAttribute('src')).length,
        initialHelpImageDimensionsReserved: [
          document.getElementById('rules-help-guide-slide-img'),
          document.getElementById('rules-help-protection-map-img')
        ].every((image) => (
          image instanceof HTMLImageElement
            && Number(image.getAttribute('width')) > 0
            && Number(image.getAttribute('height')) > 0
        )),
        domCompatStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="board-dom-compat"]'
        ).length,
        domCompatStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot="board-dom-compat"]'
        ).length,
        resultStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length,
        resultStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot="result"]'
        ).length,
        profileStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        profileStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot="profile"]'
        ).length,
        rulesHelpStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        rulesHelpStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="rules-help"]'
        ).length,
        deckBuilderStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="deck-builder"]'
        ).length,
        deckBuilderStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="deck-builder"]'
        ).length,
        networkStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="network"]'
        ).length,
        networkStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="network"]'
        ).length,
        initialHelpImageElementCount: [
          document.getElementById('rules-help-guide-slide-img'),
          document.getElementById('rules-help-protection-map-img')
        ].filter(Boolean).length,
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
          imageConstructorCount: snapshot.imageConstructorCount,
          imageConstructorAssignments: snapshot.imageConstructorAssignments,
          logicalImageSrcMutations: snapshot.logicalImageSrcMutations,
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

function readVitePixiRuntimePaths(rootDir: string): readonly string[] {
  const manifestPath = path.join(
    rootDir,
    DEFAULT_ARTIFACT_ROOT,
    'vite-dist',
    '.vite',
    'manifest.json'
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as
    Record<string, { file?: string }>;
  const keys = [
    'node_modules/pixi.js/lib/index.mjs',
    'node_modules/pixi.js/lib/unsafe-eval/init.mjs'
  ];
  return Object.freeze(keys.map((key) => {
    const file = String(manifest[key]?.file || '').trim();
    if (!file) throw new Error(`Vite manifest is missing ${key}`);
    return `/vite-dist/${file.replace(/^\/+/, '')}`;
  }));
}

async function abortPixiRuntimeForScenario(
  page: Page,
  lane: 'vite' | 'classic',
  vitePaths: readonly string[]
): Promise<void> {
  const paths = lane === 'classic' ? CLASSIC_PIXI_RUNTIME_PATHS : vitePaths;
  for (const runtimePath of paths) {
    await page.route(`**${runtimePath}`, (route) => route.abort());
  }
}

async function verifyDomCompatibilityStylesheetFailure(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const context = await browser.newContext({
    viewport: UX_OPTIMIZATION_CAPTURE_POLICY.viewport,
    deviceScaleFactor: UX_OPTIMIZATION_CAPTURE_POLICY.dpr
  });
  const page = await context.newPage();
  const surfacedErrors: string[] = [];
  page.on('pageerror', (error) => surfacedErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') surfacedErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === DOM_COMPAT_STYLESHEET_PATH) {
      surfacedErrors.push('dom-compat-stylesheet-request-failed');
    }
  });
  await page.route(`**/${DOM_COMPAT_STYLESHEET_PATH}*`, (route) => route.abort());
  try {
    await page.goto(buildBootCaptureUrl(baseUrl, definition, 'dom'), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    await page.waitForTimeout(1_000);
    return Object.freeze(await page.evaluate((errorCount) => {
      const board = document.getElementById('board');
      const bootError = document.getElementById('browserViteBootError')?.textContent || '';
      return {
        stylesheetFailurePreventedMount:
          !board?.dataset.cardReversiDomBackendMountedAt
          && board?.getAttribute('data-board-renderer') !== 'dom',
        stylesheetFailureSurfaced: errorCount > 0 || bootError.length > 0,
        stylesheetFailureUiInitialized: (window as any).__uiInitialized === true
      };
    }, surfacedErrors.length));
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

async function captureRuntimeSnapshot(
  runtime: BootRuntime,
  definition: UxOptimizationScenarioCaptureDefinition,
  extraMetrics: Readonly<Record<string, unknown>>,
  expectedFault?: Readonly<{
    kind: BrowserErrorEvidence['kind'];
    path: string;
    count: number;
  }>
): Promise<Readonly<Record<string, unknown>>> {
  const rawSnapshot = await runtime.page.evaluate((key) => {
    const probe = (window as any)[key];
    if (!probe || typeof probe.snapshot !== 'function') {
      throw new Error('UX optimization probe snapshot is unavailable');
    }
    return probe.snapshot();
  }, UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL);
  const snapshot = normalizeBrowserProbeSnapshot(rawSnapshot);
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
  return Object.freeze({
    id: definition.id,
    lane: definition.lane,
    backend: definition.backend,
    cacheProfile: definition.cacheProfile,
    captureStatus: 'complete',
    ...(expectedFault ? { expectedFault } : {}),
    phases: snapshot.phases,
    resources: Object.freeze([...snapshot.resources, ...untimedResponseResources]),
    errors: Object.freeze(runtime.errors.slice()),
    metrics: Object.freeze({
      ...extraMetrics,
      capturedAtMs: snapshot.capturedAtMs,
      timeOrigin: snapshot.timeOrigin,
      cls: snapshot.cls,
      longTasks: snapshot.longTasks,
      rafIntervalsMs: snapshot.rafIntervalsMs,
      visibility: snapshot.visibility,
      focused: snapshot.focused,
      capabilities: snapshot.capabilities
    })
  });
}

async function readSpecialScenarioSurfaceMetrics(page: Page): Promise<Readonly<Record<string, unknown>>> {
  return Object.freeze(await page.evaluate(() => {
    const debug = (window as any).__boardVisualDebug;
    const backend = String(
      debug?.getBackendKind?.()
      || document.getElementById('board')?.getAttribute('data-board-renderer')
      || 'none'
    );
    const backendDiagnostics = debug?.getBackendDiagnostics?.() || null;
    const host = document.getElementById('board');
    const cellCount = Number(backendDiagnostics?.domCellCount || 0);
    const canvasCount = Number(backendDiagnostics?.canvasCount || 0);
    const compatStylesheet = document.querySelector(
      'link[data-card-reversi-feature-style="board-dom-compat"]'
    ) as HTMLLinkElement | null;
    const compatStylesheetSlot = document.querySelector(
      '[data-card-reversi-feature-style-slot="board-dom-compat"]'
    );
    return {
      backend,
      cellCount,
      canvasCount,
      singleWriter: backend === 'dom' ? canvasCount === 0 && cellCount > 0 : canvasCount === 1,
      fallbackStyled: backend !== 'dom' || backendDiagnostics?.computedStyleReady === true,
      domCompatStylesheetLinkCount: document.querySelectorAll(
        'link[data-card-reversi-feature-style="board-dom-compat"]'
      ).length,
      domCompatStylesheetLoaded:
        compatStylesheet?.dataset.cardReversiFeatureStyleLoaded === 'true',
      domCompatStylesheetReadyAt: Number(
        compatStylesheet?.dataset.cardReversiFeatureStyleReadyAt || NaN
      ),
      domBackendMountedAt: Number(
        host?.dataset.cardReversiDomBackendMountedAt || NaN
      ),
      domCompatStylesheetAtSlot: !!(
        compatStylesheet
        && compatStylesheetSlot
        && compatStylesheet.nextElementSibling === compatStylesheetSlot
      ),
      neededSpecialAssetIds: Array.isArray(backendDiagnostics?.neededSpecialAssetIds)
        ? backendDiagnostics.neededSpecialAssetIds.map(String).sort()
        : []
    };
  }));
}

async function injectFirstSpecialFrame(page: Page): Promise<Readonly<Record<string, unknown>>> {
  return Object.freeze(await page.evaluate(async () => {
    const root = window as any;
    const bootstrap = root.UIBootstrap;
    const controller = bootstrap && typeof bootstrap.getBoardVisualController === 'function'
      ? bootstrap.getBoardVisualController()
      : null;
    const debug = root.__boardVisualDebug;
    if (!controller || typeof controller.getSettledFrame !== 'function') {
      throw new Error('Board visual controller is unavailable for the first-special fixture');
    }
    await controller.waitForIdle();
    const checkpoint = controller.getSettledFrame();
    if (!checkpoint?.model?.cells) throw new Error('Settled visual frame is unavailable');
    const targetIndex = checkpoint.model.cells.findIndex((cell: any) => !!cell?.stone);
    if (targetIndex < 0) throw new Error('First-special fixture requires an occupied cell');
    const frameToken = `ux-monitor:first-special:${Date.now()}`;
    const cells = checkpoint.model.cells.map((cell: any, index: number) => {
      if (index !== targetIndex) return cell;
      return Object.freeze({
        ...cell,
        stone: Object.freeze({
          ...cell.stone,
          specialType: 'TIME_BOMB'
        }),
        visualSignature: `${String(cell.visualSignature || '')}:ux-first-special`,
        stoneSignature: `${String(cell.stoneSignature || '')}:ux-first-special`
      });
    });
    const model = Object.freeze({
      ...checkpoint.model,
      visualRevision: Number(checkpoint.model.visualRevision || 0) + 1,
      cells: Object.freeze(cells)
    });
    const frame = Object.freeze({
      ...checkpoint,
      frameToken,
      model
    });
    const token = controller.claimWriter(frameToken, 'local');
    const accepted = await controller.settleLocalWriter(token, frame);
    await controller.waitForIdle();
    const entries = debug?.getDiagnosticEntries?.() || [];
    const preparedIndex = entries.findIndex((entry: any) => (
      entry?.event === 'frame:prepared' && entry?.detail?.frameToken === frameToken
    ));
    const settledToken = debug?.getBackendDiagnostics?.()?.settledFrameToken || null;
    return {
      accepted,
      framePreparedBeforeSettlement: preparedIndex >= 0 && settledToken === frameToken,
      settledSpecialFrame: settledToken === frameToken
    };
  }));
}

async function triggerContextLossFallback(page: Page): Promise<Readonly<Record<string, unknown>>> {
  const startedAt = Date.now();
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#board canvas');
    if (!canvas) throw new Error('Pixi canvas is unavailable for context-loss fixture');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context is unavailable');
    canvas.addEventListener('webglcontextlost', (event) => {
      (window as any).__uxOptimizationContextLossPrevented = event.defaultPrevented;
    }, { once: true });
    extension.loseContext();
  });
  await page.waitForFunction(() => {
    const debug = (window as any).__boardVisualDebug;
    return debug?.getBackendKind?.() === 'dom'
      && debug?.getWriterMode?.() === 'idle';
  }, null, { timeout: 15_000 });
  return Object.freeze(await page.evaluate((elapsedMs) => ({
    lossPrevented: (window as any).__uxOptimizationContextLossPrevented === true,
    fallbackElapsedMs: elapsedMs
  }), Date.now() - startedAt));
}

async function exerciseLockToggle(page: Page): Promise<Readonly<Record<string, unknown>>> {
  return Object.freeze(await page.evaluate(async () => {
    const root = window as any;
    const bootstrap = root.UIBootstrap;
    const controller = bootstrap && typeof bootstrap.getBoardVisualController === 'function'
      ? bootstrap.getBoardVisualController()
      : null;
    const renderer = typeof root.__require === 'function'
      ? root.__require('ui/board-renderer')
      : null;
    const input = renderer && typeof renderer.getBoardInputController === 'function'
      ? renderer.getBoardInputController()
      : null;
    if (!controller || !input || typeof controller.getSettledFrame !== 'function') {
      throw new Error('Board lock-toggle fixture runtime is unavailable');
    }
    await controller.waitForIdle();
    const checkpoint = controller.getSettledFrame();
    if (!checkpoint?.model?.cells) throw new Error('Board lock-toggle fixture has no settled frame');

    const counters = () => {
      const scene = controller.getBackendDiagnostics?.()?.scene || {};
      return {
        cell: Number(scene.cumulativeUpdatedCellViewCount) || 0,
        stone: Number(scene.cumulativeUpdatedStoneViewCount) || 0,
        hint: Number(scene.cumulativeUpdatedHintViewCount) || 0,
        paint: Number(scene.cumulativeHintPaintCount) || 0,
        input: Number(scene.cumulativeHintInputSyncCount) || 0
      };
    };
    const delta = (before: ReturnType<typeof counters>, after: ReturnType<typeof counters>) => ({
      updatedCellViews: after.cell - before.cell,
      updatedStoneViews: after.stone - before.stone,
      updatedHintViews: after.hint - before.hint,
      hintPaintCount: after.paint - before.paint,
      hintInputSyncCount: after.input - before.input
    });
    const buildFrame = (base: any, locked: boolean, suffix: string) => {
      const cells = base.model.cells.map((cell: any) => Object.freeze({
        ...cell,
        interaction: Object.freeze({
          ...cell.interaction,
          interactionLocked: locked
        }),
        visualSignature: `${String(cell.visualSignature || '')}:ux-lock=${locked}`,
        hintPaintSignature: String(cell.hintPaintSignature || ''),
        hintInputSignature: `${String(cell.hintInputSignature || '')}:ux-lock=${locked}`,
        interactionSignature: `${String(cell.interactionSignature || '')}:ux-lock=${locked}`
      }));
      return Object.freeze({
        ...base,
        frameToken: `ux-monitor:lock-toggle:${suffix}:${Date.now()}`,
        model: Object.freeze({
          ...base.model,
          visualRevision: Number(base.model.visualRevision || 0) + 1,
          cells: Object.freeze(cells)
        })
      });
    };
    const settle = async (frame: any) => {
      const startedAt = performance.now();
      const token = controller.claimWriter(frame.frameToken, 'local');
      const accepted = await controller.settleLocalWriter(token, frame);
      await controller.waitForIdle();
      return { accepted, durationMs: performance.now() - startedAt };
    };

    // Normalize the fixture to an explicitly unlocked frame before the
    // measured lock transition. Its hint paint signature remains identical.
    const normalized = buildFrame(checkpoint, false, 'normalized');
    await settle(normalized);
    const beforeLock = counters();
    const lockedFrame = buildFrame(normalized, true, 'locked');
    const lockSettlement = await settle(lockedFrame);
    const afterLock = counters();
    const legalCells = typeof input.getLegalCells === 'function' ? input.getLegalCells() : [];
    const target = Array.isArray(legalCells) ? legalCells[0] : null;
    if (!target) throw new Error('Board lock-toggle fixture has no legal input cell');

    const pointerAccepted = input.handlePointer?.({
      type: 'pointerdown',
      row: target.row,
      col: target.col,
      pointerId: 101,
      pointerType: 'mouse',
      button: 0,
      clientX: 0,
      clientY: 0
    }) === true || input.handlePointer?.({
      type: 'pointerup',
      row: target.row,
      col: target.col,
      pointerId: 101,
      pointerType: 'mouse',
      button: 0,
      clientX: 0,
      clientY: 0
    }) === true;
    const touchAccepted = input.handlePointer?.({
      type: 'pointerdown',
      row: target.row,
      col: target.col,
      pointerId: 102,
      pointerType: 'touch',
      button: 0,
      clientX: 0,
      clientY: 0
    }) === true || input.handlePointer?.({
      type: 'pointerup',
      row: target.row,
      col: target.col,
      pointerId: 102,
      pointerType: 'touch',
      button: 0,
      clientX: 0,
      clientY: 0
    }) === true;
    const keyboardAccepted = input.handleKeyboard?.({ code: 'Space', key: ' ' }) === true;
    const directAccepted = input.activateCell?.(target.row, target.col) === true;
    const lockedInputState = input.getState?.() || {};

    const beforeUnlock = counters();
    const unlockedFrame = buildFrame(lockedFrame, false, 'unlocked');
    const unlockSettlement = await settle(unlockedFrame);
    const afterUnlock = counters();
    const unlockAcceptedCount = input.activateCell?.(target.row, target.col) === true ? 1 : 0;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      backend: String(controller.getBackendKind?.() || ''),
      lockAccepted: lockSettlement.accepted === true,
      unlockAccepted: unlockSettlement.accepted === true,
      lockApplyDurationMs: lockSettlement.durationMs,
      unlockApplyDurationMs: unlockSettlement.durationMs,
      lockDelta: delta(beforeLock, afterLock),
      unlockDelta: delta(beforeUnlock, afterUnlock),
      lockedCommandCount: [
        pointerAccepted,
        touchAccepted,
        keyboardAccepted,
        directAccepted
      ].filter(Boolean).length,
      unlockCommandCount: unlockAcceptedCount,
      staleInputStateCount: [
        lockedInputState.activePointerId != null,
        lockedInputState.hoveredCellKey != null,
        lockedInputState.longPressed === true
      ].filter(Boolean).length
    };
  }));
}

async function exerciseOpponentTurn(page: Page): Promise<Readonly<Record<string, unknown>>> {
  return Object.freeze(await page.evaluate(async () => {
    const root = window as any;
    const debug = root.__boardVisualDebug;
    const core = root.__require?.('game/logic/core');
    const cards = root.__require?.('game/logic/cards');
    if (!debug || !core?.createGameState || !cards?.createCardState) {
      throw new Error('Opponent-turn fixture runtime is unavailable');
    }
    const levelSelect = document.querySelector<HTMLSelectElement>('#smartWhite');
    if (levelSelect) {
      levelSelect.value = '1';
      levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    root.MATCH_MODE = 'cpu';
    root.DEBUG_HUMAN_VS_HUMAN = false;
    root.DEBUG_UNLIMITED_USAGE = true;
    for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
      root[key] = root[key] || {};
      root[key].MATCH_MODE = 'cpu';
      root[key].DEBUG_HUMAN_VS_HUMAN = false;
      root[key].DEBUG_UNLIMITED_USAGE = true;
    }
    const installFixture = async (turnNumber: number) => {
      const nextGame = core.createGameState();
      const nextCards = cards.createCardState(null, {
        boardConfig: nextGame.boardConfig,
        initialDeckCardIdsByPlayer: { black: [], white: [] },
        initialChargeByPlayer: { black: 99, white: 99 }
      });
      nextGame.currentPlayer = 1;
      nextGame.turnNumber = turnNumber;
      nextGame.consecutivePasses = 0;
      nextCards.turnIndex = turnNumber;
      root.gameState = nextGame;
      root.cardState = nextCards;
      root.isProcessing = false;
      root.isCardAnimating = false;
      root.VisualPlaybackActive = false;
      try {
        const playback = root.__require?.('ui/playback-state-manager');
        playback?.clearVisualPlaybackClaims?.();
        playback?.clearSelectionSettlementLocks?.();
        playback?.setBusyState?.({ processing: false, cardAnimating: false });
        playback?.clearPlaybackLock?.();
      } catch (_error) { /* fixture state remains isolated in this page */ }
      root.renderCardUI?.();
      root.renderBoard?.();
      await debug.waitForIdle();
      const protection = root.getActiveProtectionForPlayer?.(1) || [];
      const blockers = root.getFlipBlockers?.() || [];
      const legal = root.getLegalMoves?.(root.gameState, protection, blockers) || [];
      if (!Array.isArray(legal) || legal.length === 0) {
        throw new Error('Opponent-turn fixture has no legal move');
      }
      return legal[0];
    };
    const runOpponentCycle = async (move: unknown) => {
      const startTurn = Number(root.gameState.turnNumber);
      const started = root.executeMove?.(move);
      await Promise.resolve(started);
      const deadline = performance.now() + 30_000;
      while (!(
        Number(root.gameState?.turnNumber) >= startTurn + 2
        && root.gameState?.currentPlayer === 1
        && root.isProcessing !== true
        && root.isCardAnimating !== true
        && !root.cardState?.pendingEffectByPlayer?.white
      )) {
        if (performance.now() >= deadline) throw new Error('Opponent-turn fixture timed out');
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      if (typeof root.waitForPlaybackIdle === 'function') await root.waitForPlaybackIdle();
      await debug.waitForIdle();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    };

    // Match the established opponent-action performance harness: initialize
    // first-use CPU/playback paths outside the measured interval, then measure
    // the same deterministic fixture from a fresh canonical state.
    const warmupMove = await installFixture(1900);
    await runOpponentCycle(warmupMove);
    const measuredMove = await installFixture(2000);

    const intervals: number[] = [];
    let previousRaf: number | null = null;
    let rafId = 0;
    let recording = true;
    const tick = (atMs: number) => {
      if (!recording) return;
      if (previousRaf !== null) intervals.push(Math.max(0, atMs - previousRaf));
      previousRaf = atMs;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    const longTasks: number[] = [];
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(Number(entry.duration) || 0);
      });
      observer.observe({ type: 'longtask' } as PerformanceObserverInit);
    } catch (_error) { /* capability is reported separately */ }
    await runOpponentCycle(measuredMove);
    recording = false;
    cancelAnimationFrame(rafId);
    observer?.disconnect();
    const sorted = intervals.slice().sort((left, right) => left - right);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const diagnostics = debug.getBackendDiagnostics?.() || {};
    const supported = typeof PerformanceObserver === 'function'
      && (PerformanceObserver.supportedEntryTypes || []).includes('longtask');
    return {
      backend: String(debug.getBackendKind?.() || ''),
      settledOpponentTurn: true,
      longTaskSupported: supported,
      longTaskCount: longTasks.filter((duration) => duration >= 50).length,
      rafSampleCount: intervals.length,
      rafP95Ms: sorted.length ? sorted[p95Index] : null,
      rafStall50msCount: intervals.filter((duration) => duration >= 50).length,
      tickerIdle: diagnostics.tickerRunning !== true
    };
  }));
}

async function captureLockOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await markProbePhase(runtime.page, `playback:${definition.id}`);
    const metrics = definition.id === 'board.lock-toggle'
      ? await exerciseLockToggle(runtime.page)
      : await exerciseOpponentTurn(runtime.page);
    await markProbePhase(runtime.page, `board-idle:${definition.id}`);
    return await captureRuntimeSnapshot(runtime, definition, metrics);
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureSpecialOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  rootDir: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const viteRuntimePaths = readVitePixiRuntimePaths(rootDir);
  const isExplicitDom = definition.id === 'fallback.explicit-dom';
  const isInitFailure = definition.id === 'fallback.pixi-init-failure';
  const runtime = await openBootRuntime(
    browser,
    baseUrl,
    definition,
    undefined,
    {
      boardRenderer: isExplicitDom ? 'dom' : 'pixi',
      beforeGoto: isInitFailure
        ? (page) => abortPixiRuntimeForScenario(page, definition.lane, viteRuntimePaths)
        : undefined
    }
  );
  try {
    let actionMetrics: Readonly<Record<string, unknown>> = Object.freeze({});
    let specialResponsesAtActionStart = new Set<string>();
    if (definition.id === 'board.first-special') {
      await runtime.page.waitForLoadState('networkidle', { timeout: 10_000 });
      specialResponsesAtActionStart = new Set(
        runtime.responsePaths.filter((resourcePath) => resourcePath.startsWith(SPECIAL_STONE_PATH_PREFIX))
      );
      await markProbePhase(runtime.page, 'playback:first-special-start');
      actionMetrics = await injectFirstSpecialFrame(runtime.page);
      await markProbePhase(runtime.page, 'board-idle:first-special-ready');
    } else if (definition.id === 'fallback.context-loss') {
      await markProbePhase(runtime.page, 'fallback-transition:context-loss');
      actionMetrics = await triggerContextLossFallback(runtime.page);
      await markProbePhase(runtime.page, 'board-idle:context-fallback-ready');
    }
    const surfaceMetrics = await readSpecialScenarioSurfaceMetrics(runtime.page);
    const specialResponsePaths = Object.freeze(Array.from(new Set(
      runtime.responsePaths.filter((resourcePath) => (
        resourcePath.startsWith(SPECIAL_STONE_PATH_PREFIX)
        && !specialResponsesAtActionStart.has(resourcePath)
      ))
    )).sort());
    const domCompatStylesheetResponseCount = runtime.responsePaths.filter(
      (resourcePath) => resourcePath === DOM_COMPAT_STYLESHEET_PATH
    ).length;
    const stylesheetFailureMetrics = isExplicitDom
      ? await verifyDomCompatibilityStylesheetFailure(browser, baseUrl, definition)
      : Object.freeze({});
    const expectedFault = isInitFailure
      ? Object.freeze({
        kind: 'console' as const,
        path: 'document',
        count: definition.lane === 'classic' ? 2 : 1
      })
      : undefined;
    return await captureRuntimeSnapshot(runtime, definition, {
      ...surfaceMetrics,
      ...actionMetrics,
      specialResponseCount: specialResponsePaths.length,
      specialResponsePaths,
      domCompatStylesheetResponseCount,
      ...stylesheetFailureMetrics
    }, expectedFault);
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function installHeldHelpIdleCallbacks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const callbacks = new Map<number, () => void>();
    let nextId = 1;
    const control = {
      releaseAll() {
        const pending = Array.from(callbacks.values());
        callbacks.clear();
        pending.forEach((callback) => callback());
      },
      pendingCount() {
        return callbacks.size;
      }
    };
    Object.defineProperty(window, '__uxHelpIdleControl', {
      configurable: true,
      enumerable: false,
      value: control
    });
    (window as any).requestIdleCallback = (callback: () => void) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    (window as any).cancelIdleCallback = (id: number) => {
      callbacks.delete(id);
    };
  });
}

function readHelpResources(snapshot: ReturnType<typeof normalizeBrowserProbeSnapshot>): readonly any[] {
  return snapshot.resources.filter((resource) => (
    INITIAL_HELP_IMAGE_PATHS.includes(resource.path)
  ));
}

async function readNormalizedBrowserProbeSnapshot(
  page: Page
): Promise<ReturnType<typeof normalizeBrowserProbeSnapshot>> {
  const rawSnapshot = await page.evaluate((key) => {
    const probe = (window as any)[key];
    if (!probe || typeof probe.snapshot !== 'function') {
      throw new Error('UX optimization probe snapshot is unavailable');
    }
    return probe.snapshot();
  }, UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL);
  return normalizeBrowserProbeSnapshot(rawSnapshot);
}

async function captureHelpOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(
    browser,
    baseUrl,
    definition,
    undefined,
    {
      beforeGoto: installHeldHelpIdleCallbacks
    }
  );
  try {
    const afterIdle = definition.id === 'help.after-idle';
    if (afterIdle) {
      await markProbePhase(runtime.page, 'idle-prefetch:help-images');
      await runtime.page.evaluate(() => {
        const control = (window as any).__uxHelpIdleControl;
        if (!control || typeof control.releaseAll !== 'function') {
          throw new Error('Held help idle callback control is unavailable');
        }
        control.releaseAll();
      });
      await runtime.page.waitForFunction((paths) => {
        const observed = new Set(
          performance.getEntriesByType('resource')
            .map((entry) => new URL(entry.name).pathname.replace(/^\/+/, ''))
        );
        return paths.every((resourcePath) => observed.has(resourcePath));
      }, INITIAL_HELP_IMAGE_PATHS, { timeout: 30_000 });
      await runtime.page.waitForLoadState('networkidle', { timeout: 30_000 });
    }

    const beforeOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const beforeOpenHelpResources = readHelpResources(beforeOpenSnapshot);
    const helpResponsePathsBeforeOpen = Array.from(new Set(
      runtime.responsePaths.filter((resourcePath) => INITIAL_HELP_IMAGE_PATHS.includes(resourcePath))
    )).sort();
    const initialDomState = await runtime.page.evaluate(() => {
      const images = [
        document.getElementById('rules-help-guide-slide-img'),
        document.getElementById('rules-help-protection-map-img')
      ];
      return {
        initialInnerDomCount: document.querySelectorAll(
          '#rules-help-panel > *'
        ).length,
        initialImageElementCount: images.filter(Boolean).length,
        initialStylesheetLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        stylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="rules-help"]'
        ).length,
        initialSrcCount: images.filter((image) => image?.hasAttribute('src')).length,
        uiInitialized: (window as any).__uiInitialized === true,
        pendingIdleCallbackCount: Number(
          (window as any).__uxHelpIdleControl?.pendingCount?.() || 0
        )
      };
    });

    await markProbePhase(runtime.page, 'feature-opening:rules-help');
    const openStartMs = await runtime.page.evaluate(() => performance.now());
    await runtime.page.evaluate(() => {
      const openButton = document.getElementById('rulesHelpBtn') as HTMLButtonElement | null;
      if (!openButton) throw new Error('Rules help open button is unavailable');
      openButton.focus();
      openButton.click();
    });
    await runtime.page.waitForFunction(() => (
      document.getElementById('rules-help-panel')?.classList.contains('is-open') === true
      && document.querySelectorAll(
        'link[data-card-reversi-feature-style^="rules-help"]'
      ).length === 3
    ), null, { timeout: 30_000 });
    await runtime.page.evaluate(() => {
      const guideTab = document.querySelector(
        '[data-help-tab="guide"]'
      ) as HTMLButtonElement | null;
      if (!guideTab) throw new Error('Rules help guide tab is unavailable');
      guideTab.focus();
      guideTab.click();
    });
    await runtime.page.waitForFunction(() => {
      const guide = document.getElementById(
        'rules-help-guide-slide-img'
      ) as HTMLImageElement | null;
      const protection = document.getElementById(
        'rules-help-protection-map-img'
      ) as HTMLImageElement | null;
      return !!guide?.complete
        && Number(guide.naturalWidth) > 0
        && !!protection?.complete
        && Number(protection.naturalWidth) > 0;
    }, null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:rules-help');

    const surfaceMetrics = await runtime.page.evaluate((startedAtMs) => {
      const panel = document.getElementById('rules-help-panel');
      const guide = document.getElementById(
        'rules-help-guide-slide-img'
      ) as HTMLImageElement | null;
      const protection = document.getElementById(
        'rules-help-protection-map-img'
      ) as HTMLImageElement | null;
      const guideFrame = document.getElementById('rules-help-guide-slide-frame');
      const protectionFrame = document.getElementById('rules-help-protection-map-frame');
      const guideRect = guideFrame?.getBoundingClientRect();
      const protectionTab = document.querySelector(
        '[data-help-tab="protection-map"]'
      ) as HTMLButtonElement | null;
      protectionTab?.focus();
      protectionTab?.click();
      const protectionRect = protectionFrame?.getBoundingClientRect();
      const activeElement = document.activeElement;
      return {
        backend: String(
          (window as any).__boardVisualDebug?.getBackendKind?.()
          || document.documentElement.getAttribute('data-board-visual-backend')
          || 'none'
        ),
        panelOpen: panel?.getAttribute('aria-hidden') === 'false'
          && panel.classList.contains('is-open'),
        guideComplete: !!guide?.complete && Number(guide.naturalWidth) > 0,
        protectionComplete: !!protection?.complete && Number(protection.naturalWidth) > 0,
        guideFrameVisible: Number(guideRect?.width || 0) > 0 && Number(guideRect?.height || 0) > 0,
        protectionFrameVisible: Number(protectionRect?.width || 0) > 0
          && Number(protectionRect?.height || 0) > 0,
        guideDimensions: {
          width: Number(guide?.getAttribute('width') || 0),
          height: Number(guide?.getAttribute('height') || 0)
        },
        protectionDimensions: {
          width: Number(protection?.getAttribute('width') || 0),
          height: Number(protection?.getAttribute('height') || 0)
        },
        dimensionsReserved:
          Number(guide?.getAttribute('width') || 0) > 0
          && Number(guide?.getAttribute('height') || 0) > 0
          && Number(protection?.getAttribute('width') || 0) > 0
          && Number(protection?.getAttribute('height') || 0) > 0,
        focusWithinPanel: !!activeElement && !!panel?.contains(activeElement),
        focusedElementId: activeElement?.id || '',
        firstOpenLatencyMs: performance.now() - Number(startedAtMs)
      };
    }, openStartMs);

    const afterOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const afterOpenHelpResources = readHelpResources(afterOpenSnapshot);
    const firstFrameAtMs = afterOpenSnapshot.phases.find(
      (phase) => phase.name === 'first-frame-committed'
    )?.atMs ?? null;
    const boardIdleAtMs = afterOpenSnapshot.phases.find(
      (phase) => phase.name === 'board-idle'
    )?.atMs ?? null;
    const idlePrefetchAtMs = afterOpenSnapshot.phases.find(
      (phase) => phase.name === 'idle-prefetch:help-images'
    )?.atMs ?? null;
    const additionalHelpResources = afterOpenHelpResources.filter(
      (resource) => resource.startMs >= openStartMs
    );
    const helpResponsePathsAfterOpen = Array.from(new Set(
      runtime.responsePaths.filter((resourcePath) => INITIAL_HELP_IMAGE_PATHS.includes(resourcePath))
    )).sort();
    const earliestHelpResourceStartMs = afterOpenHelpResources.length
      ? Math.min(...afterOpenHelpResources.map((resource) => resource.startMs))
      : null;

    return await captureRuntimeSnapshot(runtime, definition, {
      ...surfaceMetrics,
      ...initialDomState,
      helpResourceEntriesBeforeOpen: beforeOpenHelpResources.length,
      helpResponsePathsBeforeOpen,
      helpResponsePathsAfterOpen,
      helpResourcePathCount: new Set(
        afterOpenHelpResources.map((resource) => resource.path)
      ).size,
      helpEncodedBodyBytes: afterOpenHelpResources.reduce(
        (total, resource) => total + Math.max(0, Number(resource.encodedBodySize) || 0),
        0
      ),
      helpRequestsBeforeFirstFrame: Number.isFinite(firstFrameAtMs)
        ? afterOpenHelpResources.filter((resource) => resource.startMs < Number(firstFrameAtMs)).length
        : -1,
      earliestHelpResourceStartMs,
      firstFrameAtMs,
      boardIdleAtMs,
      idlePrefetchAtMs,
      additionalHelpTransferSizeAfterOpen: additionalHelpResources.reduce(
        (total, resource) => total + Math.max(0, Number(resource.transferSize) || 0),
        0
      ),
      additionalHelpResourceEntriesAfterOpen: additionalHelpResources.length,
      clsDelta: Math.max(0, afterOpenSnapshot.cls - beforeOpenSnapshot.cls)
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureFailedRulesHelpStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  const failedPath = RULES_HELP_STYLESHEET_PATHS[0];
  let failedPathRequestCount = 0;
  let failedPathRequestFailureCount = 0;
  let warningCount = 0;
  runtime.page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === failedPath) {
      failedPathRequestFailureCount += 1;
    }
  });
  runtime.page.on('console', (message) => {
    if (
      message.type() === 'warning'
      && message.text().includes(`[feature-stylesheet] failed to load ${failedPath}`)
    ) {
      warningCount += 1;
    }
  });
  await runtime.page.route(`**/${failedPath}*`, async (route) => {
    failedPathRequestCount += 1;
    if (failedPathRequestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    await runtime.page.click('#rulesHelpBtn');
    await runtime.page.waitForSelector(
      '#rules-help-panel.rules-help-surface-failure.is-open',
      { state: 'visible', timeout: 30_000 }
    );
    await runtime.page.waitForFunction(() => (
      document.querySelectorAll(
        'link[data-card-reversi-feature-style^="rules-help"]'
      ).length === 0
    ), null, { timeout: 30_000 });
    const failed = await runtime.page.evaluate(() => {
      const panel = document.getElementById('rules-help-panel');
      const close = panel?.querySelector('button') as HTMLButtonElement | null;
      return {
        failureVisible:
          panel?.classList.contains('is-open') === true
          && Number(panel.getBoundingClientRect().width) > 0
          && Number(panel.getBoundingClientRect().height) > 0,
        failureFocused: document.activeElement === close,
        failureDialogStable:
          panel?.getAttribute('role') === 'dialog'
          && panel.getAttribute('aria-label') === 'help',
        failureNormalInnerDomCount: panel?.querySelectorAll(
          '#rules-help-title-row, #rules-help-tabs, #rules-help-pages'
        ).length || 0,
        failureLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        failureRetryGuidance:
          panel?.textContent?.includes('もう一度押すと再試行') === true
      };
    });
    await runtime.page.evaluate(() => {
      const failureClose = document.querySelector(
        '#rules-help-panel.rules-help-surface-failure button'
      ) as HTMLButtonElement | null;
      if (!failureClose) throw new Error('Rules help failure close button is unavailable');
      failureClose.click();
    });
    await runtime.page.click('#rulesHelpBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="rules-help"]'
      ));
      return document.getElementById('rules-help-panel')?.classList.contains('is-open') === true
        && links.length === 3
        && links.every((link) => (
          link.dataset.cardReversiFeatureStyleLoaded === 'true'
        ));
    }, null, { timeout: 30_000 });
    const retried = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'rules-help',
        document
      ) || null;
      return {
        failureRetryReady: !!document.getElementById('rules-help-title-row'),
        failureRetryLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        failureRetryInnerDomCount: document.querySelectorAll(
          '#rules-help-panel > #rules-help-title-row, '
          + '#rules-help-panel > #rules-help-tabs, '
          + '#rules-help-panel > #rules-help-pages'
        ).length,
        failureRetryAttemptCount: Number(diagnostics?.attemptCount || 0),
        failureRetryFailureCount: Number(diagnostics?.failureCount || 0),
        failureRetryCount: Number(diagnostics?.retryCount || 0)
      };
    });
    return Object.freeze({
      ...failed,
      ...retried,
      failureRequestCount: failedPathRequestCount,
      failureRequestFailureCount: failedPathRequestFailureCount,
      failureResponseCount: countPath(runtime.responsePaths, failedPath),
      failureConsoleErrorCount: runtime.errors.filter(
        (error) => error.kind === 'console'
      ).length,
      failureConsoleWarningCount: warningCount
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureRulesHelpOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    const beforeSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const initial = await runtime.page.evaluate((stylesheetPaths) => {
      const icon = document.querySelector(
        '#rulesHelpBtn .left-action-icon-help'
      ) as HTMLElement | null;
      const responsePaths = new Set(
        performance.getEntriesByType('resource').map((entry) => {
          try {
            return new URL(entry.name).pathname.replace(/^\/+/, '');
          } catch (_error) {
            return '';
          }
        })
      );
      return {
        backend: String(
          (window as any).__boardVisualDebug?.getBackendKind?.()
          || document.documentElement.getAttribute('data-board-visual-backend')
          || 'none'
        ),
        uiInitialized: (window as any).__uiInitialized === true,
        rulesHelpStylesheetLinkCountBeforeOpen: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        rulesHelpStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="rules-help"]'
        ).length,
        rulesHelpInnerDomCountBeforeOpen: document.querySelectorAll(
          '#rules-help-panel > *'
        ).length,
        rulesHelpImageElementCountBeforeOpen: document.querySelectorAll(
          '#rules-help-panel img'
        ).length,
        rulesHelpResourceCountBeforeOpen: stylesheetPaths.filter(
          (resourcePath) => responsePaths.has(resourcePath)
        ).length,
        rulesHelpOpenIconReady: !!icon && (
          getComputedStyle(icon).maskImage !== 'none'
          || getComputedStyle(icon).webkitMaskImage !== 'none'
        )
      };
    }, RULES_HELP_STYLESHEET_PATHS);
    const responsesBeforeOpen = RULES_HELP_STYLESHEET_PATHS.reduce(
      (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
      0
    );
    await markProbePhase(runtime.page, 'feature-opening:rules-help');
    await runtime.page.evaluate(() => {
      const button = document.getElementById('rulesHelpBtn');
      button?.addEventListener('click', () => {
        (window as any).__uxRulesHelpStartedAtMs = performance.now();
      }, { capture: true, once: true });
    });
    await runtime.page.click('#rulesHelpBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="rules-help"]'
      ));
      const guide = document.getElementById(
        'rules-help-guide-slide-img'
      ) as HTMLImageElement | null;
      const protection = document.getElementById(
        'rules-help-protection-map-img'
      ) as HTMLImageElement | null;
      return document.getElementById('rules-help-panel')?.classList.contains('is-open') === true
        && links.length === 3
        && links.every((link) => link.dataset.cardReversiFeatureStyleLoaded === 'true')
        && !!guide?.complete
        && Number(guide.naturalWidth) > 0
        && !!protection?.complete
        && Number(protection.naturalWidth) > 0;
    }, null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:rules-help');
    const firstOpen = await runtime.page.evaluate((stylesheetPaths) => {
      const root = window as any;
      const panel = document.getElementById('rules-help-panel') as HTMLElement | null;
      const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"]'
      ));
      const featureLinks = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="rules-help"]'
      ));
      const indexOf = (nameValue: string): number => links.findIndex((candidate) => {
        try {
          return new URL(candidate.href).pathname.endsWith(`/${nameValue}`);
        } catch (_error) {
          return false;
        }
      });
      const cascadePairs = [
        ['styles-layout-info.css', stylesheetPaths[0]],
        ['styles-cards.css', stylesheetPaths[1]],
        ['styles-responsive.css', stylesheetPaths[2]]
      ];
      root.__uxRulesHelpInnerNode = document.getElementById('rules-help-title-row');
      return {
        firstOpenLatencyMs:
          performance.now() - Number(root.__uxRulesHelpStartedAtMs),
        firstStyleReadyLatencyMs:
          Math.max(...featureLinks.map((link) => (
            Number(link.dataset.cardReversiFeatureStyleReadyAt || NaN)
          ))) - Number(root.__uxRulesHelpStartedAtMs),
        firstLinkCount: featureLinks.length,
        firstInnerDomCount: document.querySelectorAll(
          '#rules-help-panel > #rules-help-title-row, '
          + '#rules-help-panel > #rules-help-tabs, '
          + '#rules-help-panel > #rules-help-pages'
        ).length,
        firstPanelVisible:
          Number(panel?.getBoundingClientRect().width || 0) > 0
          && Number(panel?.getBoundingClientRect().height || 0) > 0,
        firstFullStyleReady:
          featureLinks.length === 3
          && featureLinks.every((link) => (
            link.dataset.cardReversiFeatureStyleLoaded === 'true'
          )),
        firstCascadeOrderPreserved: cascadePairs.every(([source, feature]) => (
          indexOf(feature) === indexOf(source) + 1
        )),
        firstCardCount: document.querySelectorAll(
          '#rules-help-card-list .rules-help-card-item'
        ).length,
        firstGuideComplete:
          (document.getElementById(
            'rules-help-guide-slide-img'
          ) as HTMLImageElement | null)?.complete === true,
        firstProtectionComplete:
          (document.getElementById(
            'rules-help-protection-map-img'
          ) as HTMLImageElement | null)?.complete === true,
        initialOpenControlFocused:
          document.activeElement === document.getElementById('rulesHelpBtn')
      };
    }, RULES_HELP_STYLESHEET_PATHS);
    await runtime.page.waitForTimeout(0);
    const firstOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);

    const totalCardCount = Number(firstOpen.firstCardCount || 0);
    await runtime.page.fill('#rules-help-card-search', '__monitor_no_match__');
    const search = await runtime.page.evaluate(() => ({
      searchNoMatchWorked: document.querySelectorAll(
        '#rules-help-card-list .rules-help-card-item'
      ).length === 0,
      searchStatusUpdated:
        document.getElementById('rules-help-card-filter-status')
          ?.textContent?.trim().startsWith('0 /') === true
    }));
    await runtime.page.click('#rules-help-card-filter-clear');
    const clear = await runtime.page.evaluate((expectedCount) => ({
      searchClearWorked:
        (document.getElementById('rules-help-card-search') as HTMLInputElement | null)
          ?.value === ''
        && document.querySelectorAll(
          '#rules-help-card-list .rules-help-card-item'
        ).length === expectedCount
    }), totalCardCount);
    await runtime.page.click('#rules-help-card-tag-filters .rules-help-card-tag-filter');
    const tag = await runtime.page.evaluate((expectedCount) => {
      const button = document.querySelector(
        '#rules-help-card-tag-filters .rules-help-card-tag-filter'
      );
      const filteredCount = document.querySelectorAll(
        '#rules-help-card-list .rules-help-card-item'
      ).length;
      return {
        tagFilterWorked:
          button?.getAttribute('aria-pressed') === 'true'
          && filteredCount > 0
          && filteredCount <= expectedCount
      };
    }, totalCardCount);
    await runtime.page.click('[data-help-tab="effects"]');
    const effects = await runtime.page.evaluate(() => ({
      effectsTabWorked:
        document.getElementById('rules-help-page-effects')
          ?.getAttribute('aria-hidden') === 'false'
        && document.querySelectorAll('#rules-help-effects-list > *').length > 0
    }));
    await runtime.page.click('[data-help-tab="guide"]');
    await runtime.page.click('#rules-help-guide-next');
    await runtime.page.waitForFunction(() => {
      const image = document.getElementById(
        'rules-help-guide-slide-img'
      ) as HTMLImageElement | null;
      return document.getElementById('rules-help-guide-page-status')
        ?.textContent?.trim() === '2 / 8'
        && !!image?.complete
        && Number(image.naturalWidth) > 0;
    }, null, { timeout: 30_000 });
    const guide = await runtime.page.evaluate(() => ({
      guideNextWorked:
        document.getElementById('rules-help-guide-page-status')
          ?.textContent?.trim() === '2 / 8'
    }));
    await runtime.page.click('[data-help-tab="protection-map"]');
    await runtime.page.click('#rules-help-protection-map-next');
    await runtime.page.waitForFunction(() => {
      const image = document.getElementById(
        'rules-help-protection-map-img'
      ) as HTMLImageElement | null;
      return document.getElementById('rules-help-protection-map-page-status')
        ?.textContent?.trim() === '2 / 2'
        && !!image?.complete
        && Number(image.naturalWidth) > 0;
    }, null, { timeout: 30_000 });
    const protection = await runtime.page.evaluate(() => ({
      protectionNextWorked:
        document.getElementById('rules-help-protection-map-page-status')
          ?.textContent?.trim() === '2 / 2'
        && document.getElementById('rules-help-protection-map-img')
          ?.getAttribute('data-card-reversi-logical-src')
          ?.endsWith('/protection-penetration-explainer.png') === true
    }));
    await runtime.page.click('[data-help-tab="counters"]');
    const counters = await runtime.page.evaluate(() => {
      const panel = document.getElementById('rules-help-panel');
      const tab = document.querySelector(
        '[data-help-tab="counters"]'
      ) as HTMLButtonElement | null;
      tab?.focus();
      return {
        countersTabWorked:
          document.getElementById('rules-help-page-counters')
            ?.getAttribute('aria-hidden') === 'false',
        focusWithinPanel:
          !!document.activeElement && !!panel?.contains(document.activeElement)
      };
    });
    await runtime.page.keyboard.press('Escape');
    const escapeClose = await runtime.page.evaluate(() => ({
      escapeClosed:
        document.getElementById('rules-help-panel')?.classList.contains('is-open') !== true,
      escapeFocusReturned:
        document.activeElement === document.getElementById('rulesHelpBtn')
    }));
    await runtime.page.click('#rulesHelpBtn');
    await runtime.page.waitForSelector('#rules-help-panel.is-open', {
      state: 'visible',
      timeout: 30_000
    });
    const reopen = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'rules-help',
        document
      ) || null;
      return {
        reopenSameInnerNode:
          (window as any).__uxRulesHelpInnerNode
            === document.getElementById('rules-help-title-row'),
        reopenLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="rules-help"]'
        ).length,
        reopenInnerDomCount: document.querySelectorAll(
          '#rules-help-panel > #rules-help-title-row, '
          + '#rules-help-panel > #rules-help-tabs, '
          + '#rules-help-panel > #rules-help-pages'
        ).length,
        diagnosticsAttemptCount: Number(diagnostics?.attemptCount || 0),
        diagnosticsDomCreatedCount: Number(diagnostics?.domCreatedCount || 0),
        diagnosticsReadyCount: Number(diagnostics?.readyCount || 0),
        diagnosticsFailureCount: Number(diagnostics?.failureCount || 0),
        diagnosticsListenerBindingCount: Number(
          diagnostics?.listenerBindingCount || 0
        )
      };
    });
    await runtime.page.click('#rules-help-backdrop', {
      position: { x: 1, y: 1 }
    });
    await runtime.page.waitForFunction(() => (
      document.activeElement === document.getElementById('rulesHelpBtn')
    ), null, { timeout: 10_000 });
    const backdropClose = await runtime.page.evaluate(() => ({
      backdropClosed:
        document.getElementById('rules-help-panel')?.classList.contains('is-open') !== true,
      backdropFocusReturned:
        document.activeElement === document.getElementById('rulesHelpBtn')
    }));
    const afterSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const startedAtMs = await runtime.page.evaluate(() => (
      Number((window as any).__uxRulesHelpStartedAtMs)
    ));
    const failure = await captureFailedRulesHelpStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    return await captureRuntimeSnapshot(runtime, definition, {
      ...initial,
      ...firstOpen,
      ...search,
      ...clear,
      ...tag,
      ...effects,
      ...guide,
      ...protection,
      ...counters,
      ...escapeClose,
      ...reopen,
      ...backdropClose,
      ...failure,
      rulesHelpResponseCountBeforeOpen: responsesBeforeOpen,
      rulesHelpResponseCountAfterOpen: RULES_HELP_STYLESHEET_PATHS.reduce(
        (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
        0
      ),
      firstOpenLongTaskSupported: firstOpenSnapshot.capabilities.longTask,
      firstOpenLongTaskCount: firstOpenSnapshot.longTasks.filter(
        (entry) => entry.startMs >= startedAtMs
      ).length,
      clsDelta: Math.max(0, afterSnapshot.cls - beforeSnapshot.cls)
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureFailedDeckBuilderStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  const failedPath = DECK_BUILDER_STYLESHEET_PATHS[0];
  let failedPathRequestCount = 0;
  let failedPathRequestFailureCount = 0;
  let warningCount = 0;
  runtime.page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === failedPath) {
      failedPathRequestFailureCount += 1;
    }
  });
  runtime.page.on('console', (message) => {
    if (
      message.type() === 'warning'
      && message.text().includes(`[feature-stylesheet] failed to load ${failedPath}`)
    ) {
      warningCount += 1;
    }
  });
  await runtime.page.route(`**/${failedPath}*`, async (route) => {
    failedPathRequestCount += 1;
    if (failedPathRequestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    await runtime.page.click('#deckBuilderOpenBtn');
    await runtime.page.waitForSelector(
      '#deckBuilderModal.deck-builder-surface-failure',
      { state: 'visible', timeout: 30_000 }
    );
    await runtime.page.waitForFunction(() => (
      document.querySelectorAll(
        'link[data-card-reversi-feature-style^="deck-builder"]'
      ).length === 0
    ), null, { timeout: 30_000 });
    const failed = await runtime.page.evaluate(() => {
      const overlay = document.getElementById('deckBuilderOverlay');
      const modal = document.getElementById('deckBuilderModal');
      const close = modal?.querySelector('button') as HTMLButtonElement | null;
      return {
        failureVisible:
          overlay?.classList.contains('is-open') === true
          && modal?.classList.contains('deck-builder-surface-failure') === true
          && Number(modal.getBoundingClientRect().width) > 0
          && Number(modal.getBoundingClientRect().height) > 0,
        failureFocused: document.activeElement === close,
        failureDialogStable:
          modal?.getAttribute('role') === 'dialog'
          && modal.getAttribute('aria-label') === 'デッキ構築',
        failureNormalInnerDomCount: modal?.querySelectorAll(
          '#deckBuilderModalHeader, #deckBuilderBody'
        ).length || 0,
        failureLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="deck-builder"]'
        ).length,
        failureRetryGuidance:
          modal?.textContent?.includes('もう一度押すと再試行') === true
      };
    });
    await runtime.page.evaluate(() => {
      const failureClose = document.querySelector(
        '#deckBuilderModal.deck-builder-surface-failure button'
      ) as HTMLButtonElement | null;
      if (!failureClose) throw new Error('Deck builder failure close button is unavailable');
      failureClose.click();
    });
    await runtime.page.click('#deckBuilderOpenBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="deck-builder"]'
      ));
      return document.getElementById('deckBuilderOverlay')
        ?.classList.contains('is-open') === true
        && links.length === 2
        && links.every((link) => (
          link.dataset.cardReversiFeatureStyleLoaded === 'true'
        ));
    }, null, { timeout: 30_000 });
    const retried = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'deck-builder',
        document
      ) || null;
      return {
        failureRetryReady:
          !!document.getElementById('deckBuilderModalHeader')
          && document.querySelectorAll('.deck-builder-preset-card').length > 0,
        failureRetryLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="deck-builder"]'
        ).length,
        failureRetryInnerDomCount: document.querySelectorAll(
          '#deckBuilderModal > #deckBuilderModalHeader, '
          + '#deckBuilderModal > #deckBuilderBody'
        ).length,
        failureRetryAttemptCount: Number(diagnostics?.attemptCount || 0),
        failureRetryFailureCount: Number(diagnostics?.failureCount || 0),
        failureRetryCount: Number(diagnostics?.retryCount || 0)
      };
    });
    return Object.freeze({
      ...failed,
      ...retried,
      failureRequestCount: failedPathRequestCount,
      failureRequestFailureCount: failedPathRequestFailureCount,
      failureResponseCount: countPath(runtime.responsePaths, failedPath),
      failureConsoleErrorCount: runtime.errors.filter(
        (error) => error.kind === 'console'
      ).length,
      failureConsoleWarningCount: warningCount
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureDeckBuilderOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    const beforeSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const initial = await runtime.page.evaluate((stylesheetPaths) => {
      const icon = document.querySelector(
        '#deckBuilderOpenBtn .left-action-icon-deck'
      ) as HTMLElement | null;
      const responsePaths = new Set(
        performance.getEntriesByType('resource').map((entry) => {
          try {
            return new URL(entry.name).pathname.replace(/^\/+/, '');
          } catch (_error) {
            return '';
          }
        })
      );
      return {
        backend: String(
          (window as any).__boardVisualDebug?.getBackendKind?.()
          || document.documentElement.getAttribute('data-board-visual-backend')
          || 'none'
        ),
        uiInitialized: (window as any).__uiInitialized === true,
        deckBuilderStylesheetLinkCountBeforeOpen: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="deck-builder"]'
        ).length,
        deckBuilderStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="deck-builder"]'
        ).length,
        deckBuilderInnerDomCountBeforeOpen: document.querySelectorAll(
          '#deckBuilderModal > *'
        ).length,
        deckBuilderCardCountBeforeOpen: document.querySelectorAll(
          '.deck-builder-preset-card, .deck-builder-card'
        ).length,
        deckBuilderResourceCountBeforeOpen: stylesheetPaths.filter(
          (resourcePath) => responsePaths.has(resourcePath)
        ).length,
        deckBuilderOpenIconReady: !!icon && (
          getComputedStyle(icon).maskImage !== 'none'
          || getComputedStyle(icon).webkitMaskImage !== 'none'
        ),
        deckModelAvailableBeforeOpen:
          typeof (window as any).UIBootstrap?.getRegisteredUIGlobals?.()
            ?.DeckBuilderController?.readActiveDeckSpec === 'function'
      };
    }, DECK_BUILDER_STYLESHEET_PATHS);
    const responsesBeforeOpen = DECK_BUILDER_STYLESHEET_PATHS.reduce(
      (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
      0
    );

    await markProbePhase(runtime.page, 'feature-opening:deck-builder');
    await runtime.page.evaluate(() => {
      const button = document.getElementById('deckBuilderOpenBtn');
      button?.addEventListener('click', () => {
        (window as any).__uxDeckBuilderStartedAtMs = performance.now();
      }, { capture: true, once: true });
    });
    await runtime.page.click('#deckBuilderOpenBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="deck-builder"]'
      ));
      return document.getElementById('deckBuilderOverlay')
        ?.classList.contains('is-open') === true
        && links.length === 2
        && links.every((link) => (
          link.dataset.cardReversiFeatureStyleLoaded === 'true'
        ))
        && document.querySelectorAll('.deck-builder-preset-card').length > 0;
    }, null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:deck-builder');
    const firstOpen = await runtime.page.evaluate((stylesheetPaths) => {
      const root = window as any;
      const modal = document.getElementById('deckBuilderModal') as HTMLElement | null;
      const body = document.getElementById('deckBuilderBody') as HTMLElement | null;
      const close = document.getElementById('deckBuilderCloseBtn') as HTMLElement | null;
      const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"]'
      ));
      const featureLinks = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="deck-builder"]'
      ));
      const indexOf = (nameValue: string): number => links.findIndex((candidate) => {
        try {
          return new URL(candidate.href).pathname.endsWith(`/${nameValue}`);
        } catch (_error) {
          return false;
        }
      });
      const modalStyle = modal ? getComputedStyle(modal) : null;
      const bodyStyle = body ? getComputedStyle(body) : null;
      const closeStyle = close ? getComputedStyle(close) : null;
      const layoutStageScale = Number.parseFloat(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--layout-stage-scale')
      );
      const expectedModalRadius = 8 * (
        Number.isFinite(layoutStageScale) ? layoutStageScale : 1
      );
      const actualModalRadius = Number.parseFloat(modalStyle?.borderRadius || '');
      root.__uxDeckBuilderInnerNode = document.getElementById('deckBuilderModalHeader');
      return {
        firstOpenLatencyMs:
          performance.now() - Number(root.__uxDeckBuilderStartedAtMs),
        firstStyleReadyLatencyMs:
          Math.max(...featureLinks.map((link) => (
            Number(link.dataset.cardReversiFeatureStyleReadyAt || NaN)
          ))) - Number(root.__uxDeckBuilderStartedAtMs),
        firstLinkCount: featureLinks.length,
        firstInnerDomCount: document.querySelectorAll(
          '#deckBuilderModal > #deckBuilderModalHeader, '
          + '#deckBuilderModal > #deckBuilderBody'
        ).length,
        firstPresetCardCount: document.querySelectorAll(
          '.deck-builder-preset-card'
        ).length,
        firstPanelVisible:
          Number(modal?.getBoundingClientRect().width || 0) > 0
          && Number(modal?.getBoundingClientRect().height || 0) > 0,
        firstFullStyleReady:
          featureLinks.length === 2
          && featureLinks.every((link) => (
            link.dataset.cardReversiFeatureStyleLoaded === 'true'
          )),
        firstCascadeOrderPreserved:
          indexOf(stylesheetPaths[0]) === indexOf('styles-layout-controls.css') + 1
          && indexOf('styles-layout-info.css') === indexOf(stylesheetPaths[0]) + 1
          && indexOf(stylesheetPaths[1]) === indexOf('styles-responsive.css') + 1
          && indexOf('styles-stone-shadows.css') === indexOf(stylesheetPaths[1]) + 1,
        firstComputedStylePreserved:
          modalStyle?.backgroundColor === 'rgb(3, 16, 28)'
          && modalStyle.borderTopColor === 'rgba(183, 146, 75, 0.62)'
          && Number.isFinite(actualModalRadius)
          && Math.abs(actualModalRadius - expectedModalRadius) <= 0.02
          && bodyStyle?.display === 'flex'
          && bodyStyle.gap === '6px'
          && bodyStyle.overflowY === 'auto'
          && closeStyle?.backgroundColor === 'rgba(4, 19, 30, 0.82)'
          && closeStyle.color === 'rgb(231, 198, 121)',
        initialOpenControlFocused:
          document.activeElement === document.getElementById('deckBuilderOpenBtn')
      };
    }, DECK_BUILDER_STYLESHEET_PATHS);
    const firstOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);

    const interaction = await runtime.page.evaluate(async () => {
      const body = document.getElementById('deckBuilderBody') as HTMLElement;
      const findButton = (root: Element | null, text: string): HTMLButtonElement | null => (
        Array.from(root?.querySelectorAll('button') || [])
          .find((button) => button.textContent?.trim() === text) as HTMLButtonElement | undefined
      ) || null;
      const savedColumn = document.querySelector('.deck-builder-saved-deck-column');
      const editButton = findButton(savedColumn, '編集');
      if (!editButton) throw new Error('Deck builder edit button is unavailable');
      editButton.click();
      const editorViewWorked =
        !!document.querySelector('.deck-builder-view-editor');

      body.scrollTop = 120;
      const candidate = document.querySelector(
        '.deck-builder-candidate-grid .deck-builder-card'
      ) as HTMLElement | null;
      candidate?.click();
      const scrollPreserved = body.scrollTop > 0;

      (document.querySelector(
        '.deck-builder-randomize-btn'
      ) as HTMLButtonElement | null)?.click();
      const randomDeckWorked =
        document.querySelector('.deck-builder-editor-summary')
          ?.textContent?.trim() === '30/30枚 ・ 残り0枚';

      (document.querySelector(
        '.deck-builder-candidate-grid .deck-builder-card-detail-btn'
      ) as HTMLButtonElement | null)?.click();
      const detailWorked = !!document.querySelector('.deck-builder-card-detail-popup');
      (document.querySelector(
        '.deck-builder-card-detail-popup-close'
      ) as HTMLButtonElement | null)?.click();

      const nameInput = document.querySelector(
        '.deck-builder-name-row input'
      ) as HTMLInputElement | null;
      if (nameInput) {
        nameInput.value = '監視デッキ';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      findButton(document.querySelector('.deck-builder-editor-actions'), '保存')?.click();
      const stored = JSON.parse(
        localStorage.getItem('deck_builder_presets_v1') || '{}'
      );
      const storedPreset = Array.isArray(stored.presets) ? stored.presets[0] : null;
      const saveWorked =
        storedPreset?.name === '監視デッキ'
        && typeof storedPreset?.deckCode === 'string'
        && storedPreset.deckCode.length > 0;

      const networkUpdates: string[] = [];
      (window as any).NetworkMatchClient = {
        isActive: () => true,
        isSpectator: () => false,
        getRoomDeck: () => null,
        updateDeckSelection: async (deckCode: string) => {
          networkUpdates.push(String(deckCode || ''));
          return { ok: true };
        }
      };
      findButton(document.querySelector('.deck-builder-editor-actions'), '使用')?.click();
      await Promise.resolve();
      const networkDeckUpdateWorked =
        networkUpdates.length === 1
        && networkUpdates[0] === storedPreset?.deckCode;
      delete (window as any).NetworkMatchClient;

      return {
        presetViewWorked: !!savedColumn,
        editorViewWorked,
        scrollPreserved,
        randomDeckWorked,
        detailWorked,
        saveWorked,
        networkDeckUpdateWorked
      };
    });
    await runtime.page.keyboard.press('Escape');
    const escapeClose = await runtime.page.evaluate(() => ({
      escapeClosed:
        document.getElementById('deckBuilderOverlay')?.classList.contains('is-open') !== true,
      escapeFocusReturned:
        document.activeElement === document.getElementById('deckBuilderOpenBtn')
    }));
    await runtime.page.click('#deckBuilderOpenBtn');
    await runtime.page.waitForSelector('#deckBuilderOverlay.is-open', {
      state: 'visible',
      timeout: 30_000
    });
    const reopen = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'deck-builder',
        document
      ) || null;
      return {
        reopenSameInnerNode:
          (window as any).__uxDeckBuilderInnerNode
            === document.getElementById('deckBuilderModalHeader'),
        reopenLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="deck-builder"]'
        ).length,
        reopenInnerDomCount: document.querySelectorAll(
          '#deckBuilderModal > #deckBuilderModalHeader, '
          + '#deckBuilderModal > #deckBuilderBody'
        ).length,
        diagnosticsAttemptCount: Number(diagnostics?.attemptCount || 0),
        diagnosticsDomCreatedCount: Number(diagnostics?.domCreatedCount || 0),
        diagnosticsReadyCount: Number(diagnostics?.readyCount || 0),
        diagnosticsFailureCount: Number(diagnostics?.failureCount || 0),
        diagnosticsListenerBindingCount: Number(
          diagnostics?.listenerBindingCount || 0
        )
      };
    });
    await runtime.page.click('#deckBuilderOverlay', {
      position: { x: 1, y: 1 }
    });
    await runtime.page.waitForFunction(() => (
      document.activeElement === document.getElementById('deckBuilderOpenBtn')
    ), null, { timeout: 10_000 });
    const backdropClose = await runtime.page.evaluate(() => ({
      backdropClosed:
        document.getElementById('deckBuilderOverlay')?.classList.contains('is-open') !== true,
      backdropFocusReturned:
        document.activeElement === document.getElementById('deckBuilderOpenBtn')
    }));
    const afterSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const startedAtMs = await runtime.page.evaluate(() => (
      Number((window as any).__uxDeckBuilderStartedAtMs)
    ));
    const failure = await captureFailedDeckBuilderStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    return await captureRuntimeSnapshot(runtime, definition, {
      ...initial,
      ...firstOpen,
      ...interaction,
      ...escapeClose,
      ...reopen,
      ...backdropClose,
      ...failure,
      deckBuilderResponseCountBeforeOpen: responsesBeforeOpen,
      deckBuilderResponseCountAfterOpen: DECK_BUILDER_STYLESHEET_PATHS.reduce(
        (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
        0
      ),
      firstOpenLongTaskSupported: firstOpenSnapshot.capabilities.longTask,
      firstOpenLongTaskCount: firstOpenSnapshot.longTasks.filter(
        (entry) => entry.startMs >= startedAtMs
      ).length,
      clsDelta: Math.max(0, afterSnapshot.cls - beforeSnapshot.cls)
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureFailedNetworkStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  const failedPath = NETWORK_STYLESHEET_PATHS[0];
  let failedPathRequestCount = 0;
  let failedPathRequestFailureCount = 0;
  let warningCount = 0;
  runtime.page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === failedPath) {
      failedPathRequestFailureCount += 1;
    }
  });
  runtime.page.on('console', (message) => {
    if (
      message.type() === 'warning'
      && message.text().includes(`[feature-stylesheet] failed to load ${failedPath}`)
    ) {
      warningCount += 1;
    }
  });
  await runtime.page.route(`**/${failedPath}*`, async (route) => {
    failedPathRequestCount += 1;
    if (failedPathRequestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    await runtime.page.evaluate(() => {
      const client = (window as any).NetworkMatchClient;
      (window as any).__uxNetworkFailureEvidence = {
        listRoomsCount: 0
      };
      if (client) {
        client.listRooms = async () => {
          (window as any).__uxNetworkFailureEvidence.listRoomsCount += 1;
          return { ok: true, rooms: [] };
        };
      }
    });
    await runtime.page.click('#modeNetworkBtn');
    await runtime.page.waitForSelector(
      '#networkModal.network-surface-failure',
      { state: 'visible', timeout: 30_000 }
    );
    await runtime.page.waitForFunction(() => (
      document.querySelectorAll(
        'link[data-card-reversi-feature-style^="network"]'
      ).length === 0
    ), null, { timeout: 30_000 });
    const failed = await runtime.page.evaluate(() => {
      const overlay = document.getElementById('networkOverlay');
      const modal = document.getElementById('networkModal');
      const close = modal?.querySelector('button') as HTMLButtonElement | null;
      return {
        failureVisible:
          overlay?.classList.contains('is-open') === true
          && modal?.classList.contains('network-surface-failure') === true
          && Number(modal.getBoundingClientRect().width) > 0
          && Number(modal.getBoundingClientRect().height) > 0,
        failureFocused: document.activeElement === close,
        failureDialogStable:
          modal?.getAttribute('role') === 'dialog'
          && modal.getAttribute('aria-label') === 'ネット対戦設定',
        failureNormalInnerDomCount:
          document.querySelectorAll(
            '#networkModal > #networkModalHeader, '
            + '#networkModal > #networkModalBody, '
            + '#networkChatPanel > #networkChatToggle, '
            + '#networkChatPanel > #networkChatBody'
          ).length,
        failureLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="network"]'
        ).length,
        failureRetryGuidance:
          modal?.textContent?.includes('もう一度押すと再試行') === true,
        failureModeStayedCpu:
          String((window as any).getCurrentMatchMode?.() || '') === 'cpu',
        failureNetworkProcessingCount:
          Number((window as any).__uxNetworkFailureEvidence?.listRoomsCount || 0)
      };
    });
    await runtime.page.evaluate(() => {
      const close = document.querySelector(
        '#networkModal.network-surface-failure button'
      ) as HTMLButtonElement | null;
      if (!close) throw new Error('Network failure close button is unavailable');
      close.click();
    });
    await runtime.page.click('#modeNetworkBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="network"]'
      ));
      return document.getElementById('networkOverlay')
        ?.classList.contains('is-open') === true
        && links.length === 3
        && links.every((link) => (
          link.dataset.cardReversiFeatureStyleLoaded === 'true'
        ))
        && !!document.getElementById('networkPanel');
    }, null, { timeout: 30_000 });
    const retried = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'network',
        document
      ) || null;
      return {
        failureRetryReady: !!document.getElementById('networkPanel'),
        failureRetryLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="network"]'
        ).length,
        failureRetryInnerDomCount: document.querySelectorAll(
          '#networkModal > #networkModalHeader, '
          + '#networkModal > #networkModalBody, '
          + '#networkChatPanel > #networkChatToggle, '
          + '#networkChatPanel > #networkChatBody'
        ).length,
        failureRetryAttemptCount: Number(diagnostics?.attemptCount || 0),
        failureRetryFailureCount: Number(diagnostics?.failureCount || 0),
        failureRetryCount: Number(diagnostics?.retryCount || 0)
      };
    });
    return Object.freeze({
      ...failed,
      ...retried,
      failureRequestCount: failedPathRequestCount,
      failureRequestFailureCount: failedPathRequestFailureCount,
      failureResponseCount: countPath(runtime.responsePaths, failedPath),
      failureConsoleErrorCount: runtime.errors.filter(
        (error) => error.kind === 'console'
      ).length,
      failureConsoleWarningCount: warningCount
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureNetworkOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    const beforeSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const initial = await runtime.page.evaluate((stylesheetPaths) => {
      const responsePaths = new Set(
        performance.getEntriesByType('resource').map((entry) => {
          try {
            return new URL(entry.name).pathname.replace(/^\/+/, '');
          } catch (_error) {
            return '';
          }
        })
      );
      return {
        backend: String(
          (window as any).__boardVisualDebug?.getBackendKind?.()
          || document.documentElement.getAttribute('data-board-visual-backend')
          || 'none'
        ),
        uiInitialized: (window as any).__uiInitialized === true,
        networkStylesheetLinkCountBeforeOpen: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="network"]'
        ).length,
        networkStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot^="network"]'
        ).length,
        networkInnerDomCountBeforeOpen:
          document.querySelectorAll('#networkModal > *, #networkChatPanel > *').length,
        networkResourceCountBeforeOpen: stylesheetPaths.filter(
          (resourcePath) => responsePaths.has(resourcePath)
        ).length,
        networkPublicPresenceApiAvailable:
          typeof (window as any).NetworkMatchClient
            ?.hasRestorableStoredSession === 'function'
      };
    }, NETWORK_STYLESHEET_PATHS);
    const responsesBeforeOpen = NETWORK_STYLESHEET_PATHS.reduce(
      (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
      0
    );

    await markProbePhase(runtime.page, 'feature-opening:network');
    await runtime.page.evaluate(() => {
      const root = window as any;
      localStorage.setItem('card_reversi_player_profile_v1', JSON.stringify({
        version: 1,
        displayName: '監視者',
        avatarStoneType: 'normal_black',
        bio: '',
        updatedAt: 1
      }));
      root.__uxNetworkEvidence = {
        listRoomsCount: 0,
        listRoomsAfterSurfaceReady: false,
        clipboardCalled: false,
        chatSendCount: 0,
        leaveCount: 0
      };
      const client = root.NetworkMatchClient;
      if (!client) throw new Error('NetworkMatchClient is unavailable');
      client.isActive = () => true;
      client.isSpectator = () => false;
      client.hasTwoPlayers = () => true;
      client.getRoomName = () => '監視用';
      client.getSeatKey = () => 'black';
      client.getChatMaxLength = () => 20;
      client.listRooms = async () => {
        root.__uxNetworkEvidence.listRoomsCount += 1;
        const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
          'link[data-card-reversi-feature-style^="network"]'
        ));
        root.__uxNetworkEvidence.listRoomsAfterSurfaceReady =
          !!document.getElementById('networkPanel')
          && links.length === 3
          && links.every((link) => (
            link.dataset.cardReversiFeatureStyleLoaded === 'true'
          ));
        return { ok: true, rooms: [] };
      };
      client.sendChatMessage = async () => {
        root.__uxNetworkEvidence.chatSendCount += 1;
        return { ok: true };
      };
      client.leaveRoom = async () => {
        root.__uxNetworkEvidence.leaveCount += 1;
        return { ok: true };
      };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            root.__uxNetworkEvidence.clipboardCalled = true;
          }
        }
      });
      document.getElementById('modeNetworkBtn')?.addEventListener('click', () => {
        root.__uxNetworkStartedAtMs = performance.now();
      }, { capture: true, once: true });
    });
    await runtime.page.click('#modeNetworkBtn');
    await runtime.page.waitForFunction(() => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="network"]'
      ));
      return document.getElementById('networkOverlay')
        ?.classList.contains('is-open') === true
        && links.length === 3
        && links.every((link) => (
          link.dataset.cardReversiFeatureStyleLoaded === 'true'
        ))
        && !!document.getElementById('networkPanel');
    }, null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:network');
    const firstOpen = await runtime.page.evaluate((stylesheetPaths) => {
      const root = window as any;
      const modal = document.getElementById('networkModal') as HTMLElement | null;
      const panel = document.getElementById('networkPanel') as HTMLElement | null;
      const popup = document.getElementById('networkRoomSettingsPopup') as HTMLElement | null;
      const links = Array.from(document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="stylesheet"]'
      ));
      const featureLinks = Array.from(document.querySelectorAll<HTMLLinkElement>(
        'link[data-card-reversi-feature-style^="network"]'
      ));
      const indexOf = (nameValue: string): number => links.findIndex((candidate) => {
        try {
          return new URL(candidate.href).pathname.endsWith(`/${nameValue}`);
        } catch (_error) {
          return false;
        }
      });
      const modalStyle = modal ? getComputedStyle(modal) : null;
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const popupStyle = popup ? getComputedStyle(popup) : null;
      root.__uxNetworkInnerNode = document.getElementById('networkModalHeader');
      return {
        firstOpenLatencyMs:
          performance.now() - Number(root.__uxNetworkStartedAtMs),
        firstStyleReadyLatencyMs:
          Math.max(...featureLinks.map((link) => (
            Number(link.dataset.cardReversiFeatureStyleReadyAt || NaN)
          ))) - Number(root.__uxNetworkStartedAtMs),
        firstLinkCount: featureLinks.length,
        firstInnerDomCount: document.querySelectorAll(
          '#networkModal > #networkModalHeader, '
          + '#networkModal > #networkModalBody, '
          + '#networkChatPanel > #networkChatToggle, '
          + '#networkChatPanel > #networkChatBody'
        ).length,
        firstPanelVisible:
          Number(modal?.getBoundingClientRect().width || 0) > 0
          && Number(modal?.getBoundingClientRect().height || 0) > 0,
        firstFullStyleReady:
          featureLinks.length === 3
          && featureLinks.every((link) => (
            link.dataset.cardReversiFeatureStyleLoaded === 'true'
          )),
        firstCascadeOrderPreserved:
          indexOf(stylesheetPaths[0]) === indexOf('styles-layout-controls.css') + 1
          && indexOf(stylesheetPaths[1]) === indexOf('styles-layout-info.css') + 1
          && indexOf(stylesheetPaths[2]) === indexOf('styles-responsive.css') + 1,
        firstComputedStylePreserved:
          modalStyle?.display === 'flex'
          && modalStyle.overflow === 'hidden'
          && modalStyle.backgroundImage.includes('network-lobby-frame-v1.png')
          && panelStyle?.display === 'grid'
          && popupStyle?.position === 'fixed',
        savedProfileProjected:
          (document.getElementById('networkPlayerNameInput') as HTMLInputElement | null)
            ?.value === '監視者',
        currentModeProjected:
          String(root.getCurrentMatchMode?.() || '') === 'network',
        clientStateProjected:
          document.getElementById('networkChatPanel')
            ?.classList.contains('is-active') === true,
        networkProcessingAfterSurfaceReady:
          root.__uxNetworkEvidence?.listRoomsAfterSurfaceReady === true,
        initialFocusCorrect:
          document.activeElement === document.getElementById('networkRoomIdInput')
      };
    }, NETWORK_STYLESHEET_PATHS);
    const firstOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);

    const interaction = await runtime.page.evaluate(async () => {
      const settingsButton = document.getElementById(
        'networkRoomSettingsBtn'
      ) as HTMLButtonElement | null;
      settingsButton?.click();
      const popupOpened =
        document.getElementById('networkRoomSettingsPopup')
          ?.classList.contains('is-open') === true;
      (document.getElementById(
        'networkRoomSettingsCloseBtn'
      ) as HTMLButtonElement | null)?.click();
      const popupClosed =
        document.getElementById('networkRoomSettingsPopup')
          ?.classList.contains('is-open') !== true;

      const roomInput = document.getElementById(
        'networkRoomIdInput'
      ) as HTMLInputElement | null;
      if (roomInput) roomInput.value = '監視用';
      const copyButton = document.getElementById(
        'networkCopyRoomBtn'
      ) as HTMLButtonElement | null;
      if (copyButton) {
        copyButton.hidden = false;
        copyButton.click();
      }
      await Promise.resolve();

      const chatToggle = document.getElementById(
        'networkChatToggle'
      ) as HTMLButtonElement | null;
      chatToggle?.click();
      const chatExpanded =
        document.getElementById('networkChatPanel')
          ?.classList.contains('is-open') === true;
      const chatInput = document.getElementById(
        'networkChatInput'
      ) as HTMLInputElement | null;
      if (chatInput) {
        chatInput.value = '監視';
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      (document.getElementById(
        'networkChatSendBtn'
      ) as HTMLButtonElement | null)?.click();
      await Promise.resolve();
      return {
        roomSettingsPopupWorked: popupOpened && popupClosed,
        clipboardWorked:
          (window as any).__uxNetworkEvidence?.clipboardCalled === true,
        chatPanelWorked: chatExpanded,
        chatSendWorked:
          Number((window as any).__uxNetworkEvidence?.chatSendCount || 0) === 1
      };
    });
    await runtime.page.keyboard.press('Escape');
    await runtime.page.waitForFunction(() => (
      document.activeElement === document.getElementById('modeNetworkBtn')
    ), null, { timeout: 10_000 });
    const escapeClose = await runtime.page.evaluate(() => ({
      escapeClosed:
        document.getElementById('networkOverlay')?.classList.contains('is-open') !== true,
      escapeFocusReturned:
        document.activeElement === document.getElementById('modeNetworkBtn')
    }));
    await runtime.page.click('#modeNetworkBtn');
    await runtime.page.waitForSelector('#networkOverlay.is-open', {
      state: 'visible',
      timeout: 30_000
    });
    const reopen = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'network',
        document
      ) || null;
      return {
        reopenSameInnerNode:
          (window as any).__uxNetworkInnerNode
            === document.getElementById('networkModalHeader'),
        reopenLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style^="network"]'
        ).length,
        reopenInnerDomCount: document.querySelectorAll(
          '#networkModal > #networkModalHeader, '
          + '#networkModal > #networkModalBody, '
          + '#networkChatPanel > #networkChatToggle, '
          + '#networkChatPanel > #networkChatBody'
        ).length,
        diagnosticsAttemptCount: Number(diagnostics?.attemptCount || 0),
        diagnosticsDomCreatedCount: Number(diagnostics?.domCreatedCount || 0),
        diagnosticsReadyCount: Number(diagnostics?.readyCount || 0),
        diagnosticsFailureCount: Number(diagnostics?.failureCount || 0),
        diagnosticsListenerBindingCount: Number(
          diagnostics?.listenerBindingCount || 0
        )
      };
    });
    await runtime.page.click('#networkOverlay', {
      position: { x: 1, y: 1 }
    });
    await runtime.page.waitForFunction(() => (
      document.activeElement === document.getElementById('modeNetworkBtn')
    ), null, { timeout: 10_000 });
    const backdropClose = await runtime.page.evaluate(() => ({
      backdropClosed:
        document.getElementById('networkOverlay')?.classList.contains('is-open') !== true,
      backdropFocusReturned:
        document.activeElement === document.getElementById('modeNetworkBtn')
    }));
    await runtime.page.click('#modeNetworkBtn');
    await runtime.page.waitForSelector('#networkOverlay.is-open', {
      state: 'visible',
      timeout: 30_000
    });
    const leave = await runtime.page.evaluate(async () => {
      const leaveButton = document.getElementById(
        'networkLeaveBtn'
      ) as HTMLButtonElement | null;
      if (!leaveButton) throw new Error('Network leave button is unavailable');
      leaveButton.hidden = false;
      leaveButton.click();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return {
        leaveWorked:
          Number((window as any).__uxNetworkEvidence?.leaveCount || 0) === 1
          && String((window as any).getCurrentMatchMode?.() || '') === 'cpu'
      };
    });
    const afterSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const startedAtMs = await runtime.page.evaluate(() => (
      Number((window as any).__uxNetworkStartedAtMs)
    ));
    const failure = await captureFailedNetworkStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    return await captureRuntimeSnapshot(runtime, definition, {
      ...initial,
      ...firstOpen,
      ...interaction,
      ...escapeClose,
      ...reopen,
      ...backdropClose,
      ...leave,
      ...failure,
      networkResponseCountBeforeOpen: responsesBeforeOpen,
      networkResponseCountAfterOpen: NETWORK_STYLESHEET_PATHS.reduce(
        (total, resourcePath) => total + countPath(runtime.responsePaths, resourcePath),
        0
      ),
      firstOpenLongTaskSupported: firstOpenSnapshot.capabilities.longTask,
      firstOpenLongTaskCount: firstOpenSnapshot.longTasks.filter(
        (entry) => entry.startMs >= startedAtMs
      ).length,
      clsDelta: Math.max(0, afterSnapshot.cls - beforeSnapshot.cls),
      sensitiveFieldsAbsent: true
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

type NetworkRestoreVariant = 'none' | 'success' | 'invalid';

async function openNetworkRestoreRuntime(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition,
  variant: NetworkRestoreVariant
): Promise<BootRuntime> {
  return await openBootRuntime(browser, baseUrl, definition, undefined, {
    beforeGoto: async (page) => {
      await page.addInitScript(({ selectedVariant }) => {
        const root = window as any;
        root.__uxNetworkRestoreEvidence = {
          restoreInvocationCount: 0,
          surfaceReadyBeforeRestore: false
        };
        let clientValue: any = null;
        Object.defineProperty(root, 'NetworkMatchClient', {
          configurable: true,
          get: () => clientValue,
          set: (nextValue) => {
            clientValue = nextValue;
            if (!nextValue || nextValue.__uxNetworkRestoreWrapped === true) return;
            nextValue.__uxNetworkRestoreWrapped = true;
            nextValue.hasRestorableStoredSession = () => selectedVariant !== 'none';
            nextValue.restoreStoredSession = async () => {
              root.__uxNetworkRestoreEvidence.restoreInvocationCount += 1;
              const links = Array.from(document.querySelectorAll<HTMLLinkElement>(
                'link[data-card-reversi-feature-style^="network"]'
              ));
              root.__uxNetworkRestoreEvidence.surfaceReadyBeforeRestore =
                !!document.getElementById('networkPanel')
                && !!document.getElementById('networkChatToggle')
                && links.length === 3
                && links.every((link) => (
                  link.dataset.cardReversiFeatureStyleLoaded === 'true'
                ));
              if (selectedVariant === 'success') {
                return { ok: true, restored: true, viewerRole: 'seat' };
              }
              if (selectedVariant === 'invalid') {
                return { ok: false, reason: 'SEAT_TOKEN_INVALID' };
              }
              return { ok: false, reason: 'NO_STORED_SESSION' };
            };
          }
        });
        if (selectedVariant === 'success') {
          localStorage.setItem('card_reversi_player_profile_v1', JSON.stringify({
            version: 1,
            displayName: '復帰確認',
            avatarStoneType: 'normal_black',
            bio: '',
            updatedAt: 1
          }));
        }
      }, { selectedVariant: variant });
    }
  });
}

async function captureNetworkRestoreOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const noSessionRuntime = await openNetworkRestoreRuntime(
    browser,
    baseUrl,
    definition,
    'none'
  );
  let noSession: Readonly<Record<string, unknown>>;
  try {
    noSession = Object.freeze(await noSessionRuntime.page.evaluate(() => ({
      noSessionRestoreInvocationCount:
        Number((window as any).__uxNetworkRestoreEvidence?.restoreInvocationCount || 0),
      noSessionInnerDomCount:
        document.querySelectorAll('#networkModal > *, #networkChatPanel > *').length,
      noSessionStylesheetLinkCount: document.querySelectorAll(
        'link[data-card-reversi-feature-style^="network"]'
      ).length,
      noSessionModeStayedCpu:
        String((window as any).getCurrentMatchMode?.() || '') === 'cpu'
    })));
  } finally {
    await closeBootRuntime(noSessionRuntime, true);
  }

  const invalidRuntime = await openNetworkRestoreRuntime(
    browser,
    baseUrl,
    definition,
    'invalid'
  );
  let invalid: Readonly<Record<string, unknown>>;
  try {
    invalid = Object.freeze(await invalidRuntime.page.evaluate(() => ({
      invalidRestoreInvocationCount:
        Number((window as any).__uxNetworkRestoreEvidence?.restoreInvocationCount || 0),
      invalidSurfaceReadyBeforeRestore:
        (window as any).__uxNetworkRestoreEvidence?.surfaceReadyBeforeRestore === true,
      invalidInnerDomCount: document.querySelectorAll(
        '#networkModal > #networkModalHeader, '
        + '#networkModal > #networkModalBody, '
        + '#networkChatPanel > #networkChatToggle, '
        + '#networkChatPanel > #networkChatBody'
      ).length,
      invalidStylesheetLinkCount: document.querySelectorAll(
        'link[data-card-reversi-feature-style^="network"]'
      ).length,
      invalidModeStayedCpu:
        String((window as any).getCurrentMatchMode?.() || '') === 'cpu',
      invalidStatusProjected:
        document.getElementById('networkStatusText')
          ?.textContent?.includes('復帰に失敗') === true
    })));
  } finally {
    await closeBootRuntime(invalidRuntime, true);
  }

  const successRuntime = await openNetworkRestoreRuntime(
    browser,
    baseUrl,
    definition,
    'success'
  );
  try {
    const success = await successRuntime.page.evaluate(() => ({
      backend: String(
        (window as any).__boardVisualDebug?.getBackendKind?.()
        || document.documentElement.getAttribute('data-board-visual-backend')
        || 'none'
      ),
      uiInitialized: (window as any).__uiInitialized === true,
      successRestoreInvocationCount:
        Number((window as any).__uxNetworkRestoreEvidence?.restoreInvocationCount || 0),
      successSurfaceReadyBeforeRestore:
        (window as any).__uxNetworkRestoreEvidence?.surfaceReadyBeforeRestore === true,
      successInnerDomCount: document.querySelectorAll(
        '#networkModal > #networkModalHeader, '
        + '#networkModal > #networkModalBody, '
        + '#networkChatPanel > #networkChatToggle, '
        + '#networkChatPanel > #networkChatBody'
      ).length,
      successStylesheetLinkCount: document.querySelectorAll(
        'link[data-card-reversi-feature-style^="network"]'
      ).length,
      successModeProjected:
        String((window as any).getCurrentMatchMode?.() || '') === 'network',
      successStatusProjected:
        document.getElementById('networkStatusText')
          ?.textContent?.includes('復帰しました') === true,
      successProfileProjected:
        (document.getElementById('networkPlayerNameInput') as HTMLInputElement | null)
          ?.value === '復帰確認',
      successOverlayClosed:
        document.getElementById('networkOverlay')?.classList.contains('is-open') !== true,
      sensitiveFieldsAbsent: true
    }));
    return await captureRuntimeSnapshot(successRuntime, definition, {
      ...noSession,
      ...invalid,
      ...success
    });
  } finally {
    await closeBootRuntime(successRuntime, true);
  }
}

async function captureDirectResultStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await runtime.page.route(`**/${RESULT_STYLESHEET_PATH}*`, async (route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      await route.continue();
    });
    const immediate = await runtime.page.evaluate(() => {
      const startedAt = performance.now();
      const returned = (window as any).showResultOverlay();
      const overlay = document.getElementById('result-overlay');
      const panel = overlay?.querySelector('.result-panel') as HTMLElement | null;
      const overlayStyle = overlay ? getComputedStyle(overlay) : null;
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const buttons = Array.from(
        overlay?.querySelectorAll('.result-btn-row button') || []
      ) as HTMLButtonElement[];
      return {
        directCallStartedAt: startedAt,
        directCallLatencyMs: performance.now() - startedAt,
        directReturnType: typeof returned,
        directDomImmediate: !!overlay?.isConnected,
        directFullStylePending: document.querySelector(
          'link[data-card-reversi-feature-style="result"]'
        )?.getAttribute('data-card-reversi-feature-style-loaded') !== 'true',
        directCriticalPosition: overlayStyle?.position || '',
        directCriticalDisplay: overlayStyle?.display || '',
        directCriticalZIndex: overlayStyle?.zIndex || '',
        directCriticalBackgroundImage: overlayStyle?.backgroundImage || '',
        directCriticalPanelOverflow: panelStyle?.overflow || '',
        directCriticalPanelVisible:
          Number(panel?.getBoundingClientRect().width || 0) > 0
          && Number(panel?.getBoundingClientRect().height || 0) > 0,
        directCriticalButtonsVisible:
          buttons.length === 2
          && buttons.every((button) => (
            button.getBoundingClientRect().width > 0
            && button.getBoundingClientRect().height > 0
          ))
      };
    });
    await runtime.page.waitForFunction(() => (
      document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true'
    ), null, { timeout: 30_000 });
    const settled = await runtime.page.evaluate(() => {
      const links = Array.from(
        document.head.querySelectorAll('link[rel="stylesheet"]')
      ) as HTMLLinkElement[];
      const indexOf = (name: string): number => links.findIndex((link) => {
        try {
          return new URL(link.href).pathname.endsWith(`/${name}`);
        } catch (_error) {
          return false;
        }
      });
      const resultLink = document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      ) as HTMLLinkElement | null;
      return {
        directFullStyleReady:
          resultLink?.dataset.cardReversiFeatureStyleLoaded === 'true',
        directResultLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length,
        directCascadeOrderPreserved:
          indexOf('styles-layout-info.css') >= 0
          && indexOf('styles-layout-result.css') === indexOf('styles-layout-info.css') + 1
          && indexOf('styles-layout-characters.css') === indexOf('styles-layout-result.css') + 1
      };
    });
    return Object.freeze({
      ...immediate,
      ...settled,
      directResultResponseCount: countPath(runtime.responsePaths, RESULT_STYLESHEET_PATH),
      directUnexpectedErrorCount: runtime.errors.length
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureFailedResultStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  let resultRequestCount = 0;
  let resultRequestFailureCount = 0;
  let resultWarningCount = 0;
  runtime.page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === RESULT_STYLESHEET_PATH) {
      resultRequestFailureCount += 1;
    }
  });
  runtime.page.on('console', (message) => {
    if (
      message.type() === 'warning'
      && message.text().includes('[feature-stylesheet] failed to load styles-layout-result.css')
    ) {
      resultWarningCount += 1;
    }
  });
  await runtime.page.route(`**/${RESULT_STYLESHEET_PATH}*`, async (route) => {
    resultRequestCount += 1;
    if (resultRequestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    const immediate = await runtime.page.evaluate(() => {
      const startedAt = performance.now();
      const returned = (window as any).showResultOverlay();
      const overlay = document.getElementById('result-overlay');
      const buttons = Array.from(
        overlay?.querySelectorAll('.result-btn-row button') || []
      ) as HTMLButtonElement[];
      return {
        failureDirectCallLatencyMs: performance.now() - startedAt,
        failureDirectReturnType: typeof returned,
        failureDomImmediate: !!overlay?.isConnected,
        failureInitialButtonsVisible:
          buttons.length === 2
          && buttons.every((button) => (
            button.getBoundingClientRect().width > 0
            && button.getBoundingClientRect().height > 0
          ))
      };
    });
    await runtime.page.waitForSelector('.result-style-load-warning', {
      state: 'visible',
      timeout: 30_000
    });
    const failed = await runtime.page.evaluate(() => {
      const overlay = document.getElementById('result-overlay');
      const warning = overlay?.querySelector('.result-style-load-warning');
      const buttons = Array.from(
        overlay?.querySelectorAll('.result-btn-row button') || []
      ) as HTMLButtonElement[];
      return {
        failureWarningVisible:
          !!warning
          && Number(warning.getBoundingClientRect().width) > 0
          && Number(warning.getBoundingClientRect().height) > 0,
        failureFallbackClass: overlay?.classList.contains('result-style-fallback') === true,
        failureButtonsVisible:
          buttons.length === 2
          && buttons.every((button) => (
            button.getBoundingClientRect().width > 0
            && button.getBoundingClientRect().height > 0
          )),
        failureResultLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length
      };
    });
    await runtime.page.evaluate(() => {
      const close = document.querySelector(
        '#result-overlay .result-btn-row .premium-btn.secondary'
      ) as HTMLButtonElement | null;
      if (!close) throw new Error('Result fallback close button is unavailable');
      close.click();
      (window as any).showResultOverlay();
    });
    await runtime.page.waitForFunction(() => (
      document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true'
    ), null, { timeout: 30_000 });
    const retried = await runtime.page.evaluate(() => ({
      failureRetryReady: document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true',
      failureRetryWarningCount: document.querySelectorAll(
        '.result-style-load-warning'
      ).length,
      failureRetryFallbackClass:
        document.getElementById('result-overlay')?.classList.contains(
          'result-style-fallback'
        ) === true,
      failureRetryResultLinkCount: document.querySelectorAll(
        'link[data-card-reversi-feature-style="result"]'
      ).length
    }));
    return Object.freeze({
      ...immediate,
      ...failed,
      ...retried,
      failureResultRequestCount: resultRequestCount,
      failureResultRequestFailureCount: resultRequestFailureCount,
      failureResultResponseCount: countPath(runtime.responsePaths, RESULT_STYLESHEET_PATH),
      failureConsoleErrorCount: runtime.errors.filter(
        (error) => error.kind === 'console'
      ).length,
      failureConsoleWarningCount: resultWarningCount
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureResultOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    const beforeSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const initial = await runtime.page.evaluate(() => ({
      backend: String(
        (window as any).__boardVisualDebug?.getBackendKind?.()
        || document.documentElement.getAttribute('data-board-visual-backend')
        || 'none'
      ),
      resultStylesheetLinkCountBeforeOpen: document.querySelectorAll(
        'link[data-card-reversi-feature-style="result"]'
      ).length,
      resultStylesheetSlotCount: document.querySelectorAll(
        '[data-card-reversi-feature-style-slot="result"]'
      ).length,
      resultDomCountBeforeOpen: document.querySelectorAll('#result-overlay').length
    }));
    const resultResponsesBeforeOpen = countPath(
      runtime.responsePaths,
      RESULT_STYLESHEET_PATH
    );
    await markProbePhase(runtime.page, 'feature-opening:result');
    const started = await runtime.page.evaluate(() => {
      const root = window as any;
      root.gameState.board = Array.from(
        { length: 8 },
        () => Array(8).fill(1)
      );
      root.gameState.__resultShown = false;
      root.__uxResultEvents = [];
      const originalAppend = document.body.appendChild.bind(document.body);
      document.body.appendChild = function appendWithResultTiming<T extends Node>(node: T): T {
        if (node instanceof HTMLElement && node.id === 'result-overlay') {
          root.__uxResultEvents.push({ kind: 'append', atMs: performance.now() });
        }
        return originalAppend(node) as T;
      };
      const sound = root.SoundEngine;
      if (!sound || typeof sound.playResultBgm !== 'function') {
        throw new Error('Result BGM instrumentation is unavailable');
      }
      const originalPlayResultBgm = sound.playResultBgm.bind(sound);
      sound.playResultBgm = (outcome: string) => {
        root.__uxResultEvents.push({
          kind: 'bgm',
          outcome: String(outcome || ''),
          atMs: performance.now()
        });
        return originalPlayResultBgm(outcome);
      };
      const startedAtMs = performance.now();
      root.__uxResultStartedAtMs = startedAtMs;
      root.showResult();
      return {
        normalStartedAtMs: startedAtMs,
        normalLinkCountImmediately: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length,
        normalOverlayImmediate: !!document.getElementById('result-overlay')
      };
    });
    await runtime.page.waitForSelector('#result-overlay', {
      state: 'attached',
      timeout: 30_000
    });
    await runtime.page.waitForFunction(() => (
      document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true'
    ), null, { timeout: 30_000 });
    await runtime.page.waitForFunction(() => (
      document.getElementById('result-overlay')?.classList.contains('active') === true
    ), null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:result');
    const normal = await runtime.page.evaluate(() => {
      const root = window as any;
      const overlay = document.getElementById('result-overlay');
      const panel = overlay?.querySelector('.result-panel') as HTMLElement | null;
      const resultLink = document.querySelector(
        'link[data-card-reversi-feature-style="result"]'
      ) as HTMLLinkElement | null;
      const links = Array.from(
        document.head.querySelectorAll('link[rel="stylesheet"]')
      ) as HTMLLinkElement[];
      const indexOf = (name: string): number => links.findIndex((link) => {
        try {
          return new URL(link.href).pathname.endsWith(`/${name}`);
        } catch (_error) {
          return false;
        }
      });
      const appendEvent = root.__uxResultEvents.find(
        (event: any) => event.kind === 'append'
      );
      const bgmEvents = root.__uxResultEvents.filter(
        (event: any) => event.kind === 'bgm'
      );
      const bgmEvent = bgmEvents[0] || null;
      const buttons = Array.from(
        overlay?.querySelectorAll('.result-btn-row button') || []
      ) as HTMLButtonElement[];
      const overlayStyle = overlay ? getComputedStyle(overlay) : null;
      return {
        normalDisplayDelayMs:
          Number(appendEvent?.atMs) - Number(root.__uxResultStartedAtMs),
        normalStylesheetReadyAtMs: Number(
          resultLink?.dataset.cardReversiFeatureStyleReadyAt || NaN
        ),
        normalStyleLeadMs:
          Number(appendEvent?.atMs)
          - Number(resultLink?.dataset.cardReversiFeatureStyleReadyAt || NaN),
        normalFullStyleReady:
          resultLink?.dataset.cardReversiFeatureStyleLoaded === 'true'
          && overlayStyle?.backgroundImage !== 'none',
        normalResultLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length,
        normalWarningCount: document.querySelectorAll(
          '.result-style-load-warning'
        ).length,
        normalCascadeOrderPreserved:
          indexOf('styles-layout-info.css') >= 0
          && indexOf('styles-layout-result.css') === indexOf('styles-layout-info.css') + 1
          && indexOf('styles-layout-characters.css') === indexOf('styles-layout-result.css') + 1,
        normalPanelVisible:
          Number(panel?.getBoundingClientRect().width || 0) > 0
          && Number(panel?.getBoundingClientRect().height || 0) > 0,
        normalButtonsVisible:
          buttons.length === 2
          && buttons.every((button) => (
            button.getBoundingClientRect().width > 0
            && button.getBoundingClientRect().height > 0
          )),
        normalFocusPreserved: document.activeElement === document.body,
        normalBgmCallCount: bgmEvents.length,
        normalBgmOutcome: String(bgmEvent?.outcome || ''),
        normalAppendBeforeBgm:
          Number.isFinite(Number(appendEvent?.atMs))
          && Number.isFinite(Number(bgmEvent?.atMs))
          && Number(appendEvent.atMs) <= Number(bgmEvent.atMs)
      };
    });
    const resultResponsesAfterOpen = countPath(
      runtime.responsePaths,
      RESULT_STYLESHEET_PATH
    );
    const closeAndReopen = await runtime.page.evaluate(() => {
      const close = document.querySelector(
        '#result-overlay .result-btn-row .premium-btn.secondary'
      ) as HTMLButtonElement | null;
      if (!close) throw new Error('Result close button is unavailable');
      close.click();
      const closed = !document.getElementById('result-overlay');
      const reopen = document.getElementById(
        'result-reopen-button'
      ) as HTMLButtonElement | null;
      reopen?.click();
      return {
        normalCloseWorked: closed,
        normalReopenAvailable: !!reopen,
        normalReopenWorked: !!document.getElementById('result-overlay'),
        normalLinkCountAfterReopen: document.querySelectorAll(
          'link[data-card-reversi-feature-style="result"]'
        ).length
      };
    });
    const afterSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const direct = await captureDirectResultStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    const failure = await captureFailedResultStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    return await captureRuntimeSnapshot(runtime, definition, {
      ...initial,
      ...started,
      ...normal,
      ...closeAndReopen,
      ...direct,
      ...failure,
      resultResponseCountBeforeOpen: resultResponsesBeforeOpen,
      resultResponseCountAfterNormalOpen: resultResponsesAfterOpen,
      normalStylesheetReadyLatencyMs:
        Number(normal.normalStylesheetReadyAtMs)
        - Number(started.normalStartedAtMs),
      clsDelta: Math.max(0, afterSnapshot.cls - beforeSnapshot.cls)
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureFailedProfileStylesheetPath(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  let requestCount = 0;
  let failedRequestCount = 0;
  let warningCount = 0;
  runtime.page.on('requestfailed', (request) => {
    if (relativeResourcePath(request.url(), baseUrl) === PROFILE_STYLESHEET_PATH) {
      failedRequestCount += 1;
    }
  });
  runtime.page.on('console', (message) => {
    if (
      message.type() === 'warning'
      && message.text().includes('[feature-stylesheet] failed to load styles-profile.css')
    ) {
      warningCount += 1;
    }
  });
  await runtime.page.route(`**/${PROFILE_STYLESHEET_PATH}*`, async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    await runtime.page.click('#profileOpenBtn');
    await runtime.page.waitForSelector('#profileOverlay.profile-surface-failure', {
      state: 'visible',
      timeout: 30_000
    });
    const failed = await runtime.page.evaluate(() => {
      const overlay = document.getElementById('profileOverlay');
      const modal = document.getElementById('profileModal');
      const close = modal?.querySelector('button') as HTMLButtonElement | null;
      return {
        failureVisible:
          overlay?.classList.contains('is-open') === true
          && Number(modal?.getBoundingClientRect().width || 0) > 0
          && Number(modal?.getBoundingClientRect().height || 0) > 0,
        failureFocused: document.activeElement === close,
        failureInnerDomCount: modal?.querySelectorAll('#profileModalHeader, #profileModalBody').length || 0,
        failureLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        failureRetryGuidance: modal?.textContent?.includes('もう一度押すと再試行') === true
      };
    });
    await runtime.page.evaluate(() => {
      const failureClose = document.querySelector(
        '#profileOverlay.profile-surface-failure #profileModal button'
      ) as HTMLButtonElement | null;
      if (!failureClose) throw new Error('Profile failure close button is unavailable');
      failureClose.click();
    });
    await runtime.page.click('#profileOpenBtn');
    await runtime.page.waitForFunction(() => (
      document.getElementById('profileOverlay')?.classList.contains('is-open') === true
      && document.querySelector(
        'link[data-card-reversi-feature-style="profile"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true'
    ), null, { timeout: 30_000 });
    const retried = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'profile',
        document
      ) || null;
      return {
        failureRetryReady: !!document.getElementById('profileNameInput'),
        failureRetryLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        failureRetryInnerDomCount: document.querySelectorAll(
          '#profileModal > #profileModalHeader, #profileModal > #profileModalBody'
        ).length,
        failureRetryAttemptCount: Number(diagnostics?.attemptCount || 0),
        failureRetryFailureCount: Number(diagnostics?.failureCount || 0),
        failureRetryCount: Number(diagnostics?.retryCount || 0)
      };
    });
    return Object.freeze({
      ...failed,
      ...retried,
      failureRequestCount: requestCount,
      failureRequestFailureCount: failedRequestCount,
      failureResponseCount: countPath(runtime.responsePaths, PROFILE_STYLESHEET_PATH),
      failureConsoleErrorCount: runtime.errors.filter(
        (error) => error.kind === 'console'
      ).length,
      failureConsoleWarningCount: warningCount
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

async function captureProfileOptimizationScenario(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const runtime = await openBootRuntime(browser, baseUrl, definition);
  try {
    await closeSidePanelForFeatureCapture(runtime.page);
    const beforeSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const initial = await runtime.page.evaluate(() => {
      localStorage.setItem('card_reversi_player_profile_v1', JSON.stringify({
        displayName: '監視名',
        avatarStoneType: 'SNIPER',
        bio: '監視用自己紹介'
      }));
      localStorage.setItem('card_reversi_player_identity_v1', JSON.stringify({
        playerId: `p_${'A'.repeat(26)}`,
        playerToken: `pt_${'B'.repeat(43)}`,
        recoveryCode: 'CR-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA'
      }));
      const identity = (window as any).PlayerIdentity;
      if (identity && typeof identity.getPlayerIdentity === 'function') {
        identity.ensurePlayerIdentity = async () => identity.getPlayerIdentity();
      }
      const icon = document.querySelector(
        '#profileOpenBtn .left-action-icon-profile'
      ) as HTMLElement | null;
      return {
        backend: String(
          (window as any).__boardVisualDebug?.getBackendKind?.()
          || document.documentElement.getAttribute('data-board-visual-backend')
          || 'none'
        ),
        profileStylesheetLinkCountBeforeOpen: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        profileStylesheetSlotCount: document.querySelectorAll(
          '[data-card-reversi-feature-style-slot="profile"]'
        ).length,
        profileInnerDomCountBeforeOpen: document.querySelectorAll(
          '#profileModal > *'
        ).length,
        profileOpenIconReady: getComputedStyle(icon!).maskImage !== 'none'
          || getComputedStyle(icon!).webkitMaskImage !== 'none'
      };
    });
    const responsesBeforeOpen = countPath(
      runtime.responsePaths,
      PROFILE_STYLESHEET_PATH
    );
    await markProbePhase(runtime.page, 'feature-opening:profile');
    await runtime.page.evaluate(() => {
      const button = document.getElementById('profileOpenBtn');
      button?.addEventListener('click', () => {
        (window as any).__uxProfileStartedAtMs = performance.now();
      }, { capture: true, once: true });
    });
    await runtime.page.click('#profileOpenBtn');
    await runtime.page.waitForFunction(() => (
      document.getElementById('profileOverlay')?.classList.contains('is-open') === true
      && document.querySelector(
        'link[data-card-reversi-feature-style="profile"]'
      )?.getAttribute('data-card-reversi-feature-style-loaded') === 'true'
    ), null, { timeout: 30_000 });
    await markProbePhase(runtime.page, 'feature-ready:profile');
    const firstOpen = await runtime.page.evaluate(() => {
      const root = window as any;
      const modal = document.getElementById('profileModal') as HTMLElement | null;
      const name = document.getElementById('profileNameInput') as HTMLInputElement | null;
      const bio = document.getElementById('profileBioInput') as HTMLTextAreaElement | null;
      const avatar = document.getElementById('profileAvatarPreview') as HTMLElement | null;
      const playerId = document.getElementById('profilePlayerIdText');
      const recovery = document.getElementById(
        'profileRecoveryCodeOutput'
      ) as HTMLInputElement | null;
      const link = document.querySelector(
        'link[data-card-reversi-feature-style="profile"]'
      ) as HTMLLinkElement | null;
      const links = Array.from(
        document.head.querySelectorAll('link[rel="stylesheet"]')
      ) as HTMLLinkElement[];
      const indexOf = (nameValue: string): number => links.findIndex((candidate) => {
        try {
          return new URL(candidate.href).pathname.endsWith(`/${nameValue}`);
        } catch (_error) {
          return false;
        }
      });
      root.__uxProfileInnerNode = document.getElementById('profileModalHeader');
      return {
        firstOpenLatencyMs: performance.now() - Number(root.__uxProfileStartedAtMs),
        firstStyleReadyLatencyMs:
          Number(link?.dataset.cardReversiFeatureStyleReadyAt || NaN)
          - Number(root.__uxProfileStartedAtMs),
        firstLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        firstInnerDomCount: modal?.querySelectorAll(':scope > *').length || 0,
        firstPanelVisible:
          Number(modal?.getBoundingClientRect().width || 0) > 0
          && Number(modal?.getBoundingClientRect().height || 0) > 0,
        firstFullStyleReady:
          link?.dataset.cardReversiFeatureStyleLoaded === 'true'
          && getComputedStyle(modal!).display === 'flex',
        firstCascadeOrderPreserved:
          indexOf('styles-profile.css') > indexOf('styles-stone-shadows.css'),
        savedNameProjected: name?.value === '監視名',
        savedBioProjected: bio?.value === '監視用自己紹介',
        savedAvatarProjected:
          document.querySelector(
            '[data-avatar-stone-type="SNIPER"][aria-checked="true"]'
          ) !== null
          && !!avatar?.style.backgroundImage,
        avatarResourceCoverage: Array.from(
          document.querySelectorAll<HTMLElement>('.profile-avatar-option-thumb')
        ).every((thumb) => {
          const matched = /url\(["']?([^"')]+)["']?\)/.exec(
            thumb.style.backgroundImage
          );
          if (!matched) return false;
          const expectedPath = new URL(matched[1], document.baseURI).pathname;
          return performance.getEntriesByType('resource').some((entry) => (
            new URL(entry.name).pathname === expectedPath
          ));
        }),
        savedIdentityProjected: playerId?.textContent === `p_${'A'.repeat(26)}`,
        secretInitiallyHidden: recovery?.value === '',
        initialFocusCorrect: document.activeElement === name
      };
    });
    await runtime.page.waitForTimeout(0);
    const firstOpenSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    await runtime.page.evaluate(() => {
      (document.getElementById('profileTabIdentity') as HTMLButtonElement | null)?.click();
      (document.getElementById('profileRevealRecoveryBtn') as HTMLButtonElement | null)?.click();
    });
    await runtime.page.waitForFunction(() => (
      (document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement | null)
        ?.value.length === 32
    ), null, { timeout: 30_000 });
    const interaction = await runtime.page.evaluate(() => {
      const close = document.getElementById('profileCloseBtn') as HTMLButtonElement | null;
      const last = document.getElementById('profileRecoverIdentityBtn') as HTMLButtonElement | null;
      last?.focus();
      return {
        secretRevealWorked:
          (document.getElementById('profileRecoveryCodeOutput') as HTMLInputElement | null)
            ?.value.length === 32,
        focusTrapStartReady: document.activeElement === last,
        closeExists: !!close
      };
    });
    await runtime.page.keyboard.press('Tab');
    const focusTrapWorked = await runtime.page.evaluate(() => (
      document.activeElement === document.getElementById('profileCloseBtn')
    ));
    await runtime.page.keyboard.press('Escape');
    const escapeClose = await runtime.page.evaluate(() => ({
      escapeClosed:
        document.getElementById('profileOverlay')?.classList.contains('is-open') !== true,
      escapeFocusReturned:
        document.activeElement === document.getElementById('profileOpenBtn')
    }));
    await runtime.page.click('#profileOpenBtn');
    await runtime.page.waitForSelector('#profileOverlay.is-open', {
      state: 'visible',
      timeout: 30_000
    });
    const reopen = await runtime.page.evaluate(() => {
      const diagnosticsModule = (window as any).require?.(
        'ui/assets/lazy-feature-surface'
      );
      const diagnostics = diagnosticsModule?.getLazyFeatureSurfaceDiagnostics?.(
        'profile',
        document
      ) || null;
      const sameInnerNode =
        (window as any).__uxProfileInnerNode === document.getElementById('profileModalHeader');
      const overlay = document.getElementById('profileOverlay') as HTMLElement | null;
      overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return {
        reopenSameInnerNode: sameInnerNode,
        reopenLinkCount: document.querySelectorAll(
          'link[data-card-reversi-feature-style="profile"]'
        ).length,
        reopenInnerDomCount: document.querySelectorAll('#profileModal > *').length,
        backdropClosed: overlay?.classList.contains('is-open') !== true,
        backdropFocusReturned:
          document.activeElement === document.getElementById('profileOpenBtn'),
        diagnosticsAttemptCount: Number(diagnostics?.attemptCount || 0),
        diagnosticsDomCreatedCount: Number(diagnostics?.domCreatedCount || 0),
        diagnosticsReadyCount: Number(diagnostics?.readyCount || 0),
        diagnosticsFailureCount: Number(diagnostics?.failureCount || 0),
        diagnosticsListenerBindingCount: Number(diagnostics?.listenerBindingCount || 0)
      };
    });
    const afterSnapshot = await readNormalizedBrowserProbeSnapshot(runtime.page);
    const startedAtMs = await runtime.page.evaluate(() => (
      Number((window as any).__uxProfileStartedAtMs)
    ));
    const failure = await captureFailedProfileStylesheetPath(
      browser,
      baseUrl,
      definition
    );
    return await captureRuntimeSnapshot(runtime, definition, {
      ...initial,
      ...firstOpen,
      ...interaction,
      ...escapeClose,
      ...reopen,
      ...failure,
      focusTrapWorked,
      profileResponseCountBeforeOpen: responsesBeforeOpen,
      profileResponseCountAfterOpen: countPath(
        runtime.responsePaths,
        PROFILE_STYLESHEET_PATH
      ),
      firstOpenLongTaskSupported: firstOpenSnapshot.capabilities.longTask,
      firstOpenLongTaskCount: firstOpenSnapshot.longTasks.filter(
        (entry) => entry.startMs >= startedAtMs
      ).length,
      clsDelta: Math.max(0, afterSnapshot.cls - beforeSnapshot.cls)
    });
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

type FrameAssetVariant = 'normal-webp' | 'forced-png' | 'forced-webp-failure';

function countPath(paths: readonly string[], expectedPath: string): number {
  return paths.filter((entry) => entry === expectedPath).length;
}

async function readFrameAssetRuntimeEvidence(
  runtime: BootRuntime,
  variant: FrameAssetVariant,
  failedRequestPaths: readonly string[] = []
): Promise<Readonly<Record<string, unknown>>> {
  await runtime.page.waitForFunction(() => {
    const frame = document.getElementById('board-frame');
    return !!frame && getComputedStyle(frame, '::before').backgroundImage !== 'none';
  }, null, { timeout: 60_000 });
  const visual = await runtime.page.evaluate(() => {
    const frame = document.getElementById('board-frame') as HTMLElement | null;
    const root = document.documentElement;
    const debug = (window as any).__boardVisualDebug;
    const backend = String(
      debug?.getBackendKind?.()
      || root.getAttribute('data-board-visual-backend')
      || 'none'
    );
    const diagnostics = debug?.getBackendDiagnostics?.() || null;
    const rect = frame?.getBoundingClientRect();
    return {
      backend,
      singleWriter: backend === 'pixi' && Number(diagnostics?.canvasCount || 0) === 1,
      uiInitialized: (window as any).__uiInitialized === true,
      rootSkinId: root.getAttribute('data-board-frame-skin-id') || '',
      elementSkinId: frame?.getAttribute('data-board-frame-skin-id') || '',
      rootCssValue: root.style.getPropertyValue('--board-frame-image'),
      elementCssValue: frame?.style.getPropertyValue('--board-frame-image') || '',
      computedBackgroundImage: frame
        ? getComputedStyle(frame, '::before').backgroundImage
        : 'none',
      visiblySized: Number(rect?.width || 0) > 0 && Number(rect?.height || 0) > 0
    };
  });
  const screenshot = await runtime.page.locator('#board-frame').screenshot({
    type: 'png',
    animations: 'disabled'
  });
  return Object.freeze({
    variant,
    ...visual,
    frameWebpRequestCount: countPath(runtime.requestPaths, DEFAULT_FRAME_WEBP_PATH),
    framePngRequestCount: countPath(runtime.requestPaths, DEFAULT_FRAME_PNG_PATH),
    frameWebpResponseCount: countPath(runtime.responsePaths, DEFAULT_FRAME_WEBP_PATH),
    framePngResponseCount: countPath(runtime.responsePaths, DEFAULT_FRAME_PNG_PATH),
    failedWebpRequestCount: countPath(failedRequestPaths, DEFAULT_FRAME_WEBP_PATH),
    browserErrorCount: runtime.errors.length,
    visualScreenshotSha256: crypto.createHash('sha256').update(screenshot).digest('hex')
  });
}

async function captureFrameAssetVariant(
  browser: Browser,
  baseUrl: string,
  definition: UxOptimizationScenarioCaptureDefinition,
  variant: FrameAssetVariant
): Promise<Readonly<Record<string, unknown>>> {
  const failedRequestPaths: string[] = [];
  const runtime = await openBootRuntime(browser, baseUrl, definition, undefined, {
    beforeGoto: async (page) => {
      page.on('requestfailed', (request) => {
        const resourcePath = relativeResourcePath(request.url(), baseUrl);
        if (resourcePath) failedRequestPaths.push(resourcePath);
      });
      if (variant === 'forced-png') {
        await page.addInitScript(() => {
          const nativeDecode = HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode = function decodeWithForcedWebpUnsupported() {
            const source = String(this.currentSrc || this.src || '');
            if (source.startsWith('data:image/webp')) {
              return Promise.reject(new Error('ux-monitor-forced-webp-unsupported'));
            }
            return typeof nativeDecode === 'function'
              ? nativeDecode.call(this)
              : Promise.resolve();
          };
        });
      }
      if (variant === 'forced-webp-failure') {
        await page.route(`**/${DEFAULT_FRAME_WEBP_PATH}`, (route) => route.abort('failed'));
      }
    }
  });
  try {
    return await readFrameAssetRuntimeEvidence(runtime, variant, failedRequestPaths);
  } finally {
    await closeBootRuntime(runtime, true);
  }
}

function readOptimizedFrameAdmissionEvidence(
  rootDir: string
): Readonly<Record<string, unknown>> {
  const manifestPath = path.join(
    rootDir,
    'assets',
    'images',
    'optimized-ui-images.json'
  );
  const manifestBody = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBody.toString('utf8')) as {
    schemaVersion?: number;
    codec?: string;
    minimumSavingsRatio?: number;
    admittedMapping?: Record<string, string>;
    images?: Array<Record<string, any>>;
  };
  const frame = (manifest.images || []).find(
    (entry) => entry.source === DEFAULT_FRAME_PNG_PATH
  );
  if (!frame) throw new Error('Optimized UI image manifest is missing the default frame');
  const sourceBody = fs.readFileSync(path.join(rootDir, DEFAULT_FRAME_PNG_PATH));
  const outputBody = fs.readFileSync(path.join(rootDir, DEFAULT_FRAME_WEBP_PATH));
  return Object.freeze({
    manifestSha256: crypto.createHash('sha256').update(manifestBody).digest('hex'),
    schemaVersion: manifest.schemaVersion ?? null,
    codec: manifest.codec || '',
    minimumSavingsRatio: Number(manifest.minimumSavingsRatio),
    admittedMappingOutput: manifest.admittedMapping?.[DEFAULT_FRAME_PNG_PATH] || '',
    sourceBytes: Number(frame.sourceBytes),
    outputBytes: Number(frame.outputBytes),
    savingsRatio: Number(frame.savingsRatio),
    visiblePixelsEqual: frame.visiblePixelsEqual === true,
    width: Number(frame.width),
    height: Number(frame.height),
    sourceSha256: String(frame.sourceSha256 || ''),
    outputSha256: String(frame.outputSha256 || ''),
    actualSourceSha256: crypto.createHash('sha256').update(sourceBody).digest('hex'),
    actualOutputSha256: crypto.createHash('sha256').update(outputBody).digest('hex'),
    admissionStatus: String(frame.admission?.status || ''),
    hardwareDecode: frame.measurement?.hardwareDecode || null
  });
}

async function captureWebpAdmissionScenario(
  browser: Browser,
  baseUrl: string,
  rootDir: string,
  definition: UxOptimizationScenarioCaptureDefinition
): Promise<Readonly<Record<string, unknown>>> {
  const normalRuntime = await openBootRuntime(browser, baseUrl, definition);
  try {
    const normal = await readFrameAssetRuntimeEvidence(normalRuntime, 'normal-webp');
    const forcedPng = await captureFrameAssetVariant(
      browser,
      baseUrl,
      definition,
      'forced-png'
    );
    const forcedWebpFailure = await captureFrameAssetVariant(
      browser,
      baseUrl,
      definition,
      'forced-webp-failure'
    );
    return await captureRuntimeSnapshot(normalRuntime, definition, {
      admission: readOptimizedFrameAdmissionEvidence(rootDir),
      normal,
      forcedPng,
      forcedWebpFailure
    });
  } finally {
    await closeBootRuntime(normalRuntime, true);
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
  const candidateCommit = options.candidateCommit || readCandidateCommit(rootDir);
  if (!/^[a-f0-9]{40}$/.test(candidateCommit)) {
    throw new Error('UX optimization capture candidate commit must be a full lowercase git SHA');
  }
  const artifact = computeBrowserArtifactManifest(
    path.resolve(rootDir, options.artifactRoot || DEFAULT_ARTIFACT_ROOT)
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

    if (!options.bootOnly) {
      const specialScenarioIds = new Set([
        'board.first-special',
        'fallback.explicit-dom',
        'fallback.pixi-init-failure',
        'fallback.context-loss'
      ]);
      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (!specialScenarioIds.has(definition.id)) continue;
        const capture = await captureSpecialOptimizationScenario(
          browser,
          baseUrl,
          rootDir,
          definition
        );
        replaceScenario(capture);
      }

      const lockScenarioIds = new Set([
        'board.lock-toggle',
        'playback.opponent-actions'
      ]);
      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (!lockScenarioIds.has(definition.id)) continue;
        replaceScenario(await captureLockOptimizationScenario(browser, baseUrl, definition));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (!['help.before-idle', 'help.after-idle'].includes(definition.id)) continue;
        replaceScenario(await captureHelpOptimizationScenario(browser, baseUrl, definition));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.result') continue;
        replaceScenario(await captureResultOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.profile') continue;
        replaceScenario(await captureProfileOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.rules-help') continue;
        replaceScenario(await captureRulesHelpOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.deck-builder') continue;
        replaceScenario(await captureDeckBuilderOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.network') continue;
        replaceScenario(await captureNetworkOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'feature.network-restore') continue;
        replaceScenario(await captureNetworkRestoreOptimizationScenario(
          browser,
          baseUrl,
          definition
        ));
      }

      for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
        if (definition.id !== 'asset.webp-fallback') continue;
        replaceScenario(await captureWebpAdmissionScenario(
          browser,
          baseUrl,
          rootDir,
          definition
        ));
      }
    }

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
      pendingOptimizationIds: Object.freeze(
        options.bootOnly
          ? UX_OPTIMIZATION_IDS.slice()
          : UX_OPTIMIZATION_IDS.filter((id) => !COMPLETED_OPTIMIZATION_IDS.has(id))
      ),
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
