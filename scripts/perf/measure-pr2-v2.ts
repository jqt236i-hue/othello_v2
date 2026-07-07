import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

type NumericSummary = {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
  p95: number | null;
};

type ScenarioSample = {
  name: string;
  measures: Record<string, NumericSummary>;
  rawMeasures: Record<string, number[]>;
  summaryMarks: unknown[];
  navigation: Record<string, number | null>;
  paint: Record<string, number | null>;
  vitals: Record<string, number | null>;
  consoleErrors: string[];
  pageErrors: string[];
};

type PerfReport = {
  generatedAt: string;
  baseUrl: string;
  url: string;
  iterations: number;
  viewport: { width: number; height: number };
  samples: ScenarioSample[];
  aggregate: Record<string, NumericSummary>;
};

const PERF_MEASURE_NAMES = [
  'othello:renderBoard:measure',
  'othello:renderBoardDiff:measure',
  'othello:syncBoardPixelSizing:measure',
  'othello:reconcileCellHasDiscClasses:measure',
  'othello:reconcileCellHintClasses:measure',
  'othello:_syncBoardShrinkGodDirectionHintsForDiff:measure',
  'othello:buildCurrentCellState:measure'
];

function resolveMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.onnx') return 'application/octet-stream';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

function writeJson(res: http.ServerResponse, status: number, payload: unknown): void {
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

function percentile(sortedValues: number[], ratio: number): number | null {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}

function summarize(values: number[]): NumericSummary {
  const normalized = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!normalized.length) {
    return { count: 0, min: null, max: null, avg: null, median: null, p95: null };
  }
  const sum = normalized.reduce((acc, value) => acc + value, 0);
  return {
    count: normalized.length,
    min: normalized[0],
    max: normalized[normalized.length - 1],
    avg: sum / normalized.length,
    median: percentile(normalized, 0.5),
    p95: percentile(normalized, 0.95)
  };
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

function roundedSummary(summary: NumericSummary): NumericSummary {
  return {
    count: summary.count,
    min: round(summary.min),
    max: round(summary.max),
    avg: round(summary.avg),
    median: round(summary.median),
    p95: round(summary.p95)
  };
}

async function closeMaintenanceNoticeIfPresent(page: Page): Promise<void> {
  const closeButton = page.locator('#maintenanceNoticeCloseBtn');
  try {
    if (await closeButton.count()) {
      await closeButton.first().click({ timeout: 1000 });
    }
  } catch (_error) {
    // Optional notice; ignore when it is absent or already hidden.
  }
}

async function installVitalsObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__pr2v2Vitals = { lcp: null, cls: 0, firstInputDelay: null };
    try {
      const PerformanceObserverCtor = (window as any).PerformanceObserver;
      if (!PerformanceObserverCtor) return;
      if (PerformanceObserverCtor.supportedEntryTypes && PerformanceObserverCtor.supportedEntryTypes.includes('largest-contentful-paint')) {
        const observer = new PerformanceObserverCtor((list: any) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) (window as any).__pr2v2Vitals.lcp = last.startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      }
      if (PerformanceObserverCtor.supportedEntryTypes && PerformanceObserverCtor.supportedEntryTypes.includes('layout-shift')) {
        const observer = new PerformanceObserverCtor((list: any) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) (window as any).__pr2v2Vitals.cls += entry.value || 0;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      }
      if (PerformanceObserverCtor.supportedEntryTypes && PerformanceObserverCtor.supportedEntryTypes.includes('first-input')) {
        const observer = new PerformanceObserverCtor((list: any) => {
          const entry = list.getEntries()[0];
          if (entry) (window as any).__pr2v2Vitals.firstInputDelay = entry.processingStart - entry.startTime;
        });
        observer.observe({ type: 'first-input', buffered: true });
      }
    } catch (_error) {
      // Browser metric collection is best-effort.
    }
  });
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = window as any;
    const perfModule = root.PerfBenchmarks || (typeof root.require === 'function' ? root.require('ui/perf-benchmarks') : null);
    return !!(
      perfModule
      && typeof perfModule.isPerfBenchEnabled === 'function'
      && perfModule.isPerfBenchEnabled() === true
      && root.gameState
      && Array.isArray(root.gameState.board)
      && root.gameState.board.length > 0
      && typeof root.renderBoard === 'function'
    );
  }, null, { timeout: 30000 });
}

async function clearPerfEntries(page: Page): Promise<void> {
  await page.evaluate(() => {
    try { performance.clearMeasures(); } catch (_error) { /* ignore */ }
    try { performance.clearMarks(); } catch (_error) { /* ignore */ }
  });
}

async function runRenderLoop(page: Page, count: number): Promise<void> {
  await page.evaluate(async (renderCount) => {
    const root = window as any;
    for (let index = 0; index < renderCount; index++) {
      if (typeof root.renderBoard === 'function') root.renderBoard();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
}

async function clickLegalMoves(page: Page, maxMoves: number): Promise<void> {
  for (let index = 0; index < maxMoves; index++) {
    await page.waitForTimeout(80);
    const clicked = await page.evaluate(() => {
      const selectors = ['.cell.legal', '.cell.legal-free', '.cell.effect-target-highlight-positive'];
      for (const selector of selectors) {
        const cell = document.querySelector(selector) as HTMLElement | null;
        if (cell) {
          cell.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) break;
    await page.waitForTimeout(260);
  }
}

async function runSkinSwitch(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = window as any;
    const runtime = root.require ? root.require('ui/board-skin/runtime') : null;
    const catalog = root.require ? root.require('ui/board-skin/catalog') : null;
    if (runtime && catalog) {
      const boardSkins = typeof catalog.getAllBoardSkins === 'function' ? catalog.getAllBoardSkins() : [];
      const frameSkins = typeof catalog.getAllBoardFrameSkins === 'function' ? catalog.getAllBoardFrameSkins() : [];
      const nextBoard = boardSkins.find((skin: any) => skin && skin.id && document.documentElement.getAttribute('data-board-skin-id') !== skin.id);
      const nextFrame = frameSkins.find((skin: any) => skin && skin.id && document.documentElement.getAttribute('data-board-frame-skin-id') !== skin.id);
      if (nextBoard && typeof runtime.syncDisplayedBoardSkin === 'function') runtime.syncDisplayedBoardSkin(root, nextBoard.id);
      if (nextFrame && typeof runtime.syncDisplayedBoardFrameSkin === 'function') runtime.syncDisplayedBoardFrameSkin(root, nextFrame.id);
    }
    if (typeof root.renderBoard === 'function') root.renderBoard();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function runPageStateTriggers(page: Page): Promise<void> {
  await page.evaluate(async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const root = window as any;
    if (typeof root.renderBoard === 'function') root.renderBoard();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function runScenario(page: Page): Promise<void> {
  await runRenderLoop(page, 12);
  await clickLegalMoves(page, 4);
  await runRenderLoop(page, 8);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(180);
  await runRenderLoop(page, 5);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(180);
  await runSkinSwitch(page);
  await runPageStateTriggers(page);
  await runRenderLoop(page, 8);
}

async function collectSample(page: Page, name: string, consoleErrors: string[], pageErrors: string[]): Promise<ScenarioSample> {
  const raw = await page.evaluate((measureNames) => {
    const measures: Record<string, number[]> = {};
    for (const name of measureNames as string[]) {
      measures[name] = performance.getEntriesByName(name).map((entry) => entry.duration);
    }
    const summaryMarks = performance.getEntriesByName('othello:renderBoardDiff.summary')
      .slice(-12)
      .map((entry: any) => entry.detail || null);
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paintEntries = performance.getEntriesByType('paint');
    const paint: Record<string, number | null> = {};
    for (const entry of paintEntries) paint[entry.name] = entry.startTime;
    return {
      measures,
      summaryMarks,
      navigation: nav ? {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
        responseEnd: nav.responseEnd - nav.startTime,
        transferSize: (nav as any).transferSize || null
      } : {
        domContentLoaded: null,
        load: null,
        responseEnd: null,
        transferSize: null
      },
      paint,
      vitals: (window as any).__pr2v2Vitals || {}
    };
  }, PERF_MEASURE_NAMES);

  const measures: Record<string, NumericSummary> = {};
  for (const [measureName, values] of Object.entries(raw.measures as Record<string, number[]>)) {
    measures[measureName] = roundedSummary(summarize(values));
  }
  return {
    name,
    measures,
    rawMeasures: raw.measures || {},
    summaryMarks: raw.summaryMarks || [],
    navigation: raw.navigation || {},
    paint: raw.paint || {},
    vitals: raw.vitals || {},
    consoleErrors: consoleErrors.slice(),
    pageErrors: pageErrors.slice()
  };
}

function aggregateSamples(samples: ScenarioSample[]): Record<string, NumericSummary> {
  const durations: Record<string, number[]> = {};
  for (const name of PERF_MEASURE_NAMES) durations[name] = [];
  for (const sample of samples) {
    for (const name of PERF_MEASURE_NAMES) {
      const values = sample.rawMeasures && Array.isArray(sample.rawMeasures[name]) ? sample.rawMeasures[name] : [];
      durations[name].push(...values);
    }
  }
  const aggregate: Record<string, NumericSummary> = {};
  for (const [name, values] of Object.entries(durations)) aggregate[name] = roundedSummary(summarize(values));
  return aggregate;
}

function formatMs(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(3)}ms`;
}

function renderMeasureTable(measures: Record<string, NumericSummary>): string {
  const lines = [
    '| measure | count | median | p95 | avg | min | max |',
    '|---|---:|---:|---:|---:|---:|---:|'
  ];
  for (const name of PERF_MEASURE_NAMES) {
    const summary = measures[name] || { count: 0, min: null, max: null, avg: null, median: null, p95: null };
    lines.push(`| \`${name}\` | ${summary.count} | ${formatMs(summary.median)} | ${formatMs(summary.p95)} | ${formatMs(summary.avg)} | ${formatMs(summary.min)} | ${formatMs(summary.max)} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(report: PerfReport): string {
  const lines: string[] = [];
  lines.push('# PR2 v2 Performance Measurement');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Iterations: ${report.iterations}`);
  lines.push('');
  lines.push('## Aggregate');
  lines.push('');
  lines.push(renderMeasureTable(report.aggregate));
  lines.push('');
  for (const sample of report.samples) {
    lines.push(`## ${sample.name}`);
    lines.push('');
    lines.push(renderMeasureTable(sample.measures));
    lines.push('');
    lines.push(`Console errors: ${sample.consoleErrors.length}`);
    lines.push(`Page errors: ${sample.pageErrors.length}`);
    lines.push('');
    lines.push('Recent `renderBoardDiff.summary` details:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(sample.summaryMarks.slice(-5), null, 2));
    lines.push('```');
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

async function run(): Promise<void> {
  const rootDir = process.cwd();
  const outDir = path.join(rootDir, 'docs', 'perf');
  fs.mkdirSync(outDir, { recursive: true });
  const server = createStaticServer(rootDir);
  let browser: Browser | null = null;
  try {
    const baseUrl = await listen(server);
    const url = `${baseUrl}/?perf=1`;
    browser = await chromium.launch({ headless: true });
    const samples: ScenarioSample[] = [];
    const iterations = 3;
    for (let iteration = 1; iteration <= iterations; iteration++) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error && error.message ? error.message : String(error)));
      await installVitalsObserver(page);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await closeMaintenanceNoticeIfPresent(page);
      await waitForAppReady(page);
      await page.waitForTimeout(500);
      await clearPerfEntries(page);
      await runScenario(page);
      await page.waitForTimeout(300);
      samples.push(await collectSample(page, `iteration-${iteration}`, consoleErrors, pageErrors));
      await page.close();
    }

    const report: PerfReport = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      url,
      iterations,
      viewport: { width: 1366, height: 900 },
      samples,
      aggregate: aggregateSamples(samples)
    };
    const jsonPath = path.join(outDir, '2026-07-06-pr2-v2.json');
    const mdPath = path.join(outDir, '2026-07-06-pr2-v2.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');
    console.log(`[perf] wrote ${path.relative(rootDir, jsonPath)}`);
    console.log(`[perf] wrote ${path.relative(rootDir, mdPath)}`);
    console.log(renderMeasureTable(report.aggregate));
    const errorCount = samples.reduce((sum, sample) => sum + sample.consoleErrors.length + sample.pageErrors.length, 0);
    if (errorCount > 0) {
      throw new Error(`Performance run saw ${errorCount} console/page errors; inspect JSON output.`);
    }
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}

export = { run, summarize };
