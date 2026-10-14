// Chat rules shared by the Worker (Durable Object) and the local match server: seat/token checks,
// message validation (delegated to the shared network contract), history append, and the public
// history projection. HTTP responses, persistence, broadcast, and each runtime's payload decoration
// (Worker: turn timer + server time, local: roomDeck) stay in the adapters.

import { validateNetworkChatMessage } from '../shared/network-contract';

export type MatchChatSeatKey = 'black' | 'white';

export type MatchChatRejection = {
    ok: false;
    status: 400 | 403 | 409;
    reason: string;
    /** Present for message validation failures so adapters can echo the limit. */
    maxLength?: number;
};

export type MatchChatPostInput = {
    seatKey: MatchChatSeatKey;
    seatToken: string;
    /** Seat occupancy as each adapter already exposes it. */
    seats: { black?: unknown; white?: unknown } | null | undefined;
    seatTokens: { black?: unknown; white?: unknown } | null | undefined;
    message: unknown;
    maxLength: number;
    /** Reason used when the seat token is missing or wrong (runtime-specific, kept as-is). */
    seatTokenRejectionReason: (seatToken: string) => string;
};

export type MatchChatMessage = {
    id: number;
    seatKey: MatchChatSeatKey;
    text: string;
    serverTime: number;
};

export function evaluateMatchChatPost(input: MatchChatPostInput): { ok: true; text: string } | MatchChatRejection {
    const seats = input.seats || {};
    if (!seats[input.seatKey]) return { ok: false, status: 403, reason: 'SEAT_NOT_JOINED' };
    const seatToken = String(input.seatToken || '').trim();
    if (!seatToken || !input.seatTokens || input.seatTokens[input.seatKey] !== seatToken) {
        return { ok: false, status: 403, reason: input.seatTokenRejectionReason(seatToken) };
    }
    if (!seats.black || !seats.white) return { ok: false, status: 409, reason: 'CHAT_DISABLED' };
    const parsed = validateNetworkChatMessage(input.message, input.maxLength);
    if (!parsed.ok) return { ok: false, status: 400, reason: parsed.reason, maxLength: input.maxLength };
    return { ok: true, text: parsed.text };
}

// Appends an accepted message to the room history (sequence, bounded history, room activity time).
export function appendMatchChatMessage(
    room: any,
    entry: { seatKey: MatchChatSeatKey; text: string; serverTime: number; historyLimit: number }
): MatchChatMessage {
    room.chatSeq = Number.isFinite(Number(room.chatSeq)) ? Number(room.chatSeq) : 0;
    room.chatSeq += 1;
    const message: MatchChatMessage = {
        id: room.chatSeq,
        seatKey: entry.seatKey,
        text: entry.text,
        serverTime: entry.serverTime
    };
    room.chatMessages = Array.isArray(room.chatMessages) ? room.chatMessages : [];
    room.chatMessages.push(message);
    if (room.chatMessages.length > entry.historyLimit) {
        room.chatMessages.splice(0, room.chatMessages.length - entry.historyLimit);
    }
    room.updatedAt = message.serverTime;
    return message;
}

export function toPublicMatchChatMessages(
    room: any,
    normalizePlayerKey: (value: unknown) => string,
    now: () => number = () => Date.now()
): Array<Record<string, unknown>> {
    const messages: unknown[] = Array.isArray(room && room.chatMessages) ? room.chatMessages : [];
    return messages.map((value) => {
        const entry = value && typeof value === 'object' ? value as Record<string, unknown> : {};
        return {
            id: Number.isFinite(Number(entry.id)) ? Number(entry.id) : 0,
            seatKey: normalizePlayerKey(entry.seatKey),
            text: String(entry.text ? entry.text : ''),
            serverTime: Number.isFinite(Number(entry.serverTime)) ? Number(entry.serverTime) : now()
        };
    });
}
