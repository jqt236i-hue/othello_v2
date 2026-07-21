import type { MatchWorkerEnv } from './match-worker-types';

const IdentityContract = require('../shared/player-identity-contract');

type MatchWorkerApiControllerConfig = {
    corsHeaders: Record<string, string>;
    leaderboardRoomId: string;
    ratingPoolRoomId?: string;
    lobbyRoomId?: string;
    playerIdentityRoomId?: string;
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

    function getRatingPoolRoomId() {
        return String(cfg.ratingPoolRoomId || '__rating_pool_card_ranked_v1__');
    }

    function getRatingPoolStub(env: MatchWorkerEnv) {
        return getRoomStub(env, getRatingPoolRoomId());
    }

    function getLobbyStub(env: MatchWorkerEnv) {
        return getRoomStub(env, cfg.lobbyRoomId || '__match_lobby__');
    }

    function getPlayerIdentityRoomId() {
        return String(cfg.playerIdentityRoomId || '__player_identity__');
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

    async function forwardVerifiedLeaderboardSubmit(
        env: MatchWorkerEnv,
        body: Record<string, unknown>,
        playerId: string
    ): Promise<Response> {
        const category = String(body.category || 'score').trim();
        const mode = String(body.mode || '').trim().toLowerCase();
        if (category !== 'score' || mode !== 'network') {
            return cfg.jsonResponse(403, { ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REQUIRED' });
        }
        const roomId = cfg.normalizeRoomId(body.roomId);
        const seatKey = String(body.seatKey || '').trim().toLowerCase();
        if (!roomId || (seatKey !== 'black' && seatKey !== 'white')) {
            return cfg.jsonResponse(400, { ok: false, reason: 'LEADERBOARD_AUTHORITY_CONTEXT_REQUIRED' });
        }

        try {
            const proofResponse = await getRoomStub(env, roomId).fetch(new Request('https://room/internal/leaderboard/result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, seatKey })
            }));
            const proof = parseJsonBody(await proofResponse.text());
            if (!proofResponse.ok) {
                return cfg.jsonResponse(proofResponse.status, proof || { ok: false, reason: 'LEADERBOARD_RESULT_PROOF_REJECTED' });
            }
            const proofScore = Number(proof && proof.score);
            const proofScoreVersion = Number(proof && proof.scoreVersion);
            const proofTurnCount = Number(proof && proof.turnCount);
            if (
                !proof
                || proof.ok !== true
                || proof.authorityVerified !== true
                || proof.playerId !== playerId
                || proof.category !== 'score'
                || proof.mode !== 'network'
                || !Number.isFinite(proofScore)
                || !Number.isFinite(proofScoreVersion)
                || !Number.isFinite(proofTurnCount)
            ) {
                return cfg.jsonResponse(502, { ok: false, reason: 'LEADERBOARD_RESULT_PROOF_INVALID' });
            }

            const verifiedPayload: Record<string, unknown> = {
                playerId,
                playerName: body.playerName,
                avatarStoneType: body.avatarStoneType,
                bio: body.bio,
                category: 'score',
                mode: 'network',
                score: Math.max(0, Math.trunc(proofScore)),
                scoreVersion: Math.max(0, Math.trunc(proofScoreVersion)),
                turnCount: Math.max(0, Math.trunc(proofTurnCount)),
                boardConfig: proof.boardConfig,
                debug: false,
                authorityVerified: true,
                authoritySource: 'match_room',
                matchId: proof.matchId,
                stateVersion: proof.stateVersion,
                limit: body.limit
            };
            return forwardJsonToLeaderboard(env, '/internal/leaderboard/submit', verifiedPayload);
        } catch (error) {
            return cfg.jsonResponse(500, {
                ok: false,
                reason: 'LEADERBOARD_RESULT_PROOF_FAILED',
                message: errorMessage(error),
                roomId
            });
        }
    }

    async function forwardJsonToRatingPool(env: MatchWorkerEnv, pathname: string, payload: unknown): Promise<Response> {
        try {
            const stub = getRatingPoolStub(env);
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
                reason: 'RATING_FORWARD_FAILED',
                message: errorMessage(error),
                pathname
            });
        }
    }

    async function forwardGetToRatingPool(env: MatchWorkerEnv, pathname: string, sourceUrl: string): Promise<Response> {
        try {
            const stub = getRatingPoolStub(env);
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
                reason: 'RATING_FORWARD_FAILED',
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

    async function forwardJsonToLobby(env: MatchWorkerEnv, pathname: string, payload: unknown): Promise<Response> {
        try {
            const stub = getLobbyStub(env);
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

    async function verifyPlayerIdentityForPublicApi(env: MatchWorkerEnv, body: Record<string, unknown>): Promise<
        { ok: true; playerId: string | null }
        | { ok: false; response: Response }
    > {
        const playerId = IdentityContract.normalizePlayerId(body.playerId);
        const playerToken = IdentityContract.normalizePlayerToken(body.playerToken);
        if (!playerId && !playerToken) return { ok: true, playerId: null };
        if (!playerId || !playerToken) {
            return { ok: false, response: cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' }) };
        }
        const stub = getRoomStub(env, getPlayerIdentityRoomId());
        const verifyResponse = await stub.fetch(new Request('https://room/api/player/identity/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, playerToken })
        }));
        if (!verifyResponse.ok) {
            return { ok: false, response: cfg.withCORS(verifyResponse) };
        }
        return { ok: true, playerId };
    }

    async function handleMatchApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method === 'POST' && (
            pathname === '/api/player/identity/create'
            || pathname === '/api/player/identity/verify'
            || pathname === '/api/player/identity/recover'
            || pathname === '/api/player/identity/recovery/regenerate'
        )) {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            return forwardJsonToRoom(env, getPlayerIdentityRoomId(), pathname, parsed.body || {});
        }

        if (request.method === 'POST' && pathname === '/api/player/profile') {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            const body = parsed.body || {};
            const verified = await verifyPlayerIdentityForPublicApi(env, body);
            if (!verified.ok) return verified.response;
            if (!verified.playerId) {
                return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
            }
            const profilePayload: Record<string, unknown> = {
                ...body,
                playerId: verified.playerId
            };
            delete profilePayload.playerToken;
            delete profilePayload.recoveryCode;
            const leaderboardResponse = await forwardJsonToLeaderboard(env, '/api/leaderboard/profile', profilePayload);
            if (!leaderboardResponse.ok) return leaderboardResponse;
            const ratingResponse = await forwardJsonToRatingPool(env, '/api/rating/profile', profilePayload);
            if (!ratingResponse.ok) return ratingResponse;
            return cfg.jsonResponse(200, { ok: true, playerId: verified.playerId });
        }

        if (request.method === 'POST' && pathname === '/api/match/create') {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            const body = parsed.body || {};
            const verified = await verifyPlayerIdentityForPublicApi(env, body);
            if (!verified.ok) return verified.response;
            body.playerId = verified.playerId || '';
            delete body.playerToken;
            delete body.recoveryCode;
            try {
                return await cfg.handleCreate(env, body);
            } catch (error) {
                return cfg.jsonResponse(500, {
                    ok: false,
                    reason: 'MATCH_CREATE_FAILED',
                    message: errorMessage(error)
                });
            }
        }

        if (request.method === 'POST' && (
            pathname === '/api/match/rated/queue'
            || pathname === '/api/match/rated/poll'
            || pathname === '/api/match/rated/cancel'
        )) {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            const body = parsed.body || {};
            const verified = await verifyPlayerIdentityForPublicApi(env, body);
            if (!verified.ok) return verified.response;
            if (!verified.playerId) {
                return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
            }
            body.playerId = verified.playerId;
            delete body.playerToken;
            delete body.recoveryCode;
            return forwardJsonToLobby(env, pathname, body);
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
            || pathname === '/api/match/deck'
            || pathname === '/api/match/resign'
            || pathname === '/api/match/rematch-request'
            || pathname === '/api/match/rematch-response'
        )) {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;

            const body = parsed.body || {};
            const roomId = cfg.normalizeRoomId(body.roomId);
            if (!roomId) {
                return cfg.jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
            }
            body.roomId = roomId;
            if (pathname === '/api/match/join') {
                const verified = await verifyPlayerIdentityForPublicApi(env, body);
                if (!verified.ok) return verified.response;
                body.playerId = verified.playerId || '';
                delete body.playerToken;
                delete body.recoveryCode;
            }

            return forwardJsonToRoom(env, roomId, pathname, body);
        }

        if (request.method === 'GET' && (
            pathname === '/api/match/state'
            || pathname === '/api/match/stream'
            || pathname === '/api/match/presentation-journal'
        )) {
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
            const body = parsed.body || {};
            const verified = await verifyPlayerIdentityForPublicApi(env, body);
            if (!verified.ok) return verified.response;
            if (!verified.playerId) return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
            return forwardVerifiedLeaderboardSubmit(env, body, verified.playerId);
        }

        if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
            return forwardGetToLeaderboard(env, pathname, request.url);
        }

        return cfg.jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    async function handleRatingApi(request: Request, env: MatchWorkerEnv): Promise<Response> {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method === 'GET' && (
            pathname === '/api/rating/me'
            || pathname === '/api/rating/leaderboard'
            || pathname === '/api/rating/history'
        )) {
            return forwardGetToRatingPool(env, pathname, request.url);
        }

        if (request.method === 'POST' && (
            pathname === '/internal/rating/finalize'
            || pathname === '/internal/rating/active/claim'
            || pathname === '/internal/rating/active/release'
        )) {
            const parsed = await parsePostBody(request);
            if (!parsed.ok) return parsed.response;
            return forwardJsonToRatingPool(env, pathname, parsed.body || {});
        }

        return cfg.jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    return {
        getRoomStub,
        getLeaderboardStub,
        getRatingPoolStub,
        forwardJsonToRoom,
        forwardGetToRoom,
        forwardJsonToLeaderboard,
        forwardGetToLeaderboard,
        forwardVerifiedLeaderboardSubmit,
        forwardJsonToRatingPool,
        forwardGetToRatingPool,
        forwardJsonToLobby,
        forwardGetToLobby,
        parsePostBody,
        verifyPlayerIdentityForPublicApi,
        handleMatchApi,
        handleLeaderboardApi,
        handleRatingApi
    };
}
