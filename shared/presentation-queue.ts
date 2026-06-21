'use strict';

interface PresentationQueueHost {
  presentationEvents?: any[];
  _presentationEventsPersist?: any[];
  [key: string]: any;
}

function isObject(value: any): value is PresentationQueueHost {
  return !!value && typeof value === 'object';
}

function getLiveQueue(host: any): any[] {
  return isObject(host) && Array.isArray(host.presentationEvents) ? host.presentationEvents : [];
}

function getPersistentQueue(host: any): any[] {
  return isObject(host) && Array.isArray(host._presentationEventsPersist) ? host._presentationEventsPersist : [];
}

function ensurePresentationQueues(host: any): PresentationQueueHost | null {
  if (!isObject(host)) return null;
  if (!Array.isArray(host.presentationEvents)) host.presentationEvents = [];
  if (!Array.isArray(host._presentationEventsPersist)) host._presentationEventsPersist = [];
  return host;
}

function appendPresentationEvent(host: any, event: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state || !event || typeof event !== 'object') return false;
  state.presentationEvents!.push(event);
  state._presentationEventsPersist!.push(event);
  return true;
}

function appendPersistedPresentationEvent(host: any, event: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state || !event || typeof event !== 'object') return false;
  state._presentationEventsPersist!.push(event);
  return true;
}

function drainLivePresentationEvents(host: any): any[] {
  if (!isObject(host) || !Array.isArray(host.presentationEvents)) return [];
  const drained = host.presentationEvents.slice();
  host.presentationEvents.length = 0;
  return drained;
}

function getPresentationEventSignature(event: any): string | null {
  if (!event || typeof event !== 'object') return null;
  try {
    return JSON.stringify(event);
  } catch (e) {
    return null;
  }
}

function removePersistedPresentationEvent(host: any, event: any): boolean {
  const persisted = getPersistentQueue(host);
  if (!persisted.length || !event) return false;
  let index = persisted.indexOf(event);
  if (index < 0) {
    const signature = getPresentationEventSignature(event);
    if (signature) {
      index = persisted.findIndex((candidate) => getPresentationEventSignature(candidate) === signature);
    }
  }
  if (index < 0) return false;
  persisted.splice(index, 1);
  return true;
}

function clearPresentationQueues(host: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state) return false;
  state.presentationEvents!.length = 0;
  state._presentationEventsPersist!.length = 0;
  return true;
}

function isPlaybackEntry(entry: any): boolean {
  return !!entry && typeof entry === 'object' && String(entry.type || '').trim().toUpperCase() === 'PLAYBACK_EVENTS';
}

function getPresentationQueueState(host: any): any {
  const presentationEvents = getLiveQueue(host);
  const persistentEvents = getPersistentQueue(host);
  const entries = presentationEvents.concat(persistentEvents);
  return {
    presentationEvents,
    persistentEvents,
    entries,
    hasPending: entries.length > 0,
    hasVisualPlayback: entries.some(isPlaybackEntry)
  };
}

const PresentationQueue = {
  ensurePresentationQueues,
  appendPresentationEvent,
  appendPersistedPresentationEvent,
  drainLivePresentationEvents,
  removePersistedPresentationEvent,
  clearPresentationQueues,
  getPresentationQueueState
};

export = PresentationQueue;
