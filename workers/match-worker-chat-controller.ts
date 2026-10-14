import type { MatchAuthoritySeatKey } from '../utils/match-authority-types';
import { validateNetworkChatMessage } from '../shared/network-contract';
import { appendMatchChatMessage, evaluateMatchChatPost } from '../utils/match-chat-rules';
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
    return validateNetworkChatMessage(value, maxLength);
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
        // Seat/token/validation rules are shared with the local server (utils/match-chat-rules.ts).
        const evaluation = evaluateMatchChatPost({
            seatKey,
            seatToken: String(body.seatToken || ''),
            seats: cfg.buildPublicSeatState(room).seats,
            seatTokens: room.seatTokens,
            message: body.message,
            maxLength: cfg.chatMaxLength,
            seatTokenRejectionReason: (seatToken) => cfg.classifySeatTokenRejectionReason(seatToken)
        });
        if (!evaluation.ok) {
            const rejection: Record<string, unknown> = { ok: false, reason: evaluation.reason };
            if (evaluation.maxLength !== undefined) rejection.maxLength = evaluation.maxLength;
            return cfg.jsonResponse(evaluation.status, buildTimedSeatPayload(room, rejection));
        }

        const message = appendMatchChatMessage(room, {
            seatKey,
            text: evaluation.text,
            serverTime: now(),
            historyLimit: cfg.chatHistoryLimit
        });
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
