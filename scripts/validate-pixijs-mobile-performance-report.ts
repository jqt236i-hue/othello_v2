import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  evaluateDesktopPerformancePair,
  validateReferenceDeviceManifest
} from './capture-pixijs-playfield-performance';
import {
  BOARD_PERFORMANCE_EVENT_DIGEST,
  BOARD_PERFORMANCE_FIXTURE_DIGEST,
  BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS,
  BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS,
  BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
  BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
  BOARD_PERFORMANCE_SCENARIO_IDS,
  createBoardPerformanceRunConfig,
  expectedCaptureOrder,
  stablePerformanceJson,
  summarizeNumericSamples,
  summarizeRafIntervals
} from '../ui/board-visual/performance-harness';

const VALIDATION_SCHEMA_VERSION = 'pixijs_playfield_precutover_validation.v1';
const AUTOMATED_VALIDATION_SCHEMA_VERSION = 'pixijs_playfield_precutover_validation.v2';
const DESKTOP_CAPTURE_SCHEMA_VERSION = 'pixijs_playfield_desktop_capture.v1';
const CROSS_PLATFORM_SMOKE_SCHEMA_VERSION = 'pixijs_playfield_cross_platform_smoke.v1';
const REFERENCE_DEVICE_SCHEMA_VERSION = 'pixijs_playfield_reference_devices.v1';
const DEFAULT_REPORTS_DIR = 'docs/perf/pixijs-playfield-mobile/reports';
const DEFAULT_REFERENCE_MANIFEST = 'docs/perf/pixijs-playfield-mobile/reference-devices.json';
const DEFAULT_DESKTOP_CAPTURE = 'artifacts/pixijs-playfield-performance/desktop-capture.json';
const DEFAULT_CROSS_PLATFORM_SMOKE = 'artifacts/pixijs-playfield-performance/cross-platform-smoke.json';
const DEFAULT_AUTOMATED_JSON_OUTPUT = 'docs/perf/pixijs-playfield-precutover.json';
const DEFAULT_AUTOMATED_MARKDOWN_OUTPUT = 'docs/perf/pixijs-playfield-precutover.md';
const DEFAULT_PHYSICAL_JSON_OUTPUT = 'docs/perf/pixijs-playfield-mobile/optional-physical-validation.json';
const DEFAULT_PHYSICAL_MARKDOWN_OUTPUT = 'docs/perf/pixijs-playfield-mobile/optional-physical-validation.md';
const PHYSICAL_MEASURED_IDS = BOARD_PERFORMANCE_SCENARIO_IDS.filter((id) => id !== 'stability.expansion-skin');
const PLAYBACK_IDS = PHYSICAL_MEASURED_IDS.filter((id) => id !== 'micro.full-marker-16x16');
const HEAVY_IDS = BOARD_PERFORMANCE_SCENARIO_IDS.filter((id) => id.startsWith('heavy.'));
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ValidationOptions {
  readonly rootDir?: string;
  readonly reportsDir?: string;
  readonly referenceManifestPath?: string;
  readonly desktopCapturePath?: string;
  readonly crossPlatformSmokePath?: string;
  readonly mode?: 'physical' | 'automated';
  readonly write?: boolean;
  readonly jsonOutputPath?: string;
  readonly markdownOutputPath?: string;
  readonly log?: boolean;
}

interface LoadedReport {
  readonly sourcePath: string;
  readonly filename: string;
  readonly sha256: string;
  readonly report: any;
}

interface ErrorCollector {
  readonly errors: string[];
  check(condition: unknown, message: string): void;
  equal(actual: unknown, expected: unknown, message: string): void;
}

function sha256(value: Buffer | string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function collector(): ErrorCollector {
  const errors: string[] = [];
  return {
    errors,
    check(condition, message) {
      if (!condition) errors.push(message);
    },
    equal(actual, expected, message) {
      if (stablePerformanceJson(actual) !== stablePerformanceJson(expected)) {
        errors.push(`${message}: expected=${stablePerformanceJson(expected)} actual=${stablePerformanceJson(actual)}`);
      }
    }
  };
}

function finite(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = Array.from(values).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return Math.round(result * 1000) / 1000;
}

function scenario(report: any, id: string): any {
  return Array.isArray(report?.scenarios) ? report.scenarios.find((entry: any) => entry?.id === id) : null;
}

function expectedSampleCount(id: string): number {
  if (id === 'basic.multi-flip-8x8') return 30;
  if (id.startsWith('heavy.')) return 20;
  if (id === 'micro.full-marker-16x16') return 100;
  return 0;
}

function validateNumericSummary(
  check: ErrorCollector,
  actual: any,
  values: readonly number[],
  label: string
): void {
  check.equal(actual, summarizeNumericSamples(values), `${label} summary mismatch`);
}

function validateRafSummary(
  check: ErrorCollector,
  actual: any,
  values: readonly number[],
  nominal: number,
  label: string
): void {
  check.equal(actual, summarizeRafIntervals(values, nominal), `${label} rAF summary mismatch`);
}

function validateMeasuredScenario(check: ErrorCollector, report: any, entry: any, id: string): void {
  const prefix = `${report.reportId}/${id}`;
  const expectedCount = expectedSampleCount(id);
  check.check(!!entry, `${prefix} is missing`);
  if (!entry) return;
  check.check(entry.warmupCount === 5, `${prefix} warmupCount must be 5`);
  check.check(entry.sampleCount === expectedCount, `${prefix} sampleCount must be ${expectedCount}`);
  check.check(Array.isArray(entry.rawSamples) && entry.rawSamples.length === expectedCount, `${prefix} rawSamples count mismatch`);
  if (!Array.isArray(entry.rawSamples)) return;
  const nominal = finite(report.nominal?.nominalFrameIntervalMs);
  const raf: number[] = [];
  const metricValues: Record<string, number[]> = {
    presentationStartLatencyMs: [],
    modelBuildMs: [],
    backendApplySyncMs: [],
    backendApplySettlementMs: [],
    boardLocalPlaybackMs: [],
    globalDomHudMs: [],
    wholeTurnSettlementMs: [],
    hitTestMs: []
  };
  entry.rawSamples.forEach((sample: any, index: number) => {
    const samplePrefix = `${prefix}/sample-${index + 1}`;
    check.check(Array.isArray(sample.rafTimestampsMs), `${samplePrefix} raw rAF timestamps are missing`);
    check.check(Array.isArray(sample.rafIntervalsMs), `${samplePrefix} raw rAF intervals are missing`);
    if (Array.isArray(sample.rafTimestampsMs) && Array.isArray(sample.rafIntervalsMs)) {
      check.check(sample.rafTimestampsMs.length === sample.rafIntervalsMs.length + (sample.rafTimestampsMs.length ? 1 : 0), `${samplePrefix} timestamp/interval lengths mismatch`);
      sample.rafIntervalsMs.forEach((value: unknown, rafIndex: number) => {
        check.check(Number.isFinite(Number(value)) && Number(value) >= 0, `${samplePrefix} has invalid rAF interval`);
        check.check(Math.abs(rounded(finite(sample.rafTimestampsMs[rafIndex + 1]) - finite(sample.rafTimestampsMs[rafIndex])) - finite(value)) <= 0.002, `${samplePrefix} rAF timestamp delta mismatch`);
        raf.push(Number(value));
      });
    }
    for (const metric of Object.keys(metricValues)) {
      const value = sample[metric];
      if (metric === 'hitTestMs' && value === null) continue;
      check.check(Number.isFinite(Number(value)) && Number(value) >= 0, `${samplePrefix} has invalid ${metric}`);
      metricValues[metric].push(Number(value));
    }
    check.check(sample.diagnosticsBefore && typeof sample.diagnosticsBefore === 'object', `${samplePrefix} diagnosticsBefore missing`);
    check.check(sample.diagnosticsAfter && typeof sample.diagnosticsAfter === 'object', `${samplePrefix} diagnosticsAfter missing`);
  });
  validateRafSummary(check, entry.summary?.raf, raf, nominal, prefix);
  for (const [metric, values] of Object.entries(metricValues)) {
    validateNumericSummary(check, entry.summary?.[metric], values, `${prefix}/${metric}`);
  }
  if (id === 'micro.full-marker-16x16') {
    for (const metric of ['modelBuildMs', 'backendApplySyncMs', 'hitTestMs']) {
      check.check(metricValues[metric].every((value) => value < 50), `${prefix} ${metric} must remain below 50 ms per operation`);
    }
  }
}

function isMonotonicGrowth(values: readonly number[]): boolean {
  if (values.length < 2) return false;
  let grew = false;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) return false;
    if (values[index] > values[index - 1]) grew = true;
  }
  return grew;
}

function degradationWithin(last: number, first: number, allowance = 1.2): boolean {
  if (!Number.isFinite(last) || !Number.isFinite(first)) return false;
  return first === 0 ? last === 0 : last <= first * allowance;
}

function validateStabilityScenario(check: ErrorCollector, report: any, entry: any): void {
  const prefix = `${report.reportId}/stability.expansion-skin`;
  check.check(!!entry, `${prefix} is missing`);
  if (!entry) return;
  check.check(entry.warmupCount === 5, `${prefix} warmupCount must be 5`);
  check.check(finite(entry.requiredDurationMs) === BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS, `${prefix} required duration must be 10 minutes`);
  check.check(finite(entry.durationMs) >= BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS, `${prefix} duration is shorter than 10 minutes`);
  check.check(Array.isArray(entry.rawSamples) && entry.rawSamples.length > 0, `${prefix} object/backing samples missing`);
  check.check(Array.isArray(entry.rawRafTimestampsMs) && Array.isArray(entry.rawRafIntervalsMs), `${prefix} raw rAF series missing`);
  if (!Array.isArray(entry.rawSamples) || !Array.isArray(entry.rawRafTimestampsMs) || !Array.isArray(entry.rawRafIntervalsMs)) return;
  check.check(entry.rawRafTimestampsMs.length === entry.rawRafIntervalsMs.length + 1, `${prefix} rAF timestamp/interval lengths mismatch`);
  const stabilityStallCount = entry.rawRafIntervalsMs.filter((value: unknown) => finite(value) >= 50).length;
  check.check(stabilityStallCount === 0, `${prefix} rAF stall >= 50ms occurred during the 10-minute run`);
  const nominal = finite(report.nominal?.nominalFrameIntervalMs);
  const startedAt = finite(entry.startedAtPerformanceMs);
  check.check(Number.isFinite(startedAt) && startedAt >= 0, `${prefix} start performance timestamp is invalid`);
  check.check(
    entry.rawRafTimestampsMs.length > 0 && finite(entry.rawRafTimestampsMs[0]) >= startedAt,
    `${prefix} first rAF timestamp predates the measurement start`,
  );
  const lastWindowStart = Math.max(0, finite(entry.requiredDurationMs) - 120_000);
  const firstRaf: number[] = [];
  const lastRaf: number[] = [];
  entry.rawRafIntervalsMs.forEach((value: unknown, index: number) => {
    const interval = finite(value);
    const elapsed = finite(entry.rawRafTimestampsMs[index + 1]) - startedAt;
    check.check(Number.isFinite(interval) && interval >= 0, `${prefix} invalid rAF interval`);
    check.check(Math.abs(rounded(finite(entry.rawRafTimestampsMs[index + 1]) - finite(entry.rawRafTimestampsMs[index])) - interval) <= 0.002, `${prefix} rAF timestamp delta mismatch`);
    if (elapsed <= 120_000) firstRaf.push(interval);
    if (elapsed >= lastWindowStart) lastRaf.push(interval);
  });
  const firstSamples = entry.rawSamples.filter((sample: any) => finite(sample.elapsedMs) <= 120_000);
  const lastSamples = entry.rawSamples.filter((sample: any) => finite(sample.elapsedMs) >= lastWindowStart);
  const applyValues = (samples: any[]) => samples.map((sample) => finite(sample.apply?.backendApplySettlementMs));
  validateRafSummary(check, entry.summary?.firstTwoMinutes?.raf, firstRaf, nominal, `${prefix}/first-two-minutes`);
  validateRafSummary(check, entry.summary?.lastTwoMinutes?.raf, lastRaf, nominal, `${prefix}/last-two-minutes`);
  validateNumericSummary(check, entry.summary?.firstTwoMinutes?.backendApplySettlementMs, applyValues(firstSamples), `${prefix}/first-two-minutes/apply`);
  validateNumericSummary(check, entry.summary?.lastTwoMinutes?.backendApplySettlementMs, applyValues(lastSamples), `${prefix}/last-two-minutes/apply`);
  check.check(firstRaf.length > 0 && lastRaf.length > 0, `${prefix} first/last two-minute rAF windows are empty`);
  check.check(degradationWithin(
    finite(entry.summary?.lastTwoMinutes?.raf?.p95),
    finite(entry.summary?.firstTwoMinutes?.raf?.p95)
  ), `${prefix} last-two-minute rAF p95 degraded by more than 20%`);
  check.check(degradationWithin(
    finite(entry.summary?.lastTwoMinutes?.raf?.jankRatio),
    finite(entry.summary?.firstTwoMinutes?.raf?.jankRatio)
  ), `${prefix} last-two-minute jank ratio degraded by more than 20%`);

  const diagnosticValues = (field: string) => entry.rawSamples.map((sample: any) => finite(sample.diagnostics?.[field]));
  const contextLoss = diagnosticValues('contextLossCount');
  check.check(contextLoss.every((value: number) => value === 0), `${prefix} context loss occurred`);
  for (const field of ['canvasBackingWidth', 'canvasBackingHeight', 'displayObjectCount', 'textureLeaseCount', 'activeViewCount', 'textureReadyPixelCount']) {
    check.check(!isMonotonicGrowth(diagnosticValues(field)), `${prefix} ${field} grew monotonically`);
  }
  const contextCounts = diagnosticValues('contextCount');
  const canvasCounts = diagnosticValues('canvasCount');
  check.check(contextCounts.every((value: number) => value >= 0 && value <= 1), `${prefix} created more than one WebGL context`);
  check.check(canvasCounts.every((value: number) => value >= 0 && value <= 1), `${prefix} created more than one board canvas`);
  check.check(diagnosticValues('activeViewCount').every((value: number) => value >= 0 && value <= 256), `${prefix} viewport materialization exceeded the 16x16 ceiling`);
  if (report.backend === 'pixi') {
    check.check(contextCounts.every((value: number) => value === 1), `${prefix} Pixi context count must remain one`);
    check.check(diagnosticValues('domCellCount').every((value: number) => value === 0), `${prefix} Pixi run mounted DOM board cells`);
  }

  const lifecycle = entry.lifecycle;
  check.check(lifecycle?.sameModelApply?.count === 100, `${prefix} same-model apply count must be 100`);
  check.check(lifecycle?.reset?.count === 50, `${prefix} reset count must be 50`);
  check.check(lifecycle?.skinSwitch?.count === 50, `${prefix} skin-switch count must be 50`);
  const steady = lifecycle?.steadyState || {};
  for (const phase of ['sameModelApply', 'reset', 'skinSwitch']) {
    const diagnostics = lifecycle?.[phase]?.diagnostics || {};
    for (const field of ['displayObjectCount', 'textureLeaseCount', 'activeViewCount', 'canvasBackingWidth', 'canvasBackingHeight', 'contextCount', 'canvasCount']) {
      check.check(finite(diagnostics[field]) === finite(steady[field]), `${prefix} ${phase} did not return ${field} to steady state`);
    }
    check.check(diagnostics.tickerRunning === false, `${prefix} ${phase} left the ticker running`);
  }
}

function parseReportFilename(filename: string): { deviceId: string; backend: 'dom' | 'pixi'; reportId: string } | null {
  const match = /^pixijs-playfield-(.+)-(dom|pixi)-([0-9a-f-]{36})\.json$/i.exec(filename);
  if (!match || !UUID_V4.test(match[3])) return null;
  return { deviceId: match[1], backend: match[2].toLowerCase() as 'dom' | 'pixi', reportId: match[3].toLowerCase() };
}

export function validatePhysicalReport(report: any, filename: string, referenceDevice: any): readonly string[] {
  const check = collector();
  const parsed = parseReportFilename(filename);
  check.check(!!parsed, `${filename} does not follow the report filename contract`);
  check.check(report?.schemaVersion === BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION, `${filename} schemaVersion mismatch`);
  check.check(UUID_V4.test(String(report?.reportId || '')), `${filename} reportId is not UUID v4`);
  if (parsed) {
    check.check(parsed.reportId === String(report.reportId).toLowerCase(), `${filename} reportId does not match its filename`);
    check.check(parsed.deviceId === referenceDevice.id, `${filename} reference device id mismatch`);
    check.check(parsed.backend === report.backend, `${filename} backend does not match its filename`);
  }
  check.check(report?.captureProfile === 'physical', `${filename} must be a physical capture`);
  check.check(report?.standardRun === true, `${filename} must be an unmodified standard run`);
  check.check(report?.lane === 'vite', `${filename} physical capture must use the Vite lane`);
  check.check(report?.backend === 'dom' || report?.backend === 'pixi', `${filename} backend is invalid`);
  check.check(/^[0-9a-f]{40}$/.test(String(report?.candidateCommit || '')), `${filename} candidate commit is invalid`);
  check.check(/^[0-9a-f]{64}$/.test(String(report?.browserArtifactSha256 || '')), `${filename} browser artifact digest is invalid`);
  check.check(report?.fixtureDigest === BOARD_PERFORMANCE_FIXTURE_DIGEST, `${filename} fixture digest mismatch`);
  check.check(report?.eventDigest === BOARD_PERFORMANCE_EVENT_DIGEST, `${filename} event digest mismatch`);
  check.check(typeof report?.captureUrl === 'string' && report.captureUrl.includes('boardPerf=1'), `${filename} capture URL is missing`);
  check.equal(report?.environment?.referenceDevice, referenceDevice, `${filename} frozen reference device metadata mismatch`);
  check.equal(
    { width: report?.environment?.screen?.width, height: report?.environment?.screen?.height },
    referenceDevice.screen,
    `${filename} measured screen mismatch`
  );
  check.equal(report?.environment?.viewport, referenceDevice.viewport, `${filename} measured viewport mismatch`);
  check.check(finite(report?.environment?.dpr) === finite(referenceDevice.dpr), `${filename} measured DPR mismatch`);
  check.check(String(report?.environment?.orientation || '') === referenceDevice.orientation, `${filename} orientation mismatch`);
  const expectedOrder = /^[0-9a-f]{40}$/.test(String(report?.candidateCommit || ''))
    ? expectedCaptureOrder(report.candidateCommit)
    : null;
  check.check(report?.captureOrder?.expected === expectedOrder, `${filename} expected capture order mismatch`);
  check.check(report?.captureOrder?.actual === expectedOrder, `${filename} actual capture order mismatch`);
  const expectedBackend = expectedOrder === 'dom-first'
    ? (report?.captureOrder?.sequenceIndex === 1 ? 'dom' : 'pixi')
    : (report?.captureOrder?.sequenceIndex === 1 ? 'pixi' : 'dom');
  check.check(report?.captureOrder?.sequenceIndex === 1 || report?.captureOrder?.sequenceIndex === 2, `${filename} capture sequence index must be 1 or 2`);
  check.check(report?.backend === expectedBackend, `${filename} backend violates SHA-derived capture order`);
  try {
    const captureParams = new URL(report.captureUrl).searchParams;
    check.check(captureParams.get('debug') === '1' && captureParams.get('boardPerf') === '1', `${filename} capture URL debug gate mismatch`);
    check.check(captureParams.get('boardRenderer') === report.backend, `${filename} capture URL backend mismatch`);
    check.check(captureParams.get('referenceDevice') === referenceDevice.id, `${filename} capture URL reference device mismatch`);
    check.check(captureParams.get('captureOrder') === expectedOrder, `${filename} capture URL order mismatch`);
    check.check(Number(captureParams.get('captureIndex')) === report.captureOrder.sequenceIndex, `${filename} capture URL sequence mismatch`);
  } catch (_error) {
    check.check(false, `${filename} capture URL is invalid`);
  }
  check.check(finite(report?.cooldown?.requiredMs) >= BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS, `${filename} cooldown requirement is too short`);
  check.check(finite(report?.cooldown?.observedMs) >= finite(report?.cooldown?.requiredMs), `${filename} observed cooldown is too short`);
  check.check(report?.cooldown?.passed === true, `${filename} cooldown did not pass`);
  check.check(report?.validity?.valid === true, `${filename} visibility/focus validity failed`);
  check.check(report?.validity?.visibilityChangeCount === 0 && report?.validity?.focusChangeCount === 0, `${filename} changed visibility/focus during capture`);
  check.check(Array.isArray(report?.validity?.invalidReasons) && report.validity.invalidReasons.length === 0, `${filename} has visibility/focus invalid reasons`);
  check.check(report?.nominal?.sampleCount === 120, `${filename} nominal rAF count must be 120`);
  check.check(Array.isArray(report?.nominal?.rawIntervalsMs) && report.nominal.rawIntervalsMs.length === 120, `${filename} nominal raw intervals must contain 120 samples`);
  check.check(Array.isArray(report?.nominal?.rawTimestampsMs) && report.nominal.rawTimestampsMs.length === 121, `${filename} nominal raw timestamps must contain 121 samples`);
  if (Array.isArray(report?.nominal?.rawIntervalsMs)) {
    check.check(finite(report.nominal.nominalFrameIntervalMs) === median(report.nominal.rawIntervalsMs.map(Number)), `${filename} nominal median mismatch`);
    if (Array.isArray(report?.nominal?.rawTimestampsMs)) {
      report.nominal.rawIntervalsMs.forEach((value: unknown, index: number) => {
        check.check(Math.abs(rounded(finite(report.nominal.rawTimestampsMs[index + 1]) - finite(report.nominal.rawTimestampsMs[index])) - finite(value)) <= 0.002, `${filename} nominal timestamp delta mismatch`);
      });
    }
  }
  check.check(report?.percentileRule === 'nearest-rank:ceil(p*N)-1', `${filename} percentile rule mismatch`);
  check.check(report?.rawSamplePolicy === 'unfiltered-no-winsorization', `${filename} raw sample policy mismatch`);
  check.equal(report?.runConfig, createBoardPerformanceRunConfig('physical'), `${filename} physical runConfig mismatch`);
  check.check(['supported', 'unsupported'].includes(report?.support?.longAnimationFrame), `${filename} LoAF support status missing`);
  check.check(['supported', 'unsupported'].includes(report?.support?.longTask), `${filename} Long Task support status missing`);
  check.check(report?.delivery && Array.isArray(report.delivery.resources), `${filename} delivery/resource evidence missing`);
  check.check(Number.isFinite(Number(report?.delivery?.textureReadyPixelCount)), `${filename} texture pixel evidence missing`);
  check.equal(report?.scenarios?.map((entry: any) => entry.id), BOARD_PERFORMANCE_SCENARIO_IDS, `${filename} scenario ID/order mismatch`);
  for (const id of PHYSICAL_MEASURED_IDS) validateMeasuredScenario(check, report, scenario(report, id), id);
  validateStabilityScenario(check, report, scenario(report, 'stability.expansion-skin'));
  return Object.freeze(check.errors);
}

function ratioWithin(candidate: number, baseline: number, allowance: number): boolean {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline)) return false;
  return baseline === 0 ? candidate === 0 : candidate <= baseline * allowance;
}

function gate(name: string, pass: boolean, detail: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze({ name, pass, ...detail });
}

export function evaluatePhysicalPerformancePair(dom: any, pixi: any): Readonly<Record<string, unknown>> {
  const gates: Readonly<Record<string, unknown>>[] = [];
  const pixiNominal = finite(pixi?.nominal?.nominalFrameIntervalMs);
  const basicDom = scenario(dom, 'basic.multi-flip-8x8');
  const basicPixi = scenario(pixi, 'basic.multi-flip-8x8');
  const basicP95 = finite(basicPixi?.summary?.raf?.p95);
  gates.push(gate('basic.p95', basicP95 <= pixiNominal * 1.25, { actual: basicP95, target: pixiNominal * 1.25 }));
  gates.push(gate('basic.jank', finite(basicPixi?.summary?.raf?.jankRatio) <= 0.05, { actual: basicPixi?.summary?.raf?.jankRatio }));
  gates.push(gate('basic.stall50', finite(basicPixi?.summary?.raf?.rafStall50msCount) === 0, { actual: basicPixi?.summary?.raf?.rafStall50msCount }));
  const domBasicP95 = finite(basicDom?.summary?.raf?.p95);
  const domBasicTarget = finite(dom?.nominal?.nominalFrameIntervalMs) * 1.25;
  gates.push(gate(
    'basic.dom-comparison',
    domBasicP95 > domBasicTarget ? basicP95 <= domBasicP95 * 0.8 : ratioWithin(basicP95, domBasicP95, 1.05),
    { domP95: domBasicP95, pixiP95: basicP95, domTarget: domBasicTarget }
  ));
  for (const id of HEAVY_IDS) {
    const domScenario = scenario(dom, id);
    const pixiScenario = scenario(pixi, id);
    const pixiRaf = pixiScenario?.summary?.raf || {};
    const domRaf = domScenario?.summary?.raf || {};
    const target = pixiNominal * 2;
    const domTarget = finite(dom?.nominal?.nominalFrameIntervalMs) * 2;
    gates.push(gate(`${id}.p95`, finite(pixiRaf.p95) <= target, { actual: pixiRaf.p95, target }));
    gates.push(gate(`${id}.max`, finite(pixiRaf.max) < 100, { actual: pixiRaf.max, target: 100 }));
    gates.push(gate(`${id}.stall50`, finite(pixiRaf.rafStall50msCount) === 0, { actual: pixiRaf.rafStall50msCount }));
    gates.push(gate(
      `${id}.dom-comparison`,
      finite(domRaf.p95) > domTarget
        ? finite(pixiRaf.p95) <= finite(domRaf.p95) * 0.8
        : ratioWithin(finite(pixiRaf.p95), finite(domRaf.p95), 1.05),
      { domP95: domRaf.p95, pixiP95: pixiRaf.p95, domTarget }
    ));
  }
  for (const id of PLAYBACK_IDS) {
    const domScenario = scenario(dom, id);
    const pixiScenario = scenario(pixi, id);
    for (const metric of ['wholeTurnSettlementMs', 'presentationStartLatencyMs']) {
      const domP95 = finite(domScenario?.summary?.[metric]?.p95);
      const pixiP95 = finite(pixiScenario?.summary?.[metric]?.p95);
      gates.push(gate(`${id}.${metric}.dom-comparison`, ratioWithin(pixiP95, domP95, 1.05), { domP95, pixiP95 }));
    }
  }
  return Object.freeze({ pass: gates.every((entry: any) => entry.pass === true), gates: Object.freeze(gates) });
}

function loadReports(reportsDir: string): LoadedReport[] {
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .map((entry) => {
      const sourcePath = path.join(reportsDir, entry.name);
      const body = fs.readFileSync(sourcePath);
      return Object.freeze({ sourcePath, filename: entry.name, sha256: sha256(body), report: JSON.parse(body.toString('utf8')) });
    });
}

export function validateDesktopReport(
  report: any,
  expectedLane: 'classic' | 'vite',
  expectedBackend: 'dom' | 'pixi',
  capture: any
): readonly string[] {
  const check = collector();
  const prefix = `desktop/${expectedLane}/${expectedBackend}`;
  check.check(report?.schemaVersion === BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION, `${prefix} schemaVersion mismatch`);
  check.check(report?.captureProfile === 'desktop', `${prefix} captureProfile must be desktop`);
  check.check(report?.standardRun === true, `${prefix} must be an unmodified standard run`);
  check.check(report?.lane === expectedLane, `${prefix} lane mismatch`);
  check.check(report?.backend === expectedBackend, `${prefix} backend mismatch`);
  check.check(report?.candidateCommit === capture?.candidateCommit, `${prefix} candidate commit mismatch`);
  check.check(report?.browserArtifactSha256 === capture?.browserArtifact?.sha256, `${prefix} browser artifact digest mismatch`);
  check.check(report?.fixtureDigest === BOARD_PERFORMANCE_FIXTURE_DIGEST, `${prefix} fixture digest mismatch`);
  check.check(report?.eventDigest === BOARD_PERFORMANCE_EVENT_DIGEST, `${prefix} event digest mismatch`);
  check.check(typeof report?.captureUrl === 'string' && report.captureUrl.includes('debug=1') && report.captureUrl.includes('boardPerf=1'), `${prefix} capture URL gate mismatch`);
  check.check(report?.validity?.valid === true, `${prefix} visibility/focus validity failed`);
  check.check(report?.validity?.visibilityChangeCount === 0 && report?.validity?.focusChangeCount === 0, `${prefix} changed visibility/focus during capture`);
  check.check(Array.isArray(report?.validity?.invalidReasons) && report.validity.invalidReasons.length === 0, `${prefix} has visibility/focus invalid reasons`);
  check.check(report?.readiness?.fontsReady === true && report?.readiness?.texturesReady === true && report?.readiness?.applicationReady === true, `${prefix} readiness evidence failed`);
  check.check(report?.nominal?.sampleCount === 120, `${prefix} nominal rAF count must be 120`);
  check.check(Array.isArray(report?.nominal?.rawIntervalsMs) && report.nominal.rawIntervalsMs.length === 120, `${prefix} nominal raw intervals must contain 120 samples`);
  check.check(Array.isArray(report?.nominal?.rawTimestampsMs) && report.nominal.rawTimestampsMs.length === 121, `${prefix} nominal raw timestamps must contain 121 samples`);
  if (Array.isArray(report?.nominal?.rawIntervalsMs)) {
    check.check(finite(report.nominal.nominalFrameIntervalMs) === median(report.nominal.rawIntervalsMs.map(Number)), `${prefix} nominal median mismatch`);
    if (Array.isArray(report?.nominal?.rawTimestampsMs)) {
      report.nominal.rawIntervalsMs.forEach((value: unknown, index: number) => {
        check.check(Math.abs(rounded(finite(report.nominal.rawTimestampsMs[index + 1]) - finite(report.nominal.rawTimestampsMs[index])) - finite(value)) <= 0.002, `${prefix} nominal timestamp delta mismatch`);
      });
    }
  }
  check.check(report?.percentileRule === 'nearest-rank:ceil(p*N)-1', `${prefix} percentile rule mismatch`);
  check.check(report?.rawSamplePolicy === 'unfiltered-no-winsorization', `${prefix} raw sample policy mismatch`);
  check.equal(report?.runConfig, createBoardPerformanceRunConfig('desktop'), `${prefix} desktop runConfig mismatch`);
  check.check(['supported', 'unsupported'].includes(report?.support?.longAnimationFrame), `${prefix} LoAF support status missing`);
  check.check(['supported', 'unsupported'].includes(report?.support?.longTask), `${prefix} Long Task support status missing`);
  check.check(report?.delivery && Array.isArray(report.delivery.resources), `${prefix} delivery/resource evidence missing`);
  check.check(Number.isFinite(Number(report?.delivery?.textureReadyPixelCount)), `${prefix} texture pixel evidence missing`);
  check.equal(report?.scenarios?.map((entry: any) => entry.id), BOARD_PERFORMANCE_SCENARIO_IDS, `${prefix} scenario ID/order mismatch`);
  for (const id of PHYSICAL_MEASURED_IDS) validateMeasuredScenario(check, report, scenario(report, id), id);
  validateStabilityScenario(check, report, scenario(report, 'stability.expansion-skin'));
  return Object.freeze(check.errors);
}

function validateDesktopCapture(capture: any, errors: string[]): readonly Readonly<Record<string, unknown>>[] {
  if (capture?.schemaVersion !== DESKTOP_CAPTURE_SCHEMA_VERSION) errors.push('Desktop capture schema mismatch');
  if (capture?.standardRun !== true || capture?.profile !== 'desktop') errors.push('Desktop capture is not a standard desktop run');
  if (!Array.isArray(capture?.reports) || capture.reports.length !== 4) errors.push('Desktop capture must contain classic/Vite × DOM/Pixi reports');
  if (capture?.crossLaneIdentity !== true) errors.push('Desktop capture cross-lane identity failed');
  const graphics = capture?.environment?.graphics || {};
  if (graphics.hardwareAccelerated !== true
    || /swiftshader|llvmpipe|software(?: rasterizer)?/i.test(`${graphics.glRenderer || ''} ${graphics.glVendor || ''}`)) {
    errors.push('Desktop capture did not use hardware-accelerated WebGL');
  }
  if (capture?.phaseZeroEnvironment?.pass !== true) errors.push('Desktop capture no longer matches the immutable Phase 0 machine/browser/viewport/DPR');
  if (capture?.phaseZeroModelApplyComparison?.fixtureDigest !== BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST) {
    errors.push('Desktop Phase 0 synthetic model/apply comparison digest mismatch');
  }
  for (const lane of ['classic', 'vite']) {
    const comparisonLane = capture?.phaseZeroModelApplyComparison?.lanes?.[lane];
    if (!comparisonLane?.immutableDomBaseline || !comparisonLane?.currentDom || !comparisonLane?.currentPixi) {
      errors.push(`Desktop Phase 0 ${lane} DOM/Pixi model/apply comparison is incomplete`);
    }
  }
  const artifact = capture?.browserArtifact;
  if (!artifact || !Array.isArray(artifact.files)
    || artifact.fileCount !== artifact.files.length
    || sha256(stablePerformanceJson(artifact.files)) !== artifact.sha256) {
    errors.push('Desktop browser artifact file manifest digest mismatch');
  }
  const comparisons: Readonly<Record<string, unknown>>[] = [];
  for (const lane of ['classic', 'vite']) {
    const dom = capture?.reports?.find((report: any) => report.lane === lane && report.backend === 'dom');
    const pixi = capture?.reports?.find((report: any) => report.lane === lane && report.backend === 'pixi');
    if (!dom || !pixi) {
      errors.push(`Desktop ${lane} DOM/Pixi pair is missing`);
      continue;
    }
    errors.push(...validateDesktopReport(dom, lane as 'classic' | 'vite', 'dom', capture));
    errors.push(...validateDesktopReport(pixi, lane as 'classic' | 'vite', 'pixi', capture));
    const comparison = Object.freeze({ lane, ...evaluateDesktopPerformancePair(dom, pixi) });
    comparisons.push(comparison);
    if ((comparison as any).pass !== true) errors.push(`Desktop ${lane} performance gate failed`);
  }
  if (capture?.pass !== true) errors.push('Desktop capture did not record a passing result');
  return Object.freeze(comparisons);
}

function followUpInventory(reports: readonly LoadedReport[]): readonly Readonly<Record<string, unknown>>[] {
  const entries: Readonly<Record<string, unknown>>[] = [];
  for (const loaded of reports.filter((item) => item.report.backend === 'pixi')) {
    for (const id of PLAYBACK_IDS) {
      const item = scenario(loaded.report, id);
      if (finite(item?.summary?.raf?.jankRatio) > 0 && finite(item?.summary?.globalDomHudMs?.p95) > 0) {
        entries.push(Object.freeze({
          deviceId: loaded.report.environment.referenceDevice.id,
          scenarioId: id,
          owner: 'HUD/hand/global DOM effect/CPU follow-up',
          jankRatio: item.summary.raf.jankRatio,
          globalDomHudP95Ms: item.summary.globalDomHudMs.p95,
          scopeDecision: 'Pixi playfield ownership is unchanged; player-visible timing is unchanged.'
        }));
      }
    }
  }
  return Object.freeze(entries);
}

function markdownReport(validation: any): string {
  const physicalRows = validation.physicalPairs.map((pair: any) => (
    `| ${pair.deviceId} | ${pair.platform} | ${pair.pass ? 'PASS' : 'FAIL'} | ${pair.gates.length} |`
  ));
  return [
    '# PixiJS playfield pre-cutover evidence',
    '',
    `- Result: **${validation.pass ? 'PASS' : 'FAIL'}**`,
    `- Candidate commit: \`${validation.candidateCommit || 'unavailable'}\``,
    `- Browser artifact SHA-256: \`${validation.browserArtifactSha256 || 'unavailable'}\``,
    `- Fixture digest: \`${validation.fixtureDigest}\``,
    `- Event digest: \`${validation.eventDigest}\``,
    `- Validated at: ${validation.validatedAt}`,
    '',
    '| Reference device | Platform | Physical gate | Checks |',
    '| --- | --- | --- | ---: |',
    ...physicalRows,
    '',
    `Desktop classic/Vite gate: ${validation.desktopPass ? 'PASS' : 'FAIL'}`,
    '',
    `Raw physical reports: ${validation.rawReports.length}; follow-up attribution entries: ${validation.followUpInventory.length}.`,
    '',
    'This evidence does not change player-visible timing, events[] ordering, network authority, or Pixi playfield ownership.',
    ''
  ].join('\n');
}

function validateCrossPlatformSmoke(receipt: any, candidateCommit: string, artifactSha256: string, errors: string[]): void {
  if (receipt?.schemaVersion !== CROSS_PLATFORM_SMOKE_SCHEMA_VERSION) errors.push('Cross-platform smoke schema mismatch');
  if (receipt?.candidateCommit !== candidateCommit) errors.push('Cross-platform smoke candidate commit mismatch');
  if (receipt?.browserArtifactSha256 !== artifactSha256) errors.push('Cross-platform smoke browser artifact digest mismatch');
  if (receipt?.ok !== true || !Array.isArray(receipt?.errors) || receipt.errors.length !== 0) errors.push('Cross-platform smoke did not pass');
  const expectedScenarios = [
    'chromium-desktop',
    'firefox-desktop',
    'webkit-desktop',
    'chromium-touch-mobile',
    'firefox-touch-mobile',
    'webkit-touch-mobile'
  ];
  const probes = Array.isArray(receipt?.probes) ? receipt.probes : [];
  const expectedKeys = expectedScenarios.flatMap((name) => ['dom', 'pixi'].map((backend) => `${name}/${backend}`));
  const actualKeys = probes.map((probe: any) => `${probe?.name}/${probe?.backend}`).sort();
  if (stablePerformanceJson(actualKeys) !== stablePerformanceJson(expectedKeys.slice().sort())) {
    errors.push('Cross-platform smoke scenario/backend matrix mismatch');
  }
  for (const probe of probes) {
    const prefix = `cross-platform/${probe?.name}/${probe?.backend}`;
    if (probe?.evaluation?.ok !== true) errors.push(`${prefix} UI control evaluation failed`);
    if (!Array.isArray(probe?.registryRequests) || probe.registryRequests.length !== 0) errors.push(`${prefix} requested the compatibility registry`);
    for (const field of ['pageErrors', 'consoleErrors', 'resourceErrors']) {
      if (!Array.isArray(probe?.[field]) || probe[field].length !== 0) errors.push(`${prefix} ${field} is not empty`);
    }
    const backendProbe = probe?.backendProbe || {};
    if (backendProbe.backend !== probe?.backend) errors.push(`${prefix} selected backend mismatch`);
    if (backendProbe.harnessGlobalPresent || backendProbe.controlsPresent) errors.push(`${prefix} leaked performance harness state`);
    if (probe?.backend === 'pixi'
      && (finite(backendProbe.canvasCount) !== 1 || finite(backendProbe.contextCount) !== 1 || finite(backendProbe.domCellCount) !== 0)) {
      errors.push(`${prefix} Pixi was not the exclusive board surface`);
    }
    if (probe?.backend === 'dom'
      && (finite(backendProbe.canvasCount) !== 0 || finite(backendProbe.domCellCount) !== 64)) {
      errors.push(`${prefix} DOM was not the exclusive board surface`);
    }
    const expectedDpr = String(probe?.name || '').includes('mobile') ? 2 : 1;
    if (finite(backendProbe.dpr) !== expectedDpr) errors.push(`${prefix} DPR mismatch`);
  }
}

function desktopFollowUpInventory(capture: any): readonly Readonly<Record<string, unknown>>[] {
  const entries: Readonly<Record<string, unknown>>[] = [];
  for (const report of (capture?.reports || []).filter((item: any) => item.backend === 'pixi')) {
    for (const id of PLAYBACK_IDS) {
      const item = scenario(report, id);
      if (finite(item?.summary?.raf?.jankRatio) > 0 && finite(item?.summary?.globalDomHudMs?.p95) > 0) {
        entries.push(Object.freeze({
          lane: report.lane,
          scenarioId: id,
          owner: 'HUD/hand/global DOM effect/CPU follow-up',
          jankRatio: item.summary.raf.jankRatio,
          globalDomHudP95Ms: item.summary.globalDomHudMs.p95,
          scopeDecision: 'Pixi playfield ownership and player-visible timing remain unchanged.'
        }));
      }
    }
  }
  return Object.freeze(entries);
}

function automatedMarkdownReport(validation: any): string {
  const rows = validation.desktopComparisons.map((comparison: any) => (
    `| ${comparison.lane} | ${comparison.pass ? 'PASS' : 'FAIL'} | ${(comparison.checks || []).length} |`
  ));
  return [
    '# PixiJS playfield pre-cutover evidence',
    '',
    `- Result: **${validation.pass ? 'PASS' : 'FAIL'}**`,
    '- Evidence mode: automated hardware-desktop release gate',
    `- Candidate commit: \`${validation.candidateCommit || 'unavailable'}\``,
    `- Browser artifact SHA-256: \`${validation.browserArtifactSha256 || 'unavailable'}\``,
    `- Desktop capture SHA-256: \`${validation.desktopCaptureSha256 || 'unavailable'}\``,
    `- Cross-platform smoke SHA-256: \`${validation.crossPlatformSmokeSha256 || 'unavailable'}\``,
    `- Fixture digest: \`${validation.fixtureDigest}\``,
    `- Event digest: \`${validation.eventDigest}\``,
    `- Validated at: ${validation.validatedAt}`,
    '',
    '| Browser lane | DOM/Pixi gate | Checks |',
    '| --- | --- | ---: |',
    ...rows,
    '',
    `Cross-browser desktop/mobile-viewport functional gate: ${validation.crossPlatformPass ? 'PASS' : 'FAIL'}`,
    `Follow-up attribution entries: ${validation.followUpInventory.length}.`,
    '',
    '## Residual risk accepted by operator decision',
    '',
    ...validation.residualRisks.map((risk: string) => `- ${risk}`),
    '',
    'Desktop/mobile viewport automation is not represented as physical Android/iPhone performance evidence.',
    'This evidence does not change player-visible timing, events[] ordering, network authority, or Pixi playfield ownership.',
    ''
  ].join('\n');
}

export function validateAutomatedPrecutoverEvidence(options: ValidationOptions = {}): any {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const desktopCapturePath = path.resolve(rootDir, options.desktopCapturePath || DEFAULT_DESKTOP_CAPTURE);
  const crossPlatformSmokePath = path.resolve(rootDir, options.crossPlatformSmokePath || DEFAULT_CROSS_PLATFORM_SMOKE);
  const errors: string[] = [];
  let desktopCapture: any = null;
  let crossPlatformSmoke: any = null;
  try {
    desktopCapture = JSON.parse(fs.readFileSync(desktopCapturePath, 'utf8'));
  } catch (error: any) {
    errors.push(`Desktop capture unavailable: ${error?.message || error}`);
  }
  try {
    crossPlatformSmoke = JSON.parse(fs.readFileSync(crossPlatformSmokePath, 'utf8'));
  } catch (error: any) {
    errors.push(`Cross-platform smoke unavailable: ${error?.message || error}`);
  }
  const desktopComparisons = desktopCapture ? validateDesktopCapture(desktopCapture, errors) : [];
  const candidateCommit = desktopCapture?.candidateCommit || null;
  const browserArtifactSha256 = desktopCapture?.browserArtifact?.sha256 || null;
  if (desktopCapture?.fixtureDigest !== BOARD_PERFORMANCE_FIXTURE_DIGEST
    || desktopCapture?.eventDigest !== BOARD_PERFORMANCE_EVENT_DIGEST) {
    errors.push('Desktop evidence does not use the compiled deterministic fixture/event digest');
  }
  if (crossPlatformSmoke && candidateCommit && browserArtifactSha256) {
    validateCrossPlatformSmoke(crossPlatformSmoke, candidateCommit, browserArtifactSha256, errors);
  }
  const baselinePath = path.join(rootDir, 'docs/perf/pixijs-playfield-baseline.json');
  const residualRisks = Object.freeze([
    'Physical Android Chrome and iPhone Safari paint/composite performance was not measured.',
    'Safari on an actual iPhone GPU was not measured; Playwright WebKit is functional compatibility evidence only.',
    'Mobile-device thermal throttling and battery/power-mode behavior were not measured.'
  ]);
  const validation = {
    schemaVersion: AUTOMATED_VALIDATION_SCHEMA_VERSION,
    validatedAt: new Date().toISOString(),
    evidenceMode: 'automated-hardware-desktop',
    physicalDeviceEvidenceRequired: false,
    operatorDecisionDate: '2026-07-18',
    pass: errors.length === 0,
    errors: Object.freeze(errors.slice()),
    candidateCommit,
    browserArtifactSha256,
    fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
    eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
    desktopCaptureSha256: fs.existsSync(desktopCapturePath) ? sha256(fs.readFileSync(desktopCapturePath)) : null,
    crossPlatformSmokeSha256: fs.existsSync(crossPlatformSmokePath) ? sha256(fs.readFileSync(crossPlatformSmokePath)) : null,
    desktopPass: !!desktopCapture && desktopComparisons.length === 2 && desktopComparisons.every((entry: any) => entry.pass === true),
    crossPlatformPass: !!crossPlatformSmoke && crossPlatformSmoke.ok === true,
    desktopComparisons,
    desktopCapture,
    crossPlatformSmoke,
    followUpInventory: desktopFollowUpInventory(desktopCapture),
    residualRisks,
    optionalPhysicalDiagnostics: Object.freeze({ required: false, status: 'not-collected' }),
    immutablePhaseZeroBaseline: Object.freeze({
      path: 'docs/perf/pixijs-playfield-baseline.json',
      sha256: fs.existsSync(baselinePath) ? sha256(fs.readFileSync(baselinePath)) : null,
      role: 'synthetic model/apply microbaseline only'
    })
  };
  if (options.write) {
    if (!validation.pass) throw new Error(`Refusing to write failing automated pre-cutover evidence:\n${errors.join('\n')}`);
    const jsonPath = path.resolve(rootDir, options.jsonOutputPath || DEFAULT_AUTOMATED_JSON_OUTPUT);
    const markdownPath = path.resolve(rootDir, options.markdownOutputPath || DEFAULT_AUTOMATED_MARKDOWN_OUTPUT);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
    fs.writeFileSync(markdownPath, automatedMarkdownReport(validation), 'utf8');
  }
  if (options.log !== false) process.stdout.write(`${JSON.stringify({
    pass: validation.pass,
    evidenceMode: validation.evidenceMode,
    candidateCommit,
    browserArtifactSha256,
    desktopPass: validation.desktopPass,
    crossPlatformPass: validation.crossPlatformPass,
    errors
  }, null, 2)}\n`);
  return Object.freeze(validation);
}

export function validatePrecutoverEvidence(options: ValidationOptions = {}): any {
  if (options.mode === 'automated') return validateAutomatedPrecutoverEvidence(options);
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const reportsDir = path.resolve(rootDir, options.reportsDir || DEFAULT_REPORTS_DIR);
  const referenceManifestPath = path.resolve(rootDir, options.referenceManifestPath || DEFAULT_REFERENCE_MANIFEST);
  const desktopCapturePath = path.resolve(rootDir, options.desktopCapturePath || DEFAULT_DESKTOP_CAPTURE);
  const errors: string[] = [];
  let referenceManifest: any = null;
  let desktopCapture: any = null;
  let loadedReports: LoadedReport[] = [];
  try {
    referenceManifest = validateReferenceDeviceManifest(JSON.parse(fs.readFileSync(referenceManifestPath, 'utf8')));
  } catch (error: any) {
    errors.push(`Reference device manifest invalid: ${error?.message || error}`);
  }
  try {
    desktopCapture = JSON.parse(fs.readFileSync(desktopCapturePath, 'utf8'));
  } catch (error: any) {
    errors.push(`Desktop capture unavailable: ${error?.message || error}`);
  }
  try {
    loadedReports = loadReports(reportsDir);
  } catch (error: any) {
    errors.push(`Physical report import failed: ${error?.message || error}`);
  }
  if (loadedReports.length !== 4) errors.push(`Exactly four raw physical reports are required; found ${loadedReports.length}`);
  const desktopComparisons = desktopCapture ? validateDesktopCapture(desktopCapture, errors) : [];
  const identities = loadedReports.map((loaded) => ({
    candidateCommit: loaded.report.candidateCommit,
    browserArtifactSha256: loaded.report.browserArtifactSha256,
    fixtureDigest: loaded.report.fixtureDigest,
    eventDigest: loaded.report.eventDigest
  }));
  const expectedIdentity = identities[0] || null;
  if (expectedIdentity && identities.some((identity) => stablePerformanceJson(identity) !== stablePerformanceJson(expectedIdentity))) {
    errors.push('Physical reports do not share candidate/artifact/fixture/event identity');
  }
  if (desktopCapture && expectedIdentity) {
    if (desktopCapture.candidateCommit !== expectedIdentity.candidateCommit
      || desktopCapture.browserArtifact?.sha256 !== expectedIdentity.browserArtifactSha256
      || desktopCapture.fixtureDigest !== expectedIdentity.fixtureDigest
      || desktopCapture.eventDigest !== expectedIdentity.eventDigest) {
      errors.push('Desktop and physical evidence identity mismatch');
    }
  }
  if (expectedIdentity?.fixtureDigest !== BOARD_PERFORMANCE_FIXTURE_DIGEST
    || expectedIdentity?.eventDigest !== BOARD_PERFORMANCE_EVENT_DIGEST) {
    errors.push('Evidence does not use the compiled deterministic fixture/event digest');
  }

  const physicalPairs: any[] = [];
  if (referenceManifest) {
    for (const device of referenceManifest.devices) {
      const deviceReports = loadedReports.filter((loaded) => loaded.report?.environment?.referenceDevice?.id === device.id);
      if (deviceReports.length !== 2) errors.push(`Reference device ${device.id} must have DOM and Pixi reports`);
      for (const loaded of deviceReports) {
        errors.push(...validatePhysicalReport(loaded.report, loaded.filename, device));
      }
      const dom = deviceReports.find((loaded) => loaded.report.backend === 'dom')?.report;
      const pixi = deviceReports.find((loaded) => loaded.report.backend === 'pixi')?.report;
      if (dom && pixi) {
        const pair: any = Object.freeze({ deviceId: device.id, platform: device.platform, ...evaluatePhysicalPerformancePair(dom, pixi) });
        physicalPairs.push(pair);
        if (pair.pass !== true) errors.push(`Physical performance gate failed for ${device.id}`);
      }
    }
  }
  const rawReports = loadedReports.map((loaded) => Object.freeze({
    filename: loaded.filename,
    sha256: loaded.sha256,
    reportId: loaded.report.reportId,
    deviceId: loaded.report?.environment?.referenceDevice?.id,
    backend: loaded.report.backend
  }));
  const baselinePath = path.join(rootDir, 'docs/perf/pixijs-playfield-baseline.json');
  const validation = {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    validatedAt: new Date().toISOString(),
    pass: errors.length === 0,
    errors: Object.freeze(errors.slice()),
    candidateCommit: expectedIdentity?.candidateCommit || desktopCapture?.candidateCommit || null,
    browserArtifactSha256: expectedIdentity?.browserArtifactSha256 || desktopCapture?.browserArtifact?.sha256 || null,
    fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
    eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
    referenceDeviceSchemaVersion: referenceManifest?.schemaVersion || REFERENCE_DEVICE_SCHEMA_VERSION,
    referenceDevices: referenceManifest?.devices || [],
    rawReports: Object.freeze(rawReports),
    desktopCaptureSha256: fs.existsSync(desktopCapturePath) ? sha256(fs.readFileSync(desktopCapturePath)) : null,
    desktopPass: !!desktopCapture && desktopComparisons.length === 2 && desktopComparisons.every((entry: any) => entry.pass === true),
    desktopComparisons,
    desktopCapture,
    physicalPairs: Object.freeze(physicalPairs),
    followUpInventory: followUpInventory(loadedReports),
    immutablePhaseZeroBaseline: Object.freeze({
      path: 'docs/perf/pixijs-playfield-baseline.json',
      sha256: fs.existsSync(baselinePath) ? sha256(fs.readFileSync(baselinePath)) : null,
      role: 'synthetic model/apply microbaseline only'
    })
  };
  if (options.write) {
    if (!validation.pass) throw new Error(`Refusing to write failing pre-cutover evidence:\n${errors.join('\n')}`);
    const canonicalReportsDir = path.join(rootDir, DEFAULT_REPORTS_DIR);
    fs.mkdirSync(canonicalReportsDir, { recursive: true });
    for (const loaded of loadedReports) {
      const destination = path.join(canonicalReportsDir, loaded.filename);
      if (path.resolve(destination) !== path.resolve(loaded.sourcePath)) fs.copyFileSync(loaded.sourcePath, destination);
    }
    const jsonPath = path.resolve(rootDir, options.jsonOutputPath || DEFAULT_PHYSICAL_JSON_OUTPUT);
    const markdownPath = path.resolve(rootDir, options.markdownOutputPath || DEFAULT_PHYSICAL_MARKDOWN_OUTPUT);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
    fs.writeFileSync(markdownPath, markdownReport(validation), 'utf8');
  }
  if (options.log !== false) process.stdout.write(`${JSON.stringify({
    pass: validation.pass,
    candidateCommit: validation.candidateCommit,
    browserArtifactSha256: validation.browserArtifactSha256,
    rawReportCount: rawReports.length,
    errors
  }, null, 2)}\n`);
  return Object.freeze(validation);
}

interface CliArgs {
  write: boolean;
  mode?: 'physical' | 'automated';
  reportsDir?: string;
  referenceManifestPath?: string;
  desktopCapturePath?: string;
  crossPlatformSmokePath?: string;
}

export function parseValidatorArgs(argv: readonly string[]): CliArgs {
  const result: CliArgs = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') result.write = true;
    else if (arg === '--automated') result.mode = 'automated';
    else if (arg === '--physical') result.mode = 'physical';
    else if (arg === '--reports-dir') result.reportsDir = argv[++index];
    else if (arg === '--reference-devices') result.referenceManifestPath = argv[++index];
    else if (arg === '--desktop-report') result.desktopCapturePath = argv[++index];
    else if (arg === '--cross-platform-report') result.crossPlatformSmokePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

if (require.main === module) {
  try {
    const validation = validatePrecutoverEvidence(parseValidatorArgs(process.argv.slice(2)));
    if (!validation.pass) process.exitCode = 1;
  } catch (error: any) {
    process.stderr.write(`[pixijs-mobile-performance-validator] failed: ${error?.message || error}\n`);
    process.exitCode = 1;
  }
}
