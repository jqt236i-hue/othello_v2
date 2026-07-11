import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser } from 'playwright';

const OPTIONAL_REGISTRY_NAME = 'module-registry.optional.js';
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
}

interface UiControlSmokeEvaluation {
  ok: boolean;
  errors: string[];
}

interface BrowserUiControlSmokeOptions {
  rootDir?: string;
  launch?: typeof chromium.launch;
  log?: boolean;
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

async function runBrowserUiControlSmoke(options?: BrowserUiControlSmokeOptions): Promise<{
  sample: UiControlSmokeSample;
  evaluation: UiControlSmokeEvaluation;
  requestedUrls: string[];
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

    await page.goto(`${baseUrl}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await closeMaintenanceNoticeIfPresent(page);
    await page.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 10000 });
    for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
      await page.waitForSelector(target.selector, { state: 'attached', timeout: 30000 });
    }

    await page.waitForTimeout(500);
    const startupScriptSignals = await collectScriptSignals(page, requestedUrls);
    const controls: Record<string, UiControlProbe> = {};
    for (const target of REQUIRED_UI_CONTROL_SMOKE_TARGETS) {
      controls[target.name] = await probeControl(page, target);
      if (target.name === 'debug') await closeSidePanelIfOpen(page);
    }
    await page.waitForTimeout(500);
    const postInteractionScriptSignals = await collectScriptSignals(page, requestedUrls);
    const sample: UiControlSmokeSample = {
      controls,
      startupScriptSignals,
      postInteractionScriptSignals,
      pageErrors,
      consoleErrors
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
        evaluation,
        requestedScripts: postInteractionScriptSignals.filter((url) => /\.js(?:\?|$)/.test(String(url || '')))
      }, null, 2));
    }
    return { sample, evaluation, requestedUrls };
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

if (require.main === module) {
  runBrowserUiControlSmoke().then((result) => {
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
