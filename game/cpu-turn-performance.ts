export const CPU_TURN_PERFORMANCE_STAGES = Object.freeze([
    'handoff-delay',
    'card-availability',
    'card-context-base',
    'card-quiescence',
    'move-candidates',
    'commentary-context',
    'canonical-commit',
    'presentation-handoff'
] as const);

export type CpuTurnPerformanceStage = typeof CPU_TURN_PERFORMANCE_STAGES[number] | `card-context-feature:${string}`;
export type CpuTurnPerformanceKind = 'sync' | 'wait';
export type CpuTurnPerformanceOutcome = 'continue' | 'handled' | 'stale' | 'error';

export type CpuTurnPerformanceEntry = Readonly<{
    correlationId: string;
    runId: number | null;
    stage: CpuTurnPerformanceStage;
    kind: CpuTurnPerformanceKind;
    startMs: number;
    endMs: number;
    durationMs: number;
    playerKey: 'black' | 'white';
    level: number | null;
    outcome: CpuTurnPerformanceOutcome;
}>;

export type CpuTurnPerformanceRecorder = (entry: CpuTurnPerformanceEntry) => void;

export type CpuTurnPerformanceScope = Readonly<{
    recorder: CpuTurnPerformanceRecorder;
    correlationId: string;
    runId: number | null;
    playerKey: 'black' | 'white';
    level: number | null;
    readNowMs: () => number;
}>;

export const CPU_TURN_PERFORMANCE_CORRELATION_OPTION = '__cpuTurnPerformanceCorrelationId';
export const CPU_TURN_PERFORMANCE_LEVEL_OPTION = '__cpuTurnPerformanceLevel';

function normalizeTimestamp(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
}

function normalizeLevel(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.trunc(numeric)) : null;
}

function normalizePlayerKey(value: unknown): 'black' | 'white' {
    return value === 'white' ? 'white' : 'black';
}

export function readCpuTurnPerformanceNowMs(scope: CpuTurnPerformanceScope): number {
    try {
        const value = normalizeTimestamp(scope.readNowMs());
        return value === null ? Number.NaN : value;
    } catch (_error) {
        return Number.NaN;
    }
}

export function createCpuTurnPerformanceScope(options: {
    recorder?: CpuTurnPerformanceRecorder | null;
    correlationId?: unknown;
    runId?: unknown;
    playerKey?: unknown;
    level?: unknown;
    readNowMs?: (() => number) | null;
}): CpuTurnPerformanceScope | null {
    const opts = options && typeof options === 'object' ? options : {};
    if (typeof opts.recorder !== 'function') return null;
    const correlationId = String(opts.correlationId || '').trim();
    if (!correlationId) return null;
    const runIdValue = opts.runId === null || opts.runId === undefined || opts.runId === ''
        ? NaN
        : Number(opts.runId);
    const runId = Number.isSafeInteger(runIdValue) && runIdValue >= 0 ? runIdValue : null;
    const readNowMs = typeof opts.readNowMs === 'function' ? opts.readNowMs : () => Number.NaN;
    return Object.freeze({
        recorder: opts.recorder,
        correlationId,
        runId,
        playerKey: normalizePlayerKey(opts.playerKey),
        level: normalizeLevel(opts.level),
        readNowMs
    });
}

export function recordCpuTurnPerformanceInterval(
    scope: CpuTurnPerformanceScope | null | undefined,
    stage: CpuTurnPerformanceStage,
    kind: CpuTurnPerformanceKind,
    startMs: unknown,
    endMs: unknown,
    outcome: CpuTurnPerformanceOutcome = 'continue'
): void {
    if (!scope || typeof scope.recorder !== 'function') return;
    const safeStartMs = normalizeTimestamp(startMs);
    const normalizedEndMs = normalizeTimestamp(endMs);
    if (safeStartMs === null || normalizedEndMs === null) {
        try {
            scope.recorder(Object.freeze({
                correlationId: scope.correlationId,
                runId: scope.runId,
                stage,
                kind,
                startMs: Number.NaN,
                endMs: Number.NaN,
                durationMs: Number.NaN,
                playerKey: scope.playerKey,
                level: scope.level,
                outcome
            }));
        } catch (_error) { /* debug recorder failure */ }
        return;
    }
    const safeEndMs = Math.max(safeStartMs, normalizedEndMs);
    const entry: CpuTurnPerformanceEntry = Object.freeze({
        correlationId: scope.correlationId,
        runId: scope.runId,
        stage,
        kind,
        startMs: safeStartMs,
        endMs: safeEndMs,
        durationMs: safeEndMs - safeStartMs,
        playerKey: scope.playerKey,
        level: scope.level,
        outcome
    });
    try {
        scope.recorder(entry);
    } catch (_error) {
        // Debug instrumentation must never affect canonical turn progression.
    }
}

export function measureCpuTurnSync<T>(
    scope: CpuTurnPerformanceScope | null | undefined,
    stage: CpuTurnPerformanceStage,
    callback: () => T,
    outcome: CpuTurnPerformanceOutcome = 'continue'
): T {
    if (!scope) return callback();
    const startMs = readCpuTurnPerformanceNowMs(scope);
    try {
        const result = callback();
        recordCpuTurnPerformanceInterval(scope, stage, 'sync', startMs, readCpuTurnPerformanceNowMs(scope), outcome);
        return result;
    } catch (error) {
        recordCpuTurnPerformanceInterval(scope, stage, 'sync', startMs, readCpuTurnPerformanceNowMs(scope), 'error');
        throw error;
    }
}

export function withCpuTurnPerformanceOptions<T extends Record<string, any>>(
    options: T,
    correlationId: unknown,
    level?: unknown
): T {
    const safeCorrelationId = String(correlationId || '').trim();
    if (!safeCorrelationId) return options;
    const next = Object.assign({}, options, {
        [CPU_TURN_PERFORMANCE_CORRELATION_OPTION]: safeCorrelationId
    });
    const safeLevel = normalizeLevel(level);
    if (safeLevel !== null) (next as any)[CPU_TURN_PERFORMANCE_LEVEL_OPTION] = safeLevel;
    return next as T;
}

export function readCpuTurnPerformanceCorrelationId(options: unknown): string | null {
    if (!options || typeof options !== 'object') return null;
    const value = String((options as any)[CPU_TURN_PERFORMANCE_CORRELATION_OPTION] || '').trim();
    return value || null;
}

export function readCpuTurnPerformanceLevel(options: unknown): number | null {
    if (!options || typeof options !== 'object') return null;
    return normalizeLevel((options as any)[CPU_TURN_PERFORMANCE_LEVEL_OPTION]);
}

module.exports = {
    CPU_TURN_PERFORMANCE_STAGES,
    CPU_TURN_PERFORMANCE_CORRELATION_OPTION,
    CPU_TURN_PERFORMANCE_LEVEL_OPTION,
    createCpuTurnPerformanceScope,
    recordCpuTurnPerformanceInterval,
    measureCpuTurnSync,
    readCpuTurnPerformanceNowMs,
    withCpuTurnPerformanceOptions,
    readCpuTurnPerformanceCorrelationId,
    readCpuTurnPerformanceLevel
};
