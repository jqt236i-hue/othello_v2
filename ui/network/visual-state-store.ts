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
    throw new Error('network_visual_snapshot_clone_failed');
  }
}

function deepFreezeSnapshot<T>(value: T, seen?: WeakSet<object>): T {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  const objectValue = value as unknown as object;
  const visited = seen || new WeakSet<object>();
  if (visited.has(objectValue)) return value;
  visited.add(objectValue);
  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      deepFreezeSnapshot(descriptor.value, visited);
    }
  }
  return Object.freeze(value);
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

function areSnapshotValuesEquivalent(left: any, right: any, visited?: WeakMap<object, WeakSet<object>>): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const seenPairs = visited || new WeakMap<object, WeakSet<object>>();
  let rightSet = seenPairs.get(left);
  if (rightSet && rightSet.has(right)) return true;
  if (!rightSet) {
    rightSet = new WeakSet<object>();
    seenPairs.set(left, rightSet);
  }
  rightSet.add(right);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = leftKeys[index];
    if (!areSnapshotValuesEquivalent(left[key], right[key], seenPairs)) return false;
  }
  return true;
}

function createNetworkVisualStateStore(options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  const receiptRecords = new WeakMap<object, Readonly<{
    generation: number;
    visualSeq: number;
    visualVersion: number;
    snapshot: any;
  }>>();
  let canonicalSnapshot: any = null;
  let canonicalVersion: number | null = null;
  let visualSnapshot: any = null;
  let visualSeq = 0;
  let visualVersion: number | null = null;
  let lastCommitSource = '';
  let lastCommitReceipt: any = null;
  let generation = 0;

  function cloneSnapshot(value: any, reason: string): any {
    const cloned = typeof opts.cloneData === 'function'
      ? opts.cloneData(value, reason)
      : cloneData(value);
    if (typeof opts.onClone === 'function') opts.onClone(reason, value, cloned);
    return cloned;
  }

  function freezeOwnedSnapshot(value: any, reason: string): any {
    const prepared = typeof opts.freezeOwnedSnapshot === 'function'
      ? opts.freezeOwnedSnapshot(value, reason)
      : value;
    if (!prepared || (typeof prepared !== 'object' && typeof prepared !== 'function')) {
      throw new Error('network_visual_snapshot_freeze_failed');
    }
    return deepFreezeSnapshot(prepared);
  }

  function cloneOwnedSnapshot(value: any, reason: string): any {
    return freezeOwnedSnapshot(cloneSnapshot(value, reason), reason);
  }

  function cloneReadableSnapshot(value: any, reason: string): any {
    const cloned = cloneSnapshot(value, reason);
    // Preserve the existing injectable frozen-read behavior while keeping the
    // production clone getters independently mutable. The zero-copy peek and
    // receipt APIs only expose store-owned, always-frozen snapshots.
    return typeof opts.freezeOwnedSnapshot === 'function'
      ? freezeOwnedSnapshot(cloned, reason)
      : cloned;
  }

  function invalidateCommitReceipts(): void {
    generation += 1;
    lastCommitReceipt = null;
  }

  function setCanonicalSnapshot(snapshot: any, meta?: any): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    canonicalSnapshot = cloneOwnedSnapshot(snapshot, 'setCanonicalSnapshot');
    canonicalVersion = readSnapshotVersion(canonicalSnapshot, meta && meta.stateVersion);
  }

  function setBaseVisualSnapshot(snapshot: any, meta?: any): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const opts = (meta && typeof meta === 'object') ? meta : {};
    if (opts.preserveExisting === true && visualSnapshot) {
      return;
    }
    const nextVisualVersion = readSnapshotVersion(snapshot, opts.visualVersion);
    const nextVisualSnapshot = cloneOwnedSnapshot(snapshot, 'setBaseVisualSnapshot');
    const nextVisualSeq = toIntegerOrNull(opts.visualSeq);
    invalidateCommitReceipts();
    visualSnapshot = nextVisualSnapshot;
    if (nextVisualSeq !== null && nextVisualSeq >= 0) visualSeq = nextVisualSeq;
    visualVersion = nextVisualVersion;
    lastCommitSource = String(opts.source || 'base');
  }

  function commitFrame(frame: any, meta?: any): any {
    if (!frame || typeof frame !== 'object') throw new Error('visual_state_commit_frame_required');
    const frameSeq = toIntegerOrNull(frame.visualSeq);
    if (frameSeq === null || frameSeq < 0) throw new Error('visual_state_commit_visual_seq_required');
    const snapshotAfter = frame.snapshotAfter && typeof frame.snapshotAfter === 'object'
      ? frame.snapshotAfter
      : null;
    if (!snapshotAfter) throw new Error('visual_state_commit_snapshot_required');
    const frameVersion = readSnapshotVersion(snapshotAfter, frame.stateVersionTo);
    if (frameVersion === null || frameVersion < 0) throw new Error('visual_state_commit_version_required');
    if (
      isCurrentCommitReceipt(lastCommitReceipt)
      && lastCommitReceipt.visualSeq === frameSeq
      && lastCommitReceipt.visualVersion === frameVersion
    ) {
      if (!areSnapshotValuesEquivalent(snapshotAfter, visualSnapshot)) {
        throw new Error('visual_state_commit_conflict');
      }
      return lastCommitReceipt;
    }
    if (frameSeq <= visualSeq) throw new Error('visual_state_commit_out_of_order');
    const committedSnapshot = cloneOwnedSnapshot(snapshotAfter, 'commitFrame');
    const committedGeneration = generation + 1;
    const commitOptions = (meta && typeof meta === 'object') ? meta : {};
    const commitSource = String(commitOptions.source || 'frame');
    const receipt = Object.freeze({
      kind: 'network-visual-commit',
      visualSeq: frameSeq,
      visualVersion: frameVersion,
      source: commitSource,
      snapshotOwnership: 'copy_on_commit'
    });
    receiptRecords.set(receipt, Object.freeze({
      generation: committedGeneration,
      visualSeq: frameSeq,
      visualVersion: frameVersion,
      snapshot: committedSnapshot
    }));
    generation = committedGeneration;
    visualSnapshot = committedSnapshot;
    visualSeq = frameSeq;
    visualVersion = frameVersion;
    lastCommitSource = commitSource;
    lastCommitReceipt = receipt;
    return lastCommitReceipt;
  }

  function clearVisualSnapshot(): void {
    invalidateCommitReceipts();
    visualSnapshot = null;
    visualSeq = 0;
    visualVersion = null;
    lastCommitSource = '';
  }

  function reset(): void {
    invalidateCommitReceipts();
    canonicalSnapshot = null;
    canonicalVersion = null;
    visualSnapshot = null;
    visualSeq = 0;
    visualVersion = null;
    lastCommitSource = '';
  }

  function isCurrentCommitReceipt(receipt: any): boolean {
    if (!receipt || (typeof receipt !== 'object' && typeof receipt !== 'function')) return false;
    if (receipt !== lastCommitReceipt) return false;
    const record = receiptRecords.get(receipt);
    return !!(
      record
      && record.generation === generation
      && record.visualSeq === visualSeq
      && record.visualVersion === visualVersion
      && record.snapshot === visualSnapshot
    );
  }

  function getSnapshotForReceipt(receipt: any): any {
    if (!isCurrentCommitReceipt(receipt)) return null;
    const record = receiptRecords.get(receipt);
    const snapshot = record ? record.snapshot : null;
    if (snapshot && typeof opts.onReadonlyPeek === 'function') {
      opts.onReadonlyPeek('getSnapshotForReceipt', snapshot);
    }
    return snapshot;
  }

  function getCanonicalSnapshot(): any {
    return canonicalSnapshot ? cloneReadableSnapshot(canonicalSnapshot, 'getCanonicalSnapshot') : null;
  }

  function getVisualSnapshot(): any {
    return visualSnapshot ? cloneReadableSnapshot(visualSnapshot, 'getVisualSnapshot') : null;
  }

  function getRenderSnapshot(): any {
    if (visualSnapshot) return cloneReadableSnapshot(visualSnapshot, 'getRenderSnapshot');
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
    const operationalState = getOperationalState();
    return {
      ...operationalState,
      lastCommitSource
    };
  }

  function getOperationalState(): Readonly<{
    canonicalVersion: number | null;
    visualSeq: number;
    visualVersion: number | null;
    lagging: boolean;
    hasCanonicalSnapshot: boolean;
    hasVisualSnapshot: boolean;
  }> {
    return Object.freeze({
      canonicalVersion,
      visualSeq,
      visualVersion,
      lagging: canonicalVersion !== null
        && visualVersion !== null
        && visualVersion < canonicalVersion,
      hasCanonicalSnapshot: !!canonicalSnapshot,
      hasVisualSnapshot: !!visualSnapshot
    });
  }

  return {
    setCanonicalSnapshot,
    setBaseVisualSnapshot,
    commitFrame,
    clearVisualSnapshot,
    reset,
    isCurrentCommitReceipt,
    getSnapshotForReceipt,
    getCanonicalSnapshot,
    getVisualSnapshot,
    getRenderSnapshot,
    peekRenderSnapshot,
    getOperationalState,
    getDiagnostics
  };
}

const NetworkVisualStateStoreModule = {
  createNetworkVisualStateStore
};

export = NetworkVisualStateStoreModule;
