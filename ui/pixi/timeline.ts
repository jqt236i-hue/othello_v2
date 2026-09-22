export type PixiTimelineTickListener = (deltaMs: number) => void;

export interface PixiTimelineClock {
  subscribe(listener: PixiTimelineTickListener): () => void;
  start(): void;
  stop(): void;
}

export interface PixiApplicationTickerPort {
  subscribeTicker(listener: PixiTimelineTickListener): () => void;
  startTicker(): void;
  stopTicker(): void;
}

export type PixiTimelineBooleanPolicy = boolean | (() => boolean);

export interface PixiTimelineDurationContext {
  readonly baseDurationMs: number;
  readonly effectFamily: string | null;
  readonly event: unknown;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
}

export interface PixiTimelineFrame extends PixiTimelineDurationContext {
  readonly runId: number;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly progress: number;
}

export type PixiTimelineFailureStage =
  | 'start'
  | 'update'
  | 'render'
  | 'complete'
  | 'clock'
  | 'abort'
  | 'destroy';

export type PixiTimelineSettlementStatus = 'completed' | 'failed' | 'aborted';

export interface PixiTimelineSettlement {
  readonly runId: number;
  readonly status: PixiTimelineSettlementStatus;
  readonly stage: PixiTimelineFailureStage | null;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly progress: number;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
  readonly error: unknown | null;
}

export interface PixiTimelineRunResult {
  readonly runId: number;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly noAnimation: boolean;
  readonly reducedMotion: boolean;
}

export interface PixiTimelineRunOptions {
  readonly durationMs: number;
  /** Optional monotonic clock for sound-synchronized effects. Pixi's capped
   * ticker delta otherwise stretches their duration after a slow frame. */
  readonly timeSourceMs?: () => number;
  readonly effectFamily?: string | null;
  readonly event?: unknown;
  readonly onStart?: (frame: PixiTimelineFrame) => void;
  readonly onUpdate: (progress: number, frame: PixiTimelineFrame) => void;
  readonly onComplete?: (result: PixiTimelineRunResult) => void;
  readonly onError?: (error: unknown, settlement: PixiTimelineSettlement) => void;
  readonly onSettled?: (settlement: PixiTimelineSettlement) => void;
}

export interface PixiTimelineOptions {
  readonly clock: PixiTimelineClock;
  /** Stable backend render callback shared by every parallel effect. */
  readonly render: () => void;
  /** Existing effect-family duration policy injected by the presentation layer. */
  readonly resolveDurationMs?: (context: PixiTimelineDurationContext) => number;
  readonly noAnimation?: PixiTimelineBooleanPolicy;
  readonly reducedMotion?: PixiTimelineBooleanPolicy;
}

export interface PixiTimelineDiagnostics {
  readonly state: 'idle' | 'running' | 'destroyed';
  readonly activeRunCount: number;
  readonly tickerRunning: boolean;
  readonly tickerSubscribed: boolean;
  readonly startedRunCount: number;
  readonly completedRunCount: number;
  readonly failedRunCount: number;
  readonly abortedRunCount: number;
  readonly tickerStartCount: number;
  readonly tickerStopCount: number;
  readonly activeDebugFrameCaptureCount: number;
  readonly completedDebugFrameCaptureCount: number;
  readonly failedDebugFrameCaptureCount: number;
  readonly lastError: unknown | null;
}

export interface PixiTimelineDebugFrameCapture<T> {
  readonly value: T;
  readonly elapsedMs: number;
}

export interface PixiTimeline {
  run(options: PixiTimelineRunOptions): Promise<PixiTimelineRunResult>;
  /** Debug-only sampling on the existing clock; production playback never calls this. */
  captureDebugFrameAtElapsed<T>(
    elapsedMs: number,
    capture: () => T
  ): Promise<PixiTimelineDebugFrameCapture<T>>;
  abort(reason?: unknown): number;
  destroy(): void;
  hasActiveRuns(): boolean;
  getActiveRunCount(): number;
  getDiagnostics(): PixiTimelineDiagnostics;
}

export class PixiTimelineAbortError extends Error {
  readonly code: 'pixi_timeline_aborted' | 'pixi_timeline_destroyed';
  readonly reason: unknown;

  constructor(code: 'pixi_timeline_aborted' | 'pixi_timeline_destroyed', reason?: unknown) {
    super(code === 'pixi_timeline_destroyed' ? 'Pixi timeline is destroyed' : 'Pixi timeline was aborted');
    this.name = 'PixiTimelineAbortError';
    this.code = code;
    this.reason = reason;
  }
}

interface ActiveRun {
  readonly id: number;
  readonly options: PixiTimelineRunOptions;
  readonly durationContext: PixiTimelineDurationContext;
  readonly durationMs: number;
  readonly startedAtMs: number | null;
  readonly resolve: (result: PixiTimelineRunResult) => void;
  readonly reject: (error: unknown) => void;
  elapsedMs: number;
  progress: number;
  done: boolean;
}

interface PendingDebugFrameCapture {
  readonly requestedElapsedMs: number;
  readonly capture: () => unknown;
  readonly resolve: (result: PixiTimelineDebugFrameCapture<unknown>) => void;
  readonly reject: (error: unknown) => void;
  remainingMs: number;
}

function resolveBooleanPolicy(policy: PixiTimelineBooleanPolicy | undefined): boolean {
  return typeof policy === 'function' ? policy() === true : policy === true;
}

function requireDuration(value: unknown, name: string): number {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
  return duration;
}

function requireRunOptions(options: PixiTimelineRunOptions): void {
  if (!options || typeof options !== 'object') throw new Error('Pixi timeline run options are unavailable');
  if (typeof options.onUpdate !== 'function') throw new Error('Pixi timeline onUpdate callback is unavailable');
}

function asAbortError(reason: unknown, destroyed = false): Error {
  if (reason instanceof Error) return reason;
  return new PixiTimelineAbortError(
    destroyed ? 'pixi_timeline_destroyed' : 'pixi_timeline_aborted',
    reason
  );
}

/** Adapt only the Pixi Board Application's private ticker to the timeline clock. */
export function createPixiApplicationTickerClock(
  application: PixiApplicationTickerPort
): PixiTimelineClock {
  if (!application
    || typeof application.subscribeTicker !== 'function'
    || typeof application.startTicker !== 'function'
    || typeof application.stopTicker !== 'function') {
    throw new Error('Pixi application ticker port is unavailable');
  }
  return Object.freeze({
    subscribe(listener: PixiTimelineTickListener): () => void {
      return application.subscribeTicker(listener);
    },
    start(): void {
      application.startTicker();
    },
    stop(): void {
      application.stopTicker();
    }
  });
}

export function createPixiTimeline(options: PixiTimelineOptions): PixiTimeline {
  if (!options || !options.clock
    || typeof options.clock.subscribe !== 'function'
    || typeof options.clock.start !== 'function'
    || typeof options.clock.stop !== 'function') {
    throw new Error('Pixi timeline clock is unavailable');
  }
  if (typeof options.render !== 'function') throw new Error('Pixi timeline render callback is unavailable');
  const clock = options.clock;
  const render = options.render;
  const activeRuns = new Set<ActiveRun>();
  const pendingInitialRuns = new Set<ActiveRun>();
  let nextRunId = 1;
  let destroyed = false;
  let aborting = false;
  let tickerRunning = false;
  let unsubscribeClock: (() => void) | null = null;
  let startedRunCount = 0;
  let completedRunCount = 0;
  let failedRunCount = 0;
  let abortedRunCount = 0;
  let tickerStartCount = 0;
  let tickerStopCount = 0;
  const pendingDebugFrameCaptures = new Set<PendingDebugFrameCapture>();
  let completedDebugFrameCaptureCount = 0;
  let failedDebugFrameCaptureCount = 0;
  let lastError: unknown | null = null;
  let initialFlushScheduled = false;

  function makeFrame(run: ActiveRun, progress = run.progress): PixiTimelineFrame {
    return Object.freeze({
      ...run.durationContext,
      runId: run.id,
      durationMs: run.durationMs,
      elapsedMs: run.elapsedMs,
      progress
    });
  }

  function makeResult(run: ActiveRun): PixiTimelineRunResult {
    return Object.freeze({
      runId: run.id,
      durationMs: run.durationMs,
      elapsedMs: run.elapsedMs,
      noAnimation: run.durationContext.noAnimation,
      reducedMotion: run.durationContext.reducedMotion
    });
  }

  function makeSettlement(
    run: ActiveRun,
    status: PixiTimelineSettlementStatus,
    stage: PixiTimelineFailureStage | null,
    error: unknown | null
  ): PixiTimelineSettlement {
    return Object.freeze({
      runId: run.id,
      status,
      stage,
      durationMs: run.durationMs,
      elapsedMs: run.elapsedMs,
      progress: run.progress,
      noAnimation: run.durationContext.noAnimation,
      reducedMotion: run.durationContext.reducedMotion,
      error
    });
  }

  function stopClockWhenIdle(force = false): unknown | null {
    if (!force && activeRuns.size > 0) return null;
    if (!unsubscribeClock && !tickerRunning) return null;
    const unsubscribe = unsubscribeClock;
    const shouldStop = tickerRunning || !!unsubscribe;
    let cleanupError: unknown | null = null;
    if (shouldStop) {
      try {
        clock.stop();
        tickerRunning = false;
        tickerStopCount += 1;
      } catch (error) {
        // Keep the possible-running state until abort/recovery/destroy can
        // prove that a later stop succeeded. Reporting idle here would leak a
        // private Pixi ticker after a transient renderer-owned stop failure.
        tickerRunning = true;
        cleanupError = error;
      }
    }
    if (unsubscribe) {
      try {
        unsubscribe();
        if (unsubscribeClock === unsubscribe) unsubscribeClock = null;
      } catch (error) {
        // Retain the cleanup handle so a later forced cleanup can retry it.
        if (!cleanupError) cleanupError = error;
      }
    }
    if (cleanupError) lastError = cleanupError;
    return cleanupError;
  }

  function settleFailedRun(
    run: ActiveRun,
    error: unknown,
    stage: PixiTimelineFailureStage,
    status: 'failed' | 'aborted' = 'failed'
  ): void {
    if (run.done) return;
    run.done = true;
    // Aborts are controlled cancellation. Their count and rejection reason
    // remain observable without misreporting them as renderer failures.
    if (status !== 'aborted') lastError = error;
    const settlement = makeSettlement(run, status, stage, error);
    try {
      run.options.onError?.(error, settlement);
    } catch (_hookError) {
      // The originating callback/abort error remains the rejection authority.
    }
    try {
      run.options.onSettled?.(settlement);
    } catch (_hookError) {
      // The originating callback/abort error remains the rejection authority.
    }
    pendingInitialRuns.delete(run);
    activeRuns.delete(run);
    if (status === 'aborted') abortedRunCount += 1;
    else failedRunCount += 1;
    const clockError = stopClockWhenIdle();
    if (activeRuns.size === 0 && pendingDebugFrameCaptures.size > 0) {
      rejectDebugFrameCaptures(error || clockError);
    }
    run.reject(error);
  }

  function settleCompletedRun(run: ActiveRun): void {
    if (run.done) return;
    const result = makeResult(run);
    try {
      run.options.onComplete?.(result);
    } catch (error) {
      settleFailedRun(run, error, 'complete');
      return;
    }
    if (run.done) return;
    run.done = true;
    const settlement = makeSettlement(run, 'completed', null, null);
    let settlementError: unknown | null = null;
    try {
      run.options.onSettled?.(settlement);
    } catch (error) {
      settlementError = error;
      lastError = error;
    }
    pendingInitialRuns.delete(run);
    activeRuns.delete(run);
    completedRunCount += 1;
    const clockError = stopClockWhenIdle();
    if (activeRuns.size === 0 && pendingDebugFrameCaptures.size > 0) {
      rejectDebugFrameCaptures(
        settlementError
        || clockError
        || new Error('Pixi timeline became idle before debug frame capture')
      );
    }
    if (settlementError || clockError) {
      failedRunCount += 1;
      run.reject(settlementError || clockError);
      return;
    }
    run.resolve(result);
  }

  function invokeUpdate(run: ActiveRun, progress: number): boolean {
    if (run.done) return false;
    run.progress = progress;
    try {
      run.options.onUpdate(progress, makeFrame(run, progress));
      return !run.done;
    } catch (error) {
      settleFailedRun(run, error, 'update');
      return false;
    }
  }

  function renderLiveRuns(runs: readonly ActiveRun[]): readonly ActiveRun[] {
    const liveRuns = runs.filter((run) => !run.done);
    if (!liveRuns.length) return Object.freeze([]);
    try {
      render();
      return liveRuns.filter((run) => !run.done);
    } catch (error) {
      for (const run of liveRuns) settleFailedRun(run, error, 'render');
      return Object.freeze([]);
    }
  }

  function advanceRuns(deltaMs: number): void {
    const updatedRuns: ActiveRun[] = [];
    const finishing = new Set<ActiveRun>();
    for (const run of Array.from(activeRuns)) {
      if (run.done || run.durationMs <= 0) continue;
      try {
        const elapsedMs = run.options.timeSourceMs && run.startedAtMs !== null
          ? requireDuration(run.options.timeSourceMs(), 'Pixi timeline clock time') - run.startedAtMs
          : run.elapsedMs + deltaMs;
        run.elapsedMs = Math.min(run.durationMs, Math.max(run.elapsedMs, elapsedMs));
      } catch (error) {
        settleFailedRun(run, error, 'clock');
        continue;
      }
      const progress = Math.min(1, run.elapsedMs / run.durationMs);
      if (!invokeUpdate(run, progress)) continue;
      updatedRuns.push(run);
      if (progress >= 1) finishing.add(run);
    }

    // All effects on one board timeline share a single explicit render.
    for (const run of renderLiveRuns(updatedRuns)) {
      if (finishing.has(run)) settleCompletedRun(run);
    }
  }

  function rejectDebugFrameCaptures(error: unknown): void {
    const captures = Array.from(pendingDebugFrameCaptures);
    pendingDebugFrameCaptures.clear();
    failedDebugFrameCaptureCount += captures.length;
    for (const capture of captures) capture.reject(error);
  }

  function settleReadyDebugFrameCaptures(): void {
    const readyCaptures = Array.from(pendingDebugFrameCaptures).filter((capture) => (
      capture.remainingMs <= 1e-6
    ));
    for (const capture of readyCaptures) {
      pendingDebugFrameCaptures.delete(capture);
      try {
        const value = capture.capture();
        completedDebugFrameCaptureCount += 1;
        capture.resolve(Object.freeze({ value, elapsedMs: capture.requestedElapsedMs }));
      } catch (error) {
        failedDebugFrameCaptureCount += 1;
        capture.reject(error);
      }
    }
  }

  function handleTick(rawDeltaMs: number): void {
    let remainingDeltaMs = Number(rawDeltaMs);
    if (!Number.isFinite(remainingDeltaMs) || remainingDeltaMs <= 0 || destroyed) return;
    while (remainingDeltaMs > 1e-6 && !destroyed) {
      let segmentDeltaMs = remainingDeltaMs;
      for (const capture of pendingDebugFrameCaptures) {
        if (capture.remainingMs > 1e-6) {
          segmentDeltaMs = Math.min(segmentDeltaMs, capture.remainingMs);
        }
      }
      if (!(segmentDeltaMs > 1e-6)) {
        settleReadyDebugFrameCaptures();
        continue;
      }
      advanceRuns(segmentDeltaMs);
      for (const capture of pendingDebugFrameCaptures) {
        capture.remainingMs = Math.max(0, capture.remainingMs - segmentDeltaMs);
      }
      settleReadyDebugFrameCaptures();
      remainingDeltaMs = Math.max(0, remainingDeltaMs - segmentDeltaMs);
      if (activeRuns.size === 0 && pendingDebugFrameCaptures.size > 0) {
        rejectDebugFrameCaptures(new Error('Pixi timeline became idle before debug frame capture'));
      }
    }
  }

  function startClockForActiveRuns(): void {
    if (tickerRunning) return;
    if (!unsubscribeClock) unsubscribeClock = clock.subscribe(handleTick);
    tickerRunning = true;
    try {
      clock.start();
      tickerStartCount += 1;
    } catch (error) {
      tickerRunning = false;
      lastError = error;
      throw error;
    }
  }

  function flushInitialRuns(): void {
    initialFlushScheduled = false;
    const initialRuns = Array.from(pendingInitialRuns).filter((run) => !run.done);
    pendingInitialRuns.clear();
    const renderedInitialRuns = renderLiveRuns(initialRuns);
    const zeroDurationFinalRuns: ActiveRun[] = [];
    const clockCandidates: ActiveRun[] = [];

    for (const run of renderedInitialRuns) {
      if (run.done) continue;
      if (run.durationMs === 0) {
        run.elapsedMs = 0;
        if (invokeUpdate(run, 1)) zeroDurationFinalRuns.push(run);
      } else {
        clockCandidates.push(run);
      }
    }

    for (const run of renderLiveRuns(zeroDurationFinalRuns)) settleCompletedRun(run);

    const liveClockCandidates = clockCandidates.filter((run) => !run.done);
    if (!liveClockCandidates.length || tickerRunning) return;
    try {
      startClockForActiveRuns();
    } catch (error) {
      for (const run of liveClockCandidates) settleFailedRun(run, error, 'clock');
    }
  }

  function scheduleInitialFlush(): void {
    if (initialFlushScheduled) return;
    initialFlushScheduled = true;
    void Promise.resolve().then(flushInitialRuns);
  }

  function createDurationContext(runOptions: PixiTimelineRunOptions): {
    readonly context: PixiTimelineDurationContext;
    readonly durationMs: number;
  } {
    const baseDurationMs = requireDuration(runOptions.durationMs, 'Pixi timeline durationMs');
    const noAnimation = resolveBooleanPolicy(options.noAnimation);
    const reducedMotion = resolveBooleanPolicy(options.reducedMotion);
    const context = Object.freeze({
      baseDurationMs,
      effectFamily: runOptions.effectFamily == null ? null : String(runOptions.effectFamily),
      event: runOptions.event,
      noAnimation,
      reducedMotion
    });
    const policyDuration = options.resolveDurationMs
      ? options.resolveDurationMs(context)
      : baseDurationMs;
    const durationMs = noAnimation
      ? 0
      : requireDuration(policyDuration, 'Pixi timeline resolved duration');
    return Object.freeze({ context, durationMs });
  }

  function run(runOptions: PixiTimelineRunOptions): Promise<PixiTimelineRunResult> {
    try {
      requireRunOptions(runOptions);
      if (destroyed) throw new PixiTimelineAbortError('pixi_timeline_destroyed');
      if (aborting) throw new PixiTimelineAbortError('pixi_timeline_aborted', 'abort_in_progress');
      const prepared = createDurationContext(runOptions);
      const startedAtMs = runOptions.timeSourceMs
        ? requireDuration(runOptions.timeSourceMs(), 'Pixi timeline clock time')
        : null;
      const runId = nextRunId++;
      return new Promise<PixiTimelineRunResult>((resolve, reject) => {
        const active: ActiveRun = {
          id: runId,
          options: runOptions,
          durationContext: prepared.context,
          durationMs: prepared.durationMs,
          startedAtMs,
          resolve,
          reject,
          elapsedMs: 0,
          progress: 0,
          done: false
        };
        activeRuns.add(active);
        startedRunCount += 1;
        try {
          runOptions.onStart?.(makeFrame(active, 0));
        } catch (error) {
          settleFailedRun(active, error, 'start');
          return;
        }
        if (active.done || !invokeUpdate(active, 0)) return;
        pendingInitialRuns.add(active);
        scheduleInitialFlush();
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function captureDebugFrameAtElapsed<T>(
    elapsedMs: number,
    capture: () => T
  ): Promise<PixiTimelineDebugFrameCapture<T>> {
    const requestedElapsedMs = Number(elapsedMs);
    if (destroyed) return Promise.reject(new PixiTimelineAbortError('pixi_timeline_destroyed'));
    if (!Number.isFinite(requestedElapsedMs) || requestedElapsedMs < 0) {
      return Promise.reject(new Error('Pixi debug frame capture requires a finite non-negative elapsed duration'));
    }
    if (typeof capture !== 'function') {
      return Promise.reject(new Error('Pixi debug frame capture callback is unavailable'));
    }
    if (activeRuns.size === 0) {
      return Promise.reject(new Error('Pixi debug frame capture requires an active timeline run'));
    }
    if (requestedElapsedMs === 0) {
      try {
        const value = capture();
        completedDebugFrameCaptureCount += 1;
        return Promise.resolve(Object.freeze({ value, elapsedMs: 0 }));
      } catch (error) {
        failedDebugFrameCaptureCount += 1;
        return Promise.reject(error);
      }
    }
    return new Promise<PixiTimelineDebugFrameCapture<T>>((resolve, reject) => {
      pendingDebugFrameCaptures.add({
        requestedElapsedMs,
        remainingMs: requestedElapsedMs,
        capture,
        resolve: resolve as (result: PixiTimelineDebugFrameCapture<unknown>) => void,
        reject
      });
    });
  }

  function abortRuns(error: Error, stage: 'abort' | 'destroy'): number {
    if (aborting) return 0;
    aborting = true;
    const targets = Array.from(activeRuns).filter((run) => !run.done);
    try {
      for (const run of targets) settleFailedRun(run, error, stage, 'aborted');
      rejectDebugFrameCaptures(error);
    } finally {
      aborting = false;
      stopClockWhenIdle(true);
    }
    return targets.length;
  }

  function abort(reason?: unknown): number {
    if (destroyed) return 0;
    return abortRuns(asAbortError(reason), 'abort');
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    abortRuns(asAbortError(undefined, true), 'destroy');
    stopClockWhenIdle(true);
  }

  function getDiagnostics(): PixiTimelineDiagnostics {
    return Object.freeze({
      state: destroyed ? 'destroyed' : (activeRuns.size > 0 ? 'running' : 'idle'),
      activeRunCount: Array.from(activeRuns).filter((run) => !run.done).length,
      tickerRunning,
      tickerSubscribed: !!unsubscribeClock,
      startedRunCount,
      completedRunCount,
      failedRunCount,
      abortedRunCount,
      tickerStartCount,
      tickerStopCount,
      activeDebugFrameCaptureCount: pendingDebugFrameCaptures.size,
      completedDebugFrameCaptureCount,
      failedDebugFrameCaptureCount,
      lastError
    });
  }

  function hasActiveRuns(): boolean {
    return activeRuns.size > 0;
  }

  function getActiveRunCount(): number {
    return activeRuns.size;
  }

  return Object.freeze({
    run,
    captureDebugFrameAtElapsed,
    abort,
    destroy,
    hasActiveRuns,
    getActiveRunCount,
    getDiagnostics
  });
}
