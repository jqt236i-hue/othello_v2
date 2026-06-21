'use strict';

function createNetworkPlaybackDispatcher(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
  let batchSeq = 0;

  function resolveRoot(): any {
    try {
      if (rootRef) return rootRef;
    } catch (e) { /* ignore */ }
    try {
      return typeof window !== 'undefined' ? window : globalThis;
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveCardState(): any {
    if (typeof cfg.getCardState === 'function') {
      try {
        const value = cfg.getCardState();
        if (value && typeof value === 'object') return value;
      } catch (e) { /* ignore */ }
    }
    const root = resolveRoot();
    try {
      if (root && root.cardState && typeof root.cardState === 'object') return root.cardState;
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolvePresentationHandler(): any {
    if (typeof cfg.handlePresentationEvent === 'function') return cfg.handlePresentationEvent;
    const root = resolveRoot();
    try {
      if (root && root.PresentationHandler && typeof root.PresentationHandler.handlePresentationEvent === 'function') {
        return root.PresentationHandler.handlePresentationEvent.bind(root.PresentationHandler);
      }
    } catch (e) { /* ignore */ }
    try {
      if (
        typeof globalThis !== 'undefined'
        && (globalThis as any).PresentationHandler
        && typeof (globalThis as any).PresentationHandler.handlePresentationEvent === 'function'
      ) {
        return (globalThis as any).PresentationHandler.handlePresentationEvent.bind((globalThis as any).PresentationHandler);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveBoardOps(): any {
    if (cfg.boardOps && typeof cfg.boardOps === 'object') return cfg.boardOps;
    const root = resolveRoot();
    try {
      if (root && root.BoardOps && typeof root.BoardOps === 'object') return root.BoardOps;
    } catch (e) { /* ignore */ }
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).BoardOps) return (globalThis as any).BoardOps;
    } catch (e) { /* ignore */ }
    return null;
  }

  function resolveBoardDrain(): any {
    if (typeof cfg.onBoardUpdated === 'function') return cfg.onBoardUpdated;
    const root = resolveRoot();
    try {
      if (root && root.PresentationHandler && typeof root.PresentationHandler.onBoardUpdated === 'function') {
        return root.PresentationHandler.onBoardUpdated.bind(root.PresentationHandler);
      }
    } catch (e) { /* ignore */ }
    try {
      if (
        typeof globalThis !== 'undefined'
        && (globalThis as any).PresentationHandler
        && typeof (globalThis as any).PresentationHandler.onBoardUpdated === 'function'
      ) {
        return (globalThis as any).PresentationHandler.onBoardUpdated.bind((globalThis as any).PresentationHandler);
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function recordTelemetry(type: string, details?: any): void {
    if (typeof cfg.recordNetworkTelemetry !== 'function') return;
    try {
      cfg.recordNetworkTelemetry(type, details || {});
    } catch (e) { /* ignore */ }
  }

  function appendPlaybackPresentationEventDirect(cardStateRef: any, event: any): boolean {
    if (!cardStateRef || typeof cardStateRef !== 'object' || !event) return false;
    if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
    if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
    cardStateRef.presentationEvents.push(event);
    cardStateRef._presentationEventsPersist.push(event);
    return true;
  }

  function removePlaybackPresentationEventByBatchId(cardStateRef: any, batchId: any): any {
    const normalizedBatchId = String(batchId || '').trim();
    if (!normalizedBatchId || !cardStateRef || typeof cardStateRef !== 'object') {
      return {
        removedPresentationEvents: 0,
        removedPersistentEvents: 0
      };
    }
    const removeFromQueue = (queue: any) => {
      if (!Array.isArray(queue)) return 0;
      const before = queue.length;
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const entry = queue[index];
        const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : null;
        if (meta && String(meta.networkPlaybackBatchId || '') === normalizedBatchId) {
          queue.splice(index, 1);
        }
      }
      return before - queue.length;
    };
    return {
      removedPresentationEvents: removeFromQueue(cardStateRef.presentationEvents),
      removedPersistentEvents: removeFromQueue(cardStateRef._presentationEventsPersist)
    };
  }

  function removePlaybackPresentationEventFromKnownCardStates(primaryCardStateRef: any, batchId: any): any {
    const candidates: any[] = [];
    const seen = new Set<any>();
    const pushCandidate = (candidate: any) => {
      if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return;
      seen.add(candidate);
      candidates.push(candidate);
    };
    pushCandidate(primaryCardStateRef);
    pushCandidate(resolveCardState());
    const root = resolveRoot();
    try { pushCandidate(root && root.cardState); } catch (e) { /* ignore */ }
    try {
      if (typeof globalThis !== 'undefined') pushCandidate((globalThis as any).cardState);
    } catch (e) { /* ignore */ }

    const total = {
      removedPresentationEvents: 0,
      removedPersistentEvents: 0
    };
    for (const candidate of candidates) {
      const removed = removePlaybackPresentationEventByBatchId(candidate, batchId);
      total.removedPresentationEvents += removed.removedPresentationEvents;
      total.removedPersistentEvents += removed.removedPersistentEvents;
    }
    return total;
  }

  function createPlaybackEvent(playbackEvents: any[], options?: any): any {
    const opts = (options && typeof options === 'object') ? options : {};
    const source = String(opts.source || 'network_timeline');
    const networkPlaybackBatchId = opts.networkPlaybackBatchId
      ? String(opts.networkPlaybackBatchId)
      : `${source}_${++batchSeq}`;
    return {
      type: 'PLAYBACK_EVENTS',
      events: playbackEvents.slice(),
      meta: {
        source,
        suppressPlayback: opts.suppressPlayback === true,
        strictNetworkPlayback: opts.strictNetworkPlayback === true,
        visualSeq: Number.isFinite(Number(opts.visualSeq)) ? Math.trunc(Number(opts.visualSeq)) : null,
        stateVersionFrom: Number.isFinite(Number(opts.stateVersionFrom)) ? Math.trunc(Number(opts.stateVersionFrom)) : null,
        stateVersionTo: Number.isFinite(Number(opts.stateVersionTo)) ? Math.trunc(Number(opts.stateVersionTo)) : null,
        networkPlaybackBatchId
      }
    };
  }

  async function dispatchNetworkPlaybackEvents(playbackEvents: any[], options?: any): Promise<any> {
    if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) {
      return { started: false, method: 'empty' };
    }
    const event = createPlaybackEvent(playbackEvents, options);
    const handler = resolvePresentationHandler();
    if (typeof handler === 'function') {
      const result = handler(event);
      if (result && typeof result.then === 'function') await result;
      const drain = resolveBoardDrain();
      if (typeof drain === 'function') {
        const drainResult = drain({
          source: event.meta.source,
          reason: 'network_playback_dispatch',
          visualSeq: event.meta.visualSeq,
          networkPlaybackBatchId: event.meta.networkPlaybackBatchId
        });
        if (drainResult && typeof drainResult.then === 'function') await drainResult;
      }
      recordTelemetry('network_playback_dispatcher_direct', {
        source: event.meta.source,
        visualSeq: event.meta.visualSeq,
        playbackEventCount: playbackEvents.length
      });
      return { started: true, method: 'presentation_handler', event };
    }

    const cardStateRef = resolveCardState();
    const boardOps = resolveBoardOps();
    let queued = false;
    let method = 'none';
    if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
      try {
        boardOps.emitPresentationEvent(cardStateRef, event);
        queued = true;
        method = 'board_ops';
      } catch (e) {
        queued = appendPlaybackPresentationEventDirect(cardStateRef, event);
        method = queued ? 'card_state_queue' : 'none';
      }
    } else {
      queued = appendPlaybackPresentationEventDirect(cardStateRef, event);
      method = queued ? 'card_state_queue' : 'none';
    }

    if (!queued) {
      recordTelemetry('network_playback_dispatcher_queue_failed', {
        source: event.meta.source,
        visualSeq: event.meta.visualSeq,
        playbackEventCount: playbackEvents.length
      });
      return { started: false, method: 'unavailable', event };
    }

    const drain = resolveBoardDrain();
    let removedAfterDrain = {
      removedPresentationEvents: 0,
      removedPersistentEvents: 0
    };
    if (typeof drain === 'function') {
      const drainResult = drain({
        source: event.meta.source,
        reason: 'network_playback_dispatch',
        visualSeq: event.meta.visualSeq,
        networkPlaybackBatchId: event.meta.networkPlaybackBatchId
      });
      if (drainResult && typeof drainResult.then === 'function') await drainResult;
      removedAfterDrain = removePlaybackPresentationEventFromKnownCardStates(
        cardStateRef,
        event.meta.networkPlaybackBatchId
      );
    }
    recordTelemetry('network_playback_dispatcher_queued', {
      source: event.meta.source,
      visualSeq: event.meta.visualSeq,
      playbackEventCount: playbackEvents.length,
      method,
      removedPresentationEvents: removedAfterDrain.removedPresentationEvents,
      removedPersistentEvents: removedAfterDrain.removedPersistentEvents
    });
    return { started: true, method, event };
  }

  return {
    dispatchNetworkPlaybackEvents
  };
}

const NetworkPlaybackDispatcherModule = {
  createNetworkPlaybackDispatcher
};

export = NetworkPlaybackDispatcherModule;
