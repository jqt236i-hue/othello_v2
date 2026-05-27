import type { MatchAuthoritySeatKey } from '../utils/match-authority-types';
import type {
    MatchWorkerPublicSeatState,
    MatchWorkerRoomState
} from './match-worker-types';

type MatchWorkerParsedChatMessage =
    | { ok: true; text: string }
    | { ok: false; reason: string };

type MatchWorkerChatControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    loadRoom: () => Promise<void>;
    saveRoom: () => Promise<void>;
    applyExpiredTurnTimeoutIfNeeded: () => Promise<unknown>;
    normalizePlayerKey: (value: unknown) => MatchAuthoritySeatKey;
    buildPublicSeatState: (room: MatchWorkerRoomState | null | undefined) => MatchWorkerPublicSeatState;
    toPublicTurnTimer: (room: MatchWorkerRoomState, nowMs: unknown) => Record<string, unknown>;
    withPublicSeatState: (
        room: MatchWorkerRoomState,
        payload: Record<string, unknown>
    ) => Record<string, unknown>;
    toPublicNetworkDebugEnabled: (room: MatchWorkerRoomState | null | undefined) => boolean;
    classifySeatTokenRejectionReason: (seatTokenValue: unknown) => string;
    broadcastChat: (payload: unknown) => Promise<void>;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    chatMaxLength: number;
    chatHistoryLimit: number;
    now?: () => number;
};

function parseChatMessageText(value: unknown, maxLength: number): MatchWorkerParsedChatMessage {
    const normalized = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    if (!normalized) return { ok: false, reason: 'MESSAGE_REQUIRED' };
    const chars = Array.from(normalized);
    if (chars.length > maxLength) return { ok: false, reason: 'MESSAGE_TOO_LONG' };
    return { ok: true, text: chars.join('') };
}

export function createMatchWorkerChatController(config: MatchWorkerChatControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerChatControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

    function buildTimedSeatPayload(room: MatchWorkerRoomState, payload: Record<string, unknown>): Record<string, unknown> {
        const turnTimerNow = now();
        const serverTime = now();
        return cfg.withPublicSeatState(room, {
            ...payload,
            turnTimer: cfg.toPublicTurnTimer(room, turnTimerNow),
            serverTime
        });
    }

    async function handleChat(body: Record<string, unknown>): Promise<Response> {
        await cfg.loadRoom();
        const room = cfg.getRoom();

        if (!room) {
            return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await cfg.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = cfg.normalizePlayerKey(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        const publicSeats = cfg.buildPublicSeatState(room).seats;
        if (!publicSeats[seatKey]) {
            return cfg.jsonResponse(403, buildTimedSeatPayload(room, {
                ok: false,
                reason: 'SEAT_NOT_JOINED'
            }));
        }
        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return cfg.jsonResponse(403, buildTimedSeatPayload(room, {
                ok: false,
                reason: cfg.classifySeatTokenRejectionReason(seatToken)
            }));
        }
        if (!publicSeats.black || !publicSeats.white) {
            return cfg.jsonResponse(409, buildTimedSeatPayload(room, {
                ok: false,
                reason: 'CHAT_DISABLED'
            }));
        }

        const parsedText = parseChatMessageText(body.message, cfg.chatMaxLength);
        if (!parsedText.ok) {
            return cfg.jsonResponse(400, buildTimedSeatPayload(room, {
                ok: false,
                reason: parsedText.reason,
                maxLength: cfg.chatMaxLength
            }));
        }

        room.chatSeq = Number.isFinite(Number(room.chatSeq)) ? Number(room.chatSeq) : 0;
        room.chatSeq += 1;

        const message = {
            id: room.chatSeq,
            seatKey,
            text: parsedText.text,
            serverTime: now()
        };

        room.chatMessages = Array.isArray(room.chatMessages) ? room.chatMessages : [];
        room.chatMessages.push(message);
        if (room.chatMessages.length > cfg.chatHistoryLimit) {
            room.chatMessages.splice(0, room.chatMessages.length - cfg.chatHistoryLimit);
        }
        room.updatedAt = message.serverTime;
        await cfg.saveRoom();

        const payload = cfg.withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            type: 'message',
            message,
            networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room)
        });

        await cfg.broadcastChat(payload);

        return cfg.jsonResponse(200, buildTimedSeatPayload(room, {
            ok: true,
            roomId: room.roomId,
            message,
            networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room)
        }));
    }

    return {
        handleChat,
        parseChatMessageText: (value: unknown) => parseChatMessageText(value, cfg.chatMaxLength)
    };
}
