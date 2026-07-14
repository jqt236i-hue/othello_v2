import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import BrowserUiControlSmoke from './browser-ui-control-smoke';
import { REQUIRED_GLOBAL_TYPES } from '../browser-vite/runtime-contract';

const { runBrowserUiControlSmoke } = BrowserUiControlSmoke as any;
const PNG = require('pngjs').PNG;

const REPORT_JSON_PATH = 'docs/perf/2026-07-14-browser-lane-comparison.json';
const REPORT_MARKDOWN_PATH = 'docs/perf/2026-07-14-browser-lane-comparison.md';

interface CompareBrowserLanesOptions {
  rootDir?: string;
  write?: boolean;
  log?: boolean;
  runs?: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableJson(value: any): string {
  return JSON.stringify(stableValue(value));
}

function digest(value: any): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeRequestedPaths(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return Array.from(new Set(urls.map((value) => {
    try {
      const url = new URL(String(value));
      return `${url.pathname}${url.search}`;
    } catch (_error) {
      return String(value || '');
    }
  }).filter(Boolean))).sort();
}

function comparePngBuffers(classicBuffer: Buffer, viteBuffer: Buffer): {
  width: number;
  height: number;
  diffPixels: number;
} {
  const classic = PNG.sync.read(classicBuffer);
  const vite = PNG.sync.read(viteBuffer);
  if (classic.width !== vite.width || classic.height !== vite.height) {
    throw new Error(`board screenshot size mismatch: classic=${classic.width}x${classic.height}, vite=${vite.width}x${vite.height}`);
  }
  let diffPixels = 0;
  for (let offset = 0; offset < classic.data.length; offset += 4) {
    if (
      classic.data[offset] !== vite.data[offset]
      || classic.data[offset + 1] !== vite.data[offset + 1]
      || classic.data[offset + 2] !== vite.data[offset + 2]
      || classic.data[offset + 3] !== vite.data[offset + 3]
    ) {
      diffPixels += 1;
    }
  }
  return { width: classic.width, height: classic.height, diffPixels };
}

function summarizeLane(result: any): any {
  const snapshot = result.comparison;
  const startupPaths = normalizeRequestedPaths(result.startupRequestedUrls);
  return {
    lane: snapshot.lane,
    htmlLane: snapshot.htmlLane,
    bootState: snapshot.bootState,
    viteRuntime: snapshot.viteRuntime,
    pixiRuntime: snapshot.pixiRuntime,
    boardRenderSurface: snapshot.boardRenderSurface,
    readyMs: snapshot.readyMs,
    userAgent: snapshot.userAgent,
    navigation: snapshot.navigation,
    startupResources: snapshot.startupResources,
    globals: snapshot.globals,
    missingElements: snapshot.missingElements,
    stylesheetPaths: snapshot.stylesheetPaths,
    fixtureDigest: digest({
      board: snapshot.fixture.board,
      markers: snapshot.fixture.markers
    }),
    boardSize: {
      width: snapshot.fixture.boardWidth,
      height: snapshot.fixture.boardHeight
    },
    startupRequestedPaths: startupPaths,
    startupScriptPaths: startupPaths.filter((value) => /\.js(?:\?|$)/.test(value)),
    moduleRegistryAtStartup: startupPaths.some((value) => value.includes('/public/module-registry')),
    optionalRegistryAtStartup: result.sample.startupScriptSignals.some((value: string) => value.includes('module-registry.optional')),
    optionalPayloadAtStartup: startupPaths.some((value) => /\/optional-[a-z-]+-[^/]+\.mjs(?:\?|$)/.test(value)),
    onnxRuntimeAtStartup: result.sample.startupScriptSignals.some((value: string) => value.includes('onnxruntime-web/dist/ort.min.js')),
    pageErrors: result.sample.pageErrors,
    consoleErrors: result.sample.consoleErrors,
    resourceErrors: result.sample.resourceErrors || []
  };
}

function evaluateReport(classic: any, vite: any, visual: any): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (classic.lane !== 'classic' || classic.htmlLane !== 'classic') {
    errors.push(`classic lane flags are invalid: ${classic.lane}/${classic.htmlLane}`);
  }
  if (vite.lane !== 'vite' || vite.htmlLane !== 'vite' || vite.bootState !== 'ready') {
    errors.push(`Vite lane flags are invalid: ${vite.lane}/${vite.htmlLane}/${vite.bootState}`);
  }
  if (
    !vite.viteRuntime
    || vite.viteRuntime.state !== 'ready'
    || vite.viteRuntime.moduleDelivery !== 'vite-bundled'
    || vite.viteRuntime.esmEntry !== true
    || vite.viteRuntime.customModuleRegistry !== false
    || stableJson(vite.viteRuntime.loadedModules) !== stableJson(['startup', 'layout', 'entry'])
  ) {
    errors.push('Vite bundled-module boot metrics are invalid');
  }
  for (const [label, lane, expectedLane] of [
    ['classic', classic, 'classic'],
    ['Vite', vite, 'vite']
  ] as const) {
    if (
      !lane.pixiRuntime
      || lane.pixiRuntime.lane !== expectedLane
      || lane.pixiRuntime.injected !== true
      || lane.pixiRuntime.version !== '8.18.1'
      || lane.pixiRuntime.unavailableReason !== null
    ) {
      errors.push(`${label} Pixi runtime capability is invalid`);
    }
    if (
      !lane.boardRenderSurface
      || lane.boardRenderSurface.renderer !== 'legacy-dom'
      || lane.boardRenderSurface.cellCount <= 0
      || lane.boardRenderSurface.canvasCount !== 0
    ) {
      errors.push(`${label} did not preserve the Phase 1 DOM board surface`);
    }
  }
  for (const [name, expectedType] of Object.entries(REQUIRED_GLOBAL_TYPES)) {
    if (classic.globals[name] !== expectedType) errors.push(`classic global ${name} is ${classic.globals[name]}, expected ${expectedType}`);
    if (vite.globals[name] !== expectedType) errors.push(`Vite global ${name} is ${vite.globals[name]}, expected ${expectedType}`);
  }
  if (classic.missingElements.length || vite.missingElements.length) {
    errors.push(`required DOM elements missing: classic=${classic.missingElements.join(',')}; vite=${vite.missingElements.join(',')}`);
  }
  if (stableJson(classic.stylesheetPaths) !== stableJson(vite.stylesheetPaths)) {
    errors.push('classic and Vite stylesheet order differs');
  }
  if (classic.fixtureDigest !== vite.fixtureDigest) errors.push('deterministic visual fixture state differs');
  if (stableJson(classic.boardSize) !== stableJson(vite.boardSize)) errors.push('board layout size differs');
  if (visual.diffPixels !== 0) errors.push(`board screenshot differs by ${visual.diffPixels} pixels`);
  if (classic.optionalRegistryAtStartup || vite.optionalRegistryAtStartup) errors.push('optional registry loaded before interaction');
  if (!classic.moduleRegistryAtStartup) errors.push('classic rollback did not request its compatibility registry');
  if (vite.moduleRegistryAtStartup) errors.push('Vite default requested the compatibility module registry');
  if (vite.optionalPayloadAtStartup) errors.push('Vite optional payload loaded before interaction');
  if (classic.onnxRuntimeAtStartup || vite.onnxRuntimeAtStartup) errors.push('ONNX runtime loaded during startup');
  for (const [label, lane] of [['classic', classic], ['Vite', vite]] as const) {
    if (lane.pageErrors.length) errors.push(`${label} page errors: ${lane.pageErrors.join('; ')}`);
    if (lane.consoleErrors.length) errors.push(`${label} console errors: ${lane.consoleErrors.join('; ')}`);
    if (lane.resourceErrors.length) errors.push(`${label} resource errors: ${lane.resourceErrors.join('; ')}`);
  }
  const viteHasHashedEntry = vite.startupScriptPaths.some((value: string) => /\/vite-dist\/assets\/index\.vite-[^/]+\.js(?:\?|$)/.test(value));
  const classicHasViteEntry = classic.startupScriptPaths.some((value: string) => value.includes('/vite-dist/assets/index.vite-'));
  if (!viteHasHashedEntry) errors.push('Vite lane did not request a hashed ESM entry');
  if (classicHasViteEntry) errors.push('classic lane unexpectedly requested the Vite entry');
  return { ok: errors.length === 0, errors };
}

function aggregateLaneSamples(samples: any[]): any {
  if (samples.length === 0) throw new Error('browser lane samples are empty');
  const first = samples[0];
  return {
    ...first,
    readyMs: median(samples.map((sample) => sample.readyMs)),
    readyMsSamples: samples.map((sample) => sample.readyMs),
    navigation: {
      domContentLoadedMs: median(samples.map((sample) => sample.navigation.domContentLoadedMs)),
      loadMs: median(samples.map((sample) => sample.navigation.loadMs))
    },
    startupResources: {
      count: median(samples.map((sample) => sample.startupResources.count)),
      transferBytes: median(samples.map((sample) => sample.startupResources.transferBytes)),
      encodedBodyBytes: median(samples.map((sample) => sample.startupResources.encodedBodyBytes)),
      decodedBodyBytes: median(samples.map((sample) => sample.startupResources.decodedBodyBytes))
    }
  };
}

function toMarkdown(report: any): string {
  const rows = ['classic', 'vite'].map((laneName) => {
    const lane = report.lanes[laneName];
    return `| ${laneName} | ${lane.readyMs} | ${lane.readyMsSamples.join(', ')} | ${lane.startupResources.count} | ${lane.startupResources.transferBytes} | ${lane.startupResources.decodedBodyBytes} | ${lane.startupScriptPaths.length} |`;
  }).join('\n');
  return [
    '# Classic rollback / Vite default browser lane comparison (2026-07-14)',
    '',
    `- Status: ${report.evaluation.ok ? 'PASS' : 'FAIL'}`,
    `- Captured at: ${report.capturedAt}`,
    `- Node: ${report.environment.node}`,
    `- Cold runs per lane: ${report.runCount}`,
    '- Timing and transfer values are medians from fresh browser processes on the same machine, not universal performance thresholds.',
    '',
    '## Startup comparison',
    '',
    '| lane | median UI ready (ms) | ready samples (ms) | median resources | median transfer bytes | median decoded bytes | scripts |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
    rows,
    '',
    '## Correctness gates',
    '',
    `- Required globals and DOM contract: ${report.correctness.runtimeContractMatch ? 'match' : 'mismatch'}`,
    `- Fixture state digest: \`${report.correctness.fixtureDigest}\``,
    `- Board screenshot: ${report.visual.width}x${report.visual.height}, ${report.visual.diffPixels} differing pixels`,
    `- Classic optional registry at startup: ${report.lanes.classic.optionalRegistryAtStartup}`,
    `- Vite optional registry at startup: ${report.lanes.vite.optionalRegistryAtStartup}`,
    `- Vite compatibility registry at startup: ${report.lanes.vite.moduleRegistryAtStartup}`,
    `- Vite optional payload at startup: ${report.lanes.vite.optionalPayloadAtStartup}`,
    `- Classic ONNX runtime at startup: ${report.lanes.classic.onnxRuntimeAtStartup}`,
    `- Vite ONNX runtime at startup: ${report.lanes.vite.onnxRuntimeAtStartup}`,
    `- Vite hashed ESM entry: ${report.lanes.vite.startupScriptPaths.find((value: string) => value.includes('/vite-dist/assets/index.vite-')) || 'missing'}`,
    '',
    '## Evaluation',
    '',
    report.evaluation.ok ? 'All exact behavior and presentation gates passed.' : report.evaluation.errors.map((error: string) => `- ${error}`).join('\n'),
    ''
  ].join('\n');
}

async function compareBrowserLanes(options: CompareBrowserLanesOptions = {}): Promise<any> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const runCount = Math.max(1, Math.floor(options.runs ?? 3));
  const classicSamples: any[] = [];
  const viteSamples: any[] = [];
  const samples: any[] = [];
  const evaluationErrors: string[] = [];
  const visualSamples: any[] = [];
  for (let index = 0; index < runCount; index += 1) {
    const classicFirst = index % 2 === 0;
    const capture = async (entryPath: string) => runBrowserUiControlSmoke({
      rootDir,
      entryPath,
      captureComparison: true,
      log: false
    });
    const firstResult = await capture(classicFirst ? '/index.classic.html' : '/');
    const secondResult = await capture(classicFirst ? '/' : '/index.classic.html');
    const classicResult = classicFirst ? firstResult : secondResult;
    const viteResult = classicFirst ? secondResult : firstResult;
    if (!classicResult.comparison || !viteResult.comparison || !classicResult.boardPng || !viteResult.boardPng) {
      throw new Error(`browser lane comparison capture ${index + 1} is incomplete`);
    }
    const classic = summarizeLane(classicResult);
    const vite = summarizeLane(viteResult);
    const visual = comparePngBuffers(classicResult.boardPng, viteResult.boardPng);
    const evaluation = evaluateReport(classic, vite, visual);
    classicSamples.push(classic);
    viteSamples.push(vite);
    visualSamples.push(visual);
    samples.push({
      run: index + 1,
      order: classicFirst ? ['classic', 'vite'] : ['vite', 'classic'],
      lanes: {
        classic: { readyMs: classic.readyMs, navigation: classic.navigation, startupResources: classic.startupResources },
        vite: { readyMs: vite.readyMs, navigation: vite.navigation, startupResources: vite.startupResources }
      },
      visual,
      evaluation
    });
    evaluationErrors.push(...evaluation.errors.map((error) => `run ${index + 1}: ${error}`));
  }
  const classic = aggregateLaneSamples(classicSamples);
  const vite = aggregateLaneSamples(viteSamples);
  const visual = {
    width: visualSamples[0].width,
    height: visualSamples[0].height,
    diffPixels: Math.max(...visualSamples.map((sample) => sample.diffPixels)),
    diffPixelSamples: visualSamples.map((sample) => sample.diffPixels)
  };
  const evaluation = { ok: evaluationErrors.length === 0, errors: evaluationErrors };
  const report = {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    runCount,
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      userAgent: classic.userAgent
    },
    lanes: { classic, vite },
    correctness: {
      runtimeContractMatch: classicSamples.every((sample, index) => (
        digest(sample.globals) === digest(viteSamples[index].globals)
        && sample.pixiRuntime?.version === viteSamples[index].pixiRuntime?.version
        && sample.pixiRuntime?.injected === true
        && viteSamples[index].pixiRuntime?.injected === true
        && sample.missingElements.length === 0
        && viteSamples[index].missingElements.length === 0
      )),
      fixtureDigest: classic.fixtureDigest,
      fixtureDigestMatch: classicSamples.every((sample, index) => sample.fixtureDigest === viteSamples[index].fixtureDigest)
    },
    visual,
    samples,
    evaluation
  };
  if (options.write) {
    fs.writeFileSync(path.join(rootDir, REPORT_JSON_PATH), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(rootDir, REPORT_MARKDOWN_PATH), toMarkdown(report), 'utf8');
  }
  if (options.log !== false) console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  const runsArgument = process.argv.find((value) => value.startsWith('--runs='));
  const parsedRuns = runsArgument ? Number(runsArgument.slice('--runs='.length)) : 3;
  compareBrowserLanes({
    write: process.argv.includes('--write'),
    runs: Number.isFinite(parsedRuns) && parsedRuns > 0 ? parsedRuns : 3
  }).then((report) => {
    if (!report.evaluation.ok) {
      console.error(`[browser-lane-comparison] failed: ${report.evaluation.errors.join('; ')}`);
      process.exit(1);
    }
    console.log('[browser-lane-comparison] success');
  }).catch((error) => {
    console.error(`[browser-lane-comparison] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

export = {
  compareBrowserLanes,
  comparePngBuffers,
  evaluateReport,
  median,
  normalizeRequestedPaths,
  stableJson,
  toMarkdown
};
