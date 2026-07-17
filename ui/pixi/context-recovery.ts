export type PixiContextRecoveryState =
  | 'idle'
  | 'lost'
  | 'restoring'
  | 'fallback'
  | 'failed'
  | 'destroyed';

export interface PixiContextRecoveryDiagnostics {
  readonly state: PixiContextRecoveryState;
  readonly generation: number;
  readonly lossCount: number;
  readonly restoreAttemptCount: number;
  readonly restoreSuccessCount: number;
  readonly fallbackAttemptCount: number;
  readonly fallbackSuccessCount: number;
  readonly failureCount: number;
  readonly timeoutMs: number;
  readonly timerActive: boolean;
  readonly lastErrorMessage: string | null;
}

export interface PixiContextRecoveryOptions {
  readonly target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly timeoutMs?: number;
  /** Runs synchronously before the backend interrupts active Pixi work. */
  readonly onContextLost: (error: Error, event: Event) => void;
  /** Reload resources, restore the checkpoint, and replay board-only work. */
  readonly onContextRestored: (event: Event) => boolean | Promise<boolean>;
  /** Replace Pixi with the exclusive DOM compatibility backend. */
  readonly onFallbackRequired: (error: Error) => boolean | Promise<boolean>;
  readonly onRecoveryFailed?: (error: Error) => void;
  readonly setTimeout?: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
}

export interface PixiContextRecovery {
  getDiagnostics(): PixiContextRecoveryDiagnostics;
  destroy(): void;
}

const DEFAULT_CONTEXT_RECOVERY_TIMEOUT_MS = 5000;

function normalizeTimeoutMs(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return DEFAULT_CONTEXT_RECOVERY_TIMEOUT_MS;
  return Math.trunc(numeric);
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const message = String(error || '').trim();
  return new Error(message || fallback);
}

export function createPixiContextRecovery(
  options: PixiContextRecoveryOptions
): PixiContextRecovery {
  if (!options?.target
    || typeof options.target.addEventListener !== 'function'
    || typeof options.target.removeEventListener !== 'function') {
    throw new Error('Pixi context recovery requires an event target');
  }
  if (typeof options.onContextLost !== 'function'
    || typeof options.onContextRestored !== 'function'
    || typeof options.onFallbackRequired !== 'function') {
    throw new Error('Pixi context recovery hooks are unavailable');
  }

  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const schedule = options.setTimeout || ((callback: () => void, delayMs: number) => (
    globalThis.setTimeout(callback, delayMs)
  ));
  const cancel = options.clearTimeout || ((handle: unknown) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  });

  let state: PixiContextRecoveryState = 'idle';
  let generation = 0;
  let activeAttempt = 0;
  let timerHandle: unknown = null;
  let lossCount = 0;
  let restoreAttemptCount = 0;
  let restoreSuccessCount = 0;
  let fallbackAttemptCount = 0;
  let fallbackSuccessCount = 0;
  let failureCount = 0;
  let lastError: Error | null = null;

  const clearDeadline = () => {
    if (timerHandle === null) return;
    try { cancel(timerHandle); } catch (_error) { /* lifecycle cleanup */ }
    timerHandle = null;
  };

  const finishSuccess = (expectedGeneration: number, source: 'restore' | 'fallback') => {
    if (state === 'destroyed' || generation !== expectedGeneration) return false;
    clearDeadline();
    activeAttempt += 1;
    state = 'idle';
    lastError = null;
    if (source === 'restore') restoreSuccessCount += 1;
    else fallbackSuccessCount += 1;
    return true;
  };

  const finishFailure = (expectedGeneration: number, error: unknown) => {
    if (state === 'destroyed' || generation !== expectedGeneration) return false;
    clearDeadline();
    activeAttempt += 1;
    state = 'failed';
    lastError = toError(error, 'Pixi context recovery failed');
    failureCount += 1;
    try { options.onRecoveryFailed?.(lastError); } catch (_error) { /* primary failure remains authoritative */ }
    return true;
  };

  const beginFallback = (expectedGeneration: number, reason: Error) => {
    if (state === 'destroyed' || state === 'idle' || state === 'failed'
      || generation !== expectedGeneration) return;
    clearDeadline();
    state = 'fallback';
    lastError = reason;
    fallbackAttemptCount += 1;
    const attempt = ++activeAttempt;
    Promise.resolve()
      .then(() => options.onFallbackRequired(reason))
      .then((recovered) => {
        if (state === 'destroyed' || generation !== expectedGeneration || activeAttempt !== attempt) return;
        if (recovered !== true) throw new Error('DOM compatibility context recovery was rejected');
        finishSuccess(expectedGeneration, 'fallback');
      })
      .catch((error) => {
        if (state === 'destroyed' || generation !== expectedGeneration || activeAttempt !== attempt) return;
        finishFailure(expectedGeneration, error);
      });
  };

  const handleContextLost = (rawEvent: Event) => {
    if (state === 'destroyed') return;
    try { rawEvent.preventDefault?.(); } catch (_error) { /* browser owns prevention failures */ }
    // Repeated loss notifications for the same WebGL loss do not create a
    // second deadline, fallback, or writer-recovery owner.
    if (state !== 'idle' && state !== 'failed') return;
    generation += 1;
    activeAttempt += 1;
    state = 'lost';
    lossCount += 1;
    lastError = new Error('Pixi WebGL context lost');
    const expectedGeneration = generation;
    try {
      options.onContextLost(lastError, rawEvent);
    } catch (error) {
      finishFailure(expectedGeneration, error);
      return;
    }
    timerHandle = schedule(() => {
      timerHandle = null;
      beginFallback(expectedGeneration, new Error('Pixi WebGL context recovery timed out'));
    }, timeoutMs);
  };

  const handleContextRestored = (rawEvent: Event) => {
    if (state !== 'lost') return;
    const expectedGeneration = generation;
    state = 'restoring';
    restoreAttemptCount += 1;
    const attempt = ++activeAttempt;
    Promise.resolve()
      .then(() => options.onContextRestored(rawEvent))
      .then((recovered) => {
        if (state === 'destroyed' || generation !== expectedGeneration || activeAttempt !== attempt) return;
        if (recovered !== true) {
          state = 'lost';
          lastError = new Error('Pixi context restore did not settle the board checkpoint');
          return;
        }
        finishSuccess(expectedGeneration, 'restore');
      })
      .catch((error) => {
        if (state === 'destroyed' || generation !== expectedGeneration || activeAttempt !== attempt) return;
        state = 'lost';
        lastError = toError(error, 'Pixi context restore failed');
        // The original five-second deadline remains authoritative. A failed
        // WebGL restore attempt therefore converges on the same DOM fallback.
      });
  };

  options.target.addEventListener('webglcontextlost', handleContextLost as EventListener);
  options.target.addEventListener('webglcontextrestored', handleContextRestored as EventListener);

  return Object.freeze({
    getDiagnostics(): PixiContextRecoveryDiagnostics {
      return Object.freeze({
        state,
        generation,
        lossCount,
        restoreAttemptCount,
        restoreSuccessCount,
        fallbackAttemptCount,
        fallbackSuccessCount,
        failureCount,
        timeoutMs,
        timerActive: timerHandle !== null,
        lastErrorMessage: lastError ? lastError.message : null
      });
    },
    destroy() {
      if (state === 'destroyed') return;
      clearDeadline();
      activeAttempt += 1;
      state = 'destroyed';
      options.target.removeEventListener('webglcontextlost', handleContextLost as EventListener);
      options.target.removeEventListener('webglcontextrestored', handleContextRestored as EventListener);
    }
  });
}

export const PIXI_CONTEXT_RECOVERY_TIMEOUT_MS = DEFAULT_CONTEXT_RECOVERY_TIMEOUT_MS;
