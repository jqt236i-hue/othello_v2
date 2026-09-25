import deepClone from '../utils/deepClone';
import { freezeOwnedData, isOwnedImmutable } from '../shared/immutable-data';
import type { DurableObjectStorageLike, MatchWorkerRoomState } from './match-worker-types';
import { canCompressMatchStreamFrames, canDecompressMatchStreamFrames, rawDeflate, rawInflateText } from '../shared/match-stream-compression';

// v2 stores each replay-buffer record as raw-deflated JSON; parsing it back
// yields the same object, key order included. v3 also keeps the root small:
// authorityLog entries are ring entries like the histories, the initial
// viewer snapshots are written only when they change, and the journal base
// snapshot references the evicted journal entry it was copied from.
// v1 and v2 roots still load.
const FORMAT = 'split-history-v3';
const LEGACY_FORMATS = new Set(['split-history-v1', 'split-history-v2', FORMAT]);
const FIELDS = ['presentationJournal', 'sseEventBuffer', 'authorityLog'] as const;
const FIELD_LIMITS: Record<HistoryField, number> = { presentationJournal: 8, sseEventBuffer: 8, authorityLog: 64 };
const COMPRESSED_FIELDS = new Set<HistoryField>(['sseEventBuffer']);
const COMPRESSED_ENTRY_ENCODING = 'deflate-raw-json-v1';
const INITIAL_SNAPSHOT_FIELD = 'initialSnapshotByViewer';
const BASE_SNAPSHOT_FIELD = 'presentationJournalBaseSnapshotByViewer';
type HistoryField = typeof FIELDS[number];
type StoredRoom = {
  format: string;
  room: MatchWorkerRoomState;
  historyKeys: Partial<Record<HistoryField, string[]>>;
  initialSnapshotKey?: string | null;
  baseSnapshotJournalKey?: string | null;
};
type CompressedEntry = { encoding: typeof COMPRESSED_ENTRY_ENCODING; bytes: Uint8Array };

function isCompressedEntry(value: unknown): value is CompressedEntry {
  return !!value && typeof value === 'object' && (value as CompressedEntry).encoding === COMPRESSED_ENTRY_ENCODING;
}

async function encodeEntry(field: HistoryField, value: unknown): Promise<unknown> {
  if (!COMPRESSED_FIELDS.has(field) || !canCompressMatchStreamFrames()) return value;
  const bytes = new Uint8Array(await rawDeflate(new TextEncoder().encode(JSON.stringify(value))));
  return { encoding: COMPRESSED_ENTRY_ENCODING, bytes } as CompressedEntry;
}

async function decodeEntry(value: unknown): Promise<unknown> {
  if (!isCompressedEntry(value)) return value;
  if (!canDecompressMatchStreamFrames()) throw new Error('room_history_entry_undecodable');
  return JSON.parse(await rawInflateText(value.bytes));
}

function suffixOf(key: string): number {
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

// The root and newly appended/removed history records commit as one unit.
// Full history entries remain self-contained and viewer-separated on disk.
export function createMatchRoomStorage(storage: DurableObjectStorageLike, rootKey: string) {
  let persisted = new Map<string, unknown>();
  let persistedInitialSnapshot: { key: string; json: string } | null = null;
  let sequence = 0;
  let pending: Promise<void> = Promise.resolve();

  function noteKey(key: string): void {
    const suffix = suffixOf(key);
    if (Number.isSafeInteger(suffix)) sequence = Math.max(sequence, suffix);
  }

  async function readEntry(key: string, prefix: string): Promise<unknown> {
    if (typeof key !== 'string' || !key.startsWith(prefix)) throw new Error('room_history_key_invalid');
    const stored = await storage.get(key);
    if (!stored || typeof stored !== 'object') throw new Error('room_history_entry_missing');
    noteKey(key);
    return freezeOwnedData(deepClone(await decodeEntry(stored)));
  }

  async function load(): Promise<MatchWorkerRoomState | null> {
    persisted = new Map();
    persistedInitialSnapshot = null;
    const stored = await storage.get(rootKey);
    if (!stored || typeof stored !== 'object') return null;
    if (!LEGACY_FORMATS.has((stored as StoredRoom).format)) {
      const legacy = deepClone(stored) as MatchWorkerRoomState;
      for (const field of FIELDS) if (Array.isArray(legacy[field])) legacy[field].forEach(entry => freezeOwnedData(entry));
      return legacy;
    }
    const record = stored as StoredRoom;
    if (!record.room || !record.historyKeys) throw new Error('room_history_manifest_invalid');
    const room = deepClone(record.room) as Record<string, unknown>;
    const nextPersisted = new Map<string, unknown>();
    for (const field of FIELDS) {
      const keys = record.historyKeys[field];
      if (keys === undefined && field === 'authorityLog') {
        // Older roots kept the log in the root record itself.
        if (Array.isArray(room.authorityLog)) (room.authorityLog as unknown[]).forEach(entry => freezeOwnedData(entry));
        continue;
      }
      if (!Array.isArray(keys) || keys.length > FIELD_LIMITS[field]) throw new Error('room_history_manifest_invalid');
      room[field] = await Promise.all(keys.map(async key => {
        const value = await readEntry(key, `${rootKey}:history:`);
        nextPersisted.set(key, value);
        return value;
      }));
    }
    if (record.initialSnapshotKey) {
      const value = await readEntry(record.initialSnapshotKey, `${rootKey}:snapshot:`);
      room[INITIAL_SNAPSHOT_FIELD] = deepClone(value);
      persistedInitialSnapshot = { key: record.initialSnapshotKey, json: JSON.stringify(value) };
      nextPersisted.set(record.initialSnapshotKey, value);
    }
    if (record.baseSnapshotJournalKey) {
      const key = record.baseSnapshotJournalKey;
      const entry = (nextPersisted.get(key) || await readEntry(key, `${rootKey}:history:presentationJournal:`)) as Record<string, unknown>;
      room[BASE_SNAPSHOT_FIELD] = deepClone(entry.snapshotAfterByViewer || {});
      nextPersisted.set(key, entry);
    }
    persisted = nextPersisted;
    return room as MatchWorkerRoomState;
  }

  function save(room: MatchWorkerRoomState | null): Promise<void> {
    // Minimal storage adapters retain the atomic legacy single-key contract.
    if (typeof storage.transaction !== 'function') return Promise.resolve(storage.put(rootKey, deepClone(room)));
    const head = room ? { ...room } as Record<string, unknown> : null;
    // The authority log is optional on a room; only a present log is persisted
    // as a ring so an absent one stays absent after reload.
    const histories = FIELDS
      .filter(field => field !== 'authorityLog' || (room && Array.isArray(room.authorityLog)))
      .map(field => ({ field, values: room && Array.isArray(room[field]) ? (room[field] as unknown[]).slice() : [] }));
    if (head) for (const field of FIELDS) delete head[field];
    const initialSnapshot = head && head[INITIAL_SNAPSHOT_FIELD] && typeof head[INITIAL_SNAPSHOT_FIELD] === 'object'
      ? JSON.stringify(head[INITIAL_SNAPSHOT_FIELD]) : null;
    const baseSnapshot = head && head[BASE_SNAPSHOT_FIELD] && typeof head[BASE_SNAPSHOT_FIELD] === 'object'
      ? JSON.stringify(head[BASE_SNAPSHOT_FIELD]) : null;
    const baseVisualSeq = head ? head.presentationJournalBaseVisualSeq : null;
    const ownedHead = deepClone(head) as Record<string, unknown> | null;
    // `ownedHead` already holds a private deep copy of the initial snapshots (captured now, before
    // the queued transaction runs); it is frozen only when the record actually has to be written.
    const capturedInitialSnapshot = initialSnapshot === null || !ownedHead ? null : ownedHead[INITIAL_SNAPSHOT_FIELD];
    const captured = histories.map(({ field, values }) => ({ field, values: values.map(value => isOwnedImmutable(value) ? value : freezeOwnedData(deepClone(value))) }));
    const run = async () => {
      const writes = new Map<string, unknown>();
      const nextPersisted = new Map<string, unknown>();
      const historyKeys: Partial<Record<HistoryField, string[]>> = {};
      for (const { field, values } of captured) {
        historyKeys[field] = [];
        for (const value of values) {
          const previous = Array.from(persisted).find(([key, entry]) => key.startsWith(`${rootKey}:history:${field}:`) && entry === value);
          const key = previous ? previous[0] : `${rootKey}:history:${field}:${++sequence}`;
          historyKeys[field]!.push(key);
          nextPersisted.set(key, value);
          if (!previous) writes.set(key, await encodeEntry(field, value));
        }
      }
      let initialSnapshotKey: string | null = null;
      let nextInitialSnapshot = persistedInitialSnapshot;
      if (initialSnapshot !== null && ownedHead) {
        if (persistedInitialSnapshot && persistedInitialSnapshot.json === initialSnapshot) {
          initialSnapshotKey = persistedInitialSnapshot.key;
          nextPersisted.set(initialSnapshotKey, persisted.get(initialSnapshotKey));
        } else {
          initialSnapshotKey = `${rootKey}:snapshot:${INITIAL_SNAPSHOT_FIELD}:${++sequence}`;
          const ownedInitialSnapshot = freezeOwnedData(capturedInitialSnapshot);
          writes.set(initialSnapshotKey, ownedInitialSnapshot);
          nextPersisted.set(initialSnapshotKey, ownedInitialSnapshot);
          nextInitialSnapshot = { key: initialSnapshotKey, json: initialSnapshot };
        }
        delete ownedHead[INITIAL_SNAPSHOT_FIELD];
      } else {
        nextInitialSnapshot = null;
      }
      let baseSnapshotJournalKey: string | null = null;
      if (baseSnapshot !== null && ownedHead) {
        // The base is a copy of the evicted entry's snapshots; keep that entry
        // as the reference instead of rewriting the copy with every root.
        const source = Array.from(persisted).find(([key, entry]) => key.startsWith(`${rootKey}:history:presentationJournal:`)
          && !!entry && (entry as Record<string, unknown>).visualSeq === baseVisualSeq
          && JSON.stringify((entry as Record<string, unknown>).snapshotAfterByViewer || {}) === baseSnapshot);
        if (source) {
          baseSnapshotJournalKey = source[0];
          nextPersisted.set(source[0], source[1]);
          delete ownedHead[BASE_SNAPSHOT_FIELD];
        }
      }
      await storage.transaction!(async txn => {
        const operations: Array<Promise<unknown> | unknown> = [];
        for (const [key, value] of writes) operations.push(txn.put(key, value));
        for (const key of persisted.keys()) if (!nextPersisted.has(key)) operations.push(txn.delete(key));
        operations.push(txn.put(rootKey, ownedHead
          ? { format: FORMAT, room: ownedHead, historyKeys, initialSnapshotKey, baseSnapshotJournalKey }
          : null));
        await Promise.all(operations);
      });
      // Never advance the in-memory write cache on a failed transaction.
      persisted = nextPersisted;
      persistedInitialSnapshot = nextInitialSnapshot;
    };
    const result = pending.then(run);
    pending = result.catch(() => {});
    return result;
  }

  function reset(): void { persisted = new Map(); persistedInitialSnapshot = null; sequence = 0; }
  return { load, save, reset };
}
