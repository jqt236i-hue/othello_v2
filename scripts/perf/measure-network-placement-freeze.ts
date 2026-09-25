/**
 * Network placement freeze measurement (計画書 C10).
 *
 * Opens black / white / spectator pages against an in-process local match server (SSE) or an
 * external match server (`--server`, e.g. `npx wrangler dev --port 8799` for WebSocket), performs
 * moves through the real board input entry (`handleCellClick`), and records for every seat:
 * click → publish → stream arrival → canonical version → playback start → playback idle timeline,
 * long tasks (`long-animation-frame` / `longtask`), RAF gaps, optional `structuredClone` / JSON
 * operation counts, and (with `--trace`) a browser-wide CDP trace split per page with main-thread
 * long-task attribution from the sampled CPU profile.
 *
 * The tool is a characterization / regression instrument. It changes no product behavior.
 *
 * Usage:
 *   node dist/scripts/perf/measure-network-placement-freeze.js [--scenario opening|baseline-light|late-dense|late-special-20|all]
 *     [--iterations N] [--opening-moves N] [--mobile] [--throttle N] [--lane vite|classic] [--server local|<url>]
 *     [--trace] [--count-ops] [--quick] [--label NAME] [--output PATH.json] [--keep-traces]
 */
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';

import { summarizeNumeric } from './measure-opponent-action-frame-stall';
import {
  createNetworkSpecialStonePerformanceFixture,
  type NetworkSpecialStoneFixtureId
} from '../../test/helpers/network-special-stone-performance-fixtures';

export const REPORT_SCHEMA_VERSION = 'network_placement_freeze_report.v1';
export const SAMPLE_SCHEMA_VERSION = 'network_placement_freeze_sample.v1';
export const SCENARIO_IDS = Object.freeze(['opening', 'baseline-light', 'late-dense', 'late-special-20'] as const);
export type ScenarioId = (typeof SCENARIO_IDS)[number];
export const SEAT_LABELS = Object.freeze(['black', 'white', 'spectator'] as const);
export type SeatLabel = (typeof SEAT_LABELS)[number];
export type SeatRole = 'actor' | 'opponent' | 'spectator';

const TRACE_CATEGORIES = 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler,v8.execute,disabled-by-default-v8.gc,blink.user_timing,toplevel';
const LONG_TASK_MIN_MS = 16;
const SETTLEMENT_LOOKBACK_MS = 400;
const SETTLEMENT_LOOKAHEAD_MS = 60;

// ---------------------------------------------------------------------------------------------
// Types

export type NumericSummaryLike = ReturnType<typeof summarizeNumeric>;

export type SeatTimeline = {
  readonly click: number | null;
  readonly clickReturn: number | null;
  readonly publishFetchStart: number | null;
  readonly publishHeaders: number | null;
  readonly publishBody: number | null;
  readonly publishBytes: number | null;
  readonly publishStatus: number | null;
  readonly streamArrive: number | null;
  readonly streamBytes: number | null;
  readonly streamBinary: boolean | null;
  readonly streamTransport: string | null;
  readonly versionChange: number | null;
  readonly playbackStart: number | null;
  readonly playbackIdle: number | null;
  readonly stateFetches: number;
};

export type LongTaskRecord = { readonly at: number; readonly dur: number };

export type OpsCounters = {
  readonly structuredClone: { n: number; ms: number };
  readonly jsonParse: { n: number; ms: number; bytes: number };
  readonly jsonStringify: { n: number; ms: number; bytes: number };
};

export type TraceLongTask = {
  readonly at: number;
  readonly dur: number;
  readonly children: readonly { name: string; dur: number; at: number; info: string | null }[];
  readonly inclusive: readonly string[];
  readonly self: readonly string[];
};

export type TraceBusyWindow = { readonly wallMs: number; readonly busyMs: number; readonly longestMs: number } | null;

export type TraceSummary = {
  readonly mainThread: boolean;
  readonly eventCount: number;
  readonly profileSamples: number;
  readonly marks: readonly { name: string; at: number }[];
  readonly longTasks: readonly TraceLongTask[];
  readonly longTaskCount: number;
  readonly gcCount: number;
  readonly gcMajorMinorTotalMs: number;
  readonly gcTop: readonly { name: string; dur: number; at: number }[];
  readonly busyWindows: Readonly<Record<string, TraceBusyWindow>>;
  readonly file?: string;
};

export type SeatSample = {
  readonly role: SeatRole;
  readonly stateVersionAfter: number | null;
  readonly timeline: SeatTimeline;
  readonly longTasks: readonly LongTaskRecord[];
  readonly loaf: { readonly count: number; readonly blockingTotalMs: number; readonly longestMs: number | null };
  readonly rafGaps: readonly { at: number; gap: number }[];
  readonly ops: OpsCounters | null;
  readonly cloneCallers: readonly [string, number][] | null;
  readonly trace: TraceSummary | null;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
};

export type MoveSample = {
  readonly schemaVersion: typeof SAMPLE_SCHEMA_VERSION;
  readonly scenarioId: ScenarioId;
  readonly index: number;
  readonly phase: string;
  readonly actor: SeatLabel;
  readonly move: { row: number; col: number; playerKey: string; legalCount: number; turnNumber: number; stateVersion: number };
  readonly clickSyncMs: number;
  readonly seats: Readonly<Record<SeatLabel, SeatSample>>;
};

export type SeatMetrics = {
  readonly clickTaskMs: number | null;
  readonly clickToPublishMs: number | null;
  readonly publishRoundTripMs: number | null;
  readonly arrivalTaskMs: number | null;
  readonly arrivalToPlaybackStartMs: number | null;
  readonly settlementTaskMs: number | null;
  readonly playbackMs: number | null;
  readonly loafBlockingTotalMs: number;
  readonly longTaskCount: number;
  readonly longestTaskMs: number | null;
};

export type RoleSummary = Readonly<Record<keyof SeatMetrics, NumericSummaryLike>>;

export type FreezeReport = {
  readonly schemaVersion: typeof REPORT_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly label: string;
  readonly capture: Readonly<Record<string, unknown>>;
  readonly scenarios: Readonly<Record<string, {
    readonly sampleCount: number;
    readonly byRole: Readonly<Record<SeatRole, RoleSummary>>;
    readonly samples: readonly MoveSample[];
  }>>;
};

export type CliArgs = {
  readonly scenarios: readonly ScenarioId[];
  readonly iterations: number;
  readonly openingMoves: number;
  readonly mobile: boolean;
  readonly throttle: number;
  readonly lane: 'vite' | 'classic';
  readonly server: string;
  readonly trace: boolean;
  readonly countOps: boolean;
  readonly countCallers: boolean;
  readonly quick: boolean;
  readonly label: string;
  readonly outputPath: string;
  readonly keepTraces: boolean;
  readonly headed: boolean;
  /** Optional directory served before the repo root (an `index.html` + `vite-dist/` snapshot of another build). */
  readonly appRoot: string | null;
};

// ---------------------------------------------------------------------------------------------
// Pure helpers (unit tested)

export function parseArgs(argv: readonly string[]): CliArgs {
  const read = (name: string): string | null => {
    const index = argv.indexOf(name);
    return index >= 0 && index + 1 < argv.length ? String(argv[index + 1]) : null;
  };
  const has = (name: string): boolean => argv.includes(name);
  const scenarioArg = read('--scenario') || 'all';
  const scenarios = (scenarioArg === 'all'
    ? SCENARIO_IDS.slice()
    : scenarioArg.split(',').map((value) => value.trim()).filter(Boolean)) as ScenarioId[];
  for (const id of scenarios) {
    if (!SCENARIO_IDS.includes(id)) throw new Error(`unknown scenario: ${id}`);
  }
  const mobile = has('--mobile');
  const quick = has('--quick');
  const throttle = Number(read('--throttle') ?? (mobile ? 4 : 1));
  const lane = read('--lane') === 'classic' ? 'classic' : 'vite';
  const label = read('--label') || `${lane}-${mobile ? 'mobile' : 'desktop'}-x${throttle}`;
  const positive = (value: string | null, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  };
  return Object.freeze({
    scenarios: Object.freeze(scenarios),
    iterations: positive(read('--iterations'), quick ? 1 : 3),
    openingMoves: positive(read('--opening-moves'), quick ? 4 : 12),
    mobile,
    throttle: Number.isFinite(throttle) && throttle >= 1 ? throttle : 1,
    lane,
    server: read('--server') || 'local',
    trace: has('--trace'),
    countOps: has('--count-ops') || has('--count-callers'),
    countCallers: has('--count-callers'),
    quick,
    label,
    outputPath: read('--output') || `artifacts/network-placement-freeze/${label}.json`,
    keepTraces: has('--keep-traces'),
    headed: has('--headed'),
    appRoot: read('--app-root')
  });
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

type ProfileNode = { readonly cf: any; readonly parent: number | undefined };
type ReconstructedProfile = { nodes: Map<number, ProfileNode>; samples: number[]; times: number[] };

function frameName(node: ProfileNode): string {
  const url = String(node.cf.url || '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^.*\/vite-dist\/assets\//, 'vite:')
    .replace(/^\/dist\//, '')
    .replace(/^\/public\/vendor\//, 'vendor:');
  return `${node.cf.functionName || '(anon)'} ${url}:${(node.cf.lineNumber || 0) + 1}`;
}

function reconstructMainProfile(events: readonly any[], mainPid: number | null): ReconstructedProfile | null {
  const profiles = new Map<string, ReconstructedProfile & { last: number }>();
  for (const event of events) {
    if (event.name === 'Profile' && event.ph === 'P' && (mainPid === null || event.pid === mainPid)) {
      const start = Number(event.args && event.args.data && event.args.data.startTime) || 0;
      profiles.set(String(event.id), { nodes: new Map(), samples: [], times: [], last: start });
    }
  }
  const chunks = events
    .filter((event) => event.name === 'ProfileChunk' && event.ph === 'P' && (mainPid === null || event.pid === mainPid))
    .sort((a, b) => a.ts - b.ts);
  for (const chunk of chunks) {
    const profile = profiles.get(String(chunk.id));
    if (!profile) continue;
    const cpuProfile = (chunk.args && chunk.args.data && chunk.args.data.cpuProfile) || {};
    for (const node of (cpuProfile.nodes || [])) profile.nodes.set(node.id, { cf: node.callFrame || {}, parent: node.parent });
    const deltas = (chunk.args && chunk.args.data && chunk.args.data.timeDeltas) || [];
    const samples = cpuProfile.samples || [];
    for (let index = 0; index < samples.length; index += 1) {
      profile.last += Number(deltas[index]) || 0;
      profile.samples.push(samples[index]);
      profile.times.push(profile.last);
    }
  }
  const best = Array.from(profiles.values()).sort((a, b) => b.samples.length - a.samples.length)[0];
  return best || null;
}

function attributeWindow(
  profile: ReconstructedProfile | null,
  tsFrom: number,
  tsTo: number,
  limit = 12
): { samples: number; self: string[]; inclusive: string[] } | null {
  if (!profile) return null;
  const self = new Map<string, number>();
  const inclusive = new Map<string, number>();
  let sampleCount = 0;
  let previous: number | null = null;
  for (let index = 0; index < profile.samples.length; index += 1) {
    const time = profile.times[index];
    if (time < tsFrom || time > tsTo) { previous = time; continue; }
    const delta = previous === null ? 0 : Math.min(time - previous, 5000) / 1000;
    previous = time;
    sampleCount += 1;
    const leaf = profile.nodes.get(profile.samples[index]);
    if (!leaf) continue;
    const leafName = frameName(leaf);
    self.set(leafName, (self.get(leafName) || 0) + delta);
    const seen = new Set<string>();
    let current: ProfileNode | undefined = leaf;
    let depth = 0;
    while (current && depth < 200) {
      const name = frameName(current);
      if (!seen.has(name)) { seen.add(name); inclusive.set(name, (inclusive.get(name) || 0) + delta); }
      current = current.parent !== undefined ? profile.nodes.get(current.parent) : undefined;
      depth += 1;
    }
  }
  const format = (map: Map<string, number>): string[] => Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => `${Math.round(value * 10) / 10} ${name}`);
  const inclusiveFiltered = new Map(Array.from(inclusive.entries())
    .filter(([name]) => !/^\((root|program|idle|garbage collector)\)/.test(name)));
  return { samples: sampleCount, self: format(self), inclusive: format(inclusiveFiltered) };
}

/**
 * Summarize one page's main-thread trace events (already split by pid). Times are relative to the
 * `np:click` mark (actor) or the first `np:stream-arrive` mark (receivers).
 */
export function summarizeTraceEvents(events: readonly any[], options: { minTaskMs?: number } = {}): TraceSummary {
  const minTaskMs = options.minTaskMs || LONG_TASK_MIN_MS;
  let mainPid: number | null = null;
  let mainTid: number | null = null;
  for (const event of events) {
    if (event.ph === 'M' && event.name === 'thread_name' && event.args && event.args.name === 'CrRendererMain') {
      mainPid = event.pid;
      mainTid = event.tid;
      break;
    }
  }
  const onMain = (event: any): boolean => mainPid === null || (event.pid === mainPid && event.tid === mainTid);
  const marks: { name: string; ts: number }[] = [];
  for (const event of events) {
    if ((event.cat || '').includes('blink.user_timing') && (event.ph === 'R' || event.ph === 'I') && String(event.name).startsWith('np:')) {
      marks.push({ name: String(event.name).slice(3), ts: event.ts });
    }
  }
  marks.sort((a, b) => a.ts - b.ts);
  const clickMark = marks.find((mark) => mark.name === 'click');
  const arriveMark = marks.find((mark) => mark.name === 'stream-arrive');
  const t0 = clickMark ? clickMark.ts : (arriveMark ? arriveMark.ts : (marks[0] ? marks[0].ts : 0));
  const idleMark = marks.slice().reverse().find((mark) => mark.name === 'playback-idle');
  const tEnd = idleMark ? idleMark.ts + 200_000 : Infinity;
  const rel = (ts: number): number => roundMs((ts - t0) / 1000);

  const profile = reconstructMainProfile(events, mainPid);
  const taskName = events.some((event) => event.name === 'ThreadControllerImpl::RunTask' && onMain(event))
    ? 'ThreadControllerImpl::RunTask'
    : 'RunTask';
  const runTasks = events.filter((event) => event.ph === 'X' && onMain(event) && event.name === taskName);
  const tasks: TraceLongTask[] = [];
  for (const task of runTasks) {
    const dur = (task.dur || 0) / 1000;
    if (dur < minTaskMs || task.ts < t0 - 2000 || task.ts > tEnd) continue;
    const children: { name: string; dur: number; at: number; info: string | null }[] = [];
    for (const child of events) {
      if (child.ph !== 'X' || !onMain(child) || child === task) continue;
      if (child.ts < task.ts || child.ts + (child.dur || 0) > task.ts + (task.dur || 0)) continue;
      if (!/^(FunctionCall|EventDispatch|TimerFire|FireAnimationFrame|Layout|UpdateLayoutTree|Paint|MajorGC|MinorGC|RunMicrotasks|HandlePostMessage|EvaluateScript|v8\.compile)/.test(child.name)) continue;
      if ((child.dur || 0) / 1000 < 1) continue;
      const data = (child.args && child.args.data) || {};
      children.push({
        name: child.name,
        dur: roundMs((child.dur || 0) / 1000),
        at: rel(child.ts),
        info: data.type || data.functionName || null
      });
    }
    children.sort((a, b) => b.dur - a.dur);
    const attribution = attributeWindow(profile, task.ts, task.ts + task.dur);
    tasks.push({
      at: rel(task.ts),
      dur: roundMs(dur),
      children: children.slice(0, 8),
      inclusive: attribution ? attribution.inclusive : [],
      self: attribution ? attribution.self : []
    });
  }
  tasks.sort((a, b) => b.dur - a.dur);

  const gc: { name: string; dur: number; at: number }[] = [];
  for (const event of events) {
    if (event.ph !== 'X' || !onMain(event)) continue;
    if (/^(MajorGC|MinorGC|V8\.GC[A-Za-z_]*|BlinkGC\.[A-Za-z]*)$/.test(event.name)) {
      gc.push({ name: event.name, dur: roundMs((event.dur || 0) / 1000), at: rel(event.ts) });
    }
  }
  const majorMinor = gc.filter((entry) => /^(MajorGC|MinorGC)$/.test(entry.name));
  const busy = (from: string, to: string): TraceBusyWindow => {
    const markFrom = marks.find((mark) => mark.name === from);
    const markTo = marks.find((mark) => mark.name === to);
    if (!markFrom || !markTo) return null;
    let sum = 0;
    let longest = 0;
    for (const task of runTasks) {
      const start = Math.max(task.ts, markFrom.ts);
      const end = Math.min(task.ts + (task.dur || 0), markTo.ts);
      if (end > start) { sum += end - start; longest = Math.max(longest, end - start); }
    }
    return { wallMs: roundMs((markTo.ts - markFrom.ts) / 1000), busyMs: roundMs(sum / 1000), longestMs: roundMs(longest / 1000) };
  };
  return Object.freeze({
    mainThread: mainPid !== null,
    eventCount: events.length,
    profileSamples: profile ? profile.samples.length : 0,
    marks: marks.map((mark) => ({ name: mark.name, at: rel(mark.ts) })),
    longTasks: tasks.slice(0, 12),
    longTaskCount: tasks.length,
    gcCount: gc.length,
    gcMajorMinorTotalMs: roundMs(majorMinor.reduce((total, entry) => total + entry.dur, 0)),
    gcTop: majorMinor.sort((a, b) => b.dur - a.dur).slice(0, 8),
    busyWindows: Object.freeze({
      clickToPublishFetch: busy('click', 'fetch-start:/api/match/publish'),
      clickToPlaybackStart: busy('click', 'playback-start'),
      streamArriveToPlaybackStart: busy('stream-arrive', 'playback-start'),
      playbackStartToIdle: busy('playback-start', 'playback-idle')
    })
  });
}

function longestTaskWithin(tasks: readonly LongTaskRecord[], from: number | null, to: number | null): number | null {
  if (from === null || to === null) return null;
  let longest: number | null = null;
  for (const task of tasks) {
    const start = task.at;
    const end = task.at + task.dur;
    if (end < from || start > to) continue;
    if (longest === null || task.dur > longest) longest = task.dur;
  }
  return longest;
}

/** Derive the per-seat metrics that the acceptance rules compare (計画書 §6–7). */
export function deriveSeatMetrics(seat: SeatSample): SeatMetrics {
  const timeline = seat.timeline;
  // The `longtask` observer only reports tasks >= 50 ms; a trace (when captured) lists main-thread
  // tasks >= 16 ms on the same time base, so prefer it for finer desktop comparisons.
  const tasks: readonly LongTaskRecord[] = seat.trace && seat.trace.mainThread
    ? seat.trace.longTasks.map((task) => ({ at: task.at, dur: task.dur }))
    : seat.longTasks;
  const isActor = seat.role === 'actor';
  const clickTaskMs = isActor && timeline.click !== null
    ? longestTaskWithin(tasks, timeline.click - 2, (timeline.clickReturn ?? timeline.click) + 2)
    : null;
  const arrivalFrom = timeline.streamArrive !== null ? timeline.streamArrive - 2 : (isActor ? timeline.publishHeaders : null);
  const arrivalTaskMs = longestTaskWithin(tasks, arrivalFrom, timeline.playbackStart !== null ? timeline.playbackStart + 5 : null);
  const settlementTaskMs = timeline.playbackIdle !== null
    ? longestTaskWithin(tasks, timeline.playbackIdle - SETTLEMENT_LOOKBACK_MS, timeline.playbackIdle + SETTLEMENT_LOOKAHEAD_MS)
    : null;
  const diff = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : roundMs(b - a));
  return Object.freeze({
    clickTaskMs,
    clickToPublishMs: isActor ? diff(timeline.click, timeline.publishFetchStart) : null,
    publishRoundTripMs: isActor ? diff(timeline.publishFetchStart, timeline.publishHeaders) : null,
    arrivalTaskMs,
    arrivalToPlaybackStartMs: diff(timeline.streamArrive ?? (isActor ? timeline.publishHeaders : null), timeline.playbackStart),
    settlementTaskMs,
    playbackMs: diff(timeline.playbackStart, timeline.playbackIdle),
    loafBlockingTotalMs: seat.loaf.blockingTotalMs,
    longTaskCount: tasks.length,
    longestTaskMs: tasks.length ? Math.max(...tasks.map((task) => task.dur)) : null
  });
}

const METRIC_KEYS = Object.freeze([
  'clickTaskMs', 'clickToPublishMs', 'publishRoundTripMs', 'arrivalTaskMs', 'arrivalToPlaybackStartMs',
  'settlementTaskMs', 'playbackMs', 'loafBlockingTotalMs', 'longTaskCount', 'longestTaskMs'
] as const);

export function buildReport(
  label: string,
  capture: Readonly<Record<string, unknown>>,
  samplesByScenario: Readonly<Record<string, readonly MoveSample[]>>
): FreezeReport {
  const scenarios: Record<string, FreezeReport['scenarios'][string]> = {};
  for (const [scenarioId, samples] of Object.entries(samplesByScenario)) {
    const values: Record<SeatRole, Record<string, number[]>> = {
      actor: {}, opponent: {}, spectator: {}
    };
    for (const sample of samples) {
      if (sample.schemaVersion !== SAMPLE_SCHEMA_VERSION) throw new Error(`unexpected sample schema ${sample.schemaVersion}`);
      for (const seatLabel of SEAT_LABELS) {
        const seat = sample.seats[seatLabel];
        if (!seat) continue;
        const metrics = deriveSeatMetrics(seat);
        for (const key of METRIC_KEYS) {
          const value = metrics[key];
          if (value === null || !Number.isFinite(value)) continue;
          (values[seat.role][key] ||= []).push(value);
        }
      }
    }
    const byRole = {} as Record<SeatRole, RoleSummary>;
    for (const role of ['actor', 'opponent', 'spectator'] as const) {
      const summary = {} as Record<keyof SeatMetrics, NumericSummaryLike>;
      for (const key of METRIC_KEYS) summary[key] = summarizeNumeric(values[role][key] || []);
      byRole[role] = Object.freeze(summary);
    }
    scenarios[scenarioId] = Object.freeze({ sampleCount: samples.length, byRole: Object.freeze(byRole), samples });
  }
  return Object.freeze({
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    label,
    capture,
    scenarios: Object.freeze(scenarios)
  });
}

function formatSummary(summary: NumericSummaryLike): string {
  if (!summary || !summary.count) return '-';
  return `${summary.median} / ${summary.p95} (n=${summary.count})`;
}

export function renderMarkdown(report: FreezeReport): string {
  const lines: string[] = [
    '# Network placement freeze measurement',
    '',
    `Label: \`${report.label}\``,
    `Generated: ${report.generatedAt}`,
    `Capture: \`${JSON.stringify(report.capture)}\``,
    '',
    'Values are median / p95 in ms (nearest rank). Long tasks are main-thread tasks ≥ 16 ms overlapping the phase.',
    ''
  ];
  for (const [scenarioId, scenario] of Object.entries(report.scenarios)) {
    lines.push(`## ${scenarioId} (${scenario.sampleCount} moves)`, '');
    lines.push('| role | click task | click→publish | publish RTT | arrival task | arrival→playback | settlement task | playback | LoAF blocking | longest task |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const role of ['actor', 'opponent', 'spectator'] as const) {
      const summary = scenario.byRole[role];
      lines.push(`| ${role} | ${formatSummary(summary.clickTaskMs)} | ${formatSummary(summary.clickToPublishMs)} | ${formatSummary(summary.publishRoundTripMs)} | ${formatSummary(summary.arrivalTaskMs)} | ${formatSummary(summary.arrivalToPlaybackStartMs)} | ${formatSummary(summary.settlementTaskMs)} | ${formatSummary(summary.playbackMs)} | ${formatSummary(summary.loafBlockingTotalMs)} | ${formatSummary(summary.longestTaskMs)} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Compare a candidate report against a baseline for the acceptance rule of 計画書 §7: a unit is an
 * improvement when the targeted metric medians do not regress and at least one improves; a regression
 * is a p95 that is worse by more than max(2 ms, 5 %) while the medians differ as well (tail-only
 * differences are reported separately for re-pairing).
 */
export function compareReports(
  baseline: FreezeReport,
  candidate: FreezeReport,
  metricKeys: readonly (keyof SeatMetrics)[] = ['clickTaskMs', 'arrivalTaskMs', 'settlementTaskMs']
): { rows: { scenario: string; role: SeatRole; metric: string; baselineMedian: number | null; candidateMedian: number | null; baselineP95: number | null; candidateP95: number | null; verdict: 'improved' | 'unchanged' | 'regressed' | 'tail-only' | 'n/a' }[] } {
  const rows: ReturnType<typeof compareReports>['rows'] = [];
  for (const scenario of Object.keys(candidate.scenarios)) {
    const base = baseline.scenarios[scenario];
    if (!base) continue;
    for (const role of ['actor', 'opponent', 'spectator'] as const) {
      for (const metric of metricKeys) {
        const before = base.byRole[role][metric];
        const after = candidate.scenarios[scenario].byRole[role][metric];
        let verdict: (typeof rows)[number]['verdict'] = 'n/a';
        if (before && after && before.count && after.count && before.median !== null && after.median !== null) {
          const tolerance = Math.max(2, before.median * 0.05);
          const p95Tolerance = Math.max(2, (before.p95 ?? 0) * 0.05);
          const medianWorse = after.median > before.median + tolerance;
          const medianBetter = after.median < before.median - tolerance;
          const p95Worse = after.p95 !== null && before.p95 !== null && after.p95 > before.p95 + p95Tolerance;
          if (medianWorse) verdict = 'regressed';
          else if (p95Worse) verdict = 'tail-only';
          else if (medianBetter) verdict = 'improved';
          else verdict = 'unchanged';
        }
        rows.push({
          scenario, role, metric,
          baselineMedian: before ? before.median : null, candidateMedian: after ? after.median : null,
          baselineP95: before ? before.p95 : null, candidateP95: after ? after.p95 : null,
          verdict
        });
      }
    }
  }
  return { rows };
}

export function renderComparisonMarkdown(comparison: ReturnType<typeof compareReports>): string {
  const lines = ['# Network placement freeze comparison', '', '| scenario | role | metric | baseline median / p95 | candidate median / p95 | verdict |', '|---|---|---|---:|---:|---|'];
  for (const row of comparison.rows) {
    lines.push(`| ${row.scenario} | ${row.role} | ${row.metric} | ${row.baselineMedian ?? '-'} / ${row.baselineP95 ?? '-'} | ${row.candidateMedian ?? '-'} / ${row.candidateP95 ?? '-'} | ${row.verdict} |`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Runtime (browser + servers)

function mimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const table: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
    '.woff2': 'font/woff2', '.svg': 'image/svg+xml'
  };
  return table[extension] || 'application/octet-stream';
}

function createStaticServer(rootDir: string, overlayDir: string | null = null): http.Server {
  const root = path.resolve(rootDir);
  const overlay = overlayDir ? path.resolve(overlayDir) : null;
  return http.createServer((request, response) => {
    const raw = String(request.url || '/').split('?')[0] || '/';
    if (raw === '/api/match/list') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"ok":true,"rooms":[]}'); return; }
    if (raw === '/api/leaderboard/list') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"ok":true,"entries":[]}'); return; }
    let decoded: string;
    try { decoded = decodeURIComponent(raw === '/' ? '/index.html' : raw); } catch { response.writeHead(400); response.end(); return; }
    const filePath = path.resolve(root, `.${decoded}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    const overlayPath = overlay ? path.resolve(overlay, `.${decoded}`) : null;
    const candidates = overlayPath && overlayPath.startsWith(`${overlay}${path.sep}`) ? [overlayPath, filePath] : [filePath];
    const serve = (index: number) => {
      const target = candidates[index];
      fs.readFile(target, (error, data) => {
        if (error) {
          if (index + 1 < candidates.length) { serve(index + 1); return; }
          response.writeHead(404); response.end('Not found'); return;
        }
        response.setHeader('Content-Type', mimeType(target));
        response.setHeader('Cache-Control', 'no-store');
        response.end(data);
      });
    };
    serve(0);
  });
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: http.Server | null): Promise<void> {
  return new Promise((resolve) => { if (!server) { resolve(); return; } server.close(() => resolve()); });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Installed before any page script: observers, stream/fetch hooks, user-timing marks. */
function pageInitScript(options: { countOps: boolean; countCallers: boolean }): void {
  const root = window as any;
  const P = root.__NETPERF = {
    loaf: [] as any[], longtasks: [] as any[], rafGaps: [] as any[], stream: [] as any[], fetches: [] as any[], marks: [] as any[],
    epoch: 0,
    ops: null as any,
    cloneCallers: null as Map<string, number> | null,
    watch: null as any,
    mark(name: string, extra?: any) {
      P.marks.push(Object.assign({ name, t: performance.now() }, extra || {}));
      try { performance.mark(`np:${name}`); } catch (_error) { /* ignore */ }
    }
  };
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.entryType === 'long-animation-frame') {
          P.loaf.push({ t: entry.startTime, dur: entry.duration, blocking: entry.blockingDuration });
        } else if (entry.entryType === 'longtask') {
          P.longtasks.push({ t: entry.startTime, dur: entry.duration });
        }
      }
    });
    observer.observe({ type: 'long-animation-frame', buffered: true } as any);
    observer.observe({ type: 'longtask', buffered: true } as any);
  } catch (error) { (P as any).observerError = String(error); }
  let last = performance.now();
  const tick = (now: number) => { const gap = now - last; if (gap > 34) P.rafGaps.push({ t: last, gap }); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  const recordStream = (entry: any) => { P.stream.push(entry); performance.mark('np:stream-arrive'); };
  const EventSourceProto = root.EventSource && root.EventSource.prototype;
  if (EventSourceProto) {
    const originalAdd = EventSourceProto.addEventListener;
    EventSourceProto.addEventListener = function (type: string, listener: any, opts: any) {
      const wrapped = function (this: any, event: any) {
        recordStream({ t: performance.now(), type, len: typeof event.data === 'string' ? event.data.length : 0, transport: 'sse', binary: false });
        return listener.call(this, event);
      };
      return originalAdd.call(this, type, wrapped, opts);
    };
    const descriptor = Object.getOwnPropertyDescriptor(EventSourceProto, 'onmessage');
    if (descriptor && descriptor.set) {
      Object.defineProperty(EventSourceProto, 'onmessage', {
        configurable: true, get: descriptor.get,
        set(handler: any) {
          descriptor.set!.call(this, function (this: any, event: any) {
            recordStream({ t: performance.now(), type: 'message', len: typeof event.data === 'string' ? event.data.length : 0, transport: 'sse', binary: false });
            return handler.call(this, event);
          });
        }
      });
    }
  }
  const WebSocketProto = root.WebSocket && root.WebSocket.prototype;
  if (WebSocketProto) {
    const record = (event: any) => {
      const data = event.data;
      recordStream({ t: performance.now(), type: 'ws', len: typeof data === 'string' ? data.length : ((data && data.byteLength) || 0), transport: 'ws', binary: typeof data !== 'string' });
    };
    const originalAdd = WebSocketProto.addEventListener;
    WebSocketProto.addEventListener = function (type: string, listener: any, opts: any) {
      if (type !== 'message') return originalAdd.call(this, type, listener, opts);
      const wrapped = function (this: any, event: any) { record(event); return listener.call(this, event); };
      return originalAdd.call(this, type, wrapped, opts);
    };
    const descriptor = Object.getOwnPropertyDescriptor(WebSocketProto, 'onmessage');
    if (descriptor && descriptor.set) {
      Object.defineProperty(WebSocketProto, 'onmessage', {
        configurable: true, get: descriptor.get,
        set(handler: any) { descriptor.set!.call(this, function (this: any, event: any) { record(event); return handler.call(this, event); }); }
      });
    }
  }
  if (options.countOps) {
    P.ops = { structuredClone: { n: 0, ms: 0 }, jsonParse: { n: 0, ms: 0, bytes: 0 }, jsonStringify: { n: 0, ms: 0, bytes: 0 } };
    P.cloneCallers = new Map();
    const originalClone = root.structuredClone;
    root.structuredClone = function (value: any, cloneOptions?: any) {
      const started = performance.now();
      try { return originalClone.call(root, value, cloneOptions); } finally {
        P.ops.structuredClone.n += 1;
        P.ops.structuredClone.ms += performance.now() - started;
        if (options.countCallers) {
          const stack = String(new Error().stack || '').split(String.fromCharCode(10)).slice(2, 7)
            .map((line) => line.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^)]*\)?/, '').trim()).join(' < ');
          P.cloneCallers!.set(stack, (P.cloneCallers!.get(stack) || 0) + 1);
        }
      }
    };
    const originalParse = JSON.parse;
    const originalStringify = JSON.stringify;
    JSON.parse = function (text: string, reviver?: any) {
      const started = performance.now();
      try { return originalParse.call(JSON, text, reviver); } finally {
        P.ops.jsonParse.n += 1; P.ops.jsonParse.ms += performance.now() - started; P.ops.jsonParse.bytes += typeof text === 'string' ? text.length : 0;
      }
    };
    JSON.stringify = function (value: any, replacer?: any, space?: any) {
      const started = performance.now();
      let output: any;
      try { output = originalStringify.call(JSON, value, replacer, space); return output; } finally {
        P.ops.jsonStringify.n += 1; P.ops.jsonStringify.ms += performance.now() - started; P.ops.jsonStringify.bytes += typeof output === 'string' ? output.length : 0;
      }
    } as any;
  }
  const originalFetch = root.fetch;
  root.fetch = function (input: any, init?: any) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/\/api\/match\//.test(url)) return originalFetch.apply(this, arguments as any);
    const pathOnly = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const record: any = { url: pathOnly, method: (init && init.method) || 'GET', start: performance.now(), end: null, bodyEnd: null, status: null, bytes: null };
    P.fetches.push(record);
    performance.mark(`np:fetch-start:${pathOnly}`);
    return originalFetch.apply(this, arguments as any).then((response: Response) => {
      record.end = performance.now();
      record.status = response.status;
      performance.mark(`np:fetch-headers:${pathOnly}`);
      const originalText = response.text.bind(response);
      response.text = () => originalText().then((text) => { record.bodyEnd = performance.now(); record.bytes = text.length; performance.mark(`np:fetch-body:${pathOnly}`); return text; });
      response.json = () => originalText().then((text) => {
        record.bodyEnd = performance.now(); record.bytes = text.length; performance.mark(`np:fetch-body:${pathOnly}`);
        const parsed = JSON.parse(text);
        if (parsed && parsed.ok === false) record.rejectedReason = parsed.rejectedReason || null;
        return parsed;
      });
      return response;
    });
  };
}

type Seat = {
  readonly label: SeatLabel;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly cdp: CDPSession;
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly wsUrls: string[];
};

async function openSeat(browser: Browser, label: SeatLabel, appUrl: string, args: CliArgs): Promise<Seat> {
  const context = await browser.newContext({
    viewport: args.mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    deviceScaleFactor: args.mobile ? 2 : 1,
    isMobile: args.mobile,
    hasTouch: args.mobile
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, '__BOARD_VISUAL_TEST__', { value: true, configurable: true, enumerable: false, writable: false });
  });
  await context.addInitScript(pageInitScript, { countOps: args.countOps, countCallers: args.countCallers });
  const page = await context.newPage();
  const seat: Seat = { label, context, page, cdp: await context.newCDPSession(page), consoleErrors: [], pageErrors: [], wsUrls: [] };
  page.on('console', (message) => { if (message.type() === 'error') seat.consoleErrors.push(message.text().slice(0, 300)); });
  page.on('pageerror', (error) => seat.pageErrors.push(String(error.message).slice(0, 300)));
  page.on('websocket', (socket) => {
    seat.wsUrls.push(socket.url().replace(/seatToken=[^&]+/, 'seatToken=…').replace(/spectatorToken=[^&]+/, 'spectatorToken=…'));
  });
  if (args.throttle > 1) await seat.cdp.send('Emulation.setCPUThrottlingRate', { rate: args.throttle });
  const entry = args.lane === 'classic' ? 'index.classic.html' : '';
  await page.goto(`${appUrl}/${entry}?debug=1&boardRenderer=pixi`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction((lane) => {
    const root = window as any;
    return !!root.NetworkMatchClient
      && (lane === 'classic' || document.documentElement.getAttribute('data-browser-boot-state') === 'ready')
      && typeof root.handleCellClick === 'function'
      && !!root.__boardVisualDebug
      && !!root.gameState;
  }, args.lane, { timeout: 60_000 });
  if (args.lane === 'classic') await sleep(2000);
  await page.evaluate(() => { const close = document.getElementById('maintenanceNoticeCloseBtn'); if (close) close.click(); });
  return seat;
}

async function enterNetworkMode(seat: Seat, serverUrl: string): Promise<void> {
  await seat.page.evaluate(async (url) => {
    const root = window as any;
    const matchMode = root.require('ui/handlers/match-mode');
    await matchMode.setMode('network', { skipReset: true, silentLog: true, suppressStatus: true });
    root.NetworkMatchClient.setServerUrl(url);
  }, serverUrl);
}

async function waitSettled(seat: Seat, timeout = 90_000): Promise<void> {
  await seat.page.waitForFunction(() => {
    const root = window as any;
    const playbackState = root.require('ui/playback-state-manager');
    const selectionFlow = root.require('game/card-effects/selection-flow');
    const playbackIdle = !playbackState || (
      (typeof playbackState.getPlaybackActive !== 'function' || playbackState.getPlaybackActive() !== true)
      && (typeof playbackState.hasPendingVisualPlayback !== 'function' || playbackState.hasPendingVisualPlayback(root.cardState) !== true)
    );
    const selectionIdle = !selectionFlow || typeof selectionFlow.isSelectionSettlementLocked !== 'function' || selectionFlow.isSelectionSettlementLocked() !== true;
    return playbackIdle && selectionIdle && root.isProcessing !== true;
  }, null, { timeout });
  await seat.page.evaluate(async () => { const root = window as any; if (root.__boardVisualDebug && root.__boardVisualDebug.waitForIdle) await root.__boardVisualDebug.waitForIdle(); });
}

async function resetCounters(seat: Seat): Promise<void> {
  await seat.page.evaluate(() => {
    const P = (window as any).__NETPERF;
    P.loaf = []; P.longtasks = []; P.rafGaps = []; P.stream = []; P.fetches = []; P.marks = []; P.epoch = performance.now();
    if (P.ops) P.ops = { structuredClone: { n: 0, ms: 0 }, jsonParse: { n: 0, ms: 0, bytes: 0 }, jsonStringify: { n: 0, ms: 0, bytes: 0 } };
    if (P.cloneCallers) P.cloneCallers = new Map();
  });
}

/** RAF watcher for playback / version transitions. Uses the cheap `getStateVersion()` accessor; `getState()` (which clones) is only a fallback polled every 6th frame. */
async function armWatcher(seat: Seat): Promise<void> {
  await seat.page.evaluate(() => {
    const root = window as any;
    const P = root.__NETPERF;
    const playbackState = root.require('ui/playback-state-manager');
    const client = root.NetworkMatchClient;
    let pollTick = 0;
    let lastVersion: number | null = null;
    const readVersion = () => {
      if (typeof client.getStateVersion === 'function') return client.getStateVersion();
      if (lastVersion === null || (pollTick++ % 6) === 0) lastVersion = client.getState().stateVersion;
      return lastVersion;
    };
    let active = false;
    let version = readVersion();
    P.watch = { playbackStart: null, playbackIdle: null, versionChange: null, done: false };
    const poll = () => {
      if (P.watch.done) return;
      const now = performance.now();
      const isActive = playbackState.getPlaybackActive() === true || playbackState.hasPendingVisualPlayback(root.cardState) === true;
      if (isActive && !active) { active = true; if (P.watch.playbackStart === null) { P.watch.playbackStart = now; performance.mark('np:playback-start'); } }
      if (!isActive && active) { active = false; P.watch.playbackIdle = now; performance.mark('np:playback-idle'); }
      const next = readVersion();
      if (next !== version) { version = next; if (P.watch.versionChange === null) { P.watch.versionChange = now; performance.mark('np:version-change'); } }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

async function firstLegalMove(seat: Seat): Promise<MoveSample['move'] | null> {
  return seat.page.evaluate(() => {
    const root = window as any;
    const gameState = root.gameState;
    const cardState = root.cardState;
    const playerValue = Number(gameState.currentPlayer);
    const playerKey = playerValue === -1 ? 'white' : 'black';
    const moveGenerator = root.require('game/move-generator');
    const pending = cardState && cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey] || null;
    const moves = moveGenerator.generateMovesForPlayerInState(gameState, cardState, playerValue, pending, [], []);
    const move = moves && moves[0];
    if (!move) return null;
    return {
      row: Number(move.row), col: Number(move.col), playerKey, legalCount: moves.length,
      turnNumber: Number(gameState.turnNumber), stateVersion: Number(root.NetworkMatchClient.getState().stateVersion)
    };
  });
}

let activeTrace: { session: CDPSession; events: any[] } | null = null;

async function startBrowserTrace(browser: Browser, seats: readonly Seat[]): Promise<void> {
  const session = await browser.newBrowserCDPSession();
  const trace = { session, events: [] as any[] };
  activeTrace = trace;
  // Chunks keep arriving while `Tracing.end` is pending, so push into the captured object.
  session.on('Tracing.dataCollected', (event: any) => { trace.events.push(...event.value); });
  await session.send('Tracing.start', { categories: TRACE_CATEGORIES, transferMode: 'ReportEvents' });
  for (const seat of seats) await seat.page.evaluate((label) => performance.mark(`np:seat:${label}`), seat.label);
}

async function stopBrowserTrace(): Promise<{ byPid: Map<number, any[]>; seatPid: Map<string, number> }> {
  const trace = activeTrace!;
  activeTrace = null;
  await new Promise<void>((resolve) => { trace.session.once('Tracing.tracingComplete', () => resolve()); void trace.session.send('Tracing.end'); });
  await trace.session.detach();
  const byPid = new Map<number, any[]>();
  const seatPid = new Map<string, number>();
  for (const event of trace.events) {
    if (!byPid.has(event.pid)) byPid.set(event.pid, []);
    byPid.get(event.pid)!.push(event);
    if (event.ph !== 'M' && String(event.name).startsWith('np:seat:')) seatPid.set(String(event.name).slice(8), event.pid);
  }
  return { byPid, seatPid };
}

type MeasureOptions = { trace: boolean; traceTag: string; browser: Browser; outputDir: string; keepTraces: boolean; scenarioId: ScenarioId; index: number; phase: string };

async function measureMove(seats: readonly Seat[], actor: Seat, options: MeasureOptions): Promise<MoveSample> {
  for (const seat of seats) await waitSettled(seat);
  const move = await firstLegalMove(actor);
  if (!move) throw new Error(`${actor.label}: no legal move`);
  for (const seat of seats) { await resetCounters(seat); await armWatcher(seat); }
  if (options.trace) await startBrowserTrace(options.browser, seats);
  await sleep(50);
  const click = await actor.page.evaluate(({ row, col }) => {
    const root = window as any;
    const P = root.__NETPERF;
    const started = performance.now();
    P.mark('click', { row, col });
    root.handleCellClick(row, col);
    P.mark('click-return');
    return { syncMs: performance.now() - started };
  }, move);
  try {
    for (const seat of seats) {
      await seat.page.waitForFunction((version) => (window as any).NetworkMatchClient.getState().stateVersion > version, move.stateVersion, { timeout: 60_000, polling: 100 });
    }
  } catch (error) {
    const diagnostics = await Promise.all(seats.map((seat) => seat.page.evaluate(() => {
      const root = window as any; const P = root.__NETPERF; const state = root.NetworkMatchClient.getState();
      return { seat: state.seatKey, version: state.stateVersion, currentPlayer: root.gameState.currentPlayer, fetches: P.fetches.map((entry: any) => ({ url: entry.url, status: entry.status, reason: entry.rejectedReason || null })) };
    })));
    throw new Error(`move did not publish: ${JSON.stringify({ move, diagnostics })} (${(error as Error).message})`);
  }
  for (const seat of seats) await waitSettled(seat);
  await sleep(150);
  const traced = options.trace ? await stopBrowserTrace() : null;
  const seatsOut: Record<string, SeatSample> = {};
  for (const seat of seats) {
    const watch = await seat.page.evaluate(() => { const P = (window as any).__NETPERF; P.watch.done = true; return P.watch; });
    const counters = await seat.page.evaluate(() => {
      const root = window as any; const P = root.__NETPERF; const state = root.NetworkMatchClient.getState();
      return {
        epoch: P.epoch, loaf: P.loaf, longtasks: P.longtasks, rafGaps: P.rafGaps, stream: P.stream, fetches: P.fetches, marks: P.marks,
        ops: P.ops ? JSON.parse(JSON.stringify(P.ops)) : null,
        cloneCallers: P.cloneCallers ? Array.from(P.cloneCallers.entries()).sort((a: any, b: any) => b[1] - a[1]).slice(0, 30) : null,
        stateVersion: state.stateVersion
      };
    });
    const isActor = seat === actor;
    const clickMark = counters.marks.find((mark: any) => mark.name === 'click');
    const firstStream = counters.stream.find((entry: any) => entry.t >= counters.epoch);
    const base = isActor && clickMark ? clickMark.t : (firstStream ? firstStream.t : counters.epoch);
    const rel = (value: number | null | undefined): number | null => (value === null || value === undefined ? null : roundMs(value - base));
    const publish = counters.fetches.find((entry: any) => /\/api\/match\/publish/.test(entry.url)) || null;
    const stateFetches = counters.fetches.filter((entry: any) => /\/api\/match\/state/.test(entry.url)).length;
    const loaf = counters.loaf.filter((entry: any) => entry.t >= base - 5);
    let trace: TraceSummary | null = null;
    if (traced) {
      const pid = traced.seatPid.get(seat.label);
      const events = pid !== undefined ? (traced.byPid.get(pid) || []) : [];
      trace = summarizeTraceEvents(events, { minTaskMs: LONG_TASK_MIN_MS });
      if (options.keepTraces) {
        const traceFile = path.join(options.outputDir, `trace-${options.traceTag}-${seat.label}.json`);
        fs.mkdirSync(options.outputDir, { recursive: true });
        fs.writeFileSync(traceFile, JSON.stringify({ traceEvents: events }));
        trace = Object.freeze({ ...trace, file: path.relative(process.cwd(), traceFile) });
      }
    }
    seatsOut[seat.label] = Object.freeze({
      role: isActor ? 'actor' : (seat.label === 'spectator' ? 'spectator' : 'opponent'),
      stateVersionAfter: Number.isFinite(Number(counters.stateVersion)) ? Number(counters.stateVersion) : null,
      timeline: Object.freeze({
        click: isActor ? rel(clickMark && clickMark.t) : null,
        clickReturn: isActor ? rel(counters.marks.find((mark: any) => mark.name === 'click-return')?.t) : null,
        publishFetchStart: publish ? rel(publish.start) : null,
        publishHeaders: publish ? rel(publish.end) : null,
        publishBody: publish ? rel(publish.bodyEnd) : null,
        publishBytes: publish ? publish.bytes : null,
        publishStatus: publish ? publish.status : null,
        streamArrive: firstStream ? rel(firstStream.t) : null,
        streamBytes: firstStream ? Number(firstStream.len) : null,
        streamBinary: firstStream ? firstStream.binary === true : null,
        streamTransport: firstStream ? String(firstStream.transport) : null,
        versionChange: rel(watch.versionChange),
        playbackStart: rel(watch.playbackStart),
        playbackIdle: rel(watch.playbackIdle),
        stateFetches
      }),
      longTasks: counters.longtasks.filter((entry: any) => entry.t >= base - 5).map((entry: any) => ({ at: roundMs(entry.t - base), dur: roundMs(entry.dur) })),
      loaf: Object.freeze({
        count: loaf.length,
        blockingTotalMs: roundMs(loaf.reduce((total: number, entry: any) => total + (Number(entry.blocking) || 0), 0)),
        longestMs: loaf.length ? roundMs(Math.max(...loaf.map((entry: any) => Number(entry.dur) || 0))) : null
      }),
      rafGaps: counters.rafGaps.filter((entry: any) => entry.t >= base - 5).map((entry: any) => ({ at: roundMs(entry.t - base), gap: roundMs(entry.gap) })),
      ops: counters.ops,
      cloneCallers: counters.cloneCallers as readonly [string, number][] | null,
      trace,
      consoleErrors: seat.consoleErrors.splice(0),
      pageErrors: seat.pageErrors.splice(0)
    });
  }
  return Object.freeze({
    schemaVersion: SAMPLE_SCHEMA_VERSION,
    scenarioId: options.scenarioId,
    index: options.index,
    phase: options.phase,
    actor: actor.label,
    move,
    clickSyncMs: roundMs(click.syncMs),
    seats: seatsOut as Record<SeatLabel, SeatSample>
  });
}

function installFixtureRoom(localServer: any, MatchAuthority: any, deepClone: any, roomId: string, fixtureId: NetworkSpecialStoneFixtureId): void {
  const fixture = createNetworkSpecialStonePerformanceFixture(fixtureId);
  const patched = localServer.patchRoomSnapshotForTests(roomId, (room: any) => {
    const snapshot = deepClone(fixture.snapshot);
    // The fixture is the state right before black's turn start. White moves first so that black's
    // turn-start effects (bombs, dragons, mobile stones) play inside white's accepted command.
    snapshot.gameState.currentPlayer = -1;
    snapshot.cardState.lastTurnStartedFor = 'white';
    const version = Number(room.stateVersion || 0) + 1;
    const now = Date.now();
    snapshot.stateVersion = version;
    snapshot.updatedAt = now;
    room.snapshot = snapshot;
    room.stateVersion = version;
    room.updatedAt = now;
    room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(snapshot);
    room.lastAcceptedOperationBySeat = { black: null, white: null };
    room.acceptedOperationHistoryBySeat = { black: [], white: [] };
    room.roomBoardConfig = snapshot.gameState.boardConfig || room.roomBoardConfig || null;
    room.lastPlaybackEventsBySeat = { black: [], white: [] };
    room.playbackHistoryByVersion = {};
    if (Array.isArray(room.presentationJournal)) room.presentationJournal = [];
    if (Array.isArray(room.sseEventBuffer)) room.sseEventBuffer = [];
  });
  if (!patched) throw new Error(`failed to install fixture ${fixtureId} into room ${roomId}`);
}

function logMove(sample: MoveSample): void {
  const actor = sample.seats[sample.actor];
  const metrics = deriveSeatMetrics(actor);
  const opponentLabel = sample.actor === 'black' ? 'white' : 'black';
  const opponent = deriveSeatMetrics(sample.seats[opponentLabel]);
  const spectator = deriveSeatMetrics(sample.seats.spectator);
  const f = (value: number | null): string => (value === null ? '-' : String(Math.round(value)));
  process.stdout.write(`[perf] ${sample.scenarioId} #${sample.index} ${sample.phase} ${sample.actor}: click ${f(metrics.clickTaskMs)} pub ${f(metrics.clickToPublishMs)}→rtt ${f(metrics.publishRoundTripMs)} arrival ${f(metrics.arrivalTaskMs)} settle ${f(metrics.settlementTaskMs)} playback ${f(metrics.playbackMs)} loaf ${f(metrics.loafBlockingTotalMs)} | ${opponentLabel}: arrival ${f(opponent.arrivalTaskMs)} settle ${f(opponent.settlementTaskMs)} loaf ${f(opponent.loafBlockingTotalMs)} | spectator: arrival ${f(spectator.arrivalTaskMs)} settle ${f(spectator.settlementTaskMs)} loaf ${f(spectator.loafBlockingTotalMs)}\n`);
}

export async function runCapture(args: CliArgs): Promise<FreezeReport> {
  const rootDir = process.cwd();
  const outputPath = path.resolve(rootDir, args.outputPath);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  const LocalMatchServer = require(path.join(rootDir, 'dist', 'scripts', 'local-match-server.js'));
  const MatchAuthority = require(path.join(rootDir, 'dist', 'utils', 'match-authority.js'));
  const deepClone = require(path.join(rootDir, 'dist', 'utils', 'deepClone.js'));
  const appServer = createStaticServer(rootDir, args.appRoot ? path.resolve(rootDir, args.appRoot) : null);
  const appUrl = await listen(appServer);
  let matchServer: http.Server | null = null;
  let matchUrl = args.server;
  if (args.server === 'local') {
    LocalMatchServer.resetRoomsForTests();
    matchServer = LocalMatchServer.createLocalMatchServer();
    matchUrl = await listen(matchServer!);
  }
  const browser = await chromium.launch({ headless: !args.headed, args: process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=d3d11'] : [] });
  const seats: Seat[] = [];
  const samplesByScenario: Record<string, MoveSample[]> = {};
  let capture: Record<string, unknown> = {};
  try {
    const systemSession = await browser.newBrowserCDPSession();
    const systemInfo: any = await systemSession.send('SystemInfo.getInfo');
    await systemSession.detach();
    capture = {
      lane: args.lane, mobile: args.mobile, throttle: args.throttle, server: args.server, trace: args.trace, countOps: args.countOps,
      chromium: browser.version(),
      glRenderer: systemInfo.gpu && systemInfo.gpu.auxAttributes && systemInfo.gpu.auxAttributes.glRenderer,
      gpuCompositing: systemInfo.gpu && systemInfo.gpu.featureStatus && systemInfo.gpu.featureStatus.gpu_compositing,
      webgl: systemInfo.gpu && systemInfo.gpu.featureStatus && systemInfo.gpu.featureStatus.webgl,
      commit: safeGitHead(rootDir),
      appRoot: args.appRoot,
      appUrl, matchUrl
    };
    process.stdout.write(`[perf] app=${appUrl} match=${matchUrl} label=${args.label} gpu=${String(capture.glRenderer)}\n`);
    for (const label of SEAT_LABELS) seats.push(await openSeat(browser, label, appUrl, args));
    const [black, white, spectator] = seats;
    for (const seat of seats) await enterNetworkMode(seat, matchUrl);
    const created = await black.page.evaluate((url) => (window as any).NetworkMatchClient.createRoom({ serverUrl: url, playerName: 'Black', networkDebugEnabled: false }), matchUrl);
    if (!created || created.ok !== true) throw new Error(`create room failed: ${JSON.stringify(created)}`);
    const roomId = String(created.roomId);
    const joined = await white.page.evaluate(({ url, id }) => (window as any).NetworkMatchClient.joinRoom(id, { serverUrl: url, playerName: 'White' }), { url: matchUrl, id: roomId });
    if (!joined || joined.ok !== true) throw new Error(`join room failed: ${JSON.stringify(joined)}`);
    const spectating = await spectator.page.evaluate(({ url, id }) => (window as any).NetworkMatchClient.spectateRoom(id, { serverUrl: url, playerName: 'Spec' }), { url: matchUrl, id: roomId });
    if (!spectating || spectating.ok !== true) throw new Error(`spectate failed: ${JSON.stringify(spectating)}`);
    await sleep(500);
    for (const seat of seats) await seat.page.evaluate(async () => { await (window as any).NetworkMatchClient.syncLatestState(); });
    await sleep(500);
    capture = { ...capture, roomId, wsUrls: Object.fromEntries(seats.map((seat) => [seat.label, seat.wsUrls.slice()])) };

    for (const scenarioId of args.scenarios) {
      const samples: MoveSample[] = [];
      const measure = (actor: Seat, index: number, phase: string, traceTag: string) => measureMove(seats, actor, {
        trace: args.trace, traceTag, browser, outputDir, keepTraces: args.keepTraces, scenarioId, index, phase
      });
      if (scenarioId === 'opening') {
        for (let index = 0; index < args.openingMoves; index += 1) {
          const currentPlayer = await black.page.evaluate(() => (window as any).gameState.currentPlayer);
          const actor = currentPlayer === -1 ? white : black;
          const sample = await measure(actor, index, 'opening-move', `${args.label}-opening-${index}`);
          samples.push(sample);
          logMove(sample);
        }
      } else {
        if (args.server !== 'local') throw new Error(`fixture scenario ${scenarioId} requires --server local`);
        for (let index = 0; index < args.iterations; index += 1) {
          installFixtureRoom(LocalMatchServer, MatchAuthority, deepClone, roomId, scenarioId as NetworkSpecialStoneFixtureId);
          for (const seat of seats) await seat.page.evaluate(async () => { await (window as any).NetworkMatchClient.syncLatestState(); });
          for (const seat of seats) await waitSettled(seat);
          await sleep(300);
          const first = await measure(white, index, 'white-move-triggers-black-turn-start', `${args.label}-${scenarioId}-${index}-white`);
          samples.push(first);
          logMove(first);
          const nowPlayer = await black.page.evaluate(() => (window as any).gameState.currentPlayer);
          if (nowPlayer === 1) {
            const second = await measure(black, index, 'black-reply', `${args.label}-${scenarioId}-${index}-black`);
            samples.push(second);
            logMove(second);
          }
        }
      }
      samplesByScenario[scenarioId] = samples;
      const partial = buildReport(args.label, capture, samplesByScenario);
      fs.writeFileSync(outputPath, `${JSON.stringify(partial, null, 1)}\n`, 'utf8');
    }
  } finally {
    for (const seat of seats) {
      try { await seat.page.evaluate(() => { const client = (window as any).NetworkMatchClient; return client && client.leaveRoom ? client.leaveRoom() : null; }); } catch (_error) { /* cleanup only */ }
    }
    await browser.close();
    await closeServer(matchServer);
    await closeServer(appServer);
  }
  const report = buildReport(args.label, capture, samplesByScenario);
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 1)}\n`, 'utf8');
  const markdownPath = outputPath.replace(/\.json$/, '.md');
  fs.writeFileSync(markdownPath, renderMarkdown(report), 'utf8');
  process.stdout.write(`[perf] wrote ${path.relative(rootDir, outputPath)} and ${path.relative(rootDir, markdownPath)}\n`);
  return report;
}

function safeGitHead(rootDir: string): string | null {
  try {
    return require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (_error) {
    return null;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const compareIndex = argv.indexOf('--compare');
  if (compareIndex >= 0) {
    const baselinePath = argv[compareIndex + 1];
    const candidatePath = argv[argv.indexOf('--candidate') + 1];
    if (!baselinePath || !candidatePath || argv.indexOf('--candidate') < 0) throw new Error('--compare <baseline.json> --candidate <candidate.json> [--output report.md]');
    const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'));
    const candidate = JSON.parse(fs.readFileSync(path.resolve(candidatePath), 'utf8'));
    const markdown = renderComparisonMarkdown(compareReports(baseline, candidate));
    const outputIndex = argv.indexOf('--output');
    if (outputIndex >= 0) {
      const outputPath = path.resolve(argv[outputIndex + 1]);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown, 'utf8');
      process.stdout.write(`[perf] wrote ${path.relative(process.cwd(), outputPath)}\n`);
    } else {
      process.stdout.write(markdown);
    }
    return;
  }
  await runCapture(parseArgs(argv));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
