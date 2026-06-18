import type { MatchWorkerEnv } from './match-worker-types';

type MatchWorkerApiControllerConfig = {
    corsHeaders: Record<string, string>;
    leaderboardRoomId: string;
    lobbyRoomId?: string;
    normalizeRoomId: (value: unknown) => string;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    withCORS: (response: Response) => Response;
    handleCreate: (env: MatchWorkerEnv, options: unknown) => Promise<Response>;
    afterRoomMutation?: (env: MatchWorkerEnv, pathname: string, roomId: string, response: Response) => Promise<void> | void;
};

type ParsedPostBodyResult =
    | { ok: true; body: Record<string, unknown> }
    | { ok: false; response: Response };

function parseJsonBody(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch (e) {
        return null;
    }
}

function errorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message?: unknown }).message || 'unknown_error');
    }
    return String(error || 'unknown_error');
}

export function createMatchWorkerApiController(config: MatchWorkerApiControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerApiControllerConfig;
    const corsHeaders = (cfg.corsHeaders && typeof cfg.corsHeaders === 'object') ? cfg.corsHeaders : {};

    function getRoomStub(env: MatchWorkerEnv, roomId: string) {
        if (!env.MATCH_ROOM) throw new Error('MATCH_ROOM binding is required');
        const doId = env.MATCH_ROOM.idFromName(roomId);
        return env.MATCH_ROOM.get(doId);
    }

    function getLeaderboardStub(env: MatchWorkerEnv) {
        return getRoomStub(env, cfg.leaderboardRoomId);
    }

    function getLobbyStub(env: MatchWorkerEnv) {
        return getRoomStub(env, cfg.lobbyRoomId || '__match_lobby__');
    }

    async function forwardJsonToRoom(env: MatchWorkerEnv, roomId: string, pathname: string, payload: unknown): Promise<Response> {
        try {
            const stub = getRoomStub(env, roomId);
            const req = new Request(`https://room${pathname}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {})
            });
            const response = await stub.fetch(req);
            if (typeof cfg.afterRoomMutation === 'function') {
                await cfg.afterRoomMutation(env, pathname, roomId, response.clone());
            }
            return cfg.withCORS(response);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'ROOM_FORWARD_FAILED',
                message: errorMessage(error),
                pathname,
                roomId
            });
        }
    }

    async function forwardGetToRoom(env: MatchWorkerEnv, roomId: string, pathname: string, sourceUrl: string): Promise<Response> {
        try {
            const stub = getRoomStub(env, roomId);
            const urlObj = new URL(sourceUrl);
            const target = new URL(`https://room${pathname}`);
            for (const [key, value] of urlObj.searchParams.entries()) {
                target.searchParams.set(key, value);
            }
            target.searchParams.set('roomId', roomId);

            const req = new Request(target.toString(), { method: 'GET' });
            const response = await stub.fetch(req);
            return cfg.withCORS(response);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'ROOM_FORWARD_FAILED',
                message: errorMessage(error),
                pathname,
                roomId
            });
        }
    }

    async function forwardJsonToLeaderboard(env: MatchWorkerEnv, pathname: string, payload: unknown): Promise<Response> {
        try {
            const stub = getLeaderboardStub(env);
            const req = new Request(`https://room${pathname}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {})
            });
            const response = await stub.fetch(req);
            return cfg.withCORS(response);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'LEADERBOARD_FORWARD_FAILED',
                message: errorMessage(error),
                pathname
            });
        }
    }

    async function forwardGetToLeaderboard(env: MatchWorkerEnv, pathname: string, sourceUrl: string): Promise<Response> {
        try {
            const stub = getLeaderboardStub(env);
            const urlObj = new URL(sourceUrl);
            const target = new URL(`https://room${pathname}`);
            for (const [key, value] of urlObj.searchParams.entries()) {
                target.searchParams.set(key, value);
            }
            const req = new Request(target.toString(), { method: 'GET' });
            const response = await stub.fetch(req);
            return cfg.withCORS(response);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'LEADERBOARD_FORWARD_FAILED',
                message: errorMessage(error),
                pathname
            });
        }
    }

    async function forwardGetToLobby(env: MatchWorkerEnv, pathname: string, sourceUrl: string): Promise<Response> {
        try {
            const stub = getLobbyStub(env);
            const urlObj = new URL(sourceUrl);
            const target = new URL(`https://room${pathname}`);
            for (const [key, value] of urlObj.searchParams.entries()) {
                target.searchParams.set(key, value);
            }
            const req = new Request(target.toString(), { method: 'GET' });
            const response = await stub.fetch(req);
            return cfg.withCORS(response);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'LOBBY_FORWARD_FAILED',
                message: errorMessage(error),
                pathname
            });
        }
    }

    async function parsePostBody(request: Request): Promise<ParsedPostBodyResult> {
        const raw = await request.text();
        const body = parseJsonBody(raw);
        if (body === null) {
            return { ok: false, response: cfg.jsonResponse(400, { ok: false, reason: 'INVALID_JSON' }) };
        }
        return { ok: true, body };
    }

    async function handleMatchApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method === 'POST' && pathname === '/api/match/create') {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            try {
                return await cfg.handleCreate(env, parsed.body || {});
            } catch (error) {
                return cfg.jsonResponse(500, {
                    ok: false,
                    reason: 'MATCH_CREATE_FAILED',
                    message: errorMessage(error)
                });
            }
        }

        if (request.method === 'GET' && pathname === '/api/match/list') {
            return forwardGetToLobby(env, pathname, request.url);
        }

        if (request.method === 'POST' && (
            pathname === '/api/match/join'
            || pathname === '/api/match/leave'
            || pathname === '/api/match/spectate'
            || pathname === '/api/match/spectator-leave'
            || pathname === '/api/match/publish'
            || pathname === '/api/match/chat'
            || pathname === '/api/match/hand-skin'
        )) {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;

            const body = parsed.body || {};
            const roomId = cfg.normalizeRoomId(body.roomId);
            if (!roomId) {
                return cfg.jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
            }
            body.roomId = roomId;

            return forwardJsonToRoom(env, roomId, pathname, body);
        }

        if (request.method === 'GET' && (pathname === '/api/match/state' || pathname === '/api/match/stream')) {
            const roomId = cfg.normalizeRoomId(urlObj.searchParams.get('roomId') || '');
            if (!roomId) {
                return cfg.jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
            }
            return forwardGetToRoom(env, roomId, pathname, request.url);
        }

        return cfg.jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    async function handleLeaderboardApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method === 'POST' && pathname === '/api/leaderboard/submit') {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            return forwardJsonToLeaderboard(env, pathname, parsed.body || {});
        }

        if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
            return forwardGetToLeaderboard(env, pathname, request.url);
        }

        return cfg.jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    return {
        getRoomStub,
        getLeaderboardStub,
        forwardJsonToRoom,
        forwardGetToRoom,
        forwardJsonToLeaderboard,
        forwardGetToLeaderboard,
        forwardGetToLobby,
        parsePostBody,
        handleMatchApi,
        handleLeaderboardApi
    };
}
