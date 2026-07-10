import type {
    MatchAuthorityRoomState,
    MatchAuthoritySeatKey,
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

    return { resolveAuthenticatedSeatKey, addSpectatorToRoom, removeSpectatorFromRoom, resolveAuthenticatedViewer, classifySeatTokenRejectionReason };
}
