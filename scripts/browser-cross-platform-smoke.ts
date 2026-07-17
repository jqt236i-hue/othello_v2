import { chromium, devices, firefox, webkit, type Browser, type BrowserContextOptions } from 'playwright';
import BrowserUiControlSmoke from './browser-ui-control-smoke';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;

interface BrowserScenario {
  name: string;
  launch: (options: { headless: boolean }) => Promise<Browser>;
  pageOptions: BrowserContextOptions;
  interactionMode?: 'mouse' | 'touch';
}

const desktopOptions: BrowserContextOptions = {
  viewport: { width: 1366, height: 900 }
};

function createScenarios(): BrowserScenario[] {
  const pixel = devices['Pixel 7'];
  return [
    {
      name: 'chromium-desktop',
      launch: chromium.launch.bind(chromium),
      pageOptions: desktopOptions
    },
    {
      name: 'firefox-desktop',
      launch: firefox.launch.bind(firefox),
      pageOptions: desktopOptions
    },
    {
      name: 'webkit-desktop',
      launch: webkit.launch.bind(webkit),
      pageOptions: desktopOptions
    },
    {
      name: 'chromium-touch-mobile',
      launch: chromium.launch.bind(chromium),
      pageOptions: {
        ...pixel,
        viewport: pixel.viewport,
        deviceScaleFactor: 2,
        reducedMotion: 'reduce'
      },
      interactionMode: 'touch'
    }
  ];
}

async function runBrowserCrossPlatformSmoke(options: { log?: boolean; scenarioNames?: string[] } = {}): Promise<any> {
  const probes: any[] = [];
  const errors: string[] = [];
  const requestedNames = new Set((options.scenarioNames || []).map(String).filter(Boolean));
  const scenarios = createScenarios().filter((scenario) => (
    requestedNames.size === 0 || requestedNames.has(scenario.name)
  ));
  if (scenarios.length === 0) throw new Error('no matching cross-platform browser scenario');
  for (const scenario of scenarios) {
    for (const backend of ['dom', 'pixi'] as const) {
      try {
        const result = await runBrowserUiControlSmoke({
          entryPath: `/?boardRenderer=${backend}&noanim=1`,
          launch: scenario.launch,
          pageOptions: scenario.pageOptions,
          interactionMode: scenario.interactionMode,
          log: false,
          afterReady: async (page: any) => page.evaluate(() => {
            const root = window as any;
            const diagnostics = root.__boardVisualDebug?.getBackendDiagnostics?.() || {};
            return {
              backend: root.__boardVisualDebug?.getBackendKind?.() || null,
              canvasCount: Number(diagnostics.canvasCount || 0),
              contextCount: Number(diagnostics.contextCount || 0),
              domCellCount: Number(diagnostics.domCellCount || 0),
              dpr: window.devicePixelRatio,
              harnessGlobalPresent: Object.prototype.hasOwnProperty.call(root, '__boardPerfHarness'),
              controlsPresent: !!document.querySelector('[data-board-perf-controls], #board-performance-controls')
            };
          })
        });
        const registryRequests = result.requestedUrls.filter((url: string) => url.includes('module-registry'));
        const backendProbe = result.afterReadyResult || {};
        const probe = {
          name: scenario.name,
          backend,
          evaluation: result.evaluation,
          backendProbe,
          failedHitTests: Object.fromEntries(
            Object.entries(result.sample.controls)
              .filter(([, control]: any) => control?.hitTest)
              .map(([name, control]: any) => [name, control.hitTest])
          ),
          registryRequests,
          pageErrors: result.sample.pageErrors,
          consoleErrors: result.sample.consoleErrors,
          resourceErrors: result.sample.resourceErrors || []
        };
        probes.push(probe);
        if (!result.evaluation.ok) errors.push(`${scenario.name}/${backend}: ${result.evaluation.errors.join('; ')}`);
        if (registryRequests.length > 0) errors.push(`${scenario.name}/${backend}: Vite requested compatibility registry`);
        if (backendProbe.backend !== backend) errors.push(`${scenario.name}/${backend}: selected backend was ${backendProbe.backend}`);
        if (backend === 'pixi' && (backendProbe.canvasCount !== 1 || backendProbe.contextCount !== 1 || backendProbe.domCellCount !== 0)) {
          errors.push(`${scenario.name}/${backend}: Pixi did not remain the exclusive board surface`);
        }
        if (backend === 'dom' && (backendProbe.canvasCount !== 0 || backendProbe.domCellCount !== 64)) {
          errors.push(`${scenario.name}/${backend}: DOM did not remain the exclusive 64-cell board surface`);
        }
        if (backendProbe.harnessGlobalPresent || backendProbe.controlsPresent) errors.push(`${scenario.name}/${backend}: normal startup leaked performance harness state`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        probes.push({ name: scenario.name, backend, error: message });
        errors.push(`${scenario.name}/${backend}: ${message}`);
      }
    }
  }
  const report = { ok: errors.length === 0, errors, probes };
  if (options.log !== false) console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  const scenarioNames = process.argv
    .filter((value) => value.startsWith('--scenario='))
    .map((value) => value.slice('--scenario='.length));
  runBrowserCrossPlatformSmoke({ scenarioNames }).then((report) => {
    if (!report.ok) {
      console.error(`[browser-cross-platform-smoke] failed: ${report.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-cross-platform-smoke] success');
  }).catch((error) => {
    console.error(`[browser-cross-platform-smoke] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = { createScenarios, runBrowserCrossPlatformSmoke };
