import { createMatchWorkerStreamController } from '../workers/match-worker-stream-controller';

function createController(options?: { room?: any; writeReject?: boolean }) {
  const room = options && Object.prototype.hasOwnProperty.call(options, 'room')
    ? (options as any).room
    : {
      roomId: 'SSE1',
      stateVersion: 2,
      eventSeq: 0,
      sseEventBuffer: []
    };
  let sseEventBuffer = Array.isArray(room && room.sseEventBuffer) ? room.sseEventBuffer.slice() : [];
  const streams = new Map<string, any>();
  let heartbeatTimerId: any = null;
  let savedCount = 0;
  let clearedHandle: any = null;
  const written: string[] = [];
  const closed: string[] = [];

  const writer = {
    async write(chunk: Uint8Array) {
      if (options && options.writeReject) {
        throw new Error('WRITE_FAIL');
      }
      written.push(Buffer.from(chunk).toString('utf8'));
    },
    async close() {
      closed.push('closed');
    },
    releaseLock() {}
  };
  streams.set('stream1', { writer, seatKey: 'black' });

  const controller = createMatchWorkerStreamController({
    getRoom: () => room,
    getSseEventBuffer: () => sseEventBuffer,
    setSseEventBuffer: (buffer) => { sseEventBuffer = buffer; },
    getStreams: () => streams,
    getHeartbeatTimerId: () => heartbeatTimerId,
    setHeartbeatTimerId: (value) => { heartbeatTimerId = value; },
    encoder: new TextEncoder(),
    normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
    appendBufferedSseEvent: (buffer, record) => {
      const next = Array.isArray(buffer) ? buffer.slice() : [];
      next.push({ id: record.eventId, event: record.eventName, payload: record.payload, payloadByViewer: (record as any).payloadByViewer });
      return next as any;
    },
    makeSseStreamId: (_now, _crypto) => 'generated_fallback_id',
    cryptoLike: null,
    buildHeartbeatPayload: (_room, serverTime) => ({ ok: true, roomId: 'SSE1', stateVersion: 2, serverTime }),
    saveRoom: async () => { savedCount += 1; },
    sseChunk: (eventName, payload, eventId) => {
      const data = JSON.stringify(payload || {});
      const idLine = !(eventId === null || typeof eventId === 'undefined' || String(eventId) === '') ? `id: ${String(eventId)}\n` : '';
      const eventLine = eventName ? `event: ${String(eventName)}\n` : '';
      return `${idLine}${eventLine}data: ${data}\n\n`;
    },
    heartbeatIntervalMs: 100,
    writeTimeoutMs: 0,
    now: () => 12345,
    setTimeoutFn: ((callback: (...args: any[]) => void, _ms?: number) => {
      heartbeatTimerId = 777;
      return 777 as any;
    }) as any,
    clearTimeoutFn: ((handle: any) => {
      clearedHandle = handle;
      heartbeatTimerId = null;
    }) as any
  });

  return {
    controller,
    room,
    streams,
    getBuffer: () => sseEventBuffer,
    getSavedCount: () => savedCount,
    getWritten: () => written,
    getClearedHandle: () => clearedHandle,
    getClosed: () => closed,
    getHeartbeatTimerId: () => heartbeatTimerId
  };
}

describe('match worker stream controller', () => {
  test('broadcastHeartbeat buffers, saves, and writes one heartbeat to active streams', async () => {
    const ctx = createController();

    await ctx.controller.broadcastHeartbeat();

    expect(ctx.room.eventSeq).toBe(1);
    expect(ctx.getSavedCount()).toBe(1);
    expect(ctx.getBuffer()).toHaveLength(1);
    expect(ctx.getBuffer()[0]).toMatchObject({
      id: 'SSE1_2_1',
      event: 'heartbeat'
    });
    expect(ctx.getWritten()).toHaveLength(1);
    expect(ctx.getWritten()[0]).toContain('event: heartbeat');
    expect(ctx.getWritten()[0]).toContain('id: SSE1_2_1');
  });

  test('closeStream removes the last stream and clears the heartbeat timer', async () => {
    const ctx = createController();
    (ctx as any).controller.ensureHeartbeatTimer();
    expect(ctx.getHeartbeatTimerId()).toBe(777);

    await ctx.controller.closeStream('stream1');

    expect(ctx.streams.size).toBe(0);
    expect(ctx.getClearedHandle()).toBe(777);
    expect(ctx.getClosed()).toEqual(['closed']);
  });

  test('sendSse closes a broken stream on write failure', async () => {
    const ctx = createController({ writeReject: true });

    await ctx.controller.sendSse('stream1', 'heartbeat', { ok: true });

    expect(ctx.streams.size).toBe(0);
    expect(ctx.getClosed()).toEqual(['closed']);
  });
});
