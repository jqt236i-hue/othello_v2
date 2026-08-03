import * as http from 'http';
import * as Core from '../game/logic/core.js';
import {
  createLocalMatchServer,
  patchRoomSnapshotForTests,
  resetRoomsForTests
} from '../scripts/local-match-server.js';
import { resolveNetworkPresentationEnvelope } from '../shared/network-presentation-envelope';

type SseEvent = { id: string | null; event: string; data: any };

function requestJson(port: number, method: string, requestPath: string, payload?: unknown): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

function listen(server: ReturnType<typeof createLocalMatchServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function closeServer(server: ReturnType<typeof createLocalMatchServer>): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function parseSseBlock(block: string): SseEvent {
  let id: string | null = null;
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('id:')) id = line.slice(3).trim() || null;
    else if (line.startsWith('event:')) event = line.slice(6).trim() || 'message';
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  const rawData = dataLines.join('\n');
  return { id, event, data: rawData ? JSON.parse(rawData) : null };
}

function openSse(
  port: number,
  requestPath: string,
  headers: Record<string, string> = {}
): Promise<{
  nextEvent: () => Promise<SseEvent>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method: 'GET', headers }, (res) => {
      const queue: SseEvent[] = [];
      const waiters: Array<(event: SseEvent) => void> = [];
      let pending = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        pending += String(chunk || '').replace(/\r\n/g, '\n');
        let boundary = pending.indexOf('\n\n');
        while (boundary >= 0) {
          const block = pending.slice(0, boundary);
          pending = pending.slice(boundary + 2);
          if (block.trim()) {
            const event = parseSseBlock(block);
            const waiter = waiters.shift();
            if (waiter) waiter(event);
            else queue.push(event);
          }
          boundary = pending.indexOf('\n\n');
        }
      });
      res.on('error', reject);
      resolve({
        nextEvent: () => new Promise<SseEvent>((resolveEvent, rejectEvent) => {
          const event = queue.shift();
          if (event) {
            resolveEvent(event);
            return;
          }
          const timeout = setTimeout(() => rejectEvent(new Error('SSE_EVENT_TIMEOUT')), 2000);
          waiters.push((next) => {
            clearTimeout(timeout);
            resolveEvent(next);
          });
        }),
        close: () => {
          try { req.destroy(); } catch (error) { /* ignore */ }
          try { res.destroy(); } catch (error) { /* ignore */ }
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('local match server presentation envelope delivery', () => {
  afterEach(() => resetRoomsForTests());

  test('compacts V2 live and buffered snapshot delivery while legacy replay remains full', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    const opened: Array<{ close: () => void }> = [];
    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'black' });
      const roomId = created.data.roomId;
      const heartbeatId = `${roomId}_0_1`;
      expect(patchRoomSnapshotForTests(roomId, (room: any) => {
        room.eventSeq = 1;
        room.sseEventBuffer = [{
          id: heartbeatId,
          event: 'heartbeat',
          payload: { ok: true, roomId, stateVersion: 0 }
        }];
      })).toBe(true);

      const streamPath = `/api/match/stream?roomId=${encodeURIComponent(roomId)}`
        + `&seatKey=black&seatToken=${encodeURIComponent(created.data.seatToken)}`;
      const live = await openSse(port, `${streamPath}&presentationEnvelopeVersion=2`);
      opened.push(live);
      const initialSnapshot = await live.nextEvent();
      const initialChat = await live.nextEvent();
      expect(initialSnapshot.event).toBe('snapshot');
      expect(initialSnapshot.data.presentationEnvelopeVersion).toBe(2);
      expect(initialChat.event).toBe('chat');

      const move = Core.getLegalMoves(created.data.snapshot.gameState, 1)[0];
      const body = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: created.data.seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_local_sse_v2',
        actionType: 'place',
        actor: 'black',
        params: { row: move.row, col: move.col },
        turnIndex: created.data.snapshot.cardState.turnIndex,
        action: {
          type: 'place',
          playerKey: 'black',
          row: move.row,
          col: move.col,
          turnIndex: created.data.snapshot.cardState.turnIndex
        }
      };
      const publish = await requestJson(port, 'POST', '/api/match/publish', body);
      expect(publish.status).toBe(200);

      const liveSnapshot = await live.nextEvent();
      expect(liveSnapshot.event).toBe('snapshot');
      expect(liveSnapshot.data.presentationEnvelopeVersion).toBe(2);
      expect(liveSnapshot.data).not.toHaveProperty('playbackEvents');
      expect(liveSnapshot.data.presentationFrames[0]).toHaveProperty('snapshotAfterRef');
      expect(resolveNetworkPresentationEnvelope(liveSnapshot.data).ok).toBe(true);
      live.close();

      const replayV2 = await openSse(port, `${streamPath}&presentationEnvelopeVersion=2`, {
        'Last-Event-ID': heartbeatId
      });
      opened.push(replayV2);
      const replayV2Snapshot = await replayV2.nextEvent();
      expect(replayV2Snapshot.event).toBe('snapshot');
      expect(replayV2Snapshot.id).toBe(liveSnapshot.id);
      expect(replayV2Snapshot.data.presentationEnvelopeVersion).toBe(2);
      expect(replayV2Snapshot.data).not.toHaveProperty('playbackEvents');
      expect(replayV2Snapshot.data.presentationFrames[0]).toHaveProperty('snapshotAfterRef');
      expect(resolveNetworkPresentationEnvelope(replayV2Snapshot.data).ok).toBe(true);
      replayV2.close();

      const replayLegacy = await openSse(port, streamPath, { 'Last-Event-ID': heartbeatId });
      opened.push(replayLegacy);
      const replayLegacySnapshot = await replayLegacy.nextEvent();
      expect(replayLegacySnapshot.event).toBe('snapshot');
      expect(replayLegacySnapshot.id).toBe(liveSnapshot.id);
      expect(replayLegacySnapshot.data).not.toHaveProperty('presentationEnvelopeVersion');
      expect(replayLegacySnapshot.data).toHaveProperty('playbackEvents');
      expect(replayLegacySnapshot.data.presentationFrames[0]).toHaveProperty('snapshotAfter');
      expect(replayLegacySnapshot.data.presentationFrames[0]).not.toHaveProperty('snapshotAfterRef');
    } finally {
      for (const stream of opened) stream.close();
      await closeServer(server);
    }
  });
});

