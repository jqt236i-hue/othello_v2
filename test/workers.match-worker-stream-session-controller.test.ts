import { createMatchWorkerStreamSessionController } from '../workers/match-worker-stream-session-controller';

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createController(options?: { sendReject?: boolean }) {
  const room = {
    roomId: 'SSE1',
    authoritativeStateHash: 'hash_before'
  } as any;
  const sent: Array<Record<string, unknown>> = [];
  const closed: string[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const queued: Array<() => void> = [];

  const controller = createMatchWorkerStreamSessionController({
    appendAuthorityLog: (_room, entry) => {
      logs.push(entry);
    },
    buildHeartbeatPayload: (_room, serverTime) => ({
      ok: true,
      roomId: 'SSE1',
      stateVersion: 2,
      serverTime
    }),
    withPublicSeatState: (_room, payload) => ({
      publicSeatState: true,
      ...payload
    }),
    toPublicRoomDeck: () => ({ mode: 'shared' }),
    toPublicNetworkDebugEnabled: () => true,
    toPublicChatMessages: () => [{ id: 1, text: 'hello' }],
    sendSse: async (streamId, eventName, payload, optionsArg) => {
      if (options && options.sendReject) {
        throw new Error('SEND_FAIL');
      }
      sent.push({
        streamId,
        eventName,
        payload,
        options: optionsArg || null
      });
    },
    closeStream: async (streamId) => {
      closed.push(streamId);
    },
    now: () => 12345,
    queueMicrotaskFn: (callback) => {
      queued.push(callback);
    }
  });

  return {
    controller,
    room,
    sent,
    closed,
    logs,
    queued
  };
}

describe('match worker stream session controller', () => {
  test('deliverInitialStreamEvents replays buffered events and logs replay resume', async () => {
    const ctx = createController();

    await ctx.controller.deliverInitialStreamEvents({
      room: ctx.room,
      replayEvents: [
        { eventId: 'E1', eventName: 'snapshot', payload: { ok: true, seq: 1 } },
        { eventId: 'E2', eventName: 'chat', payload: { ok: true, seq: 2 } }
      ],
      initialPayload: { ok: true },
      streamId: 'stream1'
    });

    expect(ctx.logs).toEqual([
      {
        kind: 'stream_resume_replay',
        stateHashBefore: 'hash_before',
        dedupeOutcome: 'replay'
      }
    ]);
    expect(ctx.sent).toEqual([
      {
        streamId: 'stream1',
        eventName: 'snapshot',
        payload: { ok: true, seq: 1 },
        options: { eventId: 'E1' }
      },
      {
        streamId: 'stream1',
        eventName: 'chat',
        payload: { ok: true, seq: 2 },
        options: { eventId: 'E2' }
      }
    ]);
  });

  test('deliverInitialStreamEvents emits heartbeat when replay buffer is empty', async () => {
    const ctx = createController();

    await ctx.controller.deliverInitialStreamEvents({
      room: ctx.room,
      replayEvents: [],
      initialPayload: { ok: true },
      streamId: 'stream1'
    });

    expect(ctx.logs).toEqual([
      {
        kind: 'stream_resume_heartbeat',
        stateHashBefore: 'hash_before',
        dedupeOutcome: 'empty_replay'
      }
    ]);
    expect(ctx.sent).toEqual([
      {
        streamId: 'stream1',
        eventName: 'heartbeat',
        payload: { ok: true, roomId: 'SSE1', stateVersion: 2, serverTime: 12345 },
        options: { eventId: null }
      }
    ]);
  });

  test('deliverInitialStreamEvents emits snapshot and chat history on full sync', async () => {
    const ctx = createController();

    await ctx.controller.deliverInitialStreamEvents({
      room: ctx.room,
      replayEvents: null,
      initialPayload: { ok: true, type: 'snapshot' },
      streamId: 'stream1'
    });

    expect(ctx.logs).toEqual([
      {
        kind: 'stream_resume_full_sync',
        stateHashBefore: 'hash_before',
        dedupeOutcome: 'full_sync'
      }
    ]);
    expect(ctx.sent).toEqual([
      {
        streamId: 'stream1',
        eventName: 'snapshot',
        payload: { ok: true, type: 'snapshot' },
        options: { eventId: null }
      },
      {
        streamId: 'stream1',
        eventName: 'chat',
        payload: {
          publicSeatState: true,
          ok: true,
          roomId: 'SSE1',
          type: 'history',
          roomDeck: { mode: 'shared' },
          networkDebugEnabled: true,
          messages: [{ id: 1, text: 'hello' }]
        },
        options: { eventId: null }
      }
    ]);
  });

  test('scheduleInitialStreamDelivery closes the stream when delivery fails', async () => {
    const ctx = createController({ sendReject: true });

    ctx.controller.scheduleInitialStreamDelivery({
      room: ctx.room,
      replayEvents: null,
      initialPayload: { ok: true, type: 'snapshot' },
      streamId: 'stream1'
    });

    expect(ctx.queued).toHaveLength(1);
    expect(ctx.closed).toEqual([]);

    ctx.queued[0]();
    await flushPromises();

    expect(ctx.closed).toEqual(['stream1']);
  });
});
