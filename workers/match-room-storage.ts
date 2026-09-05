import deepClone from '../utils/deepClone';
import { freezeOwnedData, isOwnedImmutable } from '../shared/immutable-data';
import type { DurableObjectStorageLike, MatchWorkerRoomState } from './match-worker-types';

const FORMAT = 'split-history-v1';
const FIELDS = ['presentationJournal', 'sseEventBuffer'] as const;
type HistoryField = typeof FIELDS[number];
type StoredRoom = { format: typeof FORMAT; room: MatchWorkerRoomState; historyKeys: Record<HistoryField, string[]> };

// The root and newly appended/removed history records commit as one unit.
// Full history entries remain self-contained and viewer-separated on disk.
export function createMatchRoomStorage(storage: DurableObjectStorageLike, rootKey: string) {
  let persisted = new Map<string, unknown>();
  let sequence = 0;
  let pending: Promise<void> = Promise.resolve();

  async function load(): Promise<MatchWorkerRoomState | null> {
    persisted = new Map();
    const stored = await storage.get(rootKey);
    if (!stored || typeof stored !== 'object') return null;
    if ((stored as StoredRoom).format !== FORMAT) {
      const legacy = deepClone(stored) as MatchWorkerRoomState;
      for (const field of FIELDS) if (Array.isArray(legacy[field])) legacy[field].forEach(entry => freezeOwnedData(entry));
      return legacy;
    }
    const record = stored as StoredRoom;
    if (!record.room || !record.historyKeys) throw new Error('room_history_manifest_invalid');
    const room = deepClone(record.room);
    const nextPersisted = new Map<string, unknown>();
    for (const field of FIELDS) {
      const keys = record.historyKeys[field];
      if (!Array.isArray(keys) || keys.length > 8) throw new Error('room_history_manifest_invalid');
      const entries = await Promise.all(keys.map(async key => {
        if (typeof key !== 'string' || !key.startsWith(`${rootKey}:history:`)) throw new Error('room_history_key_invalid');
        const entry = await storage.get(key);
        if (!entry || typeof entry !== 'object') throw new Error('room_history_entry_missing');
        const value = freezeOwnedData(deepClone(entry));
        nextPersisted.set(key, value);
        const suffix = Number(key.slice(key.lastIndexOf(':') + 1));
        if (Number.isSafeInteger(suffix)) sequence = Math.max(sequence, suffix);
        return value;
      }));
      (room as Record<string, unknown>)[field] = entries;
    }
    persisted = nextPersisted;
    return room;
  }

  function save(room: MatchWorkerRoomState | null): Promise<void> {
    // Minimal storage adapters retain the atomic legacy single-key contract.
    if (typeof storage.transaction !== 'function') return Promise.resolve(storage.put(rootKey, deepClone(room)));
    const head = room ? { ...room } : null;
    const histories = FIELDS.map(field => ({ field, values: room && Array.isArray(room[field]) ? room[field].slice() : [] }));
    if (head) for (const field of FIELDS) delete head[field];
    const ownedHead = deepClone(head);
    const captured = histories.map(({ field, values }) => ({ field, values: values.map(value => isOwnedImmutable(value) ? value : freezeOwnedData(deepClone(value))) }));
    const run = async () => {
      const writes = new Map<string, unknown>();
      const nextPersisted = new Map<string, unknown>();
      const historyKeys: Record<HistoryField, string[]> = { presentationJournal: [], sseEventBuffer: [] };
      for (const { field, values } of captured) {
        for (const value of values) {
          const previous = Array.from(persisted).find(([key, entry]) => key.startsWith(`${rootKey}:history:${field}:`) && entry === value);
          const key = previous ? previous[0] : `${rootKey}:history:${field}:${++sequence}`;
          historyKeys[field].push(key);
          nextPersisted.set(key, value);
          if (!previous) writes.set(key, value);
        }
      }
      await storage.transaction!(async txn => {
        const operations: Array<Promise<unknown> | unknown> = [];
        for (const [key, value] of writes) operations.push(txn.put(key, value));
        for (const key of persisted.keys()) if (!nextPersisted.has(key)) operations.push(txn.delete(key));
        operations.push(txn.put(rootKey, ownedHead ? { format: FORMAT, room: ownedHead, historyKeys } : null));
        await Promise.all(operations);
      });
      // Never advance the in-memory write cache on a failed transaction.
      persisted = nextPersisted;
    };
    const result = pending.then(run);
    pending = result.catch(() => {});
    return result;
  }

  function reset(): void { persisted = new Map(); sequence = 0; }
  return { load, save, reset };
}
