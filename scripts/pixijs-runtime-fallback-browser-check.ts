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
  if (probe?.bootError) errors.push(`${expectedLane}: fatal boot error was rendered`);
  return errors;
}

async function captureFallbackProbe(page: any): Promise<PixiFallbackProbe> {
  return page.evaluate(() => {
    const root = window as any;
    const capability = root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.pixiRuntime || null;
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
