import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

import {
  assertHardwareAcceleratedGraphics,
  createDesktopChromiumLaunchOptions,
  readDesktopGraphicsEnvironment,
  type DesktopGraphicsEnvironment
} from '../browser-performance-environment';

export const REPORT_SCHEMA_VERSION = 'cpu_turn_frame_stall_report.v4';
export const SAMPLE_SCHEMA_VERSION = 'cpu_turn_frame_stall_sample.v3';
export const SCENARIO_IDS = Object.freeze([
  'lv1-empty-or-unusable-hand-place-8x8',
  'lv1-usable-card-then-place-8x8',
  'lv1-multi-target-card-playback-8x8',
  'lv6-worker-backed-place-8x8',
  'pixi-high-refresh-playback-8x8'
] as const);

type ScenarioId = typeof SCENARIO_IDS[number];
type NumericSummary = Readonly<{
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  median: number | null;
  p95: number | null;
}>;
type Interval = Readonly<{ startMs: number; endMs: number }>;
type StageEntry = Readonly<Interval & {
  correlationId: string;
  runId: number | null;
  stage: string;
  kind: 'sync' | 'wait';
  durationMs: number;
  playerKey: 'black' | 'white';
  level: number | null;
  outcome: 'continue' | 'handled' | 'stale' | 'error';
}>;
type BrowserTimingEntry = Readonly<Interval & {
  entryType: 'longtask' | 'long-animation-frame';
  durationMs: number;
}>;
type BrowserSample = Readonly<{
  schemaVersion: string;
  scenarioId: string | null;
  metadata?: Readonly<Record<string, unknown>>;
  stageEntries?: readonly StageEntry[];
  longTasks?: readonly BrowserTimingEntry[];
  longAnimationFrames?: readonly BrowserTimingEntry[];
  rafIntervalsMs?: readonly number[];
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  visibilityValid?: boolean;
  focusValid?: boolean;
  pixiDiagnosticsBefore?: Readonly<Record<string, unknown>> | null;
  pixiDiagnosticsAfter?: Readonly<Record<string, unknown>> | null;
  invalidEntryCount?: number;
  invalidReasons?: readonly string[];
  overflow?: boolean;
  clockDomain?: Readonly<Record<string, unknown>>;
  capabilities?: Readonly<Record<string, unknown>>;
  runtimeEvidence?: Readonly<Record<string, unknown>>;
}>;

const SCENARIO_SET = new Set<string>(SCENARIO_IDS);
const FORBIDDEN_REPORT_KEYS = new Set([
  'board',
  'hand',
  'hands',
  'cardstate',
  'gamestate',
  'seattoken',
  'operationid',
  'snapshot',
  'action'
]);
const REPORT_METADATA_KEYS = new Set([
  'profile',
  'iteration',
  'captureIndex',
  'warmup',
  'fixtureDigest',
  'browserArtifactSha256',
  'lane',
  'buildMode',
  'captureOrderIndex',
  'requestedRefreshHz',
  'observedRefreshHz',
  'emulationValidated',
  'fixtureOutcomeDigest',
  'orderedActionsVerified',
  'cardEffectVerified',
  'workerPathVerified',
  'pixiPlaybackVerified'
]);
const REPORT_DIAGNOSTIC_KEYS = new Set([
  'prepareCount',
  'applyRequestCount',
  'committedApplyCount',
  'stalePrepareCount',
  'restoreCount',
  'resizeRenderCount',
  'playPhaseCount',
  'renderCount',
  'resizeCount',
  'tickerRunning',
  'tickerListenerCount',
  'sceneApplyCount',
  'sceneUpdatedViewCount',
  'sceneUpdatedCellViewCount',
  'sceneUpdatedStoneViewCount',
  'sceneUpdatedHintViewCount',
  'sceneHintPaintCount',
  'sceneHintInputSyncCount',
  'sceneSkippedViewCount',
  'sceneReleasedViewCount',
  'sceneStaticBakeCount',
  'timelineStartedRunCount',
  'timelineCompletedRunCount',
  'timelineFailedRunCount',
  'timelineAbortedRunCount',
  'timelineTickerStartCount',
  'timelineTickerStopCount',
  'timelineActiveRunCount'
]);
const STATIC_PREFIX_ALLOWLIST = Object.freeze([
  'vite-dist/',
  'assets/',
  'cards/',
  'data/',
  'node_modules/onnxruntime-web/dist/',
  'public/',
  'othello-ai/'
]);
const STATIC_ROOT_FILE_PATTERNS = Object.freeze([
  /^index\.html$/,
  /^styles-[a-z0-9-]+\.css$/i,
  /^favicon\.(?:ico|png)$/i,
  /^manifest\.webmanifest$/i
]);

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

export function nearestRankPercentile(values: readonly number[], ratio: number): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const safeRatio = Math.min(1, Math.max(0, Number(ratio)));
  const rank = Math.max(1, Math.ceil(sorted.length * safeRatio));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
}

export function summarizeNumeric(values: readonly number[]): NumericSummary {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) {
    return Object.freeze({ count: 0, min: null, max: null, average: null, median: null, p95: null });
  }
  const sum = sorted.reduce((total, value) => total + value, 0);
  return Object.freeze({
    count: sorted.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    average: round(sum / sorted.length),
    median: round(nearestRankPercentile(sorted, 0.5)),
    p95: round(nearestRankPercentile(sorted, 0.95))
  });
}

function normalizeIntervals(intervals: readonly Interval[]): Interval[] {
  return intervals
    .map((interval) => ({ startMs: Number(interval.startMs), endMs: Number(interval.endMs) }))
    .filter((interval) => Number.isFinite(interval.startMs)
      && Number.isFinite(interval.endMs)
      && interval.endMs >= interval.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

export function unionIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = normalizeIntervals(intervals);
  const union: Interval[] = [];
  for (const interval of sorted) {
    const previous = union[union.length - 1];
    if (!previous || interval.startMs > previous.endMs) {
      union.push({ startMs: interval.startMs, endMs: interval.endMs });
      continue;
    }
    if (interval.endMs > previous.endMs) {
      union[union.length - 1] = { startMs: previous.startMs, endMs: interval.endMs };
    }
  }
  return union;
}

export function intervalUnionDurationMs(intervals: readonly Interval[]): number {
  return unionIntervals(intervals).reduce((total, interval) => total + (interval.endMs - interval.startMs), 0);
}

export function intervalIntersectionDurationMs(interval: Interval, others: readonly Interval[]): number {
  if (!Number.isFinite(interval.startMs) || !Number.isFinite(interval.endMs) || interval.endMs <= interval.startMs) return 0;
  let total = 0;
  for (const candidate of unionIntervals(others)) {
    const startMs = Math.max(interval.startMs, candidate.startMs);
    const endMs = Math.min(interval.endMs, candidate.endMs);
    if (endMs > startMs) total += endMs - startMs;
  }
  return total;
}

function groupEntries(entries: readonly StageEntry[], kind: 'sync' | 'wait'): Map<string, StageEntry[]> {
  const groups = new Map<string, StageEntry[]>();
  for (const entry of entries) {
    if (entry.kind !== kind || entry.runId === null) continue;
    const key = `${entry.correlationId}\u0000${entry.runId}`;
    const values = groups.get(key) || [];
    values.push(entry);
    groups.set(key, values);
  }
  return groups;
}

export function computeInvocationDurations(entries: readonly StageEntry[], kind: 'sync' | 'wait'): number[] {
  return Array.from(groupEntries(entries, kind).values()).map((group) => intervalUnionDurationMs(group));
}

export function attributeBrowserTimingEntry(
  timingEntry: BrowserTimingEntry,
  syncEntries: readonly StageEntry[]
): Readonly<Record<string, unknown>> {
  const syncIntervals = syncEntries.filter((entry) => entry.kind === 'sync');
  const stageOverlapMs: Record<string, number> = {};
  for (const stage of new Set(syncIntervals.map((entry) => entry.stage))) {
    const overlap = intervalIntersectionDurationMs(
      timingEntry,
      syncIntervals.filter((entry) => entry.stage === stage)
    );
    if (overlap > 0) stageOverlapMs[stage] = round(overlap) as number;
  }
  const appAttributedOverlapMs = intervalIntersectionDurationMs(timingEntry, syncIntervals);
  return Object.freeze({
    entryType: timingEntry.entryType,
    startMs: round(timingEntry.startMs),
    endMs: round(timingEntry.endMs),
    durationMs: round(timingEntry.durationMs),
    appAttributed: appAttributedOverlapMs > 0,
    appAttributedOverlapMs: round(appAttributedOverlapMs),
    stageOverlapMs: Object.freeze(stageOverlapMs),
    unattributedMs: round(Math.max(0, timingEntry.durationMs - appAttributedOverlapMs))
  });
}

function validateStageEntry(entry: StageEntry): string | null {
  if (!entry || typeof entry !== 'object') return 'invalid-stage-entry';
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(String(entry.correlationId || ''))) return 'invalid-correlation-id';
  if (!Number.isFinite(entry.startMs) || !Number.isFinite(entry.endMs) || entry.endMs < entry.startMs) return 'invalid-stage-interval';
  if (!Number.isFinite(entry.durationMs) || Math.abs(entry.durationMs - (entry.endMs - entry.startMs)) > 0.01) return 'invalid-stage-duration';
  if (entry.kind !== 'sync' && entry.kind !== 'wait') return 'invalid-stage-kind';
  if (![
    'handoff-delay',
    'card-availability',
    'card-quiescence',
    'card-context-base',
    'move-candidates',
    'tactical-safety',
    'commentary-context',
    'pending-target-choice',
    'canonical-commit',
    'presentation-handoff'
  ].includes(entry.stage) && !/^card-context-feature:[a-z0-9][a-z0-9-]*$/i.test(entry.stage)) return 'invalid-stage-name';
  if (entry.stage === 'handoff-delay' && (entry.kind !== 'wait' || entry.runId !== null)) return 'invalid-handoff-entry';
  if (entry.stage !== 'handoff-delay' && (!Number.isSafeInteger(entry.runId) || entry.runId === null || entry.runId < 0)) return 'invalid-run-id';
  return null;
}

export function validateBrowserSample(sample: BrowserSample, expectedScenarioId?: string): string[] {
  const errors: string[] = [];
  if (!sample || typeof sample !== 'object') return ['sample-missing'];
  if (sample.schemaVersion !== SAMPLE_SCHEMA_VERSION) errors.push('sample-schema-mismatch');
  if (!sample.scenarioId || !SCENARIO_SET.has(sample.scenarioId)) errors.push('scenario-id-invalid');
  if (expectedScenarioId && sample.scenarioId !== expectedScenarioId) errors.push('scenario-id-mismatch');
  if (sample.visibilityValid !== true) errors.push('visibility-invalid');
  if (sample.focusValid !== true) errors.push('focus-invalid');
  if (sample.overflow === true) errors.push('collector-overflow');
  if (Number(sample.invalidEntryCount || 0) > 0) errors.push('collector-invalid-entry');
  if (!sample.clockDomain || sample.clockDomain.compatible !== true) errors.push('clock-domain-incompatible');
  if (!Number.isFinite(Number(sample.clockDomain && sample.clockDomain.timeOrigin))) errors.push('clock-time-origin-invalid');
  if (!Number.isFinite(sample.startedAtMs) || !Number.isFinite(sample.endedAtMs) || Number(sample.endedAtMs) < Number(sample.startedAtMs)) {
    errors.push('capture-interval-invalid');
  }
  const stageEntries = Array.isArray(sample.stageEntries) ? sample.stageEntries : [];
  if (!stageEntries.length) errors.push('stage-entries-missing');
  for (const entry of stageEntries) {
    const error = validateStageEntry(entry);
    if (error && !errors.includes(error)) errors.push(error);
    if (
      Number.isFinite(sample.startedAtMs)
      && Number.isFinite(sample.endedAtMs)
      && (entry.startMs < Number(sample.startedAtMs) || entry.endMs > Number(sample.endedAtMs))
      && !errors.includes('stage-outside-capture')
    ) errors.push('stage-outside-capture');
  }
  if (!stageEntries.some((entry) => entry.kind === 'sync' && entry.runId !== null)) {
    errors.push('cpu-sync-entry-missing');
  }
  if (
    sample.scenarioId === 'lv6-worker-backed-place-8x8'
    && !stageEntries.some((entry) => entry.kind === 'sync' && entry.stage === 'tactical-safety')
  ) {
    errors.push('tactical-safety-entry-missing');
  }
  const metadata = sample.metadata || {};
  if (!/^[a-f0-9]{64}$/i.test(String(metadata.fixtureOutcomeDigest || ''))) errors.push('fixture-outcome-digest-invalid');
  for (const key of ['orderedActionsVerified', 'cardEffectVerified', 'workerPathVerified', 'pixiPlaybackVerified']) {
    if (metadata[key] !== true) errors.push(`${key}-invalid`);
  }
  return errors;
}

function stageDurationMap(entries: readonly StageEntry[], kind: 'sync' | 'wait'): Record<string, number[]> {
  const output: Record<string, number[]> = {};
  if (kind === 'wait') {
    const handoffDurations = entries
      .filter((entry) => entry.kind === 'wait' && entry.stage === 'handoff-delay' && entry.runId === null)
      .map((entry) => entry.durationMs)
      .filter(Number.isFinite);
    if (handoffDurations.length) output['handoff-delay'] = handoffDurations;
  }
  const groups = groupEntries(entries, kind);
  for (const values of groups.values()) {
    for (const stage of new Set(values.map((entry) => entry.stage))) {
      if (!output[stage]) output[stage] = [];
      output[stage].push(intervalUnionDurationMs(values.filter((entry) => entry.stage === stage)));
    }
  }
  return output;
}

function summarizeStageMap(values: Record<string, number[]>): Record<string, NumericSummary> {
  return Object.freeze(Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
      .map(([stage, durations]) => [stage, summarizeNumeric(durations)])
  ));
}

function computeHandoffCoverage(entries: readonly StageEntry[]): Readonly<Record<string, unknown>> {
  const actionCorrelations = new Set(entries.filter((entry) => entry.runId !== null).map((entry) => entry.correlationId));
  const handoffCorrelations = new Set(entries.filter((entry) => entry.stage === 'handoff-delay').map((entry) => entry.correlationId));
  const missingCount = Array.from(actionCorrelations).filter((id) => !handoffCorrelations.has(id)).length;
  return Object.freeze({
    complete: actionCorrelations.size > 0 && missingCount === 0,
    actionCorrelationCount: actionCorrelations.size,
    missingCount
  });
}

function maximumAppAttributedSyncSliceMs(sample: BrowserSample): number {
  const syncIntervals = unionIntervals(
    (sample.stageEntries || []).filter((entry) => entry.kind === 'sync')
  );
  const longTaskIntervals = unionIntervals(sample.longTasks || []);
  let maximum = 0;
  for (const syncInterval of syncIntervals) {
    for (const longTaskInterval of longTaskIntervals) {
      const startMs = Math.max(syncInterval.startMs, longTaskInterval.startMs);
      const endMs = Math.min(syncInterval.endMs, longTaskInterval.endMs);
      if (endMs > startMs) maximum = Math.max(maximum, endMs - startMs);
    }
  }
  return maximum;
}

function diagnosticsDelta(
  before: Readonly<Record<string, unknown>> | null | undefined,
  after: Readonly<Record<string, unknown>> | null | undefined
): Readonly<Record<string, number>> {
  const output: Record<string, number> = {};
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    const left = Number(before && before[key]);
    const right = Number(after && after[key]);
    if (Number.isFinite(left) && Number.isFinite(right)) output[key] = right - left;
  }
  return Object.freeze(output);
}

function sanitizeReportMetadata(value: Readonly<Record<string, unknown>> | null | undefined): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (!REPORT_METADATA_KEYS.has(key)) continue;
    if (typeof raw === 'string' && raw.length <= 128) output[key] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === 'boolean') output[key] = raw;
  }
  return Object.freeze(output);
}

function sanitizeReportDiagnostics(value: Readonly<Record<string, unknown>> | null | undefined): Readonly<Record<string, unknown>> | null {
  if (!value || typeof value !== 'object') return null;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!REPORT_DIAGNOSTIC_KEYS.has(key)) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
    else if (typeof raw === 'boolean') output[key] = raw;
  }
  return Object.freeze(output);
}

function sanitizeReportCapabilities(value: Readonly<Record<string, unknown>> | null | undefined): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  for (const key of ['longTask', 'longAnimationFrame', 'raf']) {
    const raw = value && value[key];
    if (raw === 'supported' || raw === 'unsupported') output[key] = raw;
  }
  return Object.freeze(output);
}

function sanitizeValidSample(sample: BrowserSample): Readonly<Record<string, unknown>> {
  const entries = (Array.isArray(sample.stageEntries) ? sample.stageEntries : []).map((entry) => Object.freeze({ ...entry }));
  const longTasks = (Array.isArray(sample.longTasks) ? sample.longTasks : [])
    .map((entry) => attributeBrowserTimingEntry(entry, entries));
  const longAnimationFrames = (Array.isArray(sample.longAnimationFrames) ? sample.longAnimationFrames : [])
    .map((entry) => attributeBrowserTimingEntry(entry, entries));
  return Object.freeze({
    metadata: sanitizeReportMetadata(sample.metadata),
    stageEntries: Object.freeze(entries),
    longTasks: Object.freeze(longTasks),
    longAnimationFrames: Object.freeze(longAnimationFrames),
    rafIntervalsMs: Object.freeze((sample.rafIntervalsMs || []).filter(Number.isFinite).map((value) => round(value))),
    startedAtMs: round(Number(sample.startedAtMs)),
    endedAtMs: round(Number(sample.endedAtMs)),
    pixiDiagnosticsBefore: sanitizeReportDiagnostics(sample.pixiDiagnosticsBefore),
    pixiDiagnosticsAfter: sanitizeReportDiagnostics(sample.pixiDiagnosticsAfter),
    pixiDiagnosticsDelta: diagnosticsDelta(
      sanitizeReportDiagnostics(sample.pixiDiagnosticsBefore),
      sanitizeReportDiagnostics(sample.pixiDiagnosticsAfter)
    ),
    visibilityValid: sample.visibilityValid === true,
    focusValid: sample.focusValid === true,
    overflow: sample.overflow === true,
    invalidEntryCount: Number.isFinite(Number(sample.invalidEntryCount))
      ? Number(sample.invalidEntryCount)
      : null,
    clockDomain: Object.freeze({
      stageClock: sample.clockDomain && sample.clockDomain.stageClock === 'performance.now'
        ? 'performance.now'
        : null,
      observerClock: sample.clockDomain && sample.clockDomain.observerClock === 'performance-timeline'
        ? 'performance-timeline'
        : null,
      rafClock: sample.clockDomain && sample.clockDomain.rafClock === 'document-timeline'
        ? 'document-timeline'
        : null,
      timeOrigin: Number.isFinite(Number(sample.clockDomain && sample.clockDomain.timeOrigin))
        ? Number(sample.clockDomain && sample.clockDomain.timeOrigin)
        : null,
      compatible: sample.clockDomain && sample.clockDomain.compatible === true
    }),
    capabilities: sanitizeReportCapabilities(sample.capabilities),
    runtimeEvidence: Object.freeze({
      workerCandidateScoringRequestCount: Number.isFinite(Number(sample.runtimeEvidence?.workerCandidateScoringRequestCount))
        ? Number(sample.runtimeEvidence?.workerCandidateScoringRequestCount)
        : 0,
      workerCardQuiescenceRequestCount: Number.isFinite(Number(sample.runtimeEvidence?.workerCardQuiescenceRequestCount))
        ? Number(sample.runtimeEvidence?.workerCardQuiescenceRequestCount)
        : 0,
      workerOnnxInferenceRequestCount: Number.isFinite(Number(sample.runtimeEvidence?.workerOnnxInferenceRequestCount))
        ? Number(sample.runtimeEvidence?.workerOnnxInferenceRequestCount)
        : 0
    })
  });
}

export function assertNoForbiddenReportKeys(value: unknown, currentPath = '$'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenReportKeys(entry, `${currentPath}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      FORBIDDEN_REPORT_KEYS.has(key.toLowerCase())
      || normalizedKey.includes('seattoken')
      || normalizedKey.includes('operationid')
      || normalizedKey.includes('cardstate')
      || normalizedKey.includes('gamestate')
      || normalizedKey.includes('privatehand')
    ) {
      throw new Error(`forbidden report key at ${currentPath}.${key}`);
    }
    assertNoForbiddenReportKeys(entry, `${currentPath}.${key}`);
  }
}

export function buildFrameStallReport(
  samplesByScenario: Readonly<Record<string, readonly BrowserSample[]>>,
  options: Readonly<{
    profile: string;
    lane: string;
    browserArtifactSha256: string;
    fixtureDigest: string;
    warmupIterations: number;
    captureIterations: number;
    buildMode: string;
    captureOrder: readonly string[];
    graphics: DesktopGraphicsEnvironment;
    emulation?: Readonly<{
      mode: 'desktop' | 'mobile-layout';
      viewportWidth: number;
      viewportHeight: number;
      deviceScaleFactor: number;
      isMobile: boolean;
      hasTouch: boolean;
      cpuThrottleRate: number;
      physicalDevice: false;
    }>;
    minimumValidSamples?: number;
    generatedAt?: string;
  }>
): Readonly<Record<string, unknown>> {
  assertHardwareAcceleratedGraphics(options.graphics);
  const minimumValidSamples = Number.isFinite(options.minimumValidSamples)
    ? Math.max(1, Math.trunc(Number(options.minimumValidSamples)))
    : 5;
  const scenarios: Record<string, unknown> = {};
  for (const scenarioId of SCENARIO_IDS) {
    const inputSamples = Array.isArray(samplesByScenario[scenarioId]) ? samplesByScenario[scenarioId] : [];
    const valid: BrowserSample[] = [];
    const invalidReasons: Record<string, number> = {};
    for (const sample of inputSamples) {
      const reasons = validateBrowserSample(sample, scenarioId);
      const metadata = sample && sample.metadata ? sample.metadata : {};
      if (metadata.profile !== options.profile) reasons.push('profile-mismatch');
      if (metadata.lane !== options.lane) reasons.push('lane-mismatch');
      if (metadata.buildMode !== options.buildMode) reasons.push('build-mode-mismatch');
      if (metadata.fixtureDigest !== options.fixtureDigest) reasons.push('fixture-digest-mismatch');
      if (metadata.browserArtifactSha256 !== options.browserArtifactSha256) reasons.push('artifact-hash-mismatch');
      if (Number(metadata.captureOrderIndex) !== SCENARIO_IDS.indexOf(scenarioId as ScenarioId)) {
        reasons.push('capture-order-index-mismatch');
      }
      if (!reasons.length) valid.push(sample);
      else for (const reason of reasons) invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
    }
    if (valid.length < minimumValidSamples) {
      throw new Error(
        `${scenarioId}: valid sample count ${valid.length} is below ${minimumValidSamples}; reasons=${JSON.stringify(invalidReasons)}`
      );
    }
    const allEntries = valid.flatMap((sample) => Array.isArray(sample.stageEntries) ? sample.stageEntries : []);
    const allRafIntervals = valid.flatMap((sample) => Array.isArray(sample.rafIntervalsMs) ? sample.rafIntervalsMs : []);
    const attributedLongTaskOverlaps = valid.flatMap((sample) => {
      const entries = Array.isArray(sample.stageEntries) ? sample.stageEntries : [];
      return (sample.longTasks || [])
        .map((entry) => Number(attributeBrowserTimingEntry(entry, entries).appAttributedOverlapMs || 0))
        .filter((value) => value > 0);
    });
    const syncStageDurations = valid.reduce((acc, sample) => {
      const one = stageDurationMap(sample.stageEntries || [], 'sync');
      for (const [stage, values] of Object.entries(one)) (acc[stage] ||= []).push(...values);
      return acc;
    }, {} as Record<string, number[]>);
    const waitStageDurations = valid.reduce((acc, sample) => {
      const one = stageDurationMap(sample.stageEntries || [], 'wait');
      for (const [stage, values] of Object.entries(one)) (acc[stage] ||= []).push(...values);
      return acc;
    }, {} as Record<string, number[]>);
    const handoffCoverage = computeHandoffCoverage(allEntries);
    const appAttributedSyncSlicesMs = valid.map(maximumAppAttributedSyncSliceMs);
    const fixtureOutcomeDigests = Array.from(new Set(valid.map((sample) => String(sample.metadata?.fixtureOutcomeDigest || ''))));
    if (fixtureOutcomeDigests.length !== 1) {
      throw new Error(`${scenarioId}: fixture outcome was not deterministic (${fixtureOutcomeDigests.join(', ')})`);
    }
    const observedRefreshHz = allRafIntervals.length
      ? 1000 / (nearestRankPercentile(allRafIntervals, 0.5) || Number.POSITIVE_INFINITY)
      : 0;
    scenarios[scenarioId] = Object.freeze({
      validSampleCount: valid.length,
      invalidSampleCount: inputSamples.length - valid.length,
      invalidReasons: Object.freeze(invalidReasons),
      syncInvocationMs: summarizeNumeric(valid.flatMap((sample) => computeInvocationDurations(sample.stageEntries || [], 'sync'))),
      waitInvocationMs: summarizeNumeric(valid.flatMap((sample) => computeInvocationDurations(sample.stageEntries || [], 'wait'))),
      syncStagesMs: summarizeStageMap(syncStageDurations),
      waitStagesMs: summarizeStageMap(waitStageDurations),
      handoffDelayMs: summarizeNumeric(
        allEntries
          .filter((entry) => entry.kind === 'wait' && entry.stage === 'handoff-delay')
          .map((entry) => entry.durationMs)
      ),
      rafIntervalMs: summarizeNumeric(allRafIntervals),
      appAttributedLongTaskOverlapMs: summarizeNumeric(attributedLongTaskOverlaps),
      maximumAppAttributedSyncSliceMs: round(Math.max(0, ...appAttributedSyncSlicesMs)),
      handoffCoverage,
      fixtureOutcomeDigest: fixtureOutcomeDigests[0],
      refreshEvidence: scenarioId === 'pixi-high-refresh-playback-8x8'
        ? Object.freeze({
            requestedHz: 240,
            observedHz: round(observedRefreshHz),
            emulationValidated: false,
            supportStatus: observedRefreshHz >= 120 ? 'observed-high-refresh' : 'unsupported'
          })
        : null,
      samples: Object.freeze(valid.map(sanitizeValidSample))
    });
  }
  const report = Object.freeze({
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    capture: Object.freeze({
      profile: options.profile,
      lane: options.lane,
      browserArtifactSha256: options.browserArtifactSha256,
      fixtureDigest: options.fixtureDigest,
      warmupIterations: options.warmupIterations,
      captureIterations: options.captureIterations,
      buildMode: options.buildMode,
      captureOrder: Object.freeze(options.captureOrder.slice()),
      graphics: options.graphics,
      emulation: options.emulation || null
    }),
    scenarios: Object.freeze(scenarios)
  });
  assertNoForbiddenReportKeys(report);
  return report;
}

export function evaluateBlockingPerformanceGate(
  baseline: any,
  candidate: any
): Readonly<{ ok: boolean; errors: readonly string[] }> {
  const errors: string[] = [];
  if (!baseline || baseline.schemaVersion !== REPORT_SCHEMA_VERSION) errors.push('baseline schema mismatch');
  if (!candidate || candidate.schemaVersion !== REPORT_SCHEMA_VERSION) errors.push('candidate schema mismatch');
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  for (const key of ['profile', 'lane', 'fixtureDigest', 'captureIterations', 'buildMode']) {
    if (baseline.capture?.[key] !== candidate.capture?.[key]) errors.push(`capture ${key} mismatch`);
  }
  for (const [label, report] of [['baseline', baseline], ['candidate', candidate]] as const) {
    if (report.capture?.graphics?.hardwareAccelerated !== true) {
      errors.push(`${label} capture hardware graphics evidence missing`);
    }
  }
  for (const key of ['glRenderer', 'glVendor', 'displayType']) {
    if (baseline.capture?.graphics?.[key] !== candidate.capture?.graphics?.[key]) {
      errors.push(`capture graphics ${key} mismatch`);
    }
  }
  if (JSON.stringify(baseline.capture?.captureOrder || null) !== JSON.stringify(candidate.capture?.captureOrder || null)) {
    errors.push('capture order mismatch');
  }
  if (JSON.stringify(baseline.capture?.emulation || null) !== JSON.stringify(candidate.capture?.emulation || null)) {
    errors.push('capture emulation mismatch');
  }
  const baselineArtifactHash = String(baseline.capture?.browserArtifactSha256 || '').trim();
  const candidateArtifactHash = String(candidate.capture?.browserArtifactSha256 || '').trim();
  if (!baselineArtifactHash || !candidateArtifactHash) {
    errors.push('browser artifact hash missing');
  } else if (baselineArtifactHash === candidateArtifactHash) {
    errors.push('baseline and candidate browser artifact hashes must differ');
  }
  const lv1Scenarios = SCENARIO_IDS.slice(0, 3);
  for (const scenarioId of lv1Scenarios) {
    const before = baseline.scenarios?.[scenarioId];
    const after = candidate.scenarios?.[scenarioId];
    if (!before || !after) {
      errors.push(`${scenarioId}: scenario missing`);
      continue;
    }
    for (const metric of ['p95', 'max']) {
      const baselineRaw = before.syncInvocationMs?.[metric];
      const candidateRaw = after.syncInvocationMs?.[metric];
      const baselineValue = typeof baselineRaw === 'number' ? baselineRaw : Number.NaN;
      const candidateValue = typeof candidateRaw === 'number' ? candidateRaw : Number.NaN;
      if (!Number.isFinite(baselineValue) || !Number.isFinite(candidateValue)) {
        errors.push(`${scenarioId}: sync ${metric} missing`);
      } else if (baselineValue >= 50 && candidateValue > baselineValue * 0.3) {
        errors.push(`${scenarioId}: sync ${metric} did not improve by 70%`);
      } else if (baselineValue < 50 && candidateValue > baselineValue + Math.max(5, baselineValue * 0.2)) {
        errors.push(`${scenarioId}: sync ${metric} regressed`);
      }
    }
    const stageNames = new Set([
      ...Object.keys(before.syncStagesMs || {}),
      ...Object.keys(after.syncStagesMs || {})
    ]);
    for (const stage of stageNames) {
      for (const metric of ['p95', 'max']) {
        const baselineRaw = before.syncStagesMs?.[stage]?.[metric];
        const candidateRaw = after.syncStagesMs?.[stage]?.[metric];
        const baselineValue = typeof baselineRaw === 'number'
          ? baselineRaw
          : (before.syncStagesMs?.[stage] ? Number.NaN : 0);
        const candidateValue = typeof candidateRaw === 'number'
          ? candidateRaw
          : (after.syncStagesMs?.[stage] ? Number.NaN : 0);
        if (!Number.isFinite(baselineValue) || !Number.isFinite(candidateValue)) {
          errors.push(`${scenarioId}: ${stage} ${metric} missing`);
          continue;
        }
        if (baselineValue >= 50 && candidateValue > baselineValue * 0.3) {
          errors.push(`${scenarioId}: ${stage} ${metric} did not improve by 70%`);
        } else if (baselineValue < 50 && candidateValue > baselineValue + Math.max(5, baselineValue * 0.2)) {
          errors.push(`${scenarioId}: ${stage} ${metric} regressed`);
        }
      }
    }
    if (typeof after.maximumAppAttributedSyncSliceMs !== 'number'
      || !Number.isFinite(after.maximumAppAttributedSyncSliceMs)) {
      errors.push(`${scenarioId}: app-attributed sync slice missing`);
    } else if (after.maximumAppAttributedSyncSliceMs >= 250) {
      errors.push(`${scenarioId}: app-attributed sync slice reached 250ms`);
    }
    if (after.handoffCoverage?.complete !== true) errors.push(`${scenarioId}: handoff coverage incomplete`);
    if (before.fixtureOutcomeDigest !== after.fixtureOutcomeDigest) {
      errors.push(`${scenarioId}: fixture outcome changed`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function resolveMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json' || ext === '.webmanifest') return 'application/json; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.onnx') return 'application/octet-stream';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

function isAllowlistedStaticPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return STATIC_ROOT_FILE_PATTERNS.some((pattern) => pattern.test(normalized))
    || STATIC_PREFIX_ALLOWLIST.some((prefix) => normalized.startsWith(prefix));
}

function createAllowlistedStaticServer(rootDir: string): http.Server {
  const normalizedRoot = path.resolve(rootDir);
  return http.createServer((request, response) => {
    const rawPath = String(request.url || '/').split('?')[0] || '/';
    if (rawPath === '/api/match/list') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{"ok":true,"rooms":[]}');
      return;
    }
    if (rawPath === '/api/leaderboard/list') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{"ok":true,"entries":[]}');
      return;
    }
    let relativePath = 'vite-dist/index.vite.html';
    try {
      relativePath = decodeURIComponent(rawPath === '/' ? '/vite-dist/index.vite.html' : rawPath).replace(/^\/+/, '');
    } catch (_error) {
      response.writeHead(400);
      response.end('Bad request');
      return;
    }
    if (!isAllowlistedStaticPath(relativePath)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const filePath = path.resolve(normalizedRoot, relativePath);
    const rootWithSeparator = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
    if (!filePath.startsWith(rootWithSeparator)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': resolveMimeType(filePath),
        'Cache-Control': 'no-store'
      });
      response.end(data);
    });
  });
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server has no TCP address');
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function collectFilesRecursively(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectFilesRecursively(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function computeBrowserArtifactSha256(rootDir: string): string {
  const files = [
    ...collectFilesRecursively(path.join(rootDir, 'vite-dist')),
    path.join(rootDir, 'index.html'),
    path.join(rootDir, 'public', 'module-registry.js'),
    path.join(rootDir, 'public', 'module-registry.optional.js')
  ].filter((filePath) => fs.existsSync(filePath)).sort();
  const hash = crypto.createHash('sha256');
  for (const filePath of files) {
    hash.update(path.relative(rootDir, filePath).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function computeFixtureDigest(): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    schema: 1,
    scenarios: SCENARIO_IDS,
    boardSize: 8,
    cards: {
      'lv1-empty-or-unusable-hand-place-8x8': [],
      'lv1-usable-card-then-place-8x8': ['hard_01'],
      'lv1-multi-target-card-playback-8x8': ['strong_wind_01'],
      'lv6-worker-backed-place-8x8': [],
      'pixi-high-refresh-playback-8x8': []
    },
    runtime: {
      eagerCpuPolicy: true,
      boardRenderer: 'pixi'
    }
  })).digest('hex');
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = window as any;
    return String(root.__CARD_REVERSI_BROWSER_LANE__ || '') === 'vite'
      && document.documentElement.getAttribute('data-browser-boot-state') === 'ready'
      && root.__cpuTurnPerformance
      && root.gameState
      && Array.isArray(root.gameState.board)
      && root.cardState
      && typeof root.executeMove === 'function'
      && root.__boardVisualDebug
      && typeof root.__boardVisualDebug.waitForIdle === 'function';
  }, undefined, { timeout: 30_000 });
  await page.evaluate(async () => {
    const close = document.getElementById('maintenanceNoticeCloseBtn') as HTMLButtonElement | null;
    if (close) close.click();
    const root = window as any;
    await root.__boardVisualDebug.waitForIdle();
  });
}

async function installFixture(page: Page, scenarioId: ScenarioId, fixtureIndex: number): Promise<Record<string, unknown>> {
  return page.evaluate(async ({ scenario, index }) => {
    const root = window as any;
    const BLACK_VALUE = 1;
    const WHITE_VALUE = -1;
    const cpuLevel = scenario === 'lv6-worker-backed-place-8x8' ? 6 : 1;
    const cards = scenario === 'lv1-usable-card-then-place-8x8'
      ? ['hard_01']
      : scenario === 'lv1-multi-target-card-playback-8x8'
        ? ['strong_wind_01']
        : [];
    const levelSelect = document.querySelector<HTMLSelectElement>('#smartWhite');
    if (!levelSelect) throw new Error('white CPU level select is unavailable');
    levelSelect.value = String(cpuLevel);
    levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    root.MATCH_MODE = 'cpu';
    root.DEBUG_HUMAN_VS_HUMAN = false;
    root.DEBUG_UNLIMITED_USAGE = true;
    for (const key of ['__uiImpl_turn_manager', '__uiImpl_move_executor', '__uiImpl']) {
      root[key] = root[key] || {};
      root[key].MATCH_MODE = 'cpu';
      root[key].DEBUG_HUMAN_VS_HUMAN = false;
      root[key].DEBUG_UNLIMITED_USAGE = true;
    }
    let randomState = 0x6d2b79f5;
    Math.random = () => {
      randomState = (Math.imul(randomState ^ (randomState >>> 15), 1 | randomState) + 0x6d2b79f5) | 0;
      return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
    };
    const coreLogic = root.__require('game/logic/core');
    const cardLogic = root.__require('game/logic/cards');
    if (!coreLogic || typeof coreLogic.createGameState !== 'function') throw new Error('CoreLogic state factory unavailable');
    if (!cardLogic || typeof cardLogic.createCardState !== 'function') throw new Error('CardLogic state factory unavailable');
    const freshGameState = coreLogic.createGameState();
    const freshCardState = cardLogic.createCardState(null, {
      boardConfig: freshGameState.boardConfig,
      initialDeckCardIdsByPlayer: { black: [], white: [] },
      initialChargeByPlayer: { black: 99, white: 99 }
    });
    for (const cardId of cards) {
      if (typeof cardLogic.addCardToHand !== 'function' || !cardLogic.addCardToHand(freshCardState, 'white', cardId)) {
        throw new Error(`fixture card unavailable: ${cardId}`);
      }
    }
    freshGameState.currentPlayer = BLACK_VALUE;
    freshGameState.turnNumber = 1000 + index * 10;
    freshGameState.consecutivePasses = 0;
    freshCardState.turnIndex = 1000 + index * 10;
    root.gameState = freshGameState;
    root.cardState = freshCardState;
    root.isProcessing = false;
    root.isCardAnimating = false;
    root.VisualPlaybackActive = false;
    try {
      const playbackState = root.__require('ui/playback-state-manager');
      if (playbackState && typeof playbackState.clearVisualPlaybackClaims === 'function') playbackState.clearVisualPlaybackClaims();
      if (playbackState && typeof playbackState.clearSelectionSettlementLocks === 'function') playbackState.clearSelectionSettlementLocks();
      if (playbackState && typeof playbackState.setBusyState === 'function') {
        playbackState.setBusyState({ processing: false, cardAnimating: false });
      }
      if (playbackState && typeof playbackState.clearPlaybackLock === 'function') playbackState.clearPlaybackLock();
    } catch (_error) { /* fresh page state remains authoritative for the fixture */ }
    if (typeof root.renderCardUI === 'function') root.renderCardUI();
    if (typeof root.renderBoard === 'function') root.renderBoard();
    await root.__boardVisualDebug.waitForIdle();
    const protection = typeof root.getActiveProtectionForPlayer === 'function'
      ? root.getActiveProtectionForPlayer(BLACK_VALUE)
      : [];
    const blockers = typeof root.getFlipBlockers === 'function' ? root.getFlipBlockers() : [];
    const legalMoves = typeof root.getLegalMoves === 'function'
      ? root.getLegalMoves(root.gameState, protection, blockers)
      : [];
    if (!Array.isArray(legalMoves) || !legalMoves.length) throw new Error('fixture has no legal black move');
    const move = legalMoves[0];
    const expectedPostBlackState = coreLogic.applyMove(coreLogic.copyGameState(root.gameState), move);
    const originalExecuteMove = root.__PERF_EXECUTE_MOVE_ORIGINAL || root.executeMove;
    if (typeof originalExecuteMove !== 'function') throw new Error('executeMove fixture hook unavailable');
    root.__PERF_EXECUTE_MOVE_ORIGINAL = originalExecuteMove;
    root.__PERF_ACTION_EVIDENCE = [];
    root.executeMove = function (candidateMove: any, ...args: any[]) {
      const currentPlayer = root.gameState?.currentPlayer === WHITE_VALUE ? 'white' : 'black';
      root.__PERF_ACTION_EVIDENCE.push({
        actionType: 'move',
        playerKey: currentPlayer,
        row: Number(candidateMove?.row),
        col: Number(candidateMove?.col),
        lastUsedCardBeforePlace: root.cardState?.lastUsedCardByPlayer?.white || null,
        boardBeforePlace: Array.isArray(root.gameState?.board)
          ? root.gameState.board.map((oneRow: any[]) => oneRow.slice())
          : []
      });
      return originalExecuteMove.call(this, candidateMove, ...args);
    };
    const originalProcessPassTurn = root.__PERF_PROCESS_PASS_ORIGINAL || root.processPassTurn;
    if (typeof originalProcessPassTurn !== 'function') throw new Error('processPassTurn fixture hook unavailable');
    root.__PERF_PROCESS_PASS_ORIGINAL = originalProcessPassTurn;
    root.processPassTurn = function (playerKey: any, ...args: any[]) {
      root.__PERF_ACTION_EVIDENCE.push({
        actionType: 'pass',
        playerKey: playerKey === 'white' ? 'white' : 'black',
        row: null,
        col: null,
        lastUsedCardBeforePlace: root.cardState?.lastUsedCardByPlayer?.white || null,
        boardBeforePlace: Array.isArray(root.gameState?.board)
          ? root.gameState.board.map((oneRow: any[]) => oneRow.slice())
          : []
      });
      return originalProcessPassTurn.call(this, playerKey, ...args);
    };
    const workerClient = root.__CARD_REVERSI_CPU_WORKER_CLIENT__ || null;
    root.__PERF_CPU_WORKER_OPERATIONS = [];
    if (workerClient && typeof workerClient.request === 'function') {
      const originalWorkerRequest = root.__PERF_CPU_WORKER_REQUEST_ORIGINAL
        || workerClient.request.bind(workerClient);
      root.__PERF_CPU_WORKER_REQUEST_ORIGINAL = originalWorkerRequest;
      workerClient.request = function (operation: any, ...args: any[]) {
        root.__PERF_CPU_WORKER_OPERATIONS.push(String(operation || ''));
        return originalWorkerRequest(operation, ...args);
      };
    }
    return {
      startTurnNumber: root.gameState.turnNumber,
      row: Number(move.row),
      col: Number(move.col),
      expectedCardUse: cards.length > 0,
      expectedCardId: cards[0] || null,
      expectedPostBlackBoard: expectedPostBlackState.board.map((oneRow: any[]) => oneRow.slice()),
      cpuLevel
    };
  }, { scenario: scenarioId, index: fixtureIndex });
}

async function twoAnimationFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function captureOne(
  page: Page,
  scenarioId: ScenarioId,
  fixtureIndex: number,
  metadata: Readonly<Record<string, unknown>>
): Promise<BrowserSample> {
  const fixture = await installFixture(page, scenarioId, fixtureIndex);
  const began = await page.evaluate(({ scenario, meta }) => {
    const root = window as any;
    return root.__cpuTurnPerformance.beginScenario(scenario, {
      ...meta,
      pixiDiagnosticsBefore: root.__boardVisualDebug.getBackendDiagnostics()
    });
  }, { scenario: scenarioId, meta: metadata });
  if (!began) throw new Error(`${scenarioId}: collector refused beginScenario`);
  await twoAnimationFrames(page);
  await page.evaluate(({ row, col }) => new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        Promise.resolve((window as any).executeMove({ row, col })).then(() => resolve(), reject);
      } catch (error) {
        reject(error);
      }
    }, 0);
  }), { row: fixture.row, col: fixture.col });
  await page.waitForFunction(({ startTurnNumber }) => {
    const root = window as any;
    const pendingWhite = root.cardState?.pendingEffectByPlayer?.white;
    return Number(root.gameState?.turnNumber) >= Number(startTurnNumber) + 2
      && root.gameState?.currentPlayer === 1
      && root.isProcessing !== true
      && root.isCardAnimating !== true
      && !pendingWhite;
  }, { startTurnNumber: fixture.startTurnNumber }, { timeout: 30_000 });
  await page.evaluate(async () => {
    const root = window as any;
    if (typeof root.waitForPlaybackIdle === 'function') await root.waitForPlaybackIdle();
    await root.__boardVisualDebug.waitForIdle();
  });
  await twoAnimationFrames(page);
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const captured = await page.evaluate(() => {
    const root = window as any;
    const diagnosticsAfter = root.__boardVisualDebug.getBackendDiagnostics();
    return {
      sample: root.__cpuTurnPerformance.endScenario({
        pixiDiagnosticsAfter: diagnosticsAfter
      }),
      actionEvidence: Array.isArray(root.__PERF_ACTION_EVIDENCE)
        ? root.__PERF_ACTION_EVIDENCE.map((entry: any) => ({
            actionType: entry?.actionType || null,
            playerKey: entry?.playerKey || null,
            row: Number(entry?.row),
            col: Number(entry?.col),
            lastUsedCardBeforePlace: entry?.lastUsedCardBeforePlace || null,
            boardBeforePlace: Array.isArray(entry?.boardBeforePlace)
              ? entry.boardBeforePlace.map((oneRow: any[]) => oneRow.slice())
              : []
          }))
        : [],
      finalProjection: {
        boardCells: Array.isArray(root.gameState?.board)
          ? root.gameState.board.map((oneRow: any[]) => oneRow.slice())
          : [],
        turnNumber: Number(root.gameState?.turnNumber),
        currentPlayer: root.gameState?.currentPlayer,
        lastUsedCard: root.cardState?.lastUsedCardByPlayer?.white || null,
        pendingCleared: !root.cardState?.pendingEffectByPlayer?.white,
        markers: Array.isArray(root.cardState?.markers)
          ? root.cardState.markers.map((marker: any) => ({
              row: Number(marker?.row),
              col: Number(marker?.col),
              owner: marker?.owner,
              kind: marker?.kind || null,
              type: marker?.type || marker?.data?.type || null,
              sourceCardId: marker?.sourceCardId || marker?.data?.sourceCardId || null
            }))
          : []
      },
      cpuWorkerConfigured: root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuCandidateScoringWorker === true
        && root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuCandidateScoringInjected === true,
      onnxWorkerConfigured: root.__CARD_REVERSI_BROWSER_CAPABILITIES__?.onnxInferenceWorker === true,
      workerOperations: Array.isArray(root.__PERF_CPU_WORKER_OPERATIONS)
        ? root.__PERF_CPU_WORKER_OPERATIONS.slice()
        : [],
      diagnosticsAfter
    };
  });
  const evidence = captured.actionEvidence;
  const firstPlace = evidence[0] || null;
  const secondAction = evidence[1] || null;
  const whitePlace = evidence.find((entry: any) => entry?.actionType === 'move' && entry?.playerKey === 'white') || null;
  const expectedCardId = fixture.expectedCardId || null;
  const expectsWhitePass = scenarioId === 'lv1-multi-target-card-playback-8x8';
  const whiteActionVerified = expectsWhitePass
    ? secondAction?.actionType === 'pass'
      && secondAction?.playerKey === 'white'
      && (secondAction?.lastUsedCardBeforePlace || null) === expectedCardId
    : secondAction?.actionType === 'move'
      && secondAction?.playerKey === 'white'
      && (secondAction?.lastUsedCardBeforePlace || null) === expectedCardId;
  const orderedActionsVerified = evidence.length === 2
    && firstPlace?.actionType === 'move'
    && firstPlace?.playerKey === 'black'
    && firstPlace?.row === fixture.row
    && firstPlace?.col === fixture.col
    && whiteActionVerified;
  if (!orderedActionsVerified) {
    const actionSummary = evidence.map((entry: any) => ({
      actionType: entry.actionType,
      playerKey: entry.playerKey,
      row: entry.row,
      col: entry.col,
      lastUsedCardBeforePlace: entry.lastUsedCardBeforePlace
    }));
    process.stderr.write(`[perf] ${scenarioId} ordered-action evidence=${JSON.stringify(actionSummary)}\n`);
  }
  const exactCardVerified = captured.finalProjection.lastUsedCard === expectedCardId;
  const expectedPostBlackBoardJson = JSON.stringify(fixture.expectedPostBlackBoard);
  const boardAfterCardJson = JSON.stringify(whitePlace?.boardBeforePlace || captured.finalProjection.boardCells);
  const strongWindMovedStone = scenarioId !== 'lv1-multi-target-card-playback-8x8'
    || boardAfterCardJson !== expectedPostBlackBoardJson;
  const hardStoneMarkerPresent = scenarioId !== 'lv1-usable-card-then-place-8x8'
    || captured.finalProjection.markers.some((marker: any) => (
      marker.sourceCardId === 'hard_01' || String(marker.type || '').toUpperCase() === 'PROTECTED'
    ));
  const cardEffectVerified = exactCardVerified
    && captured.finalProjection.pendingCleared === true
    && strongWindMovedStone
    && hardStoneMarkerPresent;
  const workerRequestCount = captured.workerOperations.filter((operation: any) => operation === 'onnx.run-session').length;
  const workerPathVerified = scenarioId !== 'lv6-worker-backed-place-8x8'
    || (captured.onnxWorkerConfigured === true && workerRequestCount > 0);
  if (!workerPathVerified) {
    process.stderr.write(`[perf] ${scenarioId} worker evidence=${JSON.stringify({
      onnxWorkerConfigured: captured.onnxWorkerConfigured,
      workerRequestCount,
      workerOperations: captured.workerOperations
    })}\n`);
  }
  const beforeDiagnostics = captured.sample.pixiDiagnosticsBefore || {};
  const afterDiagnostics = captured.sample.pixiDiagnosticsAfter || {};
  const diagnosticDelta = (key: string) => Number((afterDiagnostics as any)[key] || 0) - Number((beforeDiagnostics as any)[key] || 0);
  const requiresMultiTargetPlayback = scenarioId === 'lv1-multi-target-card-playback-8x8';
  const requiresPixiPlayback = scenarioId === 'pixi-high-refresh-playback-8x8';
  const pixiPlaybackVerified = (!requiresMultiTargetPlayback && !requiresPixiPlayback) || (
    diagnosticDelta('timelineStartedRunCount') > 0
    && diagnosticDelta('timelineCompletedRunCount') > 0
    && Number((afterDiagnostics as any).timelineActiveRunCount || 0) === 0
    && diagnosticDelta('renderCount') > 0
  );
  const {
    turnNumber: finalTurnNumber,
    ...stableFinalProjection
  } = captured.finalProjection;
  const fixtureOutcomeDigest = crypto.createHash('sha256').update(JSON.stringify({
    scenarioId,
    final: {
      ...stableFinalProjection,
      turnDelta: finalTurnNumber - Number(fixture.startTurnNumber)
    },
    whiteMove: whitePlace ? { row: whitePlace.row, col: whitePlace.col } : null
  })).digest('hex');
  const invalidReasons = [
    ...(!orderedActionsVerified ? ['ordered-actions-unverified'] : []),
    ...(!cardEffectVerified ? ['card-effect-unverified'] : []),
    ...(!workerPathVerified ? ['worker-path-unverified'] : []),
    ...(!pixiPlaybackVerified ? ['pixi-playback-unverified'] : [])
  ];
  return Object.freeze({
    ...captured.sample,
    metadata: Object.freeze({
      ...(captured.sample.metadata || {}),
      fixtureOutcomeDigest,
      orderedActionsVerified,
      cardEffectVerified,
      workerPathVerified,
      pixiPlaybackVerified
    }),
    runtimeEvidence: Object.freeze({
      ...(captured.sample.runtimeEvidence || {}),
      workerOnnxInferenceRequestCount: workerRequestCount
    }),
    invalidEntryCount: Number(captured.sample.invalidEntryCount || 0) + invalidReasons.length,
    invalidReasons: Object.freeze([
      ...(Array.isArray(captured.sample.invalidReasons) ? captured.sample.invalidReasons : []),
      ...invalidReasons
    ])
  }) as BrowserSample;
}

function parseArgs(argv: readonly string[]): Readonly<{
  profile: string;
  outputPath: string;
  quick: boolean;
  mobile: boolean;
  cpuThrottleRate: number;
  cpuProfilePath: string | null;
  heap: boolean;
}> {
  let profile = 'desktop';
  let outputPath = path.join('artifacts', 'opponent-action-frame-stall', 'candidate.json');
  let quick = false;
  let mobile = false;
  let cpuThrottleRate = 1;
  let cpuProfilePath: string | null = null;
  let heap = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profile' && argv[index + 1]) profile = String(argv[++index]);
    else if (arg === '--output' && argv[index + 1]) outputPath = String(argv[++index]);
    else if (arg === '--quick') quick = true;
    else if (arg === '--mobile') mobile = true;
    else if (arg === '--cpu-throttle' && argv[index + 1]) cpuThrottleRate = Number(argv[++index]);
    else if (arg === '--cpu-profile' && argv[index + 1]) cpuProfilePath = String(argv[++index]);
    else if (arg === '--heap') heap = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/i.test(profile)) throw new Error('profile must be an allowlisted identifier');
  if (!Number.isFinite(cpuThrottleRate) || cpuThrottleRate < 1 || cpuThrottleRate > 20) {
    throw new Error('cpu throttle must be between 1 and 20');
  }
  return Object.freeze({ profile, outputPath, quick, mobile, cpuThrottleRate, cpuProfilePath, heap });
}

async function runCli(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const outputPath = path.resolve(rootDir, args.outputPath);
  const artifactHashBefore = computeBrowserArtifactSha256(rootDir);
  const fixtureDigest = computeFixtureDigest();
  const warmupIterations = args.quick ? 1 : 5;
  const captureIterations = args.quick ? 5 : 20;
  const server = createAllowlistedStaticServer(rootDir);
  let browser: Browser | null = null;
  let graphics: DesktopGraphicsEnvironment | null = null;
  const samplesByScenario: Record<string, BrowserSample[]> = Object.fromEntries(SCENARIO_IDS.map((id) => [id, []]));
  const heapSeries: Array<Readonly<{ point: string; usedBytes: number; totalBytes: number }>> = [];
  try {
    const baseUrl = await listen(server);
    browser = await chromium.launch(createDesktopChromiumLaunchOptions());
    graphics = await readDesktopGraphicsEnvironment(browser);
    assertHardwareAcceleratedGraphics(graphics);
    const viewport = args.mobile
      ? { width: 390, height: 844 }
      : { width: 1366, height: 900 };
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: args.mobile ? 2 : 1,
      isMobile: args.mobile,
      hasTouch: args.mobile
    });
    await context.addInitScript(() => {
      Object.defineProperty(window, '__BOARD_VISUAL_TEST__', {
        value: true,
        configurable: true,
        enumerable: false,
        writable: false
      });
    });
    const page = await context.newPage();
    const cdp = args.cpuThrottleRate > 1 || args.cpuProfilePath || args.heap
      ? await context.newCDPSession(page)
      : null;
    // Optional retained-heap series: the same operation order with a forced
    // collection before every reading, so baseline and candidate compare.
    const readHeapAfterCollection = async (point: string): Promise<void> => {
      if (!args.heap || !cdp) return;
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.collectGarbage');
      const usage = await cdp.send('Runtime.getHeapUsage');
      heapSeries.push(Object.freeze({ point, usedBytes: usage.usedSize, totalBytes: usage.totalSize }));
    };
    if (args.cpuThrottleRate > 1 && cdp) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: args.cpuThrottleRate });
    }
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${baseUrl}/vite-dist/index.vite.html?perf=1&boardRenderer=pixi&eagerCpuPolicy=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });
    await waitForReady(page);
    if (args.cpuProfilePath && cdp) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
      await cdp.send('Profiler.start');
    }
    let fixtureIndex = 0;
    await readHeapAfterCollection('ready');
    for (const scenarioId of SCENARIO_IDS) {
      for (let iteration = 0; iteration < warmupIterations + captureIterations; iteration += 1) {
        if (iteration === warmupIterations) await readHeapAfterCollection(`${scenarioId}:after-warmup`);
        fixtureIndex += 1;
        const warmup = iteration < warmupIterations;
        const sample = await captureOne(page, scenarioId, fixtureIndex, {
          profile: args.profile,
          iteration: iteration + 1,
          captureIndex: warmup ? 0 : iteration - warmupIterations + 1,
          warmup,
          fixtureDigest,
          browserArtifactSha256: artifactHashBefore,
          lane: 'vite',
          buildMode: 'vite-production',
          captureOrderIndex: SCENARIO_IDS.indexOf(scenarioId),
          requestedRefreshHz: scenarioId === 'pixi-high-refresh-playback-8x8' ? 240 : 0,
          emulationValidated: false
        });
        if (!warmup) samplesByScenario[scenarioId].push(sample);
        process.stdout.write(`[perf] ${scenarioId} ${warmup ? 'warmup' : 'capture'} ${iteration + 1}/${warmupIterations + captureIterations}\n`);
      }
      await readHeapAfterCollection(`${scenarioId}:after-capture`);
    }
    if (args.cpuProfilePath && cdp) {
      const capturedProfile = await cdp.send('Profiler.stop');
      const profilePath = path.resolve(rootDir, args.cpuProfilePath);
      fs.mkdirSync(path.dirname(profilePath), { recursive: true });
      fs.writeFileSync(profilePath, `${JSON.stringify(capturedProfile.profile)}\n`, 'utf8');
      process.stdout.write(`[perf] wrote ${path.relative(rootDir, profilePath)}\n`);
    }
    await context.close();
    if (consoleErrors.length || pageErrors.length) {
      const details = [...consoleErrors, ...pageErrors]
        .map((value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240))
        .filter(Boolean)
        .slice(0, 10);
      throw new Error(
        `browser emitted ${consoleErrors.length} console errors and ${pageErrors.length} page errors`
        + (details.length ? `: ${JSON.stringify(details)}` : '')
      );
    }
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
  const artifactHashAfter = computeBrowserArtifactSha256(rootDir);
  if (artifactHashAfter !== artifactHashBefore) throw new Error('browser artifact changed during capture');
  if (!graphics) throw new Error('desktop graphics environment was not captured');
  const report = buildFrameStallReport(samplesByScenario, {
    profile: args.profile,
    lane: 'vite',
    browserArtifactSha256: artifactHashBefore,
    fixtureDigest,
    warmupIterations,
    captureIterations,
    buildMode: 'vite-production',
    captureOrder: SCENARIO_IDS,
    graphics,
    emulation: Object.freeze({
      mode: args.mobile ? 'mobile-layout' as const : 'desktop' as const,
      viewportWidth: args.mobile ? 390 : 1366,
      viewportHeight: args.mobile ? 844 : 900,
      deviceScaleFactor: args.mobile ? 2 : 1,
      isMobile: args.mobile,
      hasTouch: args.mobile,
      cpuThrottleRate: args.cpuThrottleRate,
      physicalDevice: false as const
    }),
    minimumValidSamples: args.quick ? 5 : 20
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`[perf] wrote ${path.relative(rootDir, outputPath)}\n`);
  if (args.heap) {
    const heapPath = `${outputPath.replace(/\.json$/i, '')}.heap.json`;
    fs.writeFileSync(heapPath, `${JSON.stringify({
      schemaVersion: 'cpu_turn_heap_series.v1',
      profile: args.profile,
      browserArtifactSha256: artifactHashBefore,
      fixtureDigest,
      warmupIterations,
      captureIterations,
      collection: 'HeapProfiler.collectGarbage x2 before Runtime.getHeapUsage',
      series: heapSeries
    }, null, 2)}\n`, 'utf8');
    process.stdout.write(`[perf] wrote ${path.relative(rootDir, heapPath)}\n`);
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
