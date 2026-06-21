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

  function resolveVisualStateStore(): any {
    if (cfg.visualStateStore && typeof cfg.visualStateStore === 'object') return cfg.visualStateStore;
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      return root && (root as any).NetworkVisualStateStore;
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

  async function dispatchFrame(frame: any, dispatcher: any): Promise<void> {
    const playbackEvents = Array.isArray(frame && frame.playbackEvents) ? frame.playbackEvents : [];
    if (playbackEvents.length <= 0) return;
    if (!dispatcher || typeof dispatcher.dispatchNetworkPlaybackEvents !== 'function') {
      throw new Error('network_playback_dispatcher_unavailable');
    }
    const result = await dispatcher.dispatchNetworkPlaybackEvents(playbackEvents, {
      source: 'network_timeline',
      visualSeq: frame.visualSeq,
      stateVersionFrom: frame.stateVersionFrom,
      stateVersionTo: frame.stateVersionTo,
      strictNetworkPlayback: true
    });
    if (!result || result.started !== true) {
      const method = result && result.method ? String(result.method) : 'unknown';
      throw new Error(`network_playback_dispatch_failed:${method}`);
    }
  }

  async function notifyFrameCommitted(frame: any, meta: any): Promise<void> {
    if (typeof cfg.onFrameCommitted !== 'function') return;
    try {
      await cfg.onFrameCommitted(frame, meta);
    } catch (e) { /* ignore */ }
  }

  function applyFrameCommit(frame: any): any {
    const commitMeta = {
      visualSeq: frame.visualSeq,
      visualVersion: frame.stateVersionTo,
      source: sourceBySeq.get(frame.visualSeq) || 'network_timeline'
    };
    const store = resolveVisualStateStore();
    if (store && typeof store.commitFrame === 'function') {
      store.commitFrame(frame, commitMeta);
    }
    visualSeq = frame.visualSeq;
    visualVersion = frame.stateVersionTo;
    lastPlayedFrame = frame;
    sourceBySeq.delete(frame.visualSeq);
    return commitMeta;
  }

  async function commitFrame(frame: any): Promise<void> {
    const commitMeta = applyFrameCommit(frame);
    await notifyFrameCommitted(frame, commitMeta);
  }

  async function drainPlayableFrames(dispatcherCandidate?: any): Promise<number> {
    if (playing || pausedError) return 0;
    const dispatcher = resolveDispatcher(dispatcherCandidate);
    let drained = 0;
    playing = true;
    try {
      while (!pausedError) {
        const nextSeq = visualSeq + 1;
        const frame = pendingFrames.get(nextSeq);
        if (!frame) break;
        if (frame.stateVersionFrom !== visualVersion) break;
        try {
          await dispatchFrame(frame, dispatcher);
        } catch (error: any) {
          pausedError = {
            visualSeq: frame.visualSeq,
            visualVersion,
            message: error && error.message ? String(error.message) : String(error || '')
          };
          break;
        }
        pendingFrames.delete(nextSeq);
        await commitFrame(frame);
        drained += 1;
      }
    } finally {
      playing = false;
    }
    return drained;
  }

  function markFramePlayed(frameOrSeq: any): boolean {
    const seq = typeof frameOrSeq === 'object'
      ? toIntegerOrNull(frameOrSeq && frameOrSeq.visualSeq)
      : toIntegerOrNull(frameOrSeq);
    if (seq === null || seq <= visualSeq) return false;
    const frame = typeof frameOrSeq === 'object'
      ? FrameContract.normalizePresentationFrame(frameOrSeq)
      : pendingFrames.get(seq);
    if (!frame || frame.visualSeq !== visualSeq + 1 || frame.stateVersionFrom !== visualVersion) return false;
    pendingFrames.delete(frame.visualSeq);
    const commitMeta = applyFrameCommit(frame);
    notifyFrameCommitted(frame, commitMeta).catch(() => {});
    return true;
  }

  function setBaseCursor(options?: any): void {
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

  function resume(): void {
    pausedError = null;
  }

  function reset(options?: any): void {
    pendingFrames.clear();
    sourceBySeq.clear();
    lastPlayedFrame = null;
    playing = false;
    pausedError = null;
    setBaseCursor(options || {
      visualSeq: 0,
      visualVersion: 0
    });
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
    markFramePlayed,
    setBaseCursor,
    resume,
    reset,
    getDiagnostics
  };
}

const NetworkPresentationTimelineModule = {
  createNetworkPresentationTimeline
};

export = NetworkPresentationTimelineModule;
