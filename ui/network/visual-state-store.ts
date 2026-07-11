'use strict';

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

function toIntegerOrNull(value: any): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.trunc(numberValue);
}

function readSnapshotVersion(snapshot: any, fallback?: any): number | null {
  const direct = toIntegerOrNull(snapshot && snapshot.stateVersion);
  if (direct !== null) return direct;
  const metaVersion = toIntegerOrNull(snapshot && snapshot._meta && snapshot._meta.stateVersion);
  if (metaVersion !== null) return metaVersion;
  return toIntegerOrNull(fallback);
}

function createNetworkVisualStateStore(options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  let canonicalSnapshot: any = null;
  let canonicalVersion: number | null = null;
  let visualSnapshot: any = null;
  let visualSeq = 0;
  let visualVersion: number | null = null;
  let lastCommitSource = '';

  function cloneOwnedSnapshot(value: any, reason: string): any {
    const cloned = typeof opts.cloneData === 'function'
      ? opts.cloneData(value, reason)
      : cloneData(value);
    if (typeof opts.onClone === 'function') opts.onClone(reason, value, cloned);
    return typeof opts.freezeOwnedSnapshot === 'function'
      ? opts.freezeOwnedSnapshot(cloned, reason)
      : cloned;
  }

  function setCanonicalSnapshot(snapshot: any, meta?: any): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    canonicalSnapshot = cloneOwnedSnapshot(snapshot, 'setCanonicalSnapshot');
    canonicalVersion = readSnapshotVersion(canonicalSnapshot, meta && meta.stateVersion);
  }

  function setBaseVisualSnapshot(snapshot: any, meta?: any): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const opts = (meta && typeof meta === 'object') ? meta : {};
    const nextVisualVersion = readSnapshotVersion(snapshot, opts.visualVersion);
    if (
      opts.preserveExisting === true
      && visualSnapshot
      && visualVersion !== null
      && nextVisualVersion !== null
      && visualVersion < nextVisualVersion
    ) {
      return;
    }
    visualSnapshot = cloneOwnedSnapshot(snapshot, 'setBaseVisualSnapshot');
    const nextVisualSeq = toIntegerOrNull(opts.visualSeq);
    if (nextVisualSeq !== null && nextVisualSeq >= 0) visualSeq = nextVisualSeq;
    visualVersion = nextVisualVersion;
    lastCommitSource = String(opts.source || 'base');
  }

  function commitFrame(frame: any, meta?: any): void {
    if (!frame || typeof frame !== 'object') return;
    const snapshotAfter = frame.snapshotAfter && typeof frame.snapshotAfter === 'object'
      ? frame.snapshotAfter
      : null;
    if (snapshotAfter) {
      visualSnapshot = cloneOwnedSnapshot(snapshotAfter, 'commitFrame');
    }
    const frameSeq = toIntegerOrNull(frame.visualSeq);
    if (frameSeq !== null && frameSeq >= 0) visualSeq = frameSeq;
    const frameVersion = readSnapshotVersion(snapshotAfter, frame.stateVersionTo);
    if (frameVersion !== null) visualVersion = frameVersion;
    const opts = (meta && typeof meta === 'object') ? meta : {};
    lastCommitSource = String(opts.source || 'frame');
  }

  function clearVisualSnapshot(): void {
    visualSnapshot = null;
    visualSeq = 0;
    visualVersion = null;
    lastCommitSource = '';
  }

  function getCanonicalSnapshot(): any {
    return canonicalSnapshot ? cloneOwnedSnapshot(canonicalSnapshot, 'getCanonicalSnapshot') : null;
  }

  function getVisualSnapshot(): any {
    return visualSnapshot ? cloneOwnedSnapshot(visualSnapshot, 'getVisualSnapshot') : null;
  }

  function getRenderSnapshot(): any {
    if (visualSnapshot) return cloneOwnedSnapshot(visualSnapshot, 'getRenderSnapshot');
    return getCanonicalSnapshot();
  }

  function peekRenderSnapshot(): any {
    const snapshot = visualSnapshot || canonicalSnapshot;
    if (snapshot && typeof opts.onReadonlyPeek === 'function') {
      opts.onReadonlyPeek('peekRenderSnapshot', snapshot);
    }
    return snapshot;
  }

  function getDiagnostics(): any {
    const lagging = canonicalVersion !== null
      && visualVersion !== null
      && visualVersion < canonicalVersion;
    return {
      canonicalVersion,
      visualSeq,
      visualVersion,
      lagging,
      hasCanonicalSnapshot: !!canonicalSnapshot,
      hasVisualSnapshot: !!visualSnapshot,
      lastCommitSource
    };
  }

  return {
    setCanonicalSnapshot,
    setBaseVisualSnapshot,
    commitFrame,
    clearVisualSnapshot,
    getCanonicalSnapshot,
    getVisualSnapshot,
    getRenderSnapshot,
    peekRenderSnapshot,
    getDiagnostics
  };
}

const NetworkVisualStateStoreModule = {
  createNetworkVisualStateStore
};

export = NetworkVisualStateStoreModule;
