'use strict';

const FrameContract = require('../../shared/network-presentation-frame');

function toIntegerOrNull(value: any): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.trunc(numberValue);
}

function cloneData(value: any): any {
  if (value === null || typeof value === 'undefined') return value;
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
      return (globalThis as any).structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return value;
  }
}

function createTimelineError(message: string, options?: any): Error {
  const error: any = new Error(message);
  const opts = options && typeof options === 'object' ? options : {};
  if (opts.safeDispatchRetry === true) error.safeDispatchRetry = true;
  if (opts.code) error.code = String(opts.code);
  return error;
}

function createNetworkPresentationTimeline(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const pendingFrames = new Map<number, any>();
  const sourceBySeq = new Map<number, string>();
  let visualSeq = Number.isFinite(Number(cfg.initialVisualSeq))
    ? Math.max(0, Math.trunc(Number(cfg.initialVisualSeq)))
    : 0;
  let visualVersion = Number.isFinite(Number(cfg.initialVisualVersion))
    ? Math.max(0, Math.trunc(Number(cfg.initialVisualVersion)))
    : visualSeq;
  let playing = false;
  let pausedError: any = null;
  let lastPlayedFrame: any = null;
  let activeSettlement: any = null;
  let disposeRequested = false;
  let disposed = false;
  let drainPromise: Promise<number> | null = null;
  let disposePromise: Promise<boolean> | null = null;

  function resolveVisualStateStore(): any {
    if (cfg.visualStateStore && typeof cfg.visualStateStore === 'object') return cfg.visualStateStore;
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      return root && (root as any).NetworkVisualStateStore;
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveVisualSettlementTracker(): any {
    if (cfg.visualSettlementTracker && typeof cfg.visualSettlementTracker === 'object') {
      return cfg.visualSettlementTracker;
    }
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      return root && (root as any).NetworkVisualSettlementTracker;
    } catch (e) { /* ignore */ }
    return null;
  }

  function normalizeFrameList(values: any): any[] {
    if (!Array.isArray(values) || values.length <= 0) return [];
    return FrameContract.collectFramesAfter(values, visualSeq);
  }

  function maybeAlignBaseCursorForIncomingFrames(frames: any[], options?: any): void {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.allowBaseCursorAdvance !== true) return;
    if (!Array.isArray(frames) || frames.length <= 0) return;
    const isJournalRecovery = String(opts.source || '').trim() === 'journal_recovery';
    if (lastPlayedFrame || (!isJournalRecovery && pendingFrames.size > 0)) return;

    const firstFrame = frames[0];
    const firstVisualSeq = toIntegerOrNull(firstFrame && firstFrame.visualSeq);
    const firstStateVersionFrom = toIntegerOrNull(firstFrame && firstFrame.stateVersionFrom);
    if (firstVisualSeq === null || firstStateVersionFrom === null) return;
    if (firstVisualSeq <= visualSeq) return;

    const expectedSeq = visualSeq + 1;
    const hasVisualSeqGap = firstVisualSeq > expectedSeq;
    const hasVersionGap = firstVisualSeq === expectedSeq && firstStateVersionFrom !== visualVersion;
    if (!hasVisualSeqGap && !hasVersionGap) return;

    visualSeq = Math.max(0, firstVisualSeq - 1);
    visualVersion = Math.max(0, firstStateVersionFrom);
    pausedError = null;
  }

  function enqueueFrames(values: any, options?: any): number {
    if (disposed || disposeRequested) throw new Error('network_presentation_timeline_disposed');
    const opts = (options && typeof options === 'object') ? options : {};
    const frames = normalizeFrameList(values);
    maybeAlignBaseCursorForIncomingFrames(frames, opts);
    let accepted = 0;
    for (const frame of frames) {
      if (!frame || !Number.isFinite(Number(frame.visualSeq))) continue;
      if (frame.visualSeq <= visualSeq) continue;
      if (pendingFrames.has(frame.visualSeq)) continue;
      pendingFrames.set(frame.visualSeq, frame);
      sourceBySeq.set(frame.visualSeq, String(opts.source || frame.actionType || 'network'));
      accepted += 1;
    }
    return accepted;
  }

  function resolveDispatcher(candidate?: any): any {
    if (candidate && typeof candidate === 'object') return candidate;
    if (cfg.playbackDispatcher && typeof cfg.playbackDispatcher === 'object') return cfg.playbackDispatcher;
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      return root && (root as any).NetworkPlaybackDispatcher;
    } catch (e) { /* ignore */ }
    return null;
  }

  async function dispatchFrame(frame: any, dispatcher: any): Promise<any> {
    const playbackEvents = Array.isArray(frame && frame.playbackEvents) ? frame.playbackEvents : [];
    if (!dispatcher || typeof dispatcher.dispatchNetworkPlaybackEvents !== 'function') {
      throw createTimelineError('network_playback_dispatcher_unavailable', {
        code: 'NETWORK_PLAYBACK_DISPATCHER_UNAVAILABLE',
        safeDispatchRetry: true
      });
    }
    let result: any = null;
    try {
      result = await dispatcher.dispatchNetworkPlaybackEvents(playbackEvents, {
        source: 'network_timeline',
        visualSeq: frame.visualSeq,
        stateVersionFrom: frame.stateVersionFrom,
        stateVersionTo: frame.stateVersionTo,
        strictNetworkPlayback: true
      });
    } catch (error: any) {
      const recoveryHandle = error && error.strictSettlementRecoveryHandle;
      if (recoveryHandle && activeSettlement && activeSettlement.frame === frame) {
        activeSettlement.handle = recoveryHandle;
      }
      throw error;
    }
    if (!result || result.started !== true) {
      const method = result && result.method ? String(result.method) : 'unknown';
      throw createTimelineError(`network_playback_dispatch_failed:${method}`, {
        code: 'NETWORK_PLAYBACK_DISPATCH_NOT_STARTED',
        safeDispatchRetry: true
      });
    }
    const handle = result.settlementHandle;
    if (
      !handle
      || handle.kind !== 'strict-network-settlement'
      || handle.visualSeq !== frame.visualSeq
      || typeof handle.applyCommittedFrame !== 'function'
      || typeof handle.settle !== 'function'
      || typeof handle.cancel !== 'function'
    ) {
      throw new Error('network_playback_settlement_handle_invalid');
    }
    return handle;
  }

  async function notifyFrameCommitted(frame: any, meta: any): Promise<void> {
    if (typeof cfg.onFrameCommitted !== 'function') return;
    try {
      await cfg.onFrameCommitted(frame, meta);
    } catch (e) { /* ignore */ }
  }

  function createCommitMeta(frame: any): any {
    return Object.freeze({
      visualSeq: frame.visualSeq,
      visualVersion: frame.stateVersionTo,
      source: sourceBySeq.get(frame.visualSeq) || 'network_timeline',
      snapshotOwnership: 'copy_on_commit'
    });
  }

  function commitVisualState(frame: any, commitMeta: any): any {
    const store = resolveVisualStateStore();
    if (!store || typeof store.commitFrame !== 'function') {
      throw new Error('network_visual_state_store_unavailable');
    }
    const receipt = store.commitFrame(frame, commitMeta);
    if (
      !receipt
      || receipt.kind !== 'network-visual-commit'
      || receipt.visualSeq !== frame.visualSeq
      || receipt.visualVersion !== frame.stateVersionTo
      || Object.isFrozen(receipt) !== true
    ) {
      throw new Error('network_visual_state_commit_receipt_invalid');
    }
    if (
      typeof store.isCurrentCommitReceipt !== 'function'
      || store.isCurrentCommitReceipt(receipt) !== true
    ) {
      throw new Error('network_visual_state_commit_receipt_untrusted');
    }
    return receipt;
  }

  async function markFrameVisuallySettled(frame: any, commitMeta: any): Promise<void> {
    const visualSettlementTracker = resolveVisualSettlementTracker();
    if (!visualSettlementTracker || typeof visualSettlementTracker.markVisualSeqCompleted !== 'function') {
      throw new Error('network_visual_settlement_tracker_unavailable');
    }
    const marked = await visualSettlementTracker.markVisualSeqCompleted(frame.visualSeq, commitMeta);
    if (marked !== true) throw new Error('network_visual_settlement_tracker_rejected');
  }

  function buildPausedError(error: any): any {
    const frame = activeSettlement && activeSettlement.frame;
    return Object.freeze({
      visualSeq: frame ? frame.visualSeq : visualSeq + 1,
      visualVersion,
      stage: activeSettlement ? activeSettlement.stage : 'unknown',
      message: error && error.message ? String(error.message) : String(error || ''),
      code: error && error.code ? String(error.code) : null,
      safeDispatchRetry: error && error.safeDispatchRetry === true
    });
  }

  function notifySettlementPaused(error: any): void {
    if (typeof cfg.onSettlementPaused !== 'function') return;
    try {
      cfg.onSettlementPaused(cloneData(error), {
        retryPausedSettlement,
        getDiagnostics
      });
    } catch (e) { /* diagnostics/recovery observer must not replace the primary error */ }
  }

  async function advanceActiveSettlement(dispatcher: any): Promise<boolean> {
    const active = activeSettlement;
    if (!active) return false;
    while (activeSettlement === active) {
      // A settle() that wins the race with dispose() has already released the
      // strict owner. Complete the local cursor bookkeeping instead of trying
      // to cancel an already-terminal handle.
      if (disposeRequested && active.stage !== 'complete') return false;
      if (active.stage === 'dispatch') {
        active.handle = await dispatchFrame(active.frame, dispatcher);
        active.stage = 'commit';
        continue;
      }
      if (active.stage === 'commit') {
        active.commitMeta = createCommitMeta(active.frame);
        active.receipt = commitVisualState(active.frame, active.commitMeta);
        active.stage = 'apply-committed-frame';
        continue;
      }
      if (active.stage === 'apply-committed-frame') {
        const applied = await active.handle.applyCommittedFrame(active.receipt);
        if (applied !== true) throw new Error('network_committed_frame_apply_failed');
        active.stage = 'tracker';
        continue;
      }
      if (active.stage === 'tracker') {
        await markFrameVisuallySettled(active.frame, active.commitMeta);
        active.stage = 'observer';
        continue;
      }
      if (active.stage === 'observer') {
        await notifyFrameCommitted(active.frame, active.commitMeta);
        active.stage = 'settle';
        continue;
      }
      if (active.stage === 'settle') {
        const settled = await active.handle.settle();
        if (settled !== true) throw new Error('network_playback_settlement_failed');
        active.stage = 'complete';
        continue;
      }
      if (active.stage === 'complete') {
        const frame = active.frame;
        pendingFrames.delete(frame.visualSeq);
        sourceBySeq.delete(frame.visualSeq);
        visualSeq = frame.visualSeq;
        visualVersion = frame.stateVersionTo;
        lastPlayedFrame = frame;
        activeSettlement = null;
        return true;
      }
      throw new Error(`network_visual_settlement_stage_invalid:${String(active.stage)}`);
    }
    return false;
  }

  async function drainPlayableFrames(dispatcherCandidate?: any): Promise<number> {
    if (disposed || disposeRequested || pausedError) return 0;
    if (drainPromise) return drainPromise;
    const dispatcher = resolveDispatcher(dispatcherCandidate);
    drainPromise = (async () => {
      let drained = 0;
      playing = true;
      try {
        while (!pausedError && !disposeRequested) {
          if (!activeSettlement) {
            const nextSeq = visualSeq + 1;
            const frame = pendingFrames.get(nextSeq);
            if (!frame) break;
            if (frame.stateVersionFrom !== visualVersion) break;
            activeSettlement = {
              frame,
              stage: 'dispatch',
              handle: null,
              commitMeta: null,
              receipt: null
            };
          }
          try {
            if (await advanceActiveSettlement(dispatcher)) drained += 1;
          } catch (error: any) {
            pausedError = buildPausedError(error);
            notifySettlementPaused(pausedError);
            break;
          }
        }
      } finally {
        playing = false;
      }
      return drained;
    })();
    try {
      return await drainPromise;
    } finally {
      drainPromise = null;
    }
  }

  async function retryPausedSettlement(dispatcherCandidate?: any): Promise<number> {
    if (disposed || disposeRequested) throw new Error('network_presentation_timeline_disposed');
    if (playing) return 0;
    if (!pausedError || !activeSettlement) return 0;
    const stage = String(activeSettlement.stage || 'unknown');
    if (stage === 'dispatch' && pausedError.safeDispatchRetry !== true) {
      throw new Error('network_playback_dispatch_retry_requires_phase_checkpoint');
    }
    pausedError = null;
    return drainPlayableFrames(dispatcherCandidate);
  }

  function setBaseCursor(options?: any): void {
    if (activeSettlement) throw new Error('network_visual_settlement_active');
    const opts = (options && typeof options === 'object') ? options : {};
    const nextVisualSeq = toIntegerOrNull(opts.visualSeq);
    const nextVisualVersion = toIntegerOrNull(opts.visualVersion);
    if (nextVisualSeq !== null && nextVisualSeq >= 0) visualSeq = nextVisualSeq;
    if (nextVisualVersion !== null && nextVisualVersion >= 0) visualVersion = nextVisualVersion;
    for (const seq of Array.from(pendingFrames.keys())) {
      if (seq <= visualSeq) {
        pendingFrames.delete(seq);
        sourceBySeq.delete(seq);
      }
    }
    pausedError = null;
  }

  function reset(options?: any): void {
    if (disposed || disposeRequested) throw new Error('network_presentation_timeline_disposed');
    if (activeSettlement) throw new Error('network_visual_settlement_active');
    pendingFrames.clear();
    sourceBySeq.clear();
    lastPlayedFrame = null;
    playing = false;
    pausedError = null;
    activeSettlement = null;
    setBaseCursor(options || {
      visualSeq: 0,
      visualVersion: 0
    });
  }

  async function dispose(reason?: any): Promise<boolean> {
    if (disposed) return true;
    if (disposePromise) return disposePromise;
    disposeRequested = true;
    const disposeReason = String(reason || 'timeline_dispose');
    disposePromise = (async () => {
      if (drainPromise) await drainPromise;
      const active = activeSettlement;
      if (active && active.handle) {
        if (typeof active.handle.cancel !== 'function') {
          throw new Error('network_playback_settlement_cancel_unavailable');
        }
        const cancelled = await active.handle.cancel(disposeReason);
        if (cancelled !== true) throw new Error('network_playback_settlement_cancel_failed');
      }
      pendingFrames.clear();
      sourceBySeq.clear();
      activeSettlement = null;
      pausedError = null;
      lastPlayedFrame = null;
      playing = false;
      disposed = true;
      disposeRequested = false;
      return true;
    })();
    try {
      return await disposePromise;
    } catch (error) {
      disposeRequested = false;
      disposePromise = null;
      throw error;
    }
  }

  function getDiagnostics(): any {
    const pendingVisualSeqs = Array.from(pendingFrames.keys()).sort((a, b) => a - b);
    const pendingFrameSummaries = pendingVisualSeqs.slice(0, 8).map((seq) => {
      const frame = pendingFrames.get(seq);
      return {
        visualSeq: seq,
        stateVersionFrom: toIntegerOrNull(frame && frame.stateVersionFrom),
        stateVersionTo: toIntegerOrNull(frame && frame.stateVersionTo),
        playbackEventCount: Array.isArray(frame && frame.playbackEvents) ? frame.playbackEvents.length : 0,
        operationId: frame && frame.operationId ? String(frame.operationId) : null,
        actionType: frame && frame.actionType ? String(frame.actionType) : null
      };
    });
    return {
      visualSeq,
      visualVersion,
      pendingFrameCount: pendingVisualSeqs.length,
      pendingVisualSeqs,
      pendingFrameSummaries,
      nextExpectedVisualSeq: visualSeq + 1,
      playing,
      disposed,
      disposing: disposeRequested && !disposed,
      blocksInput: !!(playing || activeSettlement || pausedError || disposeRequested),
      activeSettlementStage: activeSettlement ? activeSettlement.stage : null,
      paused: !!pausedError,
      pausedError: pausedError ? cloneData(pausedError) : null,
      lastPlayedFrame: lastPlayedFrame ? {
        visualSeq: lastPlayedFrame.visualSeq,
        stateVersionFrom: lastPlayedFrame.stateVersionFrom,
        stateVersionTo: lastPlayedFrame.stateVersionTo,
        operationId: lastPlayedFrame.operationId,
        actionType: lastPlayedFrame.actionType
      } : null
    };
  }

  return {
    enqueueFrames,
    drainPlayableFrames,
    retryPausedSettlement,
    setBaseCursor,
    reset,
    dispose,
    getDiagnostics
  };
}

const NetworkPresentationTimelineModule = {
  createNetworkPresentationTimeline
};

export = NetworkPresentationTimelineModule;
