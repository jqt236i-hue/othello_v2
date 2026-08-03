/**
 * @file perf-benchmarks.ts
 * @description Debug-only performance benchmark helpers (PR1 instrumentation).
 *
 * Activated ONLY when one of the following is set at module load:
 *   - window.__DEV_PERF__ === true
 *   - URL query string contains `?perf=1`
 *
 * Normal play path: every function early-returns after the boolean check,
 * so OFF has zero performance API calls (and zero string formatting cost).
 *
 * API:
 *   - isPerfBenchEnabled() => boolean
 *   - perfStart(name)       Mark `othello:<name>:start`
 *   - perfEnd(name)         Mark `othello:<name>:end`, measure `othello:<name>:measure`,
 *                           then clearMarks for both start/end (measure is kept).
 *
 * NOTE: Initialization reads __DEV_PERF__ / ?perf=1 once at module load.
 *       Reload the page after toggling window.__DEV_PERF__. PR1 is reload-scoped.
 */

const PERF_BENCH_ENABLED = ((): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__DEV_PERF__ === true) return true;
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('perf') === '1';
    } catch (e: any) {
        return false;
    }
})();

const PERF_NAMESPACE = 'othello';
const CPU_TURN_FRAME_STALL_SAMPLE_SCHEMA_VERSION = 'cpu_turn_frame_stall_sample.v1';
const CPU_TURN_PERFORMANCE_SCENARIO_IDS = Object.freeze([
    'lv1-empty-or-unusable-hand-place-8x8',
    'lv1-usable-card-then-place-8x8',
    'lv1-multi-target-card-playback-8x8',
    'lv6-worker-backed-place-8x8',
    'pixi-high-refresh-playback-8x8'
] as const);
const CPU_TURN_PERFORMANCE_SCENARIO_ID_SET = new Set<string>(CPU_TURN_PERFORMANCE_SCENARIO_IDS);

type CpuTurnPerformanceEntry = Readonly<{
    correlationId: string;
    runId: number | null;
    stage: string;
    kind: 'sync' | 'wait';
    startMs: number;
    endMs: number;
    durationMs: number;
    playerKey: 'black' | 'white';
    level: number | null;
    outcome: 'continue' | 'handled' | 'stale' | 'error';
}>;

type BrowserTimingEntry = Readonly<{
    entryType: 'longtask' | 'long-animation-frame';
    startMs: number;
    endMs: number;
    durationMs: number;
}>;

type CpuTurnPerformanceCapture = {
    scenarioId: string | null;
    metadata: Readonly<Record<string, unknown>>;
    stageEntries: CpuTurnPerformanceEntry[];
    longTasks: BrowserTimingEntry[];
    longAnimationFrames: BrowserTimingEntry[];
    rafIntervalsMs: number[];
    startedAtMs: number | null;
    endedAtMs: number | null;
    visibilityValid: boolean;
    focusValid: boolean;
    pixiDiagnosticsBefore: Readonly<Record<string, unknown>> | null;
    pixiDiagnosticsAfter: Readonly<Record<string, unknown>> | null;
    invalidEntryCount: number;
    invalidReasons: string[];
    overflow: boolean;
    runtimeEvidence: {
        workerCandidateScoringRequestCount: number;
        workerCardQuiescenceRequestCount: number;
    };
};

type CpuTurnPerformanceHarness = Readonly<{
    schemaVersion: typeof CPU_TURN_FRAME_STALL_SAMPLE_SCHEMA_VERSION;
    capabilities: Readonly<{
        longTask: 'supported' | 'unsupported';
        longAnimationFrame: 'supported' | 'unsupported';
        raf: 'supported' | 'unsupported';
    }>;
    beginScenario: (scenarioId: string, options?: Readonly<Record<string, unknown>>) => boolean;
    endScenario: (options?: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>;
    snapshot: () => Readonly<Record<string, unknown>>;
    reset: () => void;
    createCorrelationId: () => string;
    recordCpuTurnStage: (entry: CpuTurnPerformanceEntry) => void;
    recordRuntimeEvidence: (name: 'worker-candidate-scoring' | 'worker-card-quiescence') => void;
}>;

const CPU_TURN_PERFORMANCE_ENTRY_LIMIT = 20_000;
let cpuTurnPerformanceHarness: CpuTurnPerformanceHarness | null = null;
let cpuTurnPerformanceSequence = 0;

function readPerformanceNowMs(): number {
    if (typeof performance === 'undefined' || typeof performance.now !== 'function') return Number.NaN;
    const value = Number(performance.now());
    return Number.isFinite(value) ? Math.max(0, value) : Number.NaN;
}

function readClockDomain(): Readonly<Record<string, unknown>> {
    const hasPerformanceNow = typeof performance !== 'undefined'
        && typeof performance.now === 'function'
        && Number.isFinite(readPerformanceNowMs());
    const timeOrigin = typeof performance !== 'undefined' && Number.isFinite(Number(performance.timeOrigin))
        ? Number(performance.timeOrigin)
        : null;
    return Object.freeze({
        stageClock: 'performance.now',
        observerClock: 'performance-timeline',
        rafClock: 'document-timeline',
        timeOrigin,
        compatible: hasPerformanceNow && timeOrigin !== null
    });
}

function createEmptyCpuTurnCapture(): CpuTurnPerformanceCapture {
    return {
        scenarioId: null,
        metadata: Object.freeze({}),
        stageEntries: [],
        longTasks: [],
        longAnimationFrames: [],
        rafIntervalsMs: [],
        startedAtMs: null,
        endedAtMs: null,
        visibilityValid: true,
        focusValid: true,
        pixiDiagnosticsBefore: null,
        pixiDiagnosticsAfter: null,
        invalidEntryCount: 0,
        invalidReasons: [],
        overflow: false,
        runtimeEvidence: {
            workerCandidateScoringRequestCount: 0,
            workerCardQuiescenceRequestCount: 0
        }
    };
}

function supportedPerformanceEntryTypes(): Set<string> {
    try {
        const ctor = typeof PerformanceObserver !== 'undefined' ? PerformanceObserver : null;
        return new Set(Array.isArray(ctor && (ctor as any).supportedEntryTypes)
            ? (ctor as any).supportedEntryTypes.map((value: unknown) => String(value))
            : []);
    } catch (_error) {
        return new Set();
    }
}

function sanitizeCpuTurnPerformanceEntry(value: any): CpuTurnPerformanceEntry | null {
    if (!value || typeof value !== 'object') return null;
    const correlationId = String(value.correlationId || '').trim();
    const stage = String(value.stage || '').trim();
    const startMs = Number(value.startMs);
    const endMs = Number(value.endMs);
    const durationMs = Number(value.durationMs);
    const fixedStage = [
        'handoff-delay',
        'card-availability',
        'card-context-base',
        'card-quiescence',
        'move-candidates',
        'commentary-context',
        'canonical-commit',
        'presentation-handoff'
    ].includes(stage) || /^card-context-feature:[a-z0-9][a-z0-9-]*$/i.test(stage);
    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(correlationId)
        || !fixedStage
        || !Number.isFinite(startMs)
        || !Number.isFinite(endMs)
        || !Number.isFinite(durationMs)
    ) {
        return null;
    }
    if (value.kind !== 'sync' && value.kind !== 'wait') return null;
    if (!['continue', 'handled', 'stale', 'error'].includes(value.outcome)) return null;
    if (value.playerKey !== 'black' && value.playerKey !== 'white') return null;
    const runIdValue = Number(value.runId);
    const levelValue = Number(value.level);
    const safeStartMs = Math.max(0, startMs);
    const safeEndMs = Math.max(safeStartMs, endMs);
    const computedDurationMs = safeEndMs - safeStartMs;
    if (Math.abs(computedDurationMs - durationMs) > 0.01) return null;
    const runId = value.runId === null ? null : (Number.isSafeInteger(runIdValue) && runIdValue >= 0 ? runIdValue : null);
    const level = value.level === null ? null : (Number.isFinite(levelValue) ? Math.max(1, Math.trunc(levelValue)) : null);
    if (stage !== 'handoff-delay' && (runId === null || level === null)) return null;
    if (stage === 'handoff-delay' && (value.kind !== 'wait' || runId !== null)) return null;
    return Object.freeze({
        correlationId,
        runId,
        stage,
        kind: value.kind,
        startMs: safeStartMs,
        endMs: safeEndMs,
        durationMs: computedDurationMs,
        playerKey: value.playerKey,
        level,
        outcome: value.outcome
    });
}

function sanitizeDiagnostics(value: unknown): Readonly<Record<string, unknown>> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as any;
    const projections: ReadonlyArray<readonly [string, unknown]> = [
        ['prepareCount', source.prepareCount],
        ['applyRequestCount', source.applyRequestCount],
        ['committedApplyCount', source.committedApplyCount],
        ['stalePrepareCount', source.stalePrepareCount],
        ['restoreCount', source.restoreCount],
        ['resizeRenderCount', source.resizeRenderCount],
        ['playPhaseCount', source.playPhaseCount],
        ['renderCount', source.application?.renderCount],
        ['resizeCount', source.application?.resizeCount],
        ['tickerListenerCount', source.application?.tickerListenerCount],
        ['tickerRunning', source.application?.tickerRunning],
        ['sceneApplyCount', source.scene?.applyCount],
        ['sceneUpdatedViewCount', source.scene?.cumulativeUpdatedViewCount],
        ['sceneUpdatedCellViewCount', source.scene?.cumulativeUpdatedCellViewCount],
        ['sceneUpdatedStoneViewCount', source.scene?.cumulativeUpdatedStoneViewCount],
        ['sceneUpdatedHintViewCount', source.scene?.cumulativeUpdatedHintViewCount],
        ['sceneHintPaintCount', source.scene?.cumulativeHintPaintCount],
        ['sceneHintInputSyncCount', source.scene?.cumulativeHintInputSyncCount],
        ['sceneSkippedViewCount', source.scene?.cumulativeSkippedViewCount],
        ['sceneReleasedViewCount', source.scene?.cumulativeReleasedViewCount],
        ['sceneStaticBakeCount', source.scene?.staticBakeCount],
        ['timelineStartedRunCount', source.timeline?.startedRunCount],
        ['timelineCompletedRunCount', source.timeline?.completedRunCount],
        ['timelineFailedRunCount', source.timeline?.failedRunCount],
        ['timelineAbortedRunCount', source.timeline?.abortedRunCount],
        ['timelineTickerStartCount', source.timeline?.tickerStartCount],
        ['timelineTickerStopCount', source.timeline?.tickerStopCount],
        ['timelineActiveRunCount', source.timeline?.activeRunCount]
    ];
    const output: Record<string, unknown> = {};
    for (const [key, raw] of projections) {
        if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
        else if (typeof raw === 'boolean') output[key] = raw;
    }
    return Object.freeze(output);
}

function sanitizeScenarioMetadata(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const allowedKeys = new Set([
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
        'emulationValidated'
    ]);
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value || {})) {
        if (!allowedKeys.has(key)) continue;
        if (typeof raw === 'number' && Number.isFinite(raw)) output[key] = raw;
        else if (typeof raw === 'boolean') output[key] = raw;
        else if (typeof raw === 'string' && raw.length <= 128) output[key] = raw;
    }
    return Object.freeze(output);
}

function freezeCpuTurnCaptureSnapshot(capture: CpuTurnPerformanceCapture): Readonly<Record<string, unknown>> {
    return Object.freeze({
        schemaVersion: CPU_TURN_FRAME_STALL_SAMPLE_SCHEMA_VERSION,
        scenarioId: capture.scenarioId,
        metadata: capture.metadata,
        stageEntries: Object.freeze(capture.stageEntries.slice()),
        longTasks: Object.freeze(capture.longTasks.slice()),
        longAnimationFrames: Object.freeze(capture.longAnimationFrames.slice()),
        rafIntervalsMs: Object.freeze(capture.rafIntervalsMs.slice()),
        startedAtMs: capture.startedAtMs,
        endedAtMs: capture.endedAtMs,
        visibilityValid: capture.visibilityValid,
        focusValid: capture.focusValid,
        pixiDiagnosticsBefore: capture.pixiDiagnosticsBefore,
        pixiDiagnosticsAfter: capture.pixiDiagnosticsAfter,
        invalidEntryCount: capture.invalidEntryCount,
        invalidReasons: Object.freeze(capture.invalidReasons.slice()),
        overflow: capture.overflow,
        runtimeEvidence: Object.freeze({ ...capture.runtimeEvidence }),
        clockDomain: readClockDomain()
    });
}

function readDocumentVisible(): boolean {
    try {
        return typeof document === 'undefined' || document.visibilityState === 'visible';
    } catch (_error) {
        return false;
    }
}

function readDocumentFocused(): boolean {
    try {
        return typeof document === 'undefined' || typeof document.hasFocus !== 'function' || document.hasFocus();
    } catch (_error) {
        return false;
    }
}

function installCpuTurnPerformanceHarness(): CpuTurnPerformanceHarness | null {
    if (!PERF_BENCH_ENABLED || typeof window === 'undefined') return null;
    if (cpuTurnPerformanceHarness) return cpuTurnPerformanceHarness;

    let capture = createEmptyCpuTurnCapture();
    let lastRafTimestamp: number | null = null;
    const supportedEntryTypes = supportedPerformanceEntryTypes();
    let longTaskSupported = false;
    let longAnimationFrameSupported = false;

    const invalidateActiveCapture = (reason: string): void => {
        if (!capture.scenarioId || capture.startedAtMs === null || capture.endedAtMs !== null) return;
        if (reason === 'visibility-changed') capture.visibilityValid = false;
        if (reason === 'focus-changed') capture.focusValid = false;
        if (capture.invalidReasons.length < 20 && !capture.invalidReasons.includes(reason)) {
            capture.invalidReasons.push(reason);
        }
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (!readDocumentVisible()) invalidateActiveCapture('visibility-changed');
        });
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('blur', () => invalidateActiveCapture('focus-changed'));
    }

    const appendBrowserTimingEntry = (entryType: 'longtask' | 'long-animation-frame', entry: PerformanceEntry): void => {
        if (!capture.scenarioId || capture.startedAtMs === null) return;
        const startMs = Number(entry.startTime);
        const durationMs = Number(entry.duration);
        if (!Number.isFinite(startMs) || !Number.isFinite(durationMs)) return;
        const endMs = startMs + Math.max(0, durationMs);
        if (endMs <= capture.startedAtMs) return;
        if (capture.endedAtMs !== null && startMs >= capture.endedAtMs) return;
        const target = entryType === 'longtask' ? capture.longTasks : capture.longAnimationFrames;
        if (target.length >= CPU_TURN_PERFORMANCE_ENTRY_LIMIT) {
            capture.overflow = true;
            return;
        }
        target.push(Object.freeze({
            entryType,
            startMs: Math.max(0, startMs),
            endMs: Math.max(0, endMs),
            durationMs: Math.max(0, durationMs)
        }));
    };

    const observers: Array<Readonly<{
        observer: PerformanceObserver;
        entryType: 'longtask' | 'long-animation-frame';
    }>> = [];
    if (typeof PerformanceObserver !== 'undefined') {
        for (const entryType of ['longtask', 'long-animation-frame'] as const) {
            if (!supportedEntryTypes.has(entryType)) continue;
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => appendBrowserTimingEntry(entryType, entry));
                });
                observer.observe({ type: entryType, buffered: true } as PerformanceObserverInit);
                observers.push(Object.freeze({ observer, entryType }));
                if (entryType === 'longtask') longTaskSupported = true;
                else longAnimationFrameSupported = true;
            } catch (_error) { /* capability remains diagnostic-only */ }
        }
    }
    const capabilities = Object.freeze({
        longTask: longTaskSupported ? 'supported' as const : 'unsupported' as const,
        longAnimationFrame: longAnimationFrameSupported ? 'supported' as const : 'unsupported' as const,
        raf: typeof requestAnimationFrame === 'function' ? 'supported' as const : 'unsupported' as const
    });

    if (typeof requestAnimationFrame === 'function') {
        const onAnimationFrame = (timestamp: number): void => {
            if (capture.scenarioId && capture.startedAtMs !== null && capture.endedAtMs === null) {
                if (!readDocumentVisible()) capture.visibilityValid = false;
                if (!readDocumentFocused()) capture.focusValid = false;
                if (lastRafTimestamp !== null) {
                    if (capture.rafIntervalsMs.length >= CPU_TURN_PERFORMANCE_ENTRY_LIMIT) {
                        capture.overflow = true;
                    } else {
                        const interval = timestamp - lastRafTimestamp;
                        if (Number.isFinite(interval) && interval >= 0) capture.rafIntervalsMs.push(interval);
                        else {
                            capture.invalidEntryCount += 1;
                            if (capture.invalidReasons.length < 20) capture.invalidReasons.push('invalid-raf-timestamp');
                        }
                    }
                }
                lastRafTimestamp = timestamp;
            } else {
                lastRafTimestamp = null;
            }
            requestAnimationFrame(onAnimationFrame);
        };
        requestAnimationFrame(onAnimationFrame);
    }

    const recordCpuTurnStage = (value: CpuTurnPerformanceEntry): void => {
        if (!capture.scenarioId || capture.endedAtMs !== null) return;
        const entry = sanitizeCpuTurnPerformanceEntry(value);
        if (!entry) {
            capture.invalidEntryCount += 1;
            if (capture.invalidReasons.length < 20) capture.invalidReasons.push('invalid-stage-entry');
            return;
        }
        if (capture.stageEntries.length >= CPU_TURN_PERFORMANCE_ENTRY_LIMIT) {
            capture.overflow = true;
            return;
        }
        capture.stageEntries.push(entry);
        if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
            try {
                performance.measure(`${PERF_NAMESPACE}:cpu-turn:${entry.stage}`, {
                    start: entry.startMs,
                    duration: entry.durationMs,
                    detail: {
                        correlationId: entry.correlationId,
                        runId: entry.runId,
                        kind: entry.kind,
                        outcome: entry.outcome
                    }
                });
                if (typeof performance.clearMeasures === 'function') {
                    performance.clearMeasures(`${PERF_NAMESPACE}:cpu-turn:${entry.stage}`);
                }
            } catch (_error) { /* report buffer remains authoritative */ }
        }
    };

    const api: CpuTurnPerformanceHarness = Object.freeze({
        schemaVersion: CPU_TURN_FRAME_STALL_SAMPLE_SCHEMA_VERSION,
        capabilities,
        beginScenario: (scenarioId: string, options: Readonly<Record<string, unknown>> = {}): boolean => {
            const safeScenarioId = String(scenarioId || '').trim();
            if (!CPU_TURN_PERFORMANCE_SCENARIO_ID_SET.has(safeScenarioId)) return false;
            if (capture.scenarioId && capture.startedAtMs !== null && capture.endedAtMs === null) return false;
            const startedAtMs = readPerformanceNowMs();
            const clockDomain = readClockDomain();
            if (!Number.isFinite(startedAtMs)) return false;
            capture = createEmptyCpuTurnCapture();
            capture.scenarioId = safeScenarioId;
            capture.startedAtMs = startedAtMs;
            capture.visibilityValid = readDocumentVisible();
            capture.focusValid = readDocumentFocused();
            if (clockDomain.compatible !== true) {
                capture.invalidEntryCount += 1;
                capture.invalidReasons.push('clock-domain-unverified');
            }
            observers.forEach(({ observer }) => { try { observer.takeRecords(); } catch (_error) { /* ignore */ } });
            capture.metadata = sanitizeScenarioMetadata(options);
            capture.pixiDiagnosticsBefore = sanitizeDiagnostics(options.pixiDiagnosticsBefore);
            lastRafTimestamp = null;
            return true;
        },
        endScenario: (options: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> => {
            if (!capture.scenarioId || capture.startedAtMs === null) {
                capture.invalidEntryCount += 1;
                if (capture.invalidReasons.length < 20) capture.invalidReasons.push('scenario-not-started');
                return Object.freeze({
                    ...freezeCpuTurnCaptureSnapshot(capture),
                    capabilities
                });
            }
            if (capture.endedAtMs === null) {
                const endedAtMs = readPerformanceNowMs();
                if (!Number.isFinite(endedAtMs)) {
                    capture.invalidEntryCount += 1;
                    if (capture.invalidReasons.length < 20) capture.invalidReasons.push('invalid-end-clock');
                    capture.endedAtMs = capture.startedAtMs;
                } else {
                    capture.endedAtMs = Math.max(capture.startedAtMs, endedAtMs);
                }
            }
            observers.forEach(({ observer, entryType }) => {
                try {
                    observer.takeRecords().forEach((entry) => {
                        appendBrowserTimingEntry(entryType, entry);
                    });
                } catch (_error) { /* ignore */ }
            });
            capture.visibilityValid = capture.visibilityValid && readDocumentVisible();
            capture.focusValid = capture.focusValid && readDocumentFocused();
            capture.pixiDiagnosticsAfter = sanitizeDiagnostics(options.pixiDiagnosticsAfter);
            return Object.freeze({
                ...freezeCpuTurnCaptureSnapshot(capture),
                capabilities
            });
        },
        snapshot: () => Object.freeze({
            ...freezeCpuTurnCaptureSnapshot(capture),
            capabilities
        }),
        reset: () => {
            capture = createEmptyCpuTurnCapture();
            lastRafTimestamp = null;
        },
        createCorrelationId: () => {
            cpuTurnPerformanceSequence += 1;
            return `cpu-${cpuTurnPerformanceSequence.toString(36)}`;
        },
        recordCpuTurnStage,
        recordRuntimeEvidence: (name: 'worker-candidate-scoring' | 'worker-card-quiescence') => {
            if (!capture.scenarioId || capture.endedAtMs !== null) return;
            if (name === 'worker-candidate-scoring') {
                capture.runtimeEvidence.workerCandidateScoringRequestCount += 1;
            } else if (name === 'worker-card-quiescence') {
                capture.runtimeEvidence.workerCardQuiescenceRequestCount += 1;
            }
        }
    });

    cpuTurnPerformanceHarness = api;
    try {
        Object.defineProperty(window, '__cpuTurnPerformance', {
            configurable: true,
            enumerable: false,
            value: api
        });
    } catch (_error) {
        (window as any).__cpuTurnPerformance = api;
    }
    return api;
}

function getCpuTurnPerformanceRecorder(): ((entry: CpuTurnPerformanceEntry) => void) | null {
    if (!PERF_BENCH_ENABLED) return null;
    const harness = installCpuTurnPerformanceHarness();
    return harness ? harness.recordCpuTurnStage : null;
}

function createCpuTurnPerformanceCorrelationId(): string | null {
    if (!PERF_BENCH_ENABLED) return null;
    const harness = installCpuTurnPerformanceHarness();
    return harness ? harness.createCorrelationId() : null;
}

function recordCpuTurnRuntimeEvidence(name: 'worker-candidate-scoring' | 'worker-card-quiescence'): void {
    if (!PERF_BENCH_ENABLED) return;
    const harness = installCpuTurnPerformanceHarness();
    if (harness) harness.recordRuntimeEvidence(name);
}

function _safeMark(name: string, detail?: any): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
    try {
        const opts = (detail !== undefined && detail !== null) ? { detail } : undefined;
        performance.mark(name, opts);
    } catch (e: any) { /* ignore */ }
}

function _safeMeasure(measureName: string, startMark: string, endMark: string): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
    try {
        performance.measure(measureName, startMark, endMark);
    } catch (e: any) { /* mark missing */ }
}

function _safeClearMarks(...markNames: string[]): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.clearMarks !== 'function') return;
    try {
        for (const m of markNames) {
            performance.clearMarks(m);
        }
    } catch (e: any) { /* ignore */ }
}

function isPerfBenchEnabled(): boolean {
    return PERF_BENCH_ENABLED;
}

function perfStart(name: string): void {
    // OFF path: early-return BEFORE any template-string allocation.
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(`${full}:start`);
}

function perfEnd(name: string): void {
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(`${full}:end`);
    _safeMeasure(`${full}:measure`, `${full}:start`, `${full}:end`);
    // Measure is kept. The underlying start/end marks are cleared to avoid
    // unbounded accumulation across many renderBoard / renderBoardDiff calls.
    _safeClearMarks(`${full}:start`, `${full}:end`);
}

function perfMarkOnly(name: string, detail?: any): void {
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(full, detail);
}

const PerfBenchmarks = {
    isPerfBenchEnabled,
    perfStart,
    perfEnd,
    perfMarkOnly,
    installCpuTurnPerformanceHarness,
    getCpuTurnPerformanceRecorder,
    createCpuTurnPerformanceCorrelationId,
    recordCpuTurnRuntimeEvidence,
    CPU_TURN_FRAME_STALL_SAMPLE_SCHEMA_VERSION
};

export = PerfBenchmarks;
