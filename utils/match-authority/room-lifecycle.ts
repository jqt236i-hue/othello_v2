import type {
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
    MatchAuthoritySeatLeaveOptions,
    MatchAuthoritySeatLeaveResult,
    MatchAuthoritySeatTokenRejectionReason,
    MatchAuthoritySpectatorJoinOptions,
    MatchAuthoritySpectatorJoinResult,
    MatchAuthoritySpectatorLeaveResult,
    MatchAuthoritySpectators,
    MatchAuthorityViewer
} from '../match-authority-types';

interface MatchAuthorityRoomLifecycleDeps {
    maxSpectators: number;
    seatTokenChars: string;
    randomFromChars: (chars: unknown, length: unknown) => string;
    makeSeatToken: () => string;
    normalizeSpectatorId: (value: unknown) => string;
    normalizeSpectatorName: (value: unknown) => string;
    ensureSpectators: (room: MatchAuthorityRoomState) => MatchAuthoritySpectators;
    getActiveSpectatorEntries: (room: MatchAuthorityRoomState) => Array<[string, any]>;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    normalizeSeatHandSkins: (value: unknown) => { black: string; white: string };
    normalizeSeatPlayerIds: (value: unknown) => { black: string; white: string };
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityRoomLifecycleApi(deps: MatchAuthorityRoomLifecycleDeps) {
    function resolveAuthenticatedSeatKey(room: MatchAuthorityRoomState | null | undefined, seatKeyValue: unknown, seatTokenValue: unknown): MatchAuthoritySeatKey | null {
        if (!room || !room.seatTokens || !room.seats) return null;
        const seatToken = String(seatTokenValue || '').trim();
        if (!seatToken) return null;
        const requestedSeat = deps.parseSeatKeyOptional(seatKeyValue);
        if (requestedSeat) return room.seats[requestedSeat] === true && room.seatTokens[requestedSeat] === seatToken ? requestedSeat : null;
        if (room.seats.black === true && room.seatTokens.black === seatToken) return 'black';
        return room.seats.white === true && room.seatTokens.white === seatToken ? 'white' : null;
    }

    function addSpectatorToRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: MatchAuthoritySpectatorJoinOptions | null): MatchAuthoritySpectatorJoinResult {
        const room = roomValue && typeof roomValue === 'object' ? roomValue : null;
        const opts = options && typeof options === 'object' ? options : {};
        if (!room || deps.getActiveSpectatorEntries(room).length >= deps.maxSpectators) return { ok: false, reason: 'SPECTATOR_FULL' };
        const spectators = deps.ensureSpectators(room);
        const makeId = typeof opts.makeSpectatorId === 'function' ? opts.makeSpectatorId : () => `spec_${deps.randomFromChars(deps.seatTokenChars, 12)}`;
        const makeToken = typeof opts.makeSpectatorToken === 'function' ? opts.makeSpectatorToken : deps.makeSeatToken;
        let spectatorId = '';
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidate = deps.normalizeSpectatorId(makeId());
            if (candidate && !spectators[candidate]) { spectatorId = candidate; break; }
        }
        if (!spectatorId) return { ok: false, reason: 'SPECTATOR_ID_COLLISION' };
        const now = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
        const spectatorName = deps.normalizeSpectatorName(opts.spectatorName) || '観測者';
        const spectatorToken = String(makeToken() || '').trim();
        spectators[spectatorId] = { token: spectatorToken, name: spectatorName, joinedAt: now, lastSeenAt: now };
        room.updatedAt = now;
        return { ok: true, spectatorId, spectatorToken, spectatorName, spectatorCount: deps.getActiveSpectatorEntries(room).length, maxSpectators: deps.maxSpectators };
    }

    function removeSpectatorFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthoritySpectatorLeaveResult {
        const room = roomValue && typeof roomValue === 'object' ? roomValue : null;
        const opts = asRecord(options);
        if (!room) return { ok: true, spectatorId: '', spectatorName: '', spectatorCount: 0, maxSpectators: deps.maxSpectators };
        const spectatorId = deps.normalizeSpectatorId(opts.spectatorId);
        const spectatorToken = String(opts.spectatorToken || '').trim();
        const entry = spectatorId ? deps.ensureSpectators(room)[spectatorId] : null;
        if (!entry || !spectatorToken || entry.token !== spectatorToken) return { ok: false, reason: spectatorToken ? 'SPECTATOR_TOKEN_MISMATCH' : 'SPECTATOR_TOKEN_REQUIRED' };
        const spectatorName = deps.normalizeSpectatorName(entry.name) || '観測者';
        delete deps.ensureSpectators(room)[spectatorId];
        room.updatedAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
        return { ok: true, spectatorId, spectatorName, spectatorCount: deps.getActiveSpectatorEntries(room).length, maxSpectators: deps.maxSpectators };
    }

    function resolveAuthenticatedViewer(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null): MatchAuthorityViewer | null {
        const room = roomValue && typeof roomValue === 'object' ? roomValue : null;
        const opts = asRecord(options);
        if (!room) return null;
        if (String(opts.viewerRole || '').trim().toLowerCase() === 'spectator') {
            const spectatorId = deps.normalizeSpectatorId(opts.spectatorId);
            const entry = spectatorId ? deps.ensureSpectators(room)[spectatorId] : null;
            if (!entry || !String(opts.spectatorToken || '').trim() || entry.token !== String(opts.spectatorToken).trim()) return null;
            entry.lastSeenAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
            return { role: 'spectator', spectatorId };
        }
        const seatKey = resolveAuthenticatedSeatKey(room, opts.seatKey, opts.seatToken);
        return seatKey ? { role: 'seat', seatKey } : null;
    }

    function classifySeatTokenRejectionReason(value: unknown): MatchAuthoritySeatTokenRejectionReason {
        return String(value || '').trim() ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED';
    }

    function resolveSeatForJoin(
        roomValue: MatchAuthorityRoomState | null | undefined,
        requestedSeatKey: unknown,
        providedToken: unknown
    ): MatchAuthoritySeatKey | null {
        const room: MatchAuthorityRoomState | null = (roomValue && typeof roomValue === 'object') ? roomValue : null;
        if (!room) return null;

        const token = String(providedToken || '').trim();
        const requested = deps.parseSeatKeyOptional(requestedSeatKey);
        const seats = (room.seats && typeof room.seats === 'object')
            ? room.seats
            : { black: false, white: false };
        const seatTokens = (room.seatTokens && typeof room.seatTokens === 'object')
            ? room.seatTokens
            : null;

        if (requested) {
            if (token && seatTokens && seatTokens[requested] === token) return requested;
            if (!seats[requested]) return requested;
            return null;
        }

        if (token && seatTokens) {
            if (seatTokens.black === token) return 'black';
            if (seatTokens.white === token) return 'white';
        }

        if (!seats.black) return 'black';
        if (!seats.white) return 'white';
        return null;
    }

    function applySeatLeaveToRoom(
        roomValue: MatchAuthorityRoomState | null | undefined,
        seatKeyValue: unknown,
        options?: MatchAuthoritySeatLeaveOptions | null
    ): MatchAuthoritySeatLeaveResult | null {
        const room: MatchAuthorityRoomState | null = (roomValue && typeof roomValue === 'object') ? roomValue : null;
        const seatKey = deps.parseSeatKeyOptional(seatKeyValue);
        const opts = (options && typeof options === 'object') ? options : {};
        if (!room || !seatKey) return null;

        const nextUpdatedAt = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
        const createSeatToken = (typeof opts.makeSeatToken === 'function')
            ? opts.makeSeatToken
            : null;

        room.seats = (room.seats && typeof room.seats === 'object')
            ? room.seats
            : { black: false, white: false };
        room.seatNames = (room.seatNames && typeof room.seatNames === 'object')
            ? room.seatNames
            : { black: '', white: '' };
        room.seatHandSkins = deps.normalizeSeatHandSkins(room.seatHandSkins);
        room.seatPlayerIds = deps.normalizeSeatPlayerIds(room.seatPlayerIds);
        room.seatTokens = (room.seatTokens && typeof room.seatTokens === 'object')
            ? room.seatTokens
            : {};

        room.seats[seatKey] = false;
        room.seatNames[seatKey] = '';
        room.seatHandSkins[seatKey] = '';
        room.seatPlayerIds[seatKey] = '';
        if (createSeatToken) {
            room.seatTokens[seatKey] = createSeatToken();
        }
        room.updatedAt = nextUpdatedAt;

        return {
            seatKey,
            updatedAt: nextUpdatedAt,
            seatToken: room.seatTokens[seatKey] || '',
            seats: room.seats,
            seatNames: room.seatNames,
            seatHandSkins: room.seatHandSkins,
            seatPlayerIds: room.seatPlayerIds
        };
    }

    function shouldDisposeRoom(roomValue: unknown, streamCountValue: unknown): boolean {
        const room = (roomValue && typeof roomValue === 'object') ? asRecord(roomValue) : null;
        if (!room) return false;
        const seats = asRecord(room.seats);
        const streamCount = Number.isFinite(Number(streamCountValue))
            ? Math.max(0, Math.trunc(Number(streamCountValue)))
            : 0;
        return !(
            room.seats
            && (seats.black || seats.white)
        ) && streamCount === 0;
    }

    return {
        resolveAuthenticatedSeatKey,
        addSpectatorToRoom,
        removeSpectatorFromRoom,
        resolveAuthenticatedViewer,
        classifySeatTokenRejectionReason,
        resolveSeatForJoin,
        applySeatLeaveToRoom,
        shouldDisposeRoom
    };
}
