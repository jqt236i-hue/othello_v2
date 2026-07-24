import {
  createMatchWorkerStreamController,
  MATCH_WORKER_SSE_WRITE_TIMEOUT_MS
} from '../workers/match-worker-stream-controller';

function createController(options?: {
  room?: any;
  writeReject?: boolean;
  writePending?: boolean;
  writeTimeoutMs?: number;
}) {
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
  const scheduledTimeouts = new Map<any, { callback: (...args: any[]) => void; ms: number }>();
  let nextTimeoutHandle = 777;

  const writer = {
    async write(chunk: Uint8Array) {
      if (options && options.writeReject) {
        throw new Error('WRITE_FAIL');
      }
      if (options && options.writePending) {
        await new Promise<void>(() => {});
        return;
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
    writeTimeoutMs: options && Number.isFinite(options.writeTimeoutMs)
      ? Number(options.writeTimeoutMs)
      : 0,
    now: () => 12345,
    setTimeoutFn: ((callback: (...args: any[]) => void, ms?: number) => {
      const handle = nextTimeoutHandle++;
      scheduledTimeouts.set(handle, { callback, ms: Number(ms) || 0 });
      heartbeatTimerId = handle;
      return handle as any;
    }) as any,
    clearTimeoutFn: ((handle: any) => {
      clearedHandle = handle;
      scheduledTimeouts.delete(handle);
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
    getHeartbeatTimerId: () => heartbeatTimerId,
    getScheduledTimeouts: () => Array.from(scheduledTimeouts.entries()),
    fireTimeout: (handle: any) => {
      const scheduled = scheduledTimeouts.get(handle);
      if (scheduled) scheduled.callback();
    }
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

  test('production write timeout stays below the browser request deadline', () => {
    expect(MATCH_WORKER_SSE_WRITE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MATCH_WORKER_SSE_WRITE_TIMEOUT_MS).toBeLessThan(10000);
  });

  test('sendSse times out and removes a backpressured stream', async () => {
    const ctx = createController({ writePending: true, writeTimeoutMs: 25 });

    const sendPromise = ctx.controller.sendSse('stream1', 'presence', { type: 'rematch_request' });
    const scheduled = ctx.getScheduledTimeouts();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0][1].ms).toBe(25);
    ctx.fireTimeout(scheduled[0][0]);
    await sendPromise;

    expect(ctx.streams.size).toBe(0);
    expect(ctx.getClosed()).toEqual(['closed']);
  });
});
