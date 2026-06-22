'use strict';

type VisualSettlementResult = {
  ok: boolean;
  visualSeq: number;
  reason?: string;
};

type Waiter = {
  visualSeq: number;
  resolve: (result: VisualSettlementResult) => void;
  timer: any;
};

function toPositiveInteger(value: any): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  const next = Math.trunc(numberValue);
  return next > 0 ? next : null;
}

function normalizeTimeoutMs(value: any): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.trunc(numberValue);
}

function createVisualSettlementTracker(): any {
  let completedVisualSeq = 0;
  const waiters = new Map<number, Waiter[]>();

  function clearWaiterTimer(waiter: Waiter): void {
    if (waiter.timer === null) return;
    clearTimeout(waiter.timer);
    waiter.timer = null;
  }

  function resolveWaiter(waiter: Waiter, result: VisualSettlementResult): void {
    clearWaiterTimer(waiter);
    waiter.resolve(result);
  }

  function removeWaiter(waiter: Waiter): void {
    const list = waiters.get(waiter.visualSeq);
    if (!list) return;
    const index = list.indexOf(waiter);
    if (index >= 0) list.splice(index, 1);
    if (list.length <= 0) waiters.delete(waiter.visualSeq);
  }

  function flushCompletedWaiters(): void {
    const keys = Array.from(waiters.keys()).sort((a, b) => a - b);
    for (const visualSeq of keys) {
      if (visualSeq > completedVisualSeq) continue;
      const list = waiters.get(visualSeq) || [];
      waiters.delete(visualSeq);
      for (const waiter of list) {
        resolveWaiter(waiter, { ok: true, visualSeq: waiter.visualSeq });
      }
    }
  }

  function markVisualSeqCompleted(value: any): boolean {
    const visualSeq = toPositiveInteger(value);
    if (visualSeq === null) return false;
    completedVisualSeq = Math.max(completedVisualSeq, visualSeq);
    flushCompletedWaiters();
    return true;
  }

  function waitForVisualSeq(value: any, options?: any): Promise<VisualSettlementResult> {
    const visualSeq = toPositiveInteger(value);
    if (visualSeq === null) {
      return Promise.resolve({
        ok: false,
        visualSeq: 0,
        reason: 'invalid_visual_seq'
      });
    }
    if (visualSeq <= completedVisualSeq) {
      return Promise.resolve({ ok: true, visualSeq });
    }
    const opts = (options && typeof options === 'object') ? options : {};
    const timeoutMs = normalizeTimeoutMs(opts.timeoutMs);
    return new Promise((resolve) => {
      const waiter: Waiter = {
        visualSeq,
        resolve,
        timer: null
      };
      if (!waiters.has(visualSeq)) waiters.set(visualSeq, []);
      waiters.get(visualSeq)!.push(waiter);
      if (timeoutMs !== null) {
        waiter.timer = setTimeout(() => {
          removeWaiter(waiter);
          resolveWaiter(waiter, {
            ok: false,
            visualSeq,
            reason: 'timeout'
          });
        }, timeoutMs);
      }
    });
  }

  function reset(options?: any): void {
    const opts = (options && typeof options === 'object') ? options : {};
    completedVisualSeq = toPositiveInteger(opts.completedVisualSeq) || 0;
    for (const list of waiters.values()) {
      for (const waiter of list) {
        resolveWaiter(waiter, {
          ok: false,
          visualSeq: waiter.visualSeq,
          reason: 'reset'
        });
      }
    }
    waiters.clear();
  }

  function getDiagnostics(): any {
    return {
      completedVisualSeq,
      pendingVisualSeqs: Array.from(waiters.keys()).sort((a, b) => a - b),
      pendingWaiterCount: Array.from(waiters.values()).reduce((sum, list) => sum + list.length, 0)
    };
  }

  return {
    markVisualSeqCompleted,
    waitForVisualSeq,
    reset,
    getDiagnostics
  };
}

export = {
  createVisualSettlementTracker
};
