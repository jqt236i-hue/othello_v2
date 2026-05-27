import { createMatchWorkerBroadcastController } from '../workers/match-worker-broadcast-controller';

function createController() {
  const room = {
    roomId: 'SSE1',
    stateVersion: 2,
    eventSeq: 0,
    sseEventBuffer: []
  } as any;
  const streams = new Map<string, any>([
    ['black-stream', { seatKey: 'black' }],
    ['white-stream', { seatKey: 'white' }],
    ['fallback-stream', {}]
  ]);
  const buffered: Array<Record<string, unknown>> = [];
  const sent: Array<Record<string, unknown>> = [];
  let savedCount = 0;
  let nextSeq = 1;
  let nextEventIdCalls = 0;

  const controller = createMatchWorkerBroadcastController({
    getRoom: () => room,
    getStreams: () => streams,
    nextSseEventId: () => {
      nextEventIdCalls += 1;
      return `SSE1_2_${nextSeq++}`;
    },
    rememberBufferedSseEvent: (record) => {
      buffered.push(record as Record<string, unknown>);
    },
    saveRoom: async () => {
      savedCount += 1;
    },
    sendSse: async (streamId, eventName, payload, options) => {
      sent.push({
        streamId,
        eventName,
        payload,
        options: options || null
      });
    },
    buildSnapshotPayload: (_room, meta, viewerSeatKey) => ({
      ok: true,
      viewerSeatKey,
      operationId: meta && (meta as any).operationId ? (meta as any).operationId : null
    }),
    buildPresencePayload: (_room, meta) => ({
      ok: true,
      type: meta && (meta as any).type ? (meta as any).type : null
    })
  });

  return {
    controller,
    buffered,
    sent,
    getSavedCount: () => savedCount,
    getNextEventIdCalls: () => nextEventIdCalls
  };
}

describe('match worker broadcast controller', () => {
  test('broadcastPreparedSnapshot buffers, saves, and fan-outs viewer-specific payloads', async () => {
    const ctx = createController();
    const prepared = ctx.controller.prepareSnapshotBroadcast({ operationId: 'op_1' });

    await ctx.controller.broadcastPreparedSnapshot(prepared);

    expect(ctx.getNextEventIdCalls()).toBe(1);
    expect(ctx.getSavedCount()).toBe(1);
    expect(ctx.buffered).toHaveLength(1);
    expect(ctx.buffered[0]).toMatchObject({
      eventId: 'SSE1_2_1',
      eventName: 'snapshot'
    });
    expect(ctx.sent).toEqual([
      {
        streamId: 'black-stream',
        eventName: 'snapshot',
        payload: { ok: true, viewerSeatKey: 'black', operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      },
      {
        streamId: 'white-stream',
        eventName: 'snapshot',
        payload: { ok: true, viewerSeatKey: 'white', operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      },
      {
        streamId: 'fallback-stream',
        eventName: 'snapshot',
        payload: { ok: true, viewerSeatKey: null, operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      }
    ]);
  });

  test('broadcastSnapshot reuses prepared snapshot metadata without minting a new event id', async () => {
    const ctx = createController();
    const prepared = {
      eventId: 'prepared_1',
      record: {
        eventId: 'prepared_1',
        eventName: 'snapshot',
        payloadByViewer: {
          black: { ok: true, viewerSeatKey: 'black', operationId: 'prepared' },
          white: { ok: true, viewerSeatKey: 'white', operationId: 'prepared' }
        }
      },
      payloadByViewer: {
        black: { ok: true, viewerSeatKey: 'black', operationId: 'prepared' },
        white: { ok: true, viewerSeatKey: 'white', operationId: 'prepared' }
      },
      fallbackPayload: { ok: true, viewerSeatKey: null, operationId: 'prepared' }
    };

    await ctx.controller.broadcastSnapshot({ __preparedSnapshot: prepared } as any);

    expect(ctx.getNextEventIdCalls()).toBe(0);
    expect(ctx.getSavedCount()).toBe(1);
    expect(ctx.buffered[0]).toMatchObject({ eventId: 'prepared_1', eventName: 'snapshot' });
    expect(ctx.sent[0]).toMatchObject({
      streamId: 'black-stream',
      eventName: 'snapshot',
      options: { eventId: 'prepared_1' }
    });
  });

  test('broadcastPresence and broadcastChat buffer, save, and fan-out shared payloads', async () => {
    const ctx = createController();

    await ctx.controller.broadcastPresence({ type: 'join' } as any);
    await ctx.controller.broadcastChat({ ok: true, type: 'message', text: 'hello' });

    expect(ctx.getNextEventIdCalls()).toBe(2);
    expect(ctx.getSavedCount()).toBe(2);
    expect(ctx.buffered).toEqual([
      {
        eventId: 'SSE1_2_1',
        eventName: 'presence',
        payload: { ok: true, type: 'join' }
      },
      {
        eventId: 'SSE1_2_2',
        eventName: 'chat',
        payload: { ok: true, type: 'message', text: 'hello' }
      }
    ]);
    expect(ctx.sent).toEqual([
      { streamId: 'black-stream', eventName: 'presence', payload: { ok: true, type: 'join' }, options: { eventId: 'SSE1_2_1' } },
      { streamId: 'white-stream', eventName: 'presence', payload: { ok: true, type: 'join' }, options: { eventId: 'SSE1_2_1' } },
      { streamId: 'fallback-stream', eventName: 'presence', payload: { ok: true, type: 'join' }, options: { eventId: 'SSE1_2_1' } },
      { streamId: 'black-stream', eventName: 'chat', payload: { ok: true, type: 'message', text: 'hello' }, options: { eventId: 'SSE1_2_2' } },
      { streamId: 'white-stream', eventName: 'chat', payload: { ok: true, type: 'message', text: 'hello' }, options: { eventId: 'SSE1_2_2' } },
      { streamId: 'fallback-stream', eventName: 'chat', payload: { ok: true, type: 'message', text: 'hello' }, options: { eventId: 'SSE1_2_2' } }
    ]);
  });
});
