import { createMatchWorkerApiController } from '../workers/match-worker-api';

function jsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload || {}), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function withCORS(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Test-Cors', '1');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function createEnv(handler: (roomId: string, request: Request) => Promise<Response> | Response) {
  return {
    MATCH_ROOM: {
      idFromName(name: string) {
        return name;
      },
      get(id: unknown) {
        return {
          fetch(request: Request) {
            return handler(String(id || ''), request);
          }
        };
      }
    }
  };
}

describe('match worker api controller', () => {
  test('match join を room durable object へ転送し roomId を正規化する', async () => {
    const seen: Array<{ roomId: string; method: string; pathname: string; body: any }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });

    const env = createEnv(async (roomId, request) => {
      seen.push({
        roomId,
        method: request.method,
        pathname: new URL(request.url).pathname,
        body: JSON.parse(String(await request.text() || '{}'))
      });
      return jsonResponse(200, { ok: true });
    });

    const response = await controller.handleMatchApi(new Request('https://worker/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'abc', seatKey: 'white' })
    }), env as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Test-Cors')).toBe('1');
    expect(seen).toEqual([
      {
        roomId: 'ABC',
        method: 'POST',
        pathname: '/api/match/join',
        body: { roomId: 'ABC', seatKey: 'white' }
      }
    ]);
  });

  test('match state GET を room durable object へ転送し roomId を search に反映する', async () => {
    const seen: Array<{ roomId: string; url: string }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });

    const env = createEnv((roomId, request) => {
      seen.push({ roomId, url: request.url });
      return jsonResponse(200, { ok: true });
    });

    const response = await controller.handleMatchApi(
      new Request('https://worker/api/match/state?roomId=abc&seatKey=white', { method: 'GET' }),
      env as any
    );

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].roomId).toBe('ABC');
    expect(seen[0].url).toContain('/api/match/state?');
    expect(seen[0].url).toContain('roomId=ABC');
    expect(seen[0].url).toContain('seatKey=white');
  });

  test('match list GET は lobby durable object へ転送する', async () => {
    const seen: Array<{ roomId: string; url: string }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      lobbyRoomId: '__match_lobby__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    } as any);

    const env = createEnv((roomId, request) => {
      seen.push({ roomId, url: request.url });
      return jsonResponse(200, { ok: true, rooms: [] });
    });

    const response = await controller.handleMatchApi(
      new Request('https://worker/api/match/list', { method: 'GET' }),
      env as any
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Test-Cors')).toBe('1');
    expect(seen).toEqual([
      {
        roomId: '__match_lobby__',
        url: 'https://room/api/match/list'
      }
    ]);
  });

  test('leaderboard submit は leaderboard durable object へ転送する', async () => {
    const seen: Array<{ roomId: string; pathname: string; body: any }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });

    const env = createEnv(async (roomId, request) => {
      seen.push({
        roomId,
        pathname: new URL(request.url).pathname,
        body: JSON.parse(String(await request.text() || '{}'))
      });
      return jsonResponse(200, { ok: true });
    });

    const response = await controller.handleLeaderboardApi(new Request('https://worker/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 'player_alpha_0001', score: 7200 })
    }), env as any);

    expect(response.status).toBe(200);
    expect(seen).toEqual([
      {
        roomId: '__leaderboard__',
        pathname: '/api/leaderboard/submit',
        body: { playerId: 'player_alpha_0001', score: 7200 }
      }
    ]);
  });

  test('invalid json と roomId不足を fail-closed で返す', async () => {
    const handleCreate = jest.fn(async () => jsonResponse(200, { ok: true, created: true }));
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate
    });
    const env = createEnv(() => jsonResponse(200, { ok: true }));

    const invalidJsonResponse = await controller.handleMatchApi(new Request('https://worker/api/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    }), env as any);
    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toEqual({ ok: false, reason: 'INVALID_JSON' });
    expect(handleCreate).not.toHaveBeenCalled();

    const missingRoomIdResponse = await controller.handleMatchApi(new Request('https://worker/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatKey: 'white' })
    }), env as any);
    expect(missingRoomIdResponse.status).toBe(400);
    await expect(missingRoomIdResponse.json()).resolves.toEqual({ ok: false, reason: 'ROOM_ID_REQUIRED' });
  });
});
