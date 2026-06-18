import { createMatchWorkerStreamRouteController } from '../workers/match-worker-stream-route-controller';

function createJsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function readJson(response: Response): Promise<any> {
  return JSON.parse(await response.text());
}

function createRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: 'SSE1',
    stateVersion: 2,
    seats: { black: true, white: true },
    seatTokens: { black: 'black-token', white: 'white-token' },
    sseEventBuffer: [
      { id: 'SSE1_2_1', event: 'snapshot', payload: { ok: true, stateVersion: 2 } }
    ],
    ...overrides
  } as any;
}

function createController(room: any) {
  const streams = new Map<string, any>();
  const deliveries: any[] = [];
  const closed: string[] = [];
  let loadCount = 0;
  let timeoutChecks = 0;
  let heartbeatEnsures = 0;

  const controller = createMatchWorkerStreamRouteController({
    getRoom: () => room,
    getStreams: () => streams,
    getSseEventBuffer: () => [{ id: 'fallback_1', event: 'heartbeat', payload: { ok: true } }],
    loadRoom: async () => {
      loadCount += 1;
    },
    applyExpiredTurnTimeoutIfNeeded: async () => {
      timeoutChecks += 1;
      return null;
    },
    parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? value : null) as any,
    resolveAuthenticatedViewer: (currentRoom, options) => (
      options.seatKey && currentRoom.seatTokens && currentRoom.seatTokens[options.seatKey as string] === options.seatToken
        ? { role: 'seat', seatKey: options.seatKey as any }
        : null
    ),
    classifyViewerTokenRejectionReason: (searchParams) => (searchParams.get('seatToken') ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED'),
    getBufferedSseReplayEvents: (buffer, lastEventId, viewer) => [{
      eventId: String(lastEventId || 'none'),
      eventName: 'snapshot',
      payload: { buffer, viewer }
    }],
    makeSseStreamId: () => 'stream-1',
    buildSnapshotPayload: (_currentRoom, meta, viewer) => ({
      ok: true,
      viewer,
      playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : null
    }),
    scheduleInitialStreamDelivery: (options) => {
      deliveries.push(options);
    },
    closeStream: async (streamId) => {
      closed.push(streamId);
    },
    ensureHeartbeatTimer: () => {
      heartbeatEnsures += 1;
    },
    jsonResponse: createJsonResponse,
    corsHeaders: { 'Access-Control-Allow-Origin': '*' },
    cryptoLike: { getRandomValues: (array) => array },
    now: () => 1234
  });

  return {
    controller,
    streams,
    deliveries,
    closed,
    getLoadCount: () => loadCount,
    getTimeoutChecks: () => timeoutChecks,
    getHeartbeatEnsures: () => heartbeatEnsures
  };
}

describe('match worker stream route controller', () => {
  test('registers an authenticated spectator SSE stream with spectator viewer identity', async () => {
    const room = createRoom({
      spectators: {
        spec_test0001: { token: 'token', name: '観戦', joinedAt: 1000, lastSeenAt: 1000 }
      }
    });
    const streams = new Map<string, any>();
    const deliveries: any[] = [];
    const controller = createMatchWorkerStreamRouteController({
      getRoom: () => room,
      getStreams: () => streams,
      getSseEventBuffer: () => [],
      loadRoom: async () => {},
      applyExpiredTurnTimeoutIfNeeded: async () => null,
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? value : null) as any,
      resolveAuthenticatedSeatKey: () => null,
      resolveAuthenticatedViewer: (_currentRoom, options) => {
        expect(options).toEqual(expect.objectContaining({
          viewerRole: 'spectator',
          spectatorId: 'spec_test0001',
          spectatorToken: 'token',
          now: 1234
        }));
        return { role: 'spectator', spectatorId: 'spec_test0001' };
      },
      classifySeatTokenRejectionReason: (seatToken) => (seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED'),
      classifyViewerTokenRejectionReason: () => 'SPECTATOR_TOKEN_MISMATCH',
      getBufferedSseReplayEvents: (buffer, lastEventId, viewer) => [{
        eventId: String(lastEventId || 'none'),
        eventName: 'snapshot',
        payload: { buffer, viewer }
      }],
      makeSseStreamId: () => 'stream-1',
      buildSnapshotPayload: (_currentRoom, meta, viewer) => ({
        ok: true,
        viewer,
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : null
      }),
      scheduleInitialStreamDelivery: (options) => {
        deliveries.push(options);
      },
      closeStream: async () => {},
      ensureHeartbeatTimer: () => {},
      jsonResponse: createJsonResponse,
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      cryptoLike: { getRandomValues: (array) => array },
      now: () => 1234
    } as any);

    const response = await controller.handleStream(
      new Request('https://room/api/match/stream?viewerRole=spectator&spectatorId=spec_test0001&spectatorToken=token&lastEventId=SSE1_2_1')
    );

    expect(response.status).toBe(200);
    expect(streams.get('stream-1')).toMatchObject({
      viewer: { role: 'spectator', spectatorId: 'spec_test0001' }
    });
    expect(deliveries[0]).toMatchObject({
      initialPayload: {
        ok: true,
        viewer: { role: 'spectator', spectatorId: 'spec_test0001' },
        playbackEvents: []
      },
      replayEvents: [{
        eventId: 'SSE1_2_1',
        eventName: 'snapshot',
        payload: {
          buffer: room.sseEventBuffer,
          viewer: { role: 'spectator', spectatorId: 'spec_test0001' }
        }
      }]
    });

    await response.body?.cancel();
  });

  test('rejects missing room and unauthenticated stream requests', async () => {
    const missingRoom = createController(null);
    const missingResponse = await missingRoom.controller.handleStream(
      new Request('https://room/api/match/stream?seatKey=black&seatToken=black-token')
    );
    expect(missingResponse.status).toBe(404);
    await expect(readJson(missingResponse)).resolves.toMatchObject({
      ok: false,
      reason: 'ROOM_NOT_FOUND'
    });

    const unauthorized = createController(createRoom());
    const unauthorizedResponse = await unauthorized.controller.handleStream(
      new Request('https://room/api/match/stream?seatKey=black&seatToken=bad-token')
    );
    expect(unauthorizedResponse.status).toBe(403);
    await expect(readJson(unauthorizedResponse)).resolves.toMatchObject({
      ok: false,
      reason: 'SEAT_TOKEN_MISMATCH'
    });
    expect(unauthorized.streams.size).toBe(0);
    expect(unauthorized.deliveries).toEqual([]);
  });

  test('registers an authenticated SSE stream and schedules initial delivery with replay metadata', async () => {
    const room = createRoom();
    const ctx = createController(room);
    const response = await ctx.controller.handleStream(
      new Request('https://room/api/match/stream?seatKey=black&seatToken=black-token&lastEventId=SSE1_2_1')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(ctx.getLoadCount()).toBe(1);
    expect(ctx.getTimeoutChecks()).toBe(1);
    expect(ctx.getHeartbeatEnsures()).toBe(1);
    expect(ctx.streams.get('stream-1')).toMatchObject({ viewer: { role: 'seat', seatKey: 'black' } });
    expect(ctx.deliveries).toHaveLength(1);
    expect(ctx.deliveries[0]).toMatchObject({
      room,
      streamId: 'stream-1',
      initialPayload: {
        ok: true,
        viewer: { role: 'seat', seatKey: 'black' },
        playbackEvents: []
      },
      replayEvents: [{
        eventId: 'SSE1_2_1',
        eventName: 'snapshot',
        payload: {
          buffer: room.sseEventBuffer,
          viewer: { role: 'seat', seatKey: 'black' }
        }
      }]
    });

    await response.body?.cancel();
    expect(ctx.closed).toEqual([]);
  });
});
