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
    buildSnapshotPayload: (_room, meta, viewer) => ({
      ok: true,
      viewer,
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
  test('snapshot broadcasts use spectator-safe payload for spectator streams', async () => {
    const sends: Array<Record<string, unknown>> = [];
    const streams = new Map<string, any>([
      ['seat-black', { writer: {}, viewer: { role: 'seat', seatKey: 'black' } }],
      ['spec-one', { writer: {}, viewer: { role: 'spectator', spectatorId: 'spec_test0001' } }]
    ]);
    const controller = createMatchWorkerBroadcastController({
      getRoom: () => ({ roomId: 'SPC' }) as any,
      getStreams: () => streams,
      nextSseEventId: () => 'evt_1',
      rememberBufferedSseEvent: jest.fn(),
      saveRoom: jest.fn(),
      sendSse: async (streamId, eventName, payload) => {
        sends.push({ streamId, eventName, payload });
      },
      buildSnapshotPayload: (_room, _meta, viewer) => ({ viewer }),
      buildPresencePayload: () => ({ ok: true })
    });

    const prepared = controller.prepareSnapshotBroadcast({ playbackEvents: [] } as any);
    expect(prepared.record.payloadByViewer).toEqual(expect.objectContaining({
      black: { viewer: { role: 'seat', seatKey: 'black' } },
      white: { viewer: { role: 'seat', seatKey: 'white' } },
      spectator: { viewer: { role: 'spectator', spectatorId: '' } }
    }));

    await controller.broadcastPreparedSnapshot(prepared);

    expect(sends).toContainEqual(expect.objectContaining({
      streamId: 'spec-one',
      eventName: 'snapshot',
      payload: { viewer: { role: 'spectator', spectatorId: '' } }
    }));
  });

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
        payload: { ok: true, viewer: { role: 'seat', seatKey: 'black' }, operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      },
      {
        streamId: 'white-stream',
        eventName: 'snapshot',
        payload: { ok: true, viewer: { role: 'seat', seatKey: 'white' }, operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      },
      {
        streamId: 'fallback-stream',
        eventName: 'snapshot',
        payload: { ok: true, viewer: { role: 'spectator', spectatorId: '' }, operationId: 'op_1' },
        options: { eventId: 'SSE1_2_1' }
      }
    ]);
  });

  test('publish artifacts cache one snapshot payload per viewer and reuse spectator fallback', () => {
    let builds = 0;
    const controller = createMatchWorkerBroadcastController({
      getRoom: () => ({ roomId: 'CACHE' }) as any,
      getStreams: () => new Map(),
      nextSseEventId: () => 'cache_1',
      rememberBufferedSseEvent: jest.fn(),
      saveRoom: jest.fn(),
      sendSse: jest.fn(),
      buildSnapshotPayload: (_room, _meta, viewer) => {
        builds += 1;
        return { viewer, build: builds };
      },
      buildPresencePayload: () => ({ ok: true })
    });
    const artifacts: any = { projectedSnapshots: { black: {}, white: {}, spectator: {} }, snapshotPayloads: {} };

    const first = controller.prepareSnapshotBroadcast({ __publishViewerArtifacts: artifacts } as any);
    const second = controller.buildBufferedSnapshotEvent({ __publishViewerArtifacts: artifacts } as any, 'cache_2');

    expect(builds).toBe(3);
    expect(first.fallbackPayload).toBe(first.payloadByViewer.spectator);
    expect(second.payloadByViewer.black).toBe(first.payloadByViewer.black);
    expect(second.payloadByViewer.white).toBe(first.payloadByViewer.white);
    expect(second.payloadByViewer.spectator).toBe(first.payloadByViewer.spectator);
    expect(artifacts.snapshotPayloads).toBe(first.payloadByViewer);
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
