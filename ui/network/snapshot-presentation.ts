'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PresentationQueue = _require('../../shared/presentation-queue');

function cloneData(value: any, cloneFn?: any): any {
  if (typeof cloneFn === 'function') {
    return cloneFn(value);
  }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
      return (globalThis as any).structuredClone(value);
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(value));
}

function clearTransientPresentationQueues(cardStateRef: any): void {
  if (!cardStateRef || typeof cardStateRef !== 'object') return;
  if (PresentationQueue && typeof PresentationQueue.clearPresentationQueues === 'function') {
    PresentationQueue.clearPresentationQueues(cardStateRef);
    return;
  }
  if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
  else cardStateRef.presentationEvents.length = 0;
  if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
  else cardStateRef._presentationEventsPersist.length = 0;
}

function captureTransientPresentationQueues(cardStateRef: any, cloneFn?: any): any {
  if (!cardStateRef || typeof cardStateRef !== 'object') {
    return {
      presentationEvents: [],
      persistentEvents: [],
      hasPending: false
    };
  }

  const presentationEvents = Array.isArray(cardStateRef.presentationEvents)
    ? cloneData(cardStateRef.presentationEvents, cloneFn)
    : [];
  const persistentEvents = Array.isArray(cardStateRef._presentationEventsPersist)
    ? cloneData(cardStateRef._presentationEventsPersist, cloneFn)
    : [];

  return {
    presentationEvents,
    persistentEvents,
    hasPending: presentationEvents.length > 0 || persistentEvents.length > 0
  };
}

function restoreTransientPresentationQueues(cardStateRef: any, queues: any): void {
  if (!cardStateRef || typeof cardStateRef !== 'object') return;
  const source = queues && typeof queues === 'object' ? queues : {};
  cardStateRef.presentationEvents = Array.isArray(source.presentationEvents)
    ? source.presentationEvents.slice()
    : [];
  cardStateRef._presentationEventsPersist = Array.isArray(source.persistentEvents)
    ? source.persistentEvents.slice()
    : [];
}

function getTransientPresentationQueueSignature(source: any): string | null {
  const ref = (source && typeof source === 'object') ? source : {};
  const presentationEvents = Array.isArray(ref.presentationEvents)
    ? ref.presentationEvents
    : [];
  const persistentEvents = Array.isArray(ref.persistentEvents)
    ? ref.persistentEvents
    : (Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist : []);

  try {
    return JSON.stringify({
      presentationEvents,
      persistentEvents
    });
  } catch (e) {
    return null;
  }
}

function hasPendingPresentationEvents(source: any): boolean {
  if (PresentationQueue && typeof PresentationQueue.getPresentationQueueState === 'function') {
    return PresentationQueue.getPresentationQueueState(source).hasPending === true;
  }
  const ref = (source && typeof source === 'object') ? source : {};
  const pendingPersist = Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist.length > 0 : false;
  const pendingLive = Array.isArray(ref.presentationEvents) ? ref.presentationEvents.length > 0 : false;
  return pendingPersist || pendingLive;
}

function reconcilePresentationQueues(cardStateRef: any, options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  const preservedQueues = opts.preservedQueues || {
    presentationEvents: [],
    persistentEvents: [],
    hasPending: false
  };
  const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
  const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
  const dropPreservedQueues = opts.dropPreservedQueues === true;
  const hasPendingPreservedQueues = preservedQueues.hasPending === true;
  const hasPlaybackEvents = playbackEvents.length > 0;
  const shouldEmitShadowPlayback = !hasPlaybackEvents
    && (!hasPendingPreservedQueues || dropPreservedQueues)
    && shadowPlaybackEvents.length > 0;
  const restoredPreservedQueues = !hasPlaybackEvents
    && !shouldEmitShadowPlayback
    && hasPendingPreservedQueues
    && !dropPreservedQueues;

  if (hasPlaybackEvents || shouldEmitShadowPlayback || dropPreservedQueues) {
    clearTransientPresentationQueues(cardStateRef);
  } else if (restoredPreservedQueues) {
    restoreTransientPresentationQueues(cardStateRef, preservedQueues);
  } else {
    clearTransientPresentationQueues(cardStateRef);
  }

  return {
    hasPlaybackEvents,
    shouldEmitShadowPlayback,
    shouldKeepBusy: hasPlaybackEvents || (hasPendingPreservedQueues && !dropPreservedQueues),
    restoredPreservedQueues,
    restoredQueueSignature: restoredPreservedQueues
      ? getTransientPresentationQueueSignature(preservedQueues)
      : null
  };
}

const SnapshotPresentation = {
  clearTransientPresentationQueues,
  captureTransientPresentationQueues,
  restoreTransientPresentationQueues,
  getTransientPresentationQueueSignature,
  hasPendingPresentationEvents,
  reconcilePresentationQueues
};

export = SnapshotPresentation;
