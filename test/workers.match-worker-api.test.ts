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
        body: { roomId: 'ABC', seatKey: 'white', playerId: '' }
      }
    ]);
  });

  test('match rematch-request を room durable object へ転送する', async () => {
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
      return jsonResponse(200, { ok: true, requestId: 'rematch_req_1' });
    });

    const response = await controller.handleMatchApi(new Request('https://worker/api/match/rematch-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'abc', seatKey: 'black', seatToken: 'token_black' })
    }), env as any);

    expect(response.status).toBe(200);
    expect(seen).toEqual([
      {
        roomId: 'ABC',
        method: 'POST',
        pathname: '/api/match/rematch-request',
        body: { roomId: 'ABC', seatKey: 'black', seatToken: 'token_black' }
      }
    ]);
  });

  test('match deck を room durable object へ転送する', async () => {
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

    const response = await controller.handleMatchApi(new Request('https://worker/api/match/deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'abc', seatKey: 'black', seatToken: 'token_black', deckCode: 'D1C1:chest_01*3' })
    }), env as any);

    expect(response.status).toBe(200);
    expect(seen).toEqual([
      {
        roomId: 'ABC',
        method: 'POST',
        pathname: '/api/match/deck',
        body: { roomId: 'ABC', seatKey: 'black', seatToken: 'token_black', deckCode: 'D1C1:chest_01*3' }
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

  test('match presentation-journal GET を room durable object へ転送する', async () => {
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
      return jsonResponse(200, { ok: true, presentationFrames: [] });
    });

    const response = await controller.handleMatchApi(
      new Request('https://worker/api/match/presentation-journal?roomId=abc&seatKey=white&seatToken=tok&afterVisualSeq=2', { method: 'GET' }),
      env as any
    );

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].roomId).toBe('ABC');
    expect(seen[0].url).toContain('/api/match/presentation-journal?');
    expect(seen[0].url).toContain('roomId=ABC');
    expect(seen[0].url).toContain('seatKey=white');
    expect(seen[0].url).toContain('seatToken=tok');
    expect(seen[0].url).toContain('afterVisualSeq=2');
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

  test('leaderboard list は旧記録指定を leaderboard Durable Object へそのまま転送する', async () => {
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
      return jsonResponse(200, { ok: true, era: 'legacy', entries: [] });
    });

    const response = await controller.handleLeaderboardApi(
      new Request('https://worker/api/leaderboard/list?limit=100&mode=cpu&category=timeAttack&era=legacy'),
      env as any
    );

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].roomId).toBe('__leaderboard__');
    const forwardedUrl = new URL(seen[0].url);
    expect(forwardedUrl.pathname).toBe('/api/leaderboard/list');
    expect(forwardedUrl.searchParams.get('era')).toBe('legacy');
    expect(forwardedUrl.searchParams.get('category')).toBe('timeAttack');
  });

  test('leaderboard submit は playerToken が無ければ 403 fail-closed で返す', async () => {
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

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
    expect(seen).toEqual([]);
  });

  test('leaderboard submit は終局済み room のサーバー計算値だけを転送する', async () => {
    const seen: Array<{ roomId: string; pathname: string; body: any }> = [];
    const playerId = 'p_ABCDEFGHIJKLMNOPQRSTUV0001';
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      playerIdentityRoomId: '__player_identity__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });

    const env = createEnv(async (roomId, request) => {
      const pathname = new URL(request.url).pathname;
      const body = JSON.parse(String(await request.text() || '{}'));
      seen.push({ roomId, pathname, body });
      if (roomId === '__player_identity__') return jsonResponse(200, { ok: true, playerId });
      if (roomId === 'ROOM1234') {
        return jsonResponse(200, {
          ok: true,
          authorityVerified: true,
          authoritySource: 'match_room',
          matchId: 'ROOM1234',
          stateVersion: 42,
          playerId,
          category: 'score',
          mode: 'network',
          score: 8818,
          scoreVersion: 5,
          turnCount: 42,
          boardConfig: { rows: 8, cols: 8, shape: 'rectangle', standard8x8: true }
        });
      }
      return jsonResponse(200, { ok: true, updated: true, bestScore: body.score });
    });

    const response = await controller.handleLeaderboardApi(new Request('https://worker/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
        playerName: 'さかな',
        avatarStoneType: 'GHOST',
        bio: '自己紹介',
        category: 'score',
        mode: 'network',
        roomId: 'room1234',
        seatKey: 'black',
        score: 100000,
        turnCount: 1
      })
    }), env as any);

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(3);
    expect(seen[1]).toMatchObject({
      roomId: 'ROOM1234',
      pathname: '/internal/leaderboard/result',
      body: { playerId, seatKey: 'black' }
    });
    expect(seen[2]).toMatchObject({
      roomId: '__leaderboard__',
      pathname: '/internal/leaderboard/submit',
      body: {
        playerId,
        playerName: 'さかな',
        category: 'score',
        mode: 'network',
        score: 8818,
        scoreVersion: 5,
        turnCount: 42,
        authorityVerified: true,
        authoritySource: 'match_room'
      }
    });
  });

  test('CPU とタイム系のクライアント申告は本人確認後も共有ランキングへ転送しない', async () => {
    const seen: Array<{ roomId: string; pathname: string }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      playerIdentityRoomId: '__player_identity__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });
    const env = createEnv((roomId, request) => {
      seen.push({ roomId, pathname: new URL(request.url).pathname });
      return jsonResponse(200, { ok: true });
    });

    const response = await controller.handleLeaderboardApi(new Request('https://worker/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
        category: 'timeAttack',
        mode: 'cpu',
        elapsedMs: 1
      })
    }), env as any);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REQUIRED' });
    expect(seen).toEqual([{ roomId: '__player_identity__', pathname: '/api/player/identity/verify' }]);
  });

  test('player profile update は本人確認後に leaderboard と rating へ転送する', async () => {
    const seen: Array<{ roomId: string; pathname: string; body: any }> = [];
    const controller = createMatchWorkerApiController({
      corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      leaderboardRoomId: '__leaderboard__',
      ratingPoolRoomId: '__rating_pool__',
      normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
      jsonResponse,
      withCORS,
      handleCreate: async () => jsonResponse(200, { ok: true, created: true })
    });

    const env = createEnv(async (roomId, request) => {
      const pathname = new URL(request.url).pathname;
      const body = JSON.parse(String(await request.text() || '{}'));
      seen.push({ roomId, pathname, body });
      return jsonResponse(200, { ok: true, playerId: body.playerId });
    });

    const response = await controller.handleMatchApi(new Request('https://worker/api/player/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
        playerName: '新名',
        avatarStoneType: 'GHOST',
        bio: '更新後'
      })
    }), env as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' });
    expect(seen).toEqual([
      {
        roomId: '__player_identity__',
        pathname: '/api/player/identity/verify',
        body: {
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
        }
      },
      {
        roomId: '__leaderboard__',
        pathname: '/api/leaderboard/profile',
        body: {
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerName: '新名',
          avatarStoneType: 'GHOST',
          bio: '更新後'
        }
      },
      {
        roomId: '__rating_pool__',
        pathname: '/api/rating/profile',
        body: {
          playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
          playerName: '新名',
          avatarStoneType: 'GHOST',
          bio: '更新後'
        }
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
