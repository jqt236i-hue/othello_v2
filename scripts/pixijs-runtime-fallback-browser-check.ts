import * as fs from 'fs';
import * as path from 'path';
import BrowserUiControlSmoke from './browser-ui-control-smoke';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;
const PIXI_VERSION = '8.18.1';
const CLASSIC_VENDOR_PATH = `/public/vendor/pixi-${PIXI_VERSION}.min.js`;
const CLASSIC_UNSAFE_EVAL_VENDOR_PATH = `/public/vendor/pixi-unsafe-eval-${PIXI_VERSION}.min.js`;
const VITE_PIXI_MANIFEST_KEY = 'node_modules/pixi.js/lib/index.mjs';
const VITE_PIXI_UNSAFE_EVAL_MANIFEST_KEY = 'node_modules/pixi.js/lib/unsafe-eval/init.mjs';

interface PixiFallbackProbe {
  ready: boolean;
  capability: {
    lane: string;
    injected: boolean;
    version: string | null;
    unavailableReason: string | null;
  } | null;
  renderer: string;
  cellCount: number;
  canvasCount: number;
  trajectoryOverlayCount: number;
  trajectorySmoke: {
    attempted: boolean;
    originalEventTypes: string[];
    trajectoryObserved: boolean;
    phaseSettled: boolean;
    canvasCountWhileActive: number;
    trajectoryOverlayCountAfterSettle: number;
    initialVisualDigest: string | null;
    finalVisualDigest: string | null;
    soundCallCount: number;
    logEntryDelta: number;
    error: string;
  } | null;
  bootError: string;
}

interface PixiRuntimeFallbackCheckOptions {
  rootDir?: string;
  log?: boolean;
}

function evaluatePixiRuntimeFallbackProbe(
  probe: PixiFallbackProbe | null | undefined,
  expectedLane: 'classic' | 'vite'
): string[] {
  const errors: string[] = [];
  if (!probe?.ready) errors.push(`${expectedLane}: UI did not become ready`);
  if (probe?.capability?.lane !== expectedLane) {
    errors.push(`${expectedLane}: capability lane was ${probe?.capability?.lane || 'missing'}`);
  }
  if (probe?.capability?.injected !== false) {
    errors.push(`${expectedLane}: Pixi runtime was unexpectedly injected`);
  }
  if (!probe?.capability?.unavailableReason) {
    errors.push(`${expectedLane}: unavailable reason was not recorded`);
  }
  if (probe?.renderer !== 'dom' && probe?.renderer !== 'legacy-dom') {
    errors.push(`${expectedLane}: fallback renderer was ${probe?.renderer || 'missing'}`);
  }
  if (!probe || probe.cellCount <= 0) errors.push(`${expectedLane}: DOM cells were not materialized`);
  if (probe?.canvasCount !== 0) errors.push(`${expectedLane}: canvas and DOM fallback were mounted together`);
  if (probe?.trajectoryOverlayCount !== 0) {
    errors.push(`${expectedLane}: a DOM trajectory overlay survived settlement`);
  }
  if (!probe?.trajectorySmoke?.attempted) {
    errors.push(`${expectedLane}: DOM trajectory fallback smoke did not run`);
  } else {
    if (JSON.stringify(probe.trajectorySmoke.originalEventTypes) !== JSON.stringify(['destroy', 'flip'])) {
      errors.push(`${expectedLane}: trajectory fallback did not receive the original destroy/flip events`);
    }
    if (!probe.trajectorySmoke.trajectoryObserved) {
      errors.push(`${expectedLane}: DOM trajectory was not observed while active`);
    }
    if (!probe.trajectorySmoke.phaseSettled) {
      errors.push(`${expectedLane}: DOM trajectory phase did not settle`);
    }
    if (probe.trajectorySmoke.canvasCountWhileActive !== 0) {
      errors.push(`${expectedLane}: canvas and active DOM trajectory were mounted together`);
    }
    if (probe.trajectorySmoke.trajectoryOverlayCountAfterSettle !== 0) {
      errors.push(`${expectedLane}: DOM trajectory overlay was not cleaned up`);
    }
    if (!probe.trajectorySmoke.initialVisualDigest
      || probe.trajectorySmoke.finalVisualDigest !== probe.trajectorySmoke.initialVisualDigest) {
      errors.push(`${expectedLane}: final visual digest changed during fallback trajectory smoke`);
    }
    if (probe.trajectorySmoke.soundCallCount !== 0) {
      errors.push(`${expectedLane}: board-only trajectory replayed sound`);
    }
    if (probe.trajectorySmoke.logEntryDelta !== 0) {
      errors.push(`${expectedLane}: board-only trajectory replayed a log entry`);
    }
    if (probe.trajectorySmoke.error) {
      errors.push(`${expectedLane}: trajectory fallback smoke failed: ${probe.trajectorySmoke.error}`);
    }
  }
  if (probe?.bootError) errors.push(`${expectedLane}: fatal boot error was rendered`);
  return errors;
}

async function captureFallbackProbe(page: any): Promise<PixiFallbackProbe> {
  return page.evaluate(async () => {
    const root = window as any;
    const capability = root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.pixiRuntime || null;
    const resolveModule = (globalName: string, moduleId: string): any => {
      if (root[globalName]) return root[globalName];
      try {
        return typeof root.require === 'function' ? root.require(moduleId) : null;
      } catch (_error) {
        return null;
      }
    };
    const renderer = resolveModule('BoardRenderer', 'ui/board-renderer');
    const debug = root.__boardVisualDebug;
    const trajectorySelector = [
      '.dom-board-source-trajectory-layer',
      '.dom-board-source-trajectory__zombie-shadow',
      '.dom-board-source-trajectory__zombie-fang'
    ].join(',');
    let trajectorySmoke: PixiFallbackProbe['trajectorySmoke'] = null;

    if (renderer && debug
      && typeof renderer.getBoardVisualControllerReady === 'function'
      && typeof renderer.getBoardVisualController === 'function'
      && typeof renderer.validateBoardVisualPhase === 'function'
      && typeof renderer.claimBoardVisualWriter === 'function'
      && typeof renderer.playBoardVisualPhase === 'function'
      && typeof renderer.releaseBoardVisualWriter === 'function') {
      const events = Object.freeze([
        Object.freeze({
          type: 'destroy',
          phase: 2,
          actionId: 'pixi-runtime-fallback-smoke',
          effectBlockId: 'pixi-runtime-fallback-destroy',
          targets: Object.freeze([Object.freeze({
            r: 3,
            col: 4,
            sourceRow: 3,
            sourceCol: 3,
            cause: 'SNIPER_WILL',
            reason: 'sniper_shot',
            ownerBefore: 'white'
          })])
        }),
        Object.freeze({
          type: 'flip',
          phase: 2,
          actionId: 'pixi-runtime-fallback-smoke',
          effectBlockId: 'pixi-runtime-fallback-flip',
          targets: Object.freeze([Object.freeze({
            r: 4,
            col: 3,
            ownerBefore: 'white',
            ownerAfter: 'black',
            cause: 'ZOMBIE',
            reason: 'zombie_infection',
            meta: Object.freeze({ sourceRow: 4, sourceCol: 4 })
          })])
        })
      ]);
      const phaseScope = Object.freeze({
        events,
        phaseKey: 'pixi-runtime-fallback-smoke',
        stepIndex: 0
      });
      let token: any = null;
      let trajectoryObserved = false;
      let canvasCountWhileActive = 0;
      let soundCallCount = 0;
      let originalSound: ((...args: any[]) => unknown) | null = null;
      const soundEngine = root.SoundEngine;
      const logEntryCountBefore = document.querySelectorAll('#log .logEntry').length;
      let initialVisualDigest: string | null = null;
      let finalVisualDigest: string | null = null;
      let phaseSettled = false;
      let smokeError = '';
      try {
        await renderer.getBoardVisualControllerReady();
        await debug.waitForIdle();
        initialVisualDigest = debug.getVisualFrameDigest();
        if (soundEngine && typeof soundEngine.playEffectByKey === 'function') {
          originalSound = soundEngine.playEffectByKey;
          soundEngine.playEffectByKey = function (...args: any[]) {
            soundCallCount += 1;
            return originalSound!.apply(this, args);
          };
        }
        await renderer.validateBoardVisualPhase(events, phaseScope, false);
        const controller = renderer.getBoardVisualController();
        const checkpoint = controller?.getSettledFrame?.();
        if (!checkpoint) throw new Error('settled fallback board checkpoint is unavailable');
        const frameToken = 'local:pixi-runtime-fallback-smoke';
        const finalFrame = Object.freeze({ ...checkpoint, frameToken });
        token = renderer.claimBoardVisualWriter(frameToken, 'local');
        const phasePromise = renderer.playBoardVisualPhase(token, events, phaseScope);
        for (let frameIndex = 0; frameIndex < 12; frameIndex += 1) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const activeOverlayCount = document.querySelectorAll(trajectorySelector).length;
          if (activeOverlayCount > 0) {
            trajectoryObserved = true;
            canvasCountWhileActive = document.querySelectorAll('#board canvas').length;
            break;
          }
        }
        await phasePromise;
        renderer.releaseBoardVisualWriter(token, finalFrame);
        token = null;
        await debug.waitForIdle();
        phaseSettled = true;
        finalVisualDigest = debug.getVisualFrameDigest();
      } catch (error) {
        smokeError = error instanceof Error ? error.message : String(error);
        try {
          if (token) renderer.releaseBoardVisualWriter(token);
        } catch (_releaseError) { /* primary smoke failure remains authoritative */ }
      } finally {
        if (soundEngine && originalSound) soundEngine.playEffectByKey = originalSound;
      }
      trajectorySmoke = {
        attempted: true,
        originalEventTypes: events.map((event) => event.type),
        trajectoryObserved,
        phaseSettled,
        canvasCountWhileActive,
        trajectoryOverlayCountAfterSettle: document.querySelectorAll(trajectorySelector).length,
        initialVisualDigest,
        finalVisualDigest,
        soundCallCount,
        logEntryDelta: document.querySelectorAll('#log .logEntry').length - logEntryCountBefore,
        error: smokeError
      };
    }
    return {
      ready: root.__uiInitialized === true,
      capability: capability ? {
        lane: String(capability.lane || ''),
        injected: capability.injected === true,
        version: capability.version || null,
        unavailableReason: capability.unavailableReason || null
      } : null,
      renderer: document.getElementById('board')?.getAttribute('data-board-renderer') || 'legacy-dom',
      cellCount: document.querySelectorAll('#board .cell, #board-expansion-layer .cell').length,
      canvasCount: document.querySelectorAll('#board canvas').length,
      trajectoryOverlayCount: document.querySelectorAll(trajectorySelector).length,
      trajectorySmoke,
      bootError: document.getElementById('browserViteBootError')?.textContent || ''
    };
  });
}

async function runPixiRuntimeFallbackBrowserCheck(
  options: PixiRuntimeFallbackCheckOptions = {}
): Promise<Record<string, unknown>> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const manifestPath = path.join(rootDir, 'vite-dist', '.vite', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pixiEntry = manifest[VITE_PIXI_MANIFEST_KEY];
  if (!pixiEntry || typeof pixiEntry.file !== 'string') {
    throw new Error(`Vite manifest is missing ${VITE_PIXI_MANIFEST_KEY}`);
  }
  const vitePixiPath = `/vite-dist/${pixiEntry.file}`;
  const unsafeEvalEntry = manifest[VITE_PIXI_UNSAFE_EVAL_MANIFEST_KEY];
  if (!unsafeEvalEntry || typeof unsafeEvalEntry.file !== 'string') {
    throw new Error(`Vite manifest is missing ${VITE_PIXI_UNSAFE_EVAL_MANIFEST_KEY}`);
  }
  const vitePixiUnsafeEvalPath = `/vite-dist/${unsafeEvalEntry.file}`;

  const classic = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: '/index.classic.html',
    readyOnly: true,
    log: false,
    beforeGoto: async (page: any) => {
      await page.route(`**${CLASSIC_VENDOR_PATH}`, (route: any) => route.abort());
      await page.route(`**${CLASSIC_UNSAFE_EVAL_VENDOR_PATH}`, (route: any) => route.abort());
    },
    afterReady: captureFallbackProbe
  });
  const vite = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: '/',
    readyOnly: true,
    log: false,
    beforeGoto: async (page: any) => page.route(`**${vitePixiPath}`, (route: any) => route.abort()),
    afterReady: captureFallbackProbe
  });
  const viteUnsafeEval = await runBrowserUiControlSmoke({
    rootDir,
    entryPath: '/',
    readyOnly: true,
    log: false,
    beforeGoto: async (page: any) => page.route(`**${vitePixiUnsafeEvalPath}`, (route: any) => route.abort()),
    afterReady: captureFallbackProbe
  });

  const errors = [
    ...evaluatePixiRuntimeFallbackProbe(classic.afterReadyResult, 'classic'),
    ...evaluatePixiRuntimeFallbackProbe(vite.afterReadyResult, 'vite'),
    ...evaluatePixiRuntimeFallbackProbe(viteUnsafeEval.afterReadyResult, 'vite')
  ];
  if (classic.sample.pageErrors.length) errors.push(`classic: page errors ${JSON.stringify(classic.sample.pageErrors)}`);
  if (vite.sample.pageErrors.length) errors.push(`vite-core: page errors ${JSON.stringify(vite.sample.pageErrors)}`);
  if (viteUnsafeEval.sample.pageErrors.length) errors.push(`vite-csp-replacement: page errors ${JSON.stringify(viteUnsafeEval.sample.pageErrors)}`);
  if (!classic.requestedUrls.some((url: string) => new URL(url).pathname === CLASSIC_VENDOR_PATH)) {
    errors.push('classic: versioned Pixi vendor request was not observed');
  }
  if (!classic.requestedUrls.some((url: string) => new URL(url).pathname === CLASSIC_UNSAFE_EVAL_VENDOR_PATH)) {
    errors.push('classic: versioned Pixi CSP-safe replacement request was not observed');
  }
  if (!vite.requestedUrls.some((url: string) => new URL(url).pathname === vitePixiPath)) {
    errors.push('vite: Pixi dynamic chunk request was not observed');
  }
  if (!viteUnsafeEval.requestedUrls.some((url: string) => new URL(url).pathname === vitePixiUnsafeEvalPath)) {
    errors.push('vite: Pixi CSP-safe replacement chunk request was not observed');
  }
  if (errors.length) throw new Error(errors.join('; '));

  const report = {
    version: PIXI_VERSION,
    classic: classic.afterReadyResult,
    vite: vite.afterReadyResult,
    viteUnsafeEval: viteUnsafeEval.afterReadyResult,
    abortedAssets: {
      classic: [CLASSIC_VENDOR_PATH, CLASSIC_UNSAFE_EVAL_VENDOR_PATH],
      vite: vitePixiPath,
      viteUnsafeEval: vitePixiUnsafeEvalPath
    }
  };
  if (options.log !== false) console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  runPixiRuntimeFallbackBrowserCheck().then(() => {
    console.log('[pixi-runtime-fallback-check] success');
  }).catch((error) => {
    console.error(`[pixi-runtime-fallback-check] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  CLASSIC_VENDOR_PATH,
  CLASSIC_UNSAFE_EVAL_VENDOR_PATH,
  PIXI_VERSION,
  VITE_PIXI_MANIFEST_KEY,
  VITE_PIXI_UNSAFE_EVAL_MANIFEST_KEY,
  evaluatePixiRuntimeFallbackProbe,
  runPixiRuntimeFallbackBrowserCheck
};
