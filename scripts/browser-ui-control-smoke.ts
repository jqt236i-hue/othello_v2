import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser } from 'playwright';
import { REQUIRED_ELEMENT_IDS, REQUIRED_GLOBAL_TYPES } from '../browser-vite/runtime-contract';

const OPTIONAL_REGISTRY_NAME = 'module-registry.optional';
const ONNX_RUNTIME_PATH_FRAGMENT = 'onnxruntime-web/dist/ort.min.js';

interface UiControlSmokeTarget {
  name: string;
  selector: string;
  panelSelector?: string;
  closeSelector?: string;
  stateAttribute?: string;
}

interface UiControlProbe {
  selector: string;
  present: boolean;
  visible: boolean;
  enabled: boolean;
  clicked: boolean;
  opened: boolean;
  beforeState?: string | null;
  afterState?: string | null;
  error?: string;
}

interface UiControlSmokeSample {
  controls: Record<string, UiControlProbe>;
  startupScriptSignals: string[];
  postInteractionScriptSignals: string[];
  pageErrors: string[];
  consoleErrors: string[];
  resourceErrors?: string[];
  documentBaseUri?: string;
}

interface UiControlSmokeEvaluation {
  ok: boolean;
  errors: string[];
}

interface BrowserUiControlSmokeOptions {
  rootDir?: string;
  launch?: typeof chromium.launch;
  log?: boolean;
  entryPath?: string;
  captureComparison?: boolean;
}

interface BrowserLaneComparisonSnapshot {
  readyMs: number;
  userAgent: string;
  lane: string;
  htmlLane: string;
  bootState: string;
  viteRuntime: {
    state: string;
    loadedScripts: string[];
    esmEntry: boolean;
  } | null;
  globals: Record<string, string>;
  missingElements: string[];
  stylesheetPaths: string[];
  startupResources: {
    count: number;
    transferBytes: number;
    encodedBodyBytes: number;
    decodedBodyBytes: number;
  };
  navigation: {
    domContentLoadedMs: number;
    loadMs: number;
  };
  fixture: {
    board: unknown;
    markers: unknown;
    boardWidth: number;
    boardHeight: number;
  };
}

const REQUIRED_UI_CONTROL_SMOKE_TARGETS: UiControlSmokeTarget[] = [
  {
    name: 'debug',
    selector: '#debugModeBtn',
    stateAttribute: 'aria-pressed'
  },
  {
    name: 'handSkin',
    selector: '#handSkinBtn',
    panelSelector: '#handSkinPanel',
    closeSelector: '#handSkinCloseBtn'
  },
  {
    name: 'gacha',
    selector: '#gachaOpenBtn',
    panelSelector: '#gachaOverlay',
    closeSelector: '#gachaCloseBtn'
  },
  {
    name: 'leaderboard',
    selector: '#leaderboardOpenBtn',
    panelSelector: '#leaderboardOverlay',
    closeSelector: '#leaderboardCloseBtn'
  },
  {
    name: 'network',
    selector: '#modeNetworkBtn',
    panelSelector: '#networkOverlay',
    closeSelector: '#networkCloseBtn'
  },
  {
    name: 'ratedMatch',
    selector: '#ratedMatchOpenBtn',
    panelSelector: '#ratedMatchOverlay',
    closeSelector: '#ratedMatchCloseBtn'
  }
];

function normalizeSignals(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function signalContainsFragment(signals: unknown, fragment: string): boolean {
  const normalizedFragment = String(fragment || '').toLowerCase().replace(/\\/g, '/');
  return normalizeSignals(signals).some((entry) => (
    entry.toLowerCase().replace(/\\/g, '/').includes(normalizedFragment)
  ));
}

function evaluateUiControlSmokeSample(sample: UiControlSmokeSample): UiControlSmokeEvaluation {
  const source = sample && typeof sample === 'object' ? sample : {} as UiControlSmokeSample;
  const controls = source.controls && typeof source.controls === 'object' ? source.controls : {};
  const errors: string[] = [];

  for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
    const probe = controls[target.name];
    if (!probe || probe.present !== true) {
      errors.push(`${target.name} control ${target.selector} is missing`);
      continue;
    }
    if (probe.visible !== true) {
      errors.push(`${target.name} control ${target.selector} is not visible`);
    }
    if (probe.enabled !== true) {
      errors.push(`${target.name} control ${target.selector} is disabled`);
    }
    if (probe.clicked !== true) {
      errors.push(`${target.name} control ${target.selector} was not clicked`);
    }
    if (target.panelSelector && probe.opened !== true) {
      errors.push(`${target.name} control ${target.selector} did not open ${target.panelSelector}`);
    }
    if (target.stateAttribute && probe.clicked === true && probe.beforeState === probe.afterState) {
      errors.push(`${target.name} control ${target.selector} did not change ${target.stateAttribute}`);
    }
    if (probe.error) {
      errors.push(`${target.name} control ${target.selector} error: ${probe.error}`);
    }
  }

  if (signalContainsFragment(source.startupScriptSignals, OPTIONAL_REGISTRY_NAME)) {
    errors.push('optional registry was loaded before user interaction');
  }
  if (
    signalContainsFragment(source.startupScriptSignals, ONNX_RUNTIME_PATH_FRAGMENT)
    || signalContainsFragment(source.postInteractionScriptSignals, ONNX_RUNTIME_PATH_FRAGMENT)
  ) {
    errors.push('ONNX runtime was loaded during UI control smoke');
  }

  for (const error of normalizeSignals(source.pageErrors)) {
    errors.push(`page error: ${error}`);
  }
  for (const error of normalizeSignals(source.consoleErrors)) {
    errors.push(`console error: ${error}`);
  }
  for (const error of normalizeSignals(source.resourceErrors)) {
    errors.push(`resource error: ${error}`);
  }

  return { ok: errors.length === 0, errors };
}

function summarizeControls(controls: Record<string, UiControlProbe>): Record<string, any> {
  const summary: Record<string, any> = {};
  for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
    const probe = controls[target.name];
    summary[target.name] = probe ? {
      present: probe.present,
      visible: probe.visible,
      enabled: probe.enabled,
      clicked: probe.clicked,
      opened: probe.opened
    } : { present: false };
  }
  return summary;
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

function writeJson(res: http.ServerResponse, status: number, payload: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function createStaticServer(rootDir: string): http.Server {
  const normalizedRoot = path.resolve(rootDir);
  return http.createServer((req, res) => {
    const rawPath = String((req && req.url) || '/').split('?')[0] || '/';
    if (rawPath === '/api/match/list') {
      writeJson(res, 200, { ok: true, rooms: [] });
      return;
    }
    if (rawPath === '/api/leaderboard/list') {
      writeJson(res, 200, { ok: true, entries: [], updatedAt: Date.now() });
      return;
    }

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
}

async function closeSidePanelIfOpen(page: any): Promise<void> {
  const isOpen = await page.evaluate(() => {
    const panel = document.getElementById('side-panel');
    return !!panel && panel.getAttribute('aria-hidden') !== 'true';
  });
  if (!isOpen) return;

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const panel = document.getElementById('side-panel');
    return !!panel && panel.classList.contains('side-panel-collapsed') && panel.getAttribute('aria-hidden') === 'true';
  }, null, { timeout: 5000 });
}

async function collectScriptSignals(page: any, requestedUrls: string[]): Promise<string[]> {
  const runtimeSignals = await page.evaluate(() => (
    Array.from(document.scripts).map((script) => script.src || script.getAttribute('src') || '')
  ));
  return normalizeSignals(requestedUrls.concat(runtimeSignals || []));
}

async function readControlState(page: any, target: UiControlSmokeTarget): Promise<UiControlProbe> {
  return page.evaluate((probeTarget: UiControlSmokeTarget) => {
    const button = document.querySelector(probeTarget.selector) as HTMLButtonElement | null;
    if (!button) {
      return {
        selector: probeTarget.selector,
        present: false,
        visible: false,
        enabled: false,
        clicked: false,
        opened: false
      };
    }
    const rect = button.getBoundingClientRect();
    const style = window.getComputedStyle(button);
    const visible = rect.width > 0
      && rect.height > 0
      && style.visibility !== 'hidden'
      && style.display !== 'none'
      && style.opacity !== '0';
    return {
      selector: probeTarget.selector,
      present: true,
      visible,
      enabled: button.disabled !== true && button.getAttribute('aria-disabled') !== 'true',
      clicked: false,
      opened: false,
      beforeState: probeTarget.stateAttribute ? button.getAttribute(probeTarget.stateAttribute) : null
    };
  }, target);
}

async function waitForPanelOpen(page: any, selector: string): Promise<boolean> {
  try {
    await page.waitForFunction((panelSelector: string) => {
      const panel = document.querySelector(panelSelector) as HTMLElement | null;
      if (!panel) return false;
      return panel.getAttribute('aria-hidden') === 'false'
        || panel.classList.contains('is-open')
        || panel.hidden === false;
    }, selector, { timeout: 10000 });
    return true;
  } catch (_error) {
    return false;
  }
}

async function waitForStateChange(page: any, target: UiControlSmokeTarget, beforeState: string | null | undefined): Promise<boolean> {
  if (!target.stateAttribute) return true;
  try {
    await page.waitForFunction((args: any) => {
      const button = document.querySelector(args.selector) as HTMLElement | null;
      return !!button && button.getAttribute(args.attribute) !== args.beforeState;
    }, {
      selector: target.selector,
      attribute: target.stateAttribute,
      beforeState: beforeState == null ? null : String(beforeState)
    }, { timeout: 5000 });
    return true;
  } catch (_error) {
    return false;
  }
}

async function closeControlPanel(page: any, target: UiControlSmokeTarget): Promise<void> {
  if (!target.closeSelector) return;
  try {
    const closeButton = await page.$(target.closeSelector);
    if (closeButton) {
      await closeButton.click({ timeout: 5000 });
      await page.waitForTimeout(100);
    }
  } catch (_error) {
    // The probe already captured the open failure; close failures must not hide it.
  }
}

async function probeControl(page: any, target: UiControlSmokeTarget): Promise<UiControlProbe> {
  const probe = await readControlState(page, target);
  if (!probe.present || !probe.visible || !probe.enabled) return probe;
  try {
    await page.click(target.selector, { timeout: 10000 });
    probe.clicked = true;
    const opened = target.panelSelector
      ? await waitForPanelOpen(page, target.panelSelector)
      : await waitForStateChange(page, target, probe.beforeState);
    probe.opened = opened;
    probe.afterState = target.stateAttribute
      ? await page.$eval(target.selector, (button: Element, attribute: string) => button.getAttribute(attribute), target.stateAttribute)
      : null;
    await closeControlPanel(page, target);
  } catch (error) {
    probe.error = error instanceof Error ? error.message : String(error);
  }
  return probe;
}

async function captureStartupComparisonSnapshot(page: any, readyMs: number): Promise<Omit<BrowserLaneComparisonSnapshot, 'fixture'>> {
  await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready);
  return page.evaluate(({ globalTypes, elementIds, measuredReadyMs }: any) => {
    const root = window as any;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const globals = Object.fromEntries(Object.keys(globalTypes).map((name) => [name, typeof root[name]]));
    return {
      readyMs: measuredReadyMs,
      userAgent: navigator.userAgent,
      lane: String(root.__CARD_REVERSI_BROWSER_LANE__ || ''),
      htmlLane: String(document.documentElement.getAttribute('data-browser-lane') || ''),
      bootState: String(document.documentElement.getAttribute('data-browser-boot-state') || ''),
      viteRuntime: root.__CARD_REVERSI_BROWSER_METRICS__ ? {
        state: String(root.__CARD_REVERSI_BROWSER_METRICS__.state || ''),
        loadedScripts: Array.isArray(root.__CARD_REVERSI_BROWSER_METRICS__.loadedScripts)
          ? root.__CARD_REVERSI_BROWSER_METRICS__.loadedScripts.slice()
          : [],
        esmEntry: root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.esmEntry === true
      } : null,
      globals,
      missingElements: elementIds.filter((id: string) => !document.getElementById(id)),
      stylesheetPaths: Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((link: Element) => new URL((link as HTMLLinkElement).href, document.baseURI).pathname),
      startupResources: {
        count: resources.length,
        transferBytes: resources.reduce((sum, entry) => sum + Number(entry.transferSize || 0), 0),
        encodedBodyBytes: resources.reduce((sum, entry) => sum + Number(entry.encodedBodySize || 0), 0),
        decodedBodyBytes: resources.reduce((sum, entry) => sum + Number(entry.decodedBodySize || 0), 0)
      },
      navigation: {
        domContentLoadedMs: Number(navigation && navigation.domContentLoadedEventEnd || 0),
        loadMs: Number(navigation && navigation.loadEventEnd || 0)
      }
    };
  }, {
    globalTypes: REQUIRED_GLOBAL_TYPES,
    elementIds: REQUIRED_ELEMENT_IDS,
    measuredReadyMs: readyMs
  });
}

async function captureComparisonFixture(page: any): Promise<{
  fixture: BrowserLaneComparisonSnapshot['fixture'];
  boardPng: Buffer;
}> {
  const debugEnabled = await page.getAttribute('#debugModeBtn', 'aria-pressed');
  if (debugEnabled !== 'true') await page.click('#debugModeBtn', { timeout: 10000 });
  await page.waitForSelector('#visualTestBtn', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const button = document.getElementById('visualTestBtn') as HTMLButtonElement | null;
    if (!button || typeof button.click !== 'function') throw new Error('visual fixture control is unavailable');
    button.click();
  });
  try {
    await page.waitForFunction(() => {
      const root = window as any;
      const board = root.gameState && root.gameState.board;
      const markers = root.cardState && root.cardState.markers;
      return Array.isArray(board)
        && board.length === 8
        && board.every((row: unknown) => Array.isArray(row) && row.length === 8)
        && board[0][0] !== 0
        && board[0][1] !== 0
        && board[7][0] !== 0
        && board[7][1] !== 0
        && Array.isArray(markers)
        && markers.length === 15;
    }, null, { timeout: 10000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const root = window as any;
      return {
        debugPressed: document.getElementById('debugModeBtn')?.getAttribute('aria-pressed'),
        visualButtonPresent: !!document.getElementById('visualTestBtn'),
        boardRows: Array.isArray(root.gameState?.board) ? root.gameState.board.length : null,
        corners: Array.isArray(root.gameState?.board) ? [
          root.gameState.board[0]?.[0],
          root.gameState.board[0]?.[1],
          root.gameState.board[7]?.[0],
          root.gameState.board[7]?.[1]
        ] : null,
        markerCount: Array.isArray(root.cardState?.markers) ? root.cardState.markers.length : null
      };
    });
    throw new Error(`visual fixture did not settle: ${JSON.stringify(diagnostics)}; ${error instanceof Error ? error.message : error}`);
  }
  await page.evaluate(() => {
    const root = window as any;
    if (typeof root.forceFullRender === 'function' && root.boardEl) root.forceFullRender(root.boardEl);
  });
  try {
    await page.waitForFunction(() => document.documentElement.classList.contains('stone-images-loaded'), null, { timeout: 5000 });
  } catch (_error) {
    // The screenshot still captures the explicit CSS fallback if an image codec is unavailable.
  }
  await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready);
  await closeSidePanelIfOpen(page);
  await page.waitForTimeout(500);
  const fixture = await page.evaluate(() => {
    const root = window as any;
    const board = document.getElementById('board');
    const rect = board ? board.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      board: root.gameState && root.gameState.board,
      markers: root.cardState && root.cardState.markers,
      boardWidth: Number(rect.width),
      boardHeight: Number(rect.height)
    };
  });
  const board = page.locator('#board');
  const boardPng = await board.screenshot({ type: 'png' });
  return { fixture, boardPng };
}

async function runBrowserUiControlSmoke(options?: BrowserUiControlSmokeOptions): Promise<{
  sample: UiControlSmokeSample;
  evaluation: UiControlSmokeEvaluation;
  requestedUrls: string[];
  startupRequestedUrls: string[];
  comparison?: BrowserLaneComparisonSnapshot;
  boardPng?: Buffer;
}> {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootDir = path.resolve(opts.rootDir || process.cwd());
  const server = createStaticServer(rootDir);
  let browser: Browser | null = null;
  try {
    const baseUrl = await listen(server);
    const requestedUrls: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const resourceErrors: string[] = [];
    const launch = typeof opts.launch === 'function' ? opts.launch : chromium.launch.bind(chromium);
    browser = await launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

    page.on('request', (request: any) => {
      requestedUrls.push(request.url());
    });
    page.on('pageerror', (error: Error) => {
      pageErrors.push(error && error.message ? error.message : String(error));
    });
    page.on('console', (message: any) => {
      if (message.type && message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('response', (response: any) => {
      if (!response.ok()) resourceErrors.push(`${response.status()} ${response.url()}`);
    });

    const entryPath = String(opts.entryPath || '/').trim() || '/';
    const separator = entryPath.includes('?') ? '&' : '?';
    const startedAt = Date.now();
    await page.goto(`${baseUrl}${entryPath}${separator}debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 10000 });
    for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
      await page.waitForSelector(target.selector, { state: 'attached', timeout: 30000 });
    }
    await page.waitForFunction(() => (window as any).__uiInitialized === true, null, { timeout: 30000 });
    const readyMs = Date.now() - startedAt;

    await page.waitForTimeout(500);
    const startupScriptSignals = await collectScriptSignals(page, requestedUrls);
    const startupComparison = opts.captureComparison
      ? await captureStartupComparisonSnapshot(page, readyMs)
      : null;
    const startupRequestedUrls = requestedUrls.slice();
    const controls: Record<string, UiControlProbe> = {};
    let fixtureCapture: Awaited<ReturnType<typeof captureComparisonFixture>> | null = null;
    for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
      controls[target.name] = await probeControl(page, target);
      if (target.name === 'debug') {
        await closeSidePanelIfOpen(page);
        if (opts.captureComparison) fixtureCapture = await captureComparisonFixture(page);
      }
    }
    await page.waitForTimeout(500);
    const postInteractionScriptSignals = await collectScriptSignals(page, requestedUrls);
    const comparison = startupComparison && fixtureCapture
      ? { ...startupComparison, fixture: fixtureCapture.fixture }
      : undefined;
    const sample: UiControlSmokeSample = {
      controls,
      startupScriptSignals,
      postInteractionScriptSignals,
      pageErrors,
      consoleErrors,
      resourceErrors,
      documentBaseUri: await page.evaluate(() => document.baseURI)
    };
    const evaluation = evaluateUiControlSmokeSample(sample);

    if (opts.log !== false) {
      console.log(JSON.stringify({
        controls: summarizeControls(sample.controls),
        startupScriptCount: sample.startupScriptSignals.length,
        postInteractionScriptCount: sample.postInteractionScriptSignals.length,
        optionalRegistryLoadedBeforeInteraction: signalContainsFragment(sample.startupScriptSignals, OPTIONAL_REGISTRY_NAME),
        optionalRegistryLoadedAfterInteraction: signalContainsFragment(sample.postInteractionScriptSignals, OPTIONAL_REGISTRY_NAME),
        onnxRuntimeLoaded: signalContainsFragment(sample.startupScriptSignals, ONNX_RUNTIME_PATH_FRAGMENT)
          || signalContainsFragment(sample.postInteractionScriptSignals, ONNX_RUNTIME_PATH_FRAGMENT),
        pageErrorCount: sample.pageErrors.length,
        consoleErrorCount: sample.consoleErrors.length,
        resourceErrorCount: sample.resourceErrors?.length || 0,
        resourceErrors: normalizeSignals(sample.resourceErrors).slice(0, 30),
        documentBaseUri: sample.documentBaseUri,
        evaluation,
        requestedScripts: postInteractionScriptSignals.filter((url) => /\.js(?:\?|$)/.test(String(url || '')))
      }, null, 2));
    }
    return {
      sample,
      evaluation,
      requestedUrls,
      startupRequestedUrls,
      comparison,
      boardPng: fixtureCapture?.boardPng
    };
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

if (require.main === module) {
  const entryPath = process.argv.includes('--vite') ? '/vite-dist/index.vite.html' : '/';
  runBrowserUiControlSmoke({ entryPath }).then((result) => {
    if (!result.evaluation.ok) {
      console.error(`[browser-ui-control-smoke] failed: ${result.evaluation.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-ui-control-smoke] success');
  }).catch((error) => {
    console.error(`[browser-ui-control-smoke] failed: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  REQUIRED_UI_CONTROL_SMOKE_TARGETS,
  evaluateUiControlSmokeSample,
  runBrowserUiControlSmoke,
  summarizeControls
};
