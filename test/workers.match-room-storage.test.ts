import { createMatchRoomStorage } from '../workers/match-room-storage';
import { freezeOwnedData } from '../shared/immutable-data';
const { MatchRoomDurableObject } = require('../dist/workers/match-worker.js');
import { createNetworkSpecialStonePerformanceFixture, createAuthorityRoomFromFixture } from './helpers/network-special-stone-performance-fixtures';

function adapter() {
  let disk = new Map<string, any>();
  let fail = false;
  const writes: string[][] = [];
  const storage: any = {
    get: async (key: string) => structuredClone(disk.get(key)),
    put: async (key: string, value: any) => { disk.set(key, structuredClone(value)); },
    delete: async (key: string) => disk.delete(key),
    transaction: async (fn: any) => {
      const next = new Map(disk); const keys: string[] = [];
      await fn({
        put: async (key: string, value: any) => { keys.push(key); next.set(key, structuredClone(value)); },
        delete: async (key: string) => next.delete(key)
      });
      if (fail) throw new Error('DISK_FAIL');
      disk = next; writes.push(keys);
    }
  };
  return { storage, writes, fail: (value: boolean) => { fail = value; }, disk: () => disk };
}
function room(count = 8): any {
  return { roomId: 'ABC', stateVersion: 8, snapshot: { value: 8 },
    presentationJournal: Array.from({ length: count }, (_, i) => freezeOwnedData({ visualSeq: i + 1, snapshotAfterByViewer: { black: { hand: ['black'] }, white: { hand: ['white'] } })),
    sseEventBuffer: Array.from({ length: count }, (_, i) => freezeOwnedData({ id: 'sse-' + i, payloadByViewer: { black: { value: i }, white: { value: -i } } })) };
}
describe('incremental room durability', () => {
  test('Worker invalidates speculative state after failed persistence and reloads committed authority', async () => {
    const a = adapter(); const worker = new MatchRoomDurableObject({ storage: a.storage });
    worker.room = createAuthorityRoomFromFixture(createNetworkSpecialStonePerformanceFixture('baseline-light'));
    worker.roomLoaded = true; await worker.saveRoom();
    const before = structuredClone(worker.room);
    worker.room!.stateVersion++; worker.room!.snapshot!.stateVersion = worker.room!.stateVersion;
    a.fail(true); await expect(worker.saveRoom()).rejects.toThrow('DISK_FAIL');
    expect(worker.room).toBeNull(); expect(worker.roomLoaded).toBe(false);
    a.fail(false); await worker.loadRoom();
    expect(worker.room!.stateVersion).toBe(before!.stateVersion);
    expect(worker.room!.snapshot).toEqual(before!.snapshot);
  });
  test('migrates legacy state and restores full viewer-separated histories', async () => {
    const a = adapter(); const value = room(); await a.storage.put('room', value);
    const store = createMatchRoomStorage(a.storage, 'room');
    expect(await store.load()).toEqual(value);
    await store.save(value);
    expect(await createMatchRoomStorage(a.storage, 'room').load()).toEqual(value);
    expect(a.disk().size).toBe(17);
  });
  test('does not rewrite retained entries, including after reconstruction', async () => {
    const a = adapter(); let store = createMatchRoomStorage(a.storage, 'room'); let value = room();
    await store.save(value); await store.save(value);
    expect(a.writes[1]).toEqual(['room']);
    store = createMatchRoomStorage(a.storage, 'room'); value = await store.load();
    value.presentationJournal.shift(); value.presentationJournal.push(freezeOwnedData({ visualSeq: 9 }));
    value.stateVersion++;
    await store.save(value);
    expect(a.writes[2]).toHaveLength(2);
    expect(a.disk().size).toBe(17);
    expect(await createMatchRoomStorage(a.storage, 'room').load()).toEqual(value);
  });
  test('failure leaves the previous root and histories intact and retry persists all changes', async () => {
    const a = adapter(); const store = createMatchRoomStorage(a.storage, 'room'); const value = room();
    await store.save(value); const before = structuredClone(value);
    value.stateVersion++; value.sseEventBuffer.shift(); value.sseEventBuffer.push(freezeOwnedData({ id: 'new' }));
    a.fail(true); await expect(store.save(value)).rejects.toThrow('DISK_FAIL');
    expect(await createMatchRoomStorage(a.storage, 'room').load()).toEqual(before);
    a.fail(false); await store.save(value);
    expect(await createMatchRoomStorage(a.storage, 'room').load()).toEqual(value);
  });
  test('captures mutable input before waiting, and reset removes old histories', async () => {
    const a = adapter(); const store = createMatchRoomStorage(a.storage, 'room'); const value = room(0);
    value.presentationJournal = [{ visualSeq: 1, nested: { n: 1 } }];
    const saving = store.save(value); value.presentationJournal[0].nested.n = 2; await saving;
    expect((await createMatchRoomStorage(a.storage, 'room').load())!.presentationJournal[0].nested.n).toBe(1);
    await store.save(room(0)); expect(a.disk().size).toBe(1);
  });
  test('missing retained entry fails closed', async () => {
    const a = adapter(); await createMatchRoomStorage(a.storage, 'room').save(room());
    a.disk().delete(Array.from(a.disk().keys()).find(k => k.includes(':history:'))!);
    await expect(createMatchRoomStorage(a.storage, 'room').load()).rejects.toThrow('room_history_entry_missing');
  });
});
