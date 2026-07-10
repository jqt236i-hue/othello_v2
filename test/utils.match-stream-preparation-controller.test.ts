import { createMatchStreamPreparationController } from '../utils/match-stream-preparation-controller';

function createContext(overrides: Record<string, unknown> = {}) {
  const room = {
    roomId: 'SSE1',
    sseEventBuffer: [{ id: 'SSE1_2_1', event: 'snapshot', payload: { ok: true } }]
  } as any;
  const calls: string[] = [];
  const controller = createMatchStreamPreparationController({
    loadRoom: () => { calls.push('load'); },
    awaitLoadRoom: false,
    getRoom: () => room,
    expireRoomIfNeeded: () => { calls.push('expire'); return false; },
    applyExpiredTurnTimeoutIfNeeded: () => { calls.push('timeout'); },
    getSearchParam: (url: URL, key: string) => url.searchParams.get(key),
    getSearchParams: (url: URL) => url.searchParams,
    parseSeatKeyOptional: (value: unknown) => value === 'black' ? 'black' : null,
    resolveAuthenticatedViewer: (_currentRoom: unknown, options: any) => (
      options.seatKey === 'black' && options.seatToken === 'token'
        ? { role: 'seat', seatKey: 'black' }
        : null
    ),
    classifyViewerTokenRejectionReason: () => 'SEAT_TOKEN_MISMATCH',
    getSseEventBuffer: () => [{ id: 'fallback_1' }],
    getBufferedSseReplayEvents: (buffer: unknown, lastEventId: unknown, viewer: unknown) => ({ buffer, lastEventId, viewer }),
    jsonResponse: (status: number, payload: unknown) => ({ status, payload }),
    now: () => 1234,
    ...overrides
  });
  return { controller, room, calls };
}

describe('match stream preparation controller', () => {
  test('shares authenticated replay selection and gives Last-Event-ID precedence', async () => {
    const ctx = createContext();
    const result = await ctx.controller.prepareStream(
      new URL('https://room/api/match/stream?seatKey=black&seatToken=token&lastEventId=query-id'),
      'header-id'
    );

    expect(ctx.calls).toEqual(['load', 'expire', 'timeout']);
    expect(result).toMatchObject({
      room: ctx.room,
      viewer: { role: 'seat', seatKey: 'black' },
      replayEvents: {
        buffer: ctx.room.sseEventBuffer,
        lastEventId: 'header-id',
        viewer: { role: 'seat', seatKey: 'black' }
      }
    });
  });

  test('returns the existing room-not-found and viewer-rejection responses', async () => {
    const missing = createContext({ getRoom: () => null });
    await expect(missing.controller.prepareStream(new URL('https://room/api/match/stream'))).resolves.toEqual({
      response: { status: 404, payload: { ok: false, reason: 'ROOM_NOT_FOUND' } }
    });

    const unauthorized = createContext();
    await expect(unauthorized.controller.prepareStream(
      new URL('https://room/api/match/stream?seatKey=black&seatToken=wrong')
    )).resolves.toEqual({
      response: { status: 403, payload: { ok: false, reason: 'SEAT_TOKEN_MISMATCH' } }
    });
  });
});
