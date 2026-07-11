import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { chromium, type Browser, type Page } from 'playwright';
import {
  createAllNetworkSpecialStonePerformanceFixtures,
  createAuthorityRoomFromFixture,
  runHeadlessFixtureTurnStart,
  type NetworkSpecialStonePerformanceFixture
} from '../../test/helpers/network-special-stone-performance-fixtures';

const Shared = require('../../shared-constants.js');
const Core = require('../../game/logic/core.js');
const CardLogic = require('../../game/logic/cards.js');
const CardMarkers = require('../../game/logic/cards/markers.js');
const ProtectionContext = require('../../game/logic/cards-internal/protection-context.js');
const SpecialStoneRegistry = require('../../shared/special-stone-registry.js');
const ManifestStoneRegistry = require('../../shared/manifest-stone-registry.js');
const TurnPipelineUIAdapter = require('../../game/turn/pipeline_ui_adapter.js');
const VisualStateStore = require('../../ui/network/visual-state-store');
const MatchAuthority = require('../../utils/match-authority.js');
const AnimationConstants = require('../../ui/animation-constants.js');

type NumericSummary = {
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
  p95: number | null;
};

type MeasurementOptions = {
  warmup?: number;
  iterations?: number;
  integrationIterations?: number;
  browser?: boolean;
  write?: boolean;
  outputStem?: string;
};

type FixtureNodeReport = {
  summary: NetworkSpecialStonePerformanceFixture['summary'];
  seed: number;
  timingsMs: Record<string, NumericSummary>;
  operationCounts: Record<string, number>;
  payloadBytes: Record<string, number>;
  playback: { eventCount: number; phaseCount: number; durationMs: number };
  digests: Record<string, string>;
};

const DEFAULT_WARMUP = 25;
const DEFAULT_ITERATIONS = 120;
const DEFAULT_INTEGRATION_ITERATIONS = 40;

function percentile(sortedValues: number[], ratio: number): number | null {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1_000_000) / 1_000_000;
}

export function summarize(values: number[]): NumericSummary {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return { count: 0, min: null, max: null, median: null, p95: null };
  return {
    count: sorted.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95))
  };
}

function measureRepeated(fn: () => unknown, warmup: number, iterations: number): NumericSummary {
  for (let index = 0; index < warmup; index += 1) fn();
  const values: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    fn();
    values.push(performance.now() - started);
  }
  return summarize(values);
}

function countEmptyCells(board: number[][]): number {
  return board.reduce((total, row) => total + row.filter((value) => value === Shared.EMPTY).length, 0);
}

function buildMeasuredProtectionContext(cardState: any): { context: any; counts: Record<string, number> } {
  const counts: Record<string, number> = {
    specialMarkerCollections: 0,
    manifestMarkerCollections: 0,
    bombMarkerCollections: 0,
    blockingMarkerCollections: 0,
    frozenCellChecks: 0,
    nestedFullMarkerScans: 0,
    canonicalMarkerScans: 0,
    markerEntriesVisited: 0
  };
  const markerCount = Array.isArray(cardState && cardState.markers) ? cardState.markers.length : 0;
  const wrapCollection = (key: string, fn: (state: any) => any[]) => (state: any) => {
    counts[key] += 1;
    counts.canonicalMarkerScans += 1;
    counts.markerEntriesVisited += markerCount;
    return fn(state);
  };
  const context = ProtectionContext.buildCardProtectionContext(cardState, {
    constants: Shared,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    createMarkerContextIndex: (state: any, options: any) => {
      counts.canonicalMarkerScans += 1;
      return CardMarkers.createMarkerContextIndex(state, {
        ...(options && typeof options === 'object' ? options : {}),
        onMarkerVisited: () => {
          counts.markerEntriesVisited += 1;
        }
      });
    },
    getSpecialMarkers: wrapCollection('specialMarkerCollections', CardMarkers.getSpecialMarkers),
    getManifestMarkers: wrapCollection('manifestMarkerCollections', CardMarkers.getManifestMarkers),
    getBombMarkers: wrapCollection('bombMarkerCollections', CardMarkers.getBombMarkers),
    getBlockingMarkers: wrapCollection('blockingMarkerCollections', CardMarkers.getBlockingMarkers),
    isFrozenCellForCard: (state: any, row: number, col: number) => {
      counts.frozenCellChecks += 1;
      counts.nestedFullMarkerScans += 1;
      counts.canonicalMarkerScans += 1;
      counts.markerEntriesVisited += markerCount;
      return CardMarkers.isFrozenCellForCard(state, row, col);
    }
  });
  return { context, counts };
}

function preparePublishArtifacts(fixture: NetworkSpecialStonePerformanceFixture, playbackEvents: any[]): any {
  const room = createAuthorityRoomFromFixture(fixture);
  const black = MatchAuthority.buildPublicSnapshot(room, 'black');
  const white = MatchAuthority.buildPublicSnapshot(room, 'white');
  const spectator = MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'perf' });
  const buildPayload = (snapshot: any) => MatchAuthority.buildPublishPayloadFromRoom(room, {
    ok: true,
    snapshot,
    playbackEvents,
    effectLogs: [],
    serverTime: room.updatedAt
  });
  return {
    projections: { black, white, spectator },
    payloads: {
      black: buildPayload(black),
      white: buildPayload(white),
      spectator: buildPayload(spectator)
    }
  };
}

function measureVisualStore(snapshot: any): any {
  const store = VisualStateStore.createNetworkVisualStateStore();
  store.setCanonicalSnapshot(snapshot, { stateVersion: snapshot.stateVersion });
  store.setBaseVisualSnapshot(snapshot, { visualVersion: snapshot.stateVersion, visualSeq: 0, source: 'perf' });
  return store.getRenderSnapshot();
}

function countPlaybackPhases(playbackEvents: any[]): number {
  const keys = new Set<string>();
  playbackEvents.forEach((event: any, index: number) => {
    const phase = event && Object.prototype.hasOwnProperty.call(event, 'phase') ? event.phase : index;
    keys.add(String(phase));
  });
  return keys.size;
}

function nominalEventDurationMs(event: any): number {
  const explicit = Number(event && (event.durationMs ?? event.duration));
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const type = String(event && event.type || '').toLowerCase();
  if (type === 'move') return Number(AnimationConstants.MOVE_MS) || 400;
  if (type === 'flip') return Number(AnimationConstants.FLIP_MS) || 460;
  if (type === 'destroy') return Number(AnimationConstants.FADE_OUT_MS) || 500;
  if (type === 'spawn' || type === 'place') {
    return Math.max(
      Number(AnimationConstants.FADE_IN_MS) || 300,
      Number(AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS) || 500
    );
  }
  if (type === 'status_applied' || type === 'status_removed') return Number(AnimationConstants.OVERLAY_CROSSFADE_MS) || 600;
  if (type === 'observer_bubble') return (Number(AnimationConstants.OBSERVER_BUBBLE_MS) || 3000) + (Number(AnimationConstants.OBSERVER_BUBBLE_FADE_MS) || 700);
  if (type === 'theory_incarnation_spawn_roulette') return (Number(AnimationConstants.THEORY_SPAWN_ROULETTE_MS) || 2500) + (Number(AnimationConstants.THEORY_SPAWN_MATERIALIZE_MS) || 2000);
  if (type === 'manifest_ending') return 2000;
  if (type === 'round_bonus_banner') return 3000;
  return 0;
}

function sumPlaybackDuration(playbackEvents: any[]): number {
  const phaseDurations = new Map<string, number>();
  playbackEvents.forEach((event: any, index: number) => {
    const phase = String(event && Object.prototype.hasOwnProperty.call(event, 'phase') ? event.phase : index);
    phaseDurations.set(phase, Math.max(phaseDurations.get(phase) || 0, nominalEventDurationMs(event)));
  });
  const phaseGapMs = Number(AnimationConstants.PHASE_GAP_MS) || 200;
  return Array.from(phaseDurations.values()).reduce((total, duration) => total + duration, 0)
    + Math.max(0, phaseDurations.size - 1) * phaseGapMs;
}

function measureNodeFixture(
  fixture: NetworkSpecialStonePerformanceFixture,
  warmup: number,
  iterations: number,
  integrationIterations: number
): FixtureNodeReport {
  const initialSnapshot = fixture.snapshot;
  const measuredProtection = buildMeasuredProtectionContext(initialSnapshot.cardState);
  const baselineResult = runHeadlessFixtureTurnStart(fixture);
  const legalCounter = { flipContextCompiles: 0 };
  const legalContext = { ...measuredProtection.context, perfCounters: legalCounter };
  Core.getLegalMoves(initialSnapshot.gameState, initialSnapshot.gameState.currentPlayer, legalContext);
  const presentationCounter: Record<string, number> = {};
  TurnPipelineUIAdapter.mapToPlaybackEvents(
    baselineResult.events,
    baselineResult.snapshot.cardState,
    baselineResult.snapshot.gameState,
    { perfCounters: presentationCounter }
  );
  const fallbackCompiles = countEmptyCells(initialSnapshot.gameState.board);
  const publishArtifacts = preparePublishArtifacts(fixture, baselineResult.playbackEvents);

  const timingsMs = {
    protectionContext: measureRepeated(() => CardLogic.getCardContext(initialSnapshot.cardState), warmup, iterations),
    legalMoves: measureRepeated(() => {
      const context = CardLogic.getCardContext(initialSnapshot.cardState);
      Core.getLegalMoves(initialSnapshot.gameState, initialSnapshot.gameState.currentPlayer, context);
    }, warmup, iterations),
    turnStart: measureRepeated(() => runHeadlessFixtureTurnStart(fixture), warmup, iterations),
    presentationMapping: measureRepeated(() => TurnPipelineUIAdapter.mapToPlaybackEvents(
      baselineResult.events,
      baselineResult.snapshot.cardState,
      baselineResult.snapshot.gameState
    ), warmup, iterations),
    publishPreparation: measureRepeated(() => preparePublishArtifacts(fixture, baselineResult.playbackEvents), warmup, integrationIterations),
    payloadSerialization: measureRepeated(() => JSON.stringify(publishArtifacts.payloads), warmup, iterations),
    clientSnapshotStoreAndRead: measureRepeated(() => measureVisualStore(initialSnapshot), warmup, iterations)
  };

  return {
    summary: fixture.summary,
    seed: fixture.seed,
    timingsMs,
    operationCounts: {
      ...measuredProtection.counts,
      flipContextCompilesPerGetLegalMoves: legalCounter.flipContextCompiles || fallbackCompiles,
      cardProtectionContextsPerRender: 1,
      legalMoveGenerationsPerRender: 1,
      presentationEventIndexesPerMapping: presentationCounter.presentationEventIndexBuilds || 0,
      viewerProjectionBlack: 1,
      viewerProjectionWhite: 1,
      viewerProjectionSpectator: 1,
      acceptedPublishRoomPersists: 2,
      renderSnapshotFullClones: 1
    },
    payloadBytes: {
      black: Buffer.byteLength(JSON.stringify(publishArtifacts.payloads.black)),
      white: Buffer.byteLength(JSON.stringify(publishArtifacts.payloads.white)),
      spectator: Buffer.byteLength(JSON.stringify(publishArtifacts.payloads.spectator))
    },
    playback: {
      eventCount: baselineResult.playbackEvents.length,
      phaseCount: countPlaybackPhases(baselineResult.playbackEvents),
      durationMs: sumPlaybackDuration(baselineResult.playbackEvents)
    },
    digests: {
      canonicalHash: baselineResult.comparison.canonicalHash,
      eventDigest: baselineResult.comparison.eventDigest,
      playbackDigest: baselineResult.comparison.playbackDigest
    }
  };
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

function createStaticServer(rootDir: string): http.Server {
  const root = path.resolve(rootDir);
  return http.createServer((request, response) => {
    const raw = String(request.url || '/').split('?')[0] || '/';
    if (raw.startsWith('/api/')) {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, rooms: [], entries: [] }));
      return;
    }
    const decoded = decodeURIComponent(raw === '/' ? '/index.html' : raw);
    const filePath = path.resolve(root, `.${decoded}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.setHeader('Content-Type', mimeType(filePath));
      response.end(data);
    });
  });
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as any;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function waitForBrowserRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = window as any;
    return !!(root.gameState && root.cardState && typeof root.require === 'function');
  }, null, { timeout: 30_000 });
}

async function measureBrowserFixture(
  page: Page,
  fixture: NetworkSpecialStonePerformanceFixture,
  warmup: number,
  iterations: number
): Promise<Record<string, NumericSummary>> {
  const samples = await page.evaluate(({ snapshot, warmupCount, measuredCount }) => {
    const root = window as any;
    const diffRenderer = root.require('ui/diff-renderer') || root.DiffRenderer;
    const visualStoreModule = root.require('ui/network/visual-state-store');
    if (!diffRenderer || typeof diffRenderer.buildCurrentCellState !== 'function') {
      throw new Error('DiffRenderer.buildCurrentCellState unavailable');
    }
    if (!visualStoreModule || typeof visualStoreModule.createNetworkVisualStateStore !== 'function') {
      throw new Error('NetworkVisualStateStore unavailable');
    }
    const replaceState = (target: any, source: any) => {
      for (const key of Object.keys(target || {})) delete target[key];
      Object.assign(target, JSON.parse(JSON.stringify(source)));
    };
    const install = (shot: any) => {
      replaceState(root.gameState, shot.gameState);
      replaceState(root.cardState, shot.cardState);
    };
    const runProjection = () => {
      install(snapshot);
      return diffRenderer.buildCurrentCellState();
    };
    const serialized = JSON.stringify(snapshot);
    const runClientApplyAndProjection = () => {
      const parsed = JSON.parse(serialized);
      const store = visualStoreModule.createNetworkVisualStateStore();
      store.setCanonicalSnapshot(parsed, { stateVersion: parsed.stateVersion });
      store.setBaseVisualSnapshot(parsed, { visualVersion: parsed.stateVersion, visualSeq: 0, source: 'perf' });
      const renderSnapshot = store.getRenderSnapshot();
      install(renderSnapshot);
      return diffRenderer.buildCurrentCellState();
    };
    for (let index = 0; index < warmupCount; index += 1) {
      runProjection();
      runClientApplyAndProjection();
    }
    const projection: number[] = [];
    const clientApplyAndProjection: number[] = [];
    for (let index = 0; index < measuredCount; index += 1) {
      let started = window.performance.now();
      runProjection();
      projection.push(window.performance.now() - started);
      started = window.performance.now();
      runClientApplyAndProjection();
      clientApplyAndProjection.push(window.performance.now() - started);
    }
    return { projection, clientApplyAndProjection };
  }, { snapshot: fixture.snapshot, warmupCount: warmup, measuredCount: iterations });

  return {
    boardProjection: summarize(samples.projection),
    clientSnapshotApplyAndRenderPreparation: summarize(samples.clientApplyAndProjection)
  };
}

async function measureBrowserSection(
  fixtures: NetworkSpecialStonePerformanceFixture[],
  warmup: number,
  iterations: number
): Promise<Record<string, any>> {
  const server = createStaticServer(process.cwd());
  let browser: Browser | null = null;
  try {
    const baseUrl = await listen(server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(`${baseUrl}/?perf=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForBrowserRuntime(page);
    const reports: Record<string, any> = {};
    for (const fixture of fixtures) {
      reports[fixture.id] = await measureBrowserFixture(page, fixture, warmup, iterations);
    }
    await page.close();
    return {
      runtime: { chromium: browser.version(), viewport: { width: 1366, height: 900 } },
      fixtures: reports
    };
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

export async function runMeasurement(options: MeasurementOptions = {}): Promise<any> {
  const warmup = Number.isFinite(Number(options.warmup)) ? Math.max(0, Math.trunc(Number(options.warmup))) : DEFAULT_WARMUP;
  const iterations = Number.isFinite(Number(options.iterations)) ? Math.max(1, Math.trunc(Number(options.iterations))) : DEFAULT_ITERATIONS;
  const integrationIterations = Number.isFinite(Number(options.integrationIterations))
    ? Math.max(1, Math.trunc(Number(options.integrationIterations)))
    : DEFAULT_INTEGRATION_ITERATIONS;
  const fixtures = createAllNetworkSpecialStonePerformanceFixtures();
  const nodeFixtures: Record<string, FixtureNodeReport> = {};
  for (const fixture of fixtures) {
    nodeFixtures[fixture.id] = measureNodeFixture(fixture, warmup, iterations, integrationIterations);
  }
  const browser = options.browser === false
    ? { skipped: true, reason: 'browser measurement disabled by caller', fixtures: {} }
    : await measureBrowserSection(fixtures, warmup, iterations);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    config: { warmup, iterations, integrationIterations, fixtureSeeds: Object.fromEntries(fixtures.map((fixture) => [fixture.id, fixture.seed])) },
    node: { fixtures: nodeFixtures },
    browser
  };
  if (options.write === true) {
    writeReport(report, options.outputStem || '2026-07-11-network-special-stone-baseline');
  }
  return report;
}

function formatSummary(summary: NumericSummary): string {
  return `${summary.median ?? '-'} / ${summary.p95 ?? '-'} ms`;
}

export function renderMarkdown(report: any): string {
  const lines = [
    '# Network Special-Stone Late-Game Performance Baseline',
    '',
    `Generated: ${report.generatedAt}`,
    `Commit: \`${report.commit}\``,
    `Node: \`${report.runtime.node}\``,
    `Warmup / measured / integration: ${report.config.warmup} / ${report.config.iterations} / ${report.config.integrationIterations}`,
    '',
    '## Node measurements',
    '',
    '| fixture | protection median / p95 | legal median / p95 | turn-start median / p95 | presentation median / p95 | publish median / p95 |',
    '|---|---:|---:|---:|---:|---:|'
  ];
  for (const [id, fixture] of Object.entries(report.node.fixtures) as Array<[string, any]>) {
    const timing = fixture.timingsMs;
    lines.push(`| ${id} | ${formatSummary(timing.protectionContext)} | ${formatSummary(timing.legalMoves)} | ${formatSummary(timing.turnStart)} | ${formatSummary(timing.presentationMapping)} | ${formatSummary(timing.publishPreparation)} |`);
  }
  lines.push('', '## Browser measurements', '');
  if (report.browser.skipped) {
    lines.push(`Skipped: ${report.browser.reason}`);
  } else {
    lines.push('| fixture | board projection median / p95 | client apply + render preparation median / p95 |', '|---|---:|---:|');
    for (const [id, fixture] of Object.entries(report.browser.fixtures) as Array<[string, any]>) {
      lines.push(`| ${id} | ${formatSummary(fixture.boardProjection)} | ${formatSummary(fixture.clientSnapshotApplyAndRenderPreparation)} |`);
    }
  }
  lines.push('', '## Deterministic operation counts', '');
  for (const [id, fixture] of Object.entries(report.node.fixtures) as Array<[string, any]>) {
    lines.push(`### ${id}`, '', '```json', JSON.stringify(fixture.operationCounts, null, 2), '```', '');
  }
  lines.push('## Notes', '', '- Timing values are characterization data, not standalone CI pass/fail gates.', '- `acceptedPublishRoomPersists: 2` records the current accepted Worker path before Phase 5.', '- Browser and Node measurements are intentionally separated.', '');
  return `${lines.join('\n')}\n`;
}

function writeReport(report: any, outputStem: string): void {
  const outputDir = path.resolve(process.cwd(), 'docs', 'perf');
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${outputStem}.json`);
  const markdownPath = path.join(outputDir, `${outputStem}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdown(report), 'utf8');
  console.log(`[perf] wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`[perf] wrote ${path.relative(process.cwd(), markdownPath)}`);
}

export async function main(): Promise<void> {
  const quick = process.argv.includes('--quick');
  await runMeasurement({
    warmup: quick ? 2 : DEFAULT_WARMUP,
    iterations: quick ? 5 : DEFAULT_ITERATIONS,
    integrationIterations: quick ? 3 : DEFAULT_INTEGRATION_ITERATIONS,
    browser: !process.argv.includes('--node-only'),
    write: true
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
