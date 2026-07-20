export type BoardVisualInvalidationReason =
  | 'render-request'
  | 'auto-writer-claim'
  | 'network-commit'
  | 'recovery';

export interface BoardVisualInvalidationDiagnostics {
  readonly requestCount: number;
  readonly mergeCount: number;
  readonly finalFrameBuildCount: number;
  readonly finalFrameSubmitCount: number;
  readonly discardedWriterCount: number;
  readonly pending: boolean;
  readonly pendingGeneration: number;
  readonly pendingReasons: readonly BoardVisualInvalidationReason[];
}

export interface BoardVisualInvalidationAccumulator {
  mark(writerToken: object | null, reason?: BoardVisualInvalidationReason): void;
  recordFinalFrameBuild(writerToken: object | null): void;
  recordFinalFrameSubmit(writerToken: object | null): void;
  rebind(previousWriterToken: object | null, nextWriterToken: object | null): void;
  settle(writerToken: object | null): void;
  discard(writerToken?: object | null): void;
  reset(): void;
  getDiagnostics(): BoardVisualInvalidationDiagnostics;
}

export function createBoardVisualInvalidationAccumulator(): BoardVisualInvalidationAccumulator {
  let writerToken: object | null = null;
  let pending = false;
  let pendingGeneration = 0;
  let requestCount = 0;
  let mergeCount = 0;
  let finalFrameBuildCount = 0;
  let finalFrameSubmitCount = 0;
  let discardedWriterCount = 0;
  const reasons = new Set<BoardVisualInvalidationReason>();

  const matches = (candidate: object | null | undefined) => (
    candidate === undefined || writerToken === candidate
  );

  const clearPending = () => {
    writerToken = null;
    pending = false;
    reasons.clear();
  };

  return Object.freeze({
    mark(
      nextWriterToken: object | null,
      reason: BoardVisualInvalidationReason = 'render-request'
    ) {
      requestCount += 1;
      if (pending && writerToken === nextWriterToken) {
        mergeCount += 1;
      } else {
        if (pending) discardedWriterCount += 1;
        writerToken = nextWriterToken;
        pending = true;
        pendingGeneration += 1;
        reasons.clear();
      }
      reasons.add(reason);
    },
    recordFinalFrameBuild(nextWriterToken: object | null) {
      finalFrameBuildCount += 1;
      if (!pending) {
        writerToken = nextWriterToken;
        pending = true;
        pendingGeneration += 1;
      }
    },
    recordFinalFrameSubmit(nextWriterToken: object | null) {
      if (pending && writerToken !== nextWriterToken) {
        throw new Error('Final board frame submit does not match the invalidated writer');
      }
      finalFrameSubmitCount += 1;
    },
    rebind(previousWriterToken: object | null, nextWriterToken: object | null) {
      if (!pending || writerToken !== previousWriterToken) return;
      writerToken = nextWriterToken;
    },
    settle(nextWriterToken: object | null) {
      if (pending && writerToken !== nextWriterToken) {
        throw new Error('Board visual invalidation settlement writer mismatch');
      }
      clearPending();
    },
    discard(nextWriterToken?: object | null) {
      if (!pending || !matches(nextWriterToken)) return;
      discardedWriterCount += 1;
      clearPending();
    },
    reset() {
      writerToken = null;
      pending = false;
      pendingGeneration = 0;
      requestCount = 0;
      mergeCount = 0;
      finalFrameBuildCount = 0;
      finalFrameSubmitCount = 0;
      discardedWriterCount = 0;
      reasons.clear();
    },
    getDiagnostics() {
      return Object.freeze({
        requestCount,
        mergeCount,
        finalFrameBuildCount,
        finalFrameSubmitCount,
        discardedWriterCount,
        pending,
        pendingGeneration,
        pendingReasons: Object.freeze(Array.from(reasons).sort())
      });
    }
  });
}
