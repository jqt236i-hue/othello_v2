export type PlaybackSettlementMode = 'finalize' | 'already-aborted-ack';

export type PlaybackSettlementResult = Readonly<{
  kind: 'deferred-finalization';
  runId: number;
  mode: PlaybackSettlementMode;
  finalize: () => boolean;
}>;

export class PlaybackSettlementError extends Error {
  code: string;
  cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'PresentationPlaybackError';
    this.code = code;
    if (typeof cause !== 'undefined') this.cause = cause;
  }
}

export function createPlaybackSettlementError(code: string, message: string, cause?: unknown): PlaybackSettlementError {
  return new PlaybackSettlementError(code, message, cause);
}

export function isPlaybackSettlementResult(value: unknown): value is PlaybackSettlementResult {
  const candidate = value as PlaybackSettlementResult | null;
  return !!candidate
    && candidate.kind === 'deferred-finalization'
    && Number.isSafeInteger(candidate.runId)
    && candidate.runId > 0
    && (candidate.mode === 'finalize' || candidate.mode === 'already-aborted-ack')
    && typeof candidate.finalize === 'function';
}

export function assertPlaybackSettlementResult(value: unknown): PlaybackSettlementResult {
  if (!isPlaybackSettlementResult(value)) {
    throw createPlaybackSettlementError(
      'playback_settlement_result_invalid',
      'Deferred playback did not return a valid settlement result'
    );
  }
  return value;
}

export function createPlaybackSettlementResult(options: Readonly<{
  runId: number;
  mode: PlaybackSettlementMode;
  finalize: () => boolean | void;
}>): PlaybackSettlementResult {
  const runId = Number(options && options.runId);
  const mode = options && options.mode;
  const finalizeAction = options && options.finalize;
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    throw createPlaybackSettlementError('playback_settlement_run_id_invalid', 'Playback settlement runId is invalid');
  }
  if (mode !== 'finalize' && mode !== 'already-aborted-ack') {
    throw createPlaybackSettlementError('playback_settlement_mode_invalid', 'Playback settlement mode is invalid');
  }
  if (typeof finalizeAction !== 'function') {
    throw createPlaybackSettlementError('playback_settlement_finalizer_invalid', 'Playback settlement finalizer is invalid');
  }

  let consumed = false;
  return Object.freeze({
    kind: 'deferred-finalization' as const,
    runId,
    mode,
    finalize(): boolean {
      if (consumed) return false;
      try {
        const finalized = finalizeAction();
        if (finalized === false) {
          consumed = true;
          return false;
        }
      } catch (cause) {
        throw createPlaybackSettlementError(
          'playback_settlement_finalize_failed',
          `Playback settlement finalization failed for run ${runId}`,
          cause
        );
      }
      consumed = true;
      return true;
    }
  });
}

module.exports = {
  PlaybackSettlementError,
  createPlaybackSettlementError,
  createPlaybackSettlementResult,
  isPlaybackSettlementResult,
  assertPlaybackSettlementResult
};
