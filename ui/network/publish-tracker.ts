'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function cloneData(value: any): any {
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
      return (globalThis as any).structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value));
}

function createNetworkPublishTracker(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
  const cloneFn = typeof cfg.cloneData === 'function' ? cfg.cloneData : cloneData;
  const getSnapshotStateVersion = typeof cfg.getSnapshotStateVersion === 'function'
    ? cfg.getSnapshotStateVersion
    : function () { return null; };

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_publish_tracker_state_required');
    }
    return state;
  }

  function ensurePublishTracker(): any {
    const state = readState();
    let tracker = (state.publishTracker && typeof state.publishTracker === 'object')
      ? state.publishTracker
      : null;
    if (tracker && Array.isArray(tracker.operations) && Number.isFinite(Number(tracker.nextSequence))) {
      return tracker;
    }

    state.publishTracker = {
      nextSequence: 0,
      operations: []
    };
    return state.publishTracker;
  }

  function pruneTrackedPublishes(): any[] {
    const tracker = ensurePublishTracker();
    const now = Date.now();
    tracker.operations = tracker.operations.filter(function (entry: any) {
      if (!entry || !entry.operationId) return false;
      if (entry.phase === 'settled') return false;
      if (entry.responseSettled === true && entry.selfSnapshotReceived === true) return false;
      if (
        entry.responseSettled === true
        && Number.isFinite(Number(entry.completedAt))
        && (now - Number(entry.completedAt)) > cfg.retentionMs
      ) {
        return false;
      }
      return true;
    });

    if (tracker.operations.length > cfg.maxOperations) {
      tracker.operations = tracker.operations.slice(tracker.operations.length - cfg.maxOperations);
    }
    return tracker.operations;
  }

  function resetPublishTracker(): void {
    const state = readState();
    state.publishTracker = {
      nextSequence: 0,
      operations: []
    };
  }

  function createTrackedPublish(operationId: string, requestMeta?: any): any {
    const tracker = ensurePublishTracker();
    const sequence = Number.isFinite(Number(tracker.nextSequence))
      ? Number(tracker.nextSequence) + 1
      : 1;
    tracker.nextSequence = sequence;

    const entry = {
      operationId: String(operationId || ''),
      sequence: sequence,
      phase: 'queued',
      responseSettled: false,
      responseVersion: null,
      selfSnapshotReceived: false,
      selfSnapshotVersion: null,
      appliedSource: '',
      appliedVersion: null,
      completedAt: null,
      requestMeta: (requestMeta && typeof requestMeta === 'object') ? {
        actionType: requestMeta.actionType || null,
        actor: requestMeta.actor || null,
        params: (requestMeta.params && typeof requestMeta.params === 'object') ? cloneFn(requestMeta.params) : null,
        playbackEvents: Array.isArray(requestMeta.playbackEvents) ? cloneFn(requestMeta.playbackEvents) : [],
        localPlaybackEmitted: requestMeta.localPlaybackEmitted === true,
        usedSnapshotFallback: requestMeta.usedSnapshotFallback === true,
        snapshotProjectedHash: (typeof requestMeta.snapshotProjectedHash === 'string' && requestMeta.snapshotProjectedHash)
          ? requestMeta.snapshotProjectedHash
          : null
      } : null
    };
    tracker.operations.push(entry);
    pruneTrackedPublishes();
    return entry;
  }

  function getTrackedPublishRequestedPlaybackEvents(entry: any): any[] {
    const playbackEvents = entry && entry.requestMeta && Array.isArray(entry.requestMeta.playbackEvents)
      ? entry.requestMeta.playbackEvents
      : [];
    return playbackEvents;
  }

  function hasTrackedPublishLocalPlaybackEmitted(entry: any): boolean {
    return !!(entry && entry.requestMeta && entry.requestMeta.localPlaybackEmitted === true);
  }

  function findTrackedPublish(operationId: string): any {
    if (!operationId) return null;
    const operations = pruneTrackedPublishes();
    for (let index = 0; index < operations.length; index += 1) {
      const entry = operations[index];
      if (entry && entry.operationId === operationId) {
        return entry;
      }
    }
    return null;
  }

  function settleTrackedPublish(entry: any): void {
    if (!entry || typeof entry !== 'object') return;
    entry.phase = 'settled';
    entry.completedAt = Date.now();
    pruneTrackedPublishes();
  }

  function markTrackedPublishInFlight(entry: any): void {
    if (!entry || typeof entry !== 'object') return;
    entry.phase = 'inflight';
  }

  function markTrackedPublishResponse(entry: any, stateVersionValue: number): void {
    if (!entry || typeof entry !== 'object') return;
    entry.phase = 'acknowledged';
    entry.responseSettled = true;
    entry.responseVersion = Number.isFinite(Number(stateVersionValue))
      ? Number(stateVersionValue)
      : null;
    entry.completedAt = Date.now();
    if (entry.selfSnapshotReceived === true) {
      settleTrackedPublish(entry);
    } else {
      pruneTrackedPublishes();
    }
  }

  function markTrackedPublishSelfSnapshot(entry: any, snapshot: any): void {
    if (!entry || typeof entry !== 'object') return;
    entry.selfSnapshotReceived = true;
    entry.selfSnapshotVersion = getSnapshotStateVersion(snapshot);
    if (entry.responseSettled === true) {
      settleTrackedPublish(entry);
    }
  }

  function markTrackedPublishSnapshotApplied(entry: any, snapshot: any, source: string): void {
    if (!entry || typeof entry !== 'object') return;
    entry.appliedSource = typeof source === 'string' ? source : '';
    entry.appliedVersion = getSnapshotStateVersion(snapshot);
  }

  function hasTrackedPublishPresentedResult(entry: any): boolean {
    return !!(entry && entry.resultOverlayPresented === true);
  }

  function markTrackedPublishResultPresented(entry: any, snapshot: any): void {
    if (!entry || typeof entry !== 'object') return;
    entry.resultOverlayPresented = true;
    entry.resultOverlayVersion = getSnapshotStateVersion(snapshot);
  }

  function hasPendingLocalPublishes(options?: any): boolean {
    const opts = (options && typeof options === 'object') ? options : {};
    const ignoredSequence = Number.isFinite(Number(opts.ignoreSequence))
      ? Number(opts.ignoreSequence)
      : null;
    const operations = pruneTrackedPublishes();
    return operations.some(function (entry: any) {
      if (!entry || (entry.phase !== 'queued' && entry.phase !== 'inflight')) return false;
      if (ignoredSequence === null) return true;
      return Number(entry.sequence) !== ignoredSequence;
    });
  }

  function hasNewerQueuedPublish(sequence: number): boolean {
    const currentSequence = Number.isFinite(Number(sequence)) ? Number(sequence) : 0;
    const operations = pruneTrackedPublishes();
    return operations.some(function (entry: any) {
      return entry && entry.phase !== 'settled' && Number(entry.sequence) > currentSequence;
    });
  }

  function getPendingLocalPublishProjectedSnapshotHash(options?: any): string | null {
    const opts = (options && typeof options === 'object') ? options : {};
    const ignoredSequence = Number.isFinite(Number(opts.ignoreSequence))
      ? Number(opts.ignoreSequence)
      : null;
    const operations = pruneTrackedPublishes();
    for (let index = operations.length - 1; index >= 0; index -= 1) {
      const entry = operations[index];
      if (!entry || (entry.phase !== 'queued' && entry.phase !== 'inflight')) continue;
      if (ignoredSequence !== null && Number(entry.sequence) === ignoredSequence) continue;
      const requestMeta = entry.requestMeta;
      if (
        requestMeta
        && typeof requestMeta.snapshotProjectedHash === 'string'
        && requestMeta.snapshotProjectedHash
      ) {
        return requestMeta.snapshotProjectedHash;
      }
    }
    return null;
  }

  return {
    ensurePublishTracker,
    pruneTrackedPublishes,
    resetPublishTracker,
    createTrackedPublish,
    getTrackedPublishRequestedPlaybackEvents,
    hasTrackedPublishLocalPlaybackEmitted,
    findTrackedPublish,
    settleTrackedPublish,
    markTrackedPublishInFlight,
    markTrackedPublishResponse,
    markTrackedPublishSelfSnapshot,
    markTrackedPublishSnapshotApplied,
    hasTrackedPublishPresentedResult,
    markTrackedPublishResultPresented,
    hasPendingLocalPublishes,
    hasNewerQueuedPublish,
    getPendingLocalPublishProjectedSnapshotHash
  };
}

const NetworkPublishTracker = {
  createNetworkPublishTracker
};

export = NetworkPublishTracker;
