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
const COMPLETED_OPTIMIZATION_IDS = new Set([
  'special-stone-demand-loading',
  'lock-only-hint-paint'
]);
const SPECIAL_STONE_PATH_PREFIX = 'assets/images/special-stones/';
const CLASSIC_PIXI_RUNTIME_PATHS = Object.freeze([
  '/public/vendor/pixi-8.18.1.min.js',
  '/public/vendor/pixi-unsafe-eval-8.18.1.min.js'
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
      const backendDiagnostics = (window as any).__boardVisualDebug?.getBackendDiagnostics?.() || null;
      return {
        backend: String(backend),
        neededSpecialAssetIds: Array.isArray(backendDiagnostics?.neededSpecialAssetIds)
          ? backendDiagnostics.neededSpecialAssetIds.map(String).sort()
          : [],
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
    const firstCell = host?.querySelector<HTMLElement>('.cell[data-row][data-col]') || null;
    const firstDisc = host?.querySelector<HTMLElement>('.disc') || null;
    const cellStyle = firstCell ? getComputedStyle(firstCell) : null;
    const discStyle = firstDisc ? getComputedStyle(firstDisc) : null;
    const cellCount = host?.querySelectorAll('.cell[data-row][data-col]').length || 0;
    const canvasCount = host?.querySelectorAll('canvas').length || 0;
    return {
      backend,
      cellCount,
      canvasCount,
      singleWriter: backend === 'dom' ? canvasCount === 0 && cellCount > 0 : canvasCount === 1,
      fallbackStyled: backend !== 'dom' || !!(
        cellStyle
        && Number.parseFloat(cellStyle.width) > 0
        && Number.parseFloat(cellStyle.height) > 0
        && cellStyle.display !== 'none'
        && (!firstDisc || !!discStyle && discStyle.display !== 'none')
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
      specialResponsePaths
    }, expectedFault);
  } finally {
    await closeBootRuntime(runtime, true);
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
        UX_OPTIMIZATION_IDS.filter((id) => !COMPLETED_OPTIMIZATION_IDS.has(id))
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
