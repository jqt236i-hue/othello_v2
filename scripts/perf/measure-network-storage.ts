import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { performance } from 'perf_hooks';
import { createAllNetworkSpecialStonePerformanceFixtures, createAuthorityRoomFromFixture, runHeadlessFixtureTurnStart } from '../../test/helpers/network-special-stone-performance-fixtures';
import { MatchRoomDurableObject } from '../../workers/match-worker';
import deepClone from '../../utils/deepClone';
import MatchAuthority from '../../utils/match-authority';
import { compactNetworkPresentationEnvelope, resolveNetworkPresentationEnvelope } from '../../shared/network-presentation-envelope';
import { compressMatchStreamFrame } from '../../shared/match-stream-compression';

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
async function measure(fn: () => unknown, count = 60) {
  for (let i = 0; i < 10; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); await fn(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  return { median: samples[Math.floor(count / 2)], p95: samples[Math.ceil(count * .95) - 1] };
}

export async function measureNetworkStorage() {
  const rows: any[] = [];
  for (const fixture of createAllNetworkSpecialStonePerformanceFixtures()) {
    const room = createAuthorityRoomFromFixture(fixture);
    const turn = runHeadlessFixtureTurnStart(fixture);
    room.snapshot = turn.snapshot;
    let writes: Array<{ key: string; value: unknown }> = [];
    const storage: any = { get: async () => null, put: async () => {}, delete: async () => {},
      transaction: async (fn: any) => { writes = []; await fn({ put: async (key: string, value: unknown) => { writes.push({ key, value }); }, delete: async () => {} }); }
    };
    const worker = new MatchRoomDurableObject({ storage }); worker.room = room; worker.roomLoaded = true;
    let lastPayload: any;
    function append() {
      const previous = room.stateVersion; room.stateVersion++; room.snapshot.stateVersion = room.stateVersion;
      const artifacts = MatchAuthority.buildPublishViewerArtifacts(room);
      if (!room.initialSnapshotByViewer) room.initialSnapshotByViewer = deepClone(artifacts.projectedSnapshots);
      const payloadByViewer = Object.fromEntries(['black', 'white', 'spectator'].map(key => [key, { playbackEvents: turn.playbackEvents, effectLogs: [] }]));
      const entry = MatchAuthority.appendPresentationFrame(room, {
        stateVersionFrom: previous, stateVersionTo: room.stateVersion, operationId: 'perf-' + room.stateVersion,
        actorSeatKey: 'black', actionType: 'place', snapshotAfterByViewer: artifacts.projectedSnapshots, payloadByViewer, createdAt: room.updatedAt
      });
      const prepared = worker.getBroadcastController().prepareSnapshotBroadcast({
        operationId: 'perf-' + room.stateVersion, actionType: 'place', playbackEvents: turn.playbackEvents,
        presentationFrameEntry: entry, __publishViewerArtifacts: artifacts
      });
      worker.getBroadcastController().stagePreparedSnapshotBroadcast(prepared);
      lastPayload = prepared.payloadByViewer.black;
    }
    for (let i = 0; i < 8; i++) append();
    await worker.saveRoom();
    const fullBytes = bytes(room);
    const legacyCopyMs = await measure(() => deepClone(room));
    const unchangedSaveMs = await measure(() => worker.saveRoom());
    const unchangedWriteBytes = writes.reduce((n, entry) => n + bytes(entry.value), 0);
    append(); await worker.saveRoom();
    const appendWriteBytes = writes.reduce((n, entry) => n + bytes(entry.value), 0);
    const appendWriteCount = writes.length;
    // Group per-publish writes by key family (numeric suffixes collapsed) so
    // head, journal and replay-buffer costs are visible separately.
    const appendWriteBytesByKey: Record<string, number> = {};
    for (const entry of writes) {
      const family = String(entry.key).replace(/:\d+(?=:|$)/g, ':N');
      appendWriteBytesByKey[family] = (appendWriteBytesByKey[family] || 0) + bytes(entry.value);
    }
    const v2 = compactNetworkPresentationEnvelope(lastPayload, 2);
    const v3 = compactNetworkPresentationEnvelope(lastPayload, 3);
    const wireV2EncodeMs = await measure(() => JSON.stringify(compactNetworkPresentationEnvelope(lastPayload, 2)));
    const wireV3EncodeMs = await measure(() => JSON.stringify(compactNetworkPresentationEnvelope(lastPayload, 3)));
    const serializedV3 = JSON.stringify(v3);
    // One WebSocket frame carries the SSE envelope of one event.
    const frameText = `id: perf-${room.stateVersion}\nevent: snapshot\ndata: ${serializedV3}\n\n`;
    const wireV3FrameBytes = Buffer.byteLength(frameText);
    const wireV3CompressedFrameBytes = (await compressMatchStreamFrame(new TextEncoder().encode(frameText))).byteLength;
    const wireV3DecodeMs = await measure(() => resolveNetworkPresentationEnvelope(JSON.parse(serializedV3)));
    const restored = resolveNetworkPresentationEnvelope(JSON.parse(JSON.stringify(v3)));
    if (!restored.ok || JSON.stringify(restored.payload.presentationFrames) !== JSON.stringify(lastPayload.presentationFrames)) {
      // Wire reconstruction may append object properties in a different order;
      // the stable hash compares every value without ignoring any field.
      const StateHash = require('../../shared/state-hash');
      if (!restored.ok || StateHash.computeStableHash(restored.payload.presentationFrames) !== StateHash.computeStableHash(lastPayload.presentationFrames)) throw new Error('wire_roundtrip_failed');
    }
    rows.push({ fixture: fixture.id, events: turn.playbackEvents.length, fullRoomBytes: fullBytes,
      legacyCopyMs, unchangedSaveMs, unchangedWriteBytes, appendWriteBytes, appendWriteCount,
      appendWriteBytesByKey,
      wireV2Bytes: bytes(v2), wireV3Bytes: bytes(v3), wireV3GzipBytes: zlib.gzipSync(serializedV3).length,
      wireV3FrameBytes, wireV3CompressedFrameBytes, wireV2EncodeMs, wireV3EncodeMs, wireV3DecodeMs, wireRoundtrip: true });
  }
  return { node: process.version, storage: 'transaction adapter without disk I/O; copy/timing and JSON byte characterization only', rows };
}

if (require.main === module) {
  void measureNetworkStorage().then(report => {
    const output = path.resolve(process.argv[2] || 'artifacts/network-audit-20260905/optimized-storage.json');
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
