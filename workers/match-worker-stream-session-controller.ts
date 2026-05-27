import type { MatchAuthorityBufferedSseReplayEvent } from '../utils/match-authority-types';
import type { MatchWorkerRoomState } from './match-worker-types';

type MatchWorkerStreamSessionControllerConfig = {
    appendAuthorityLog: (
        room: MatchWorkerRoomState,
        entry: Record<string, unknown>,
        context?: unknown
    ) => void;
    buildHeartbeatPayload: (room: MatchWorkerRoomState, serverTime: unknown) => Record<string, unknown>;
    withPublicSeatState: (
        room: MatchWorkerRoomState,
        payload: Record<string, unknown>
    ) => Record<string, unknown>;
    toPublicRoomDeck: (room: MatchWorkerRoomState | null | undefined) => unknown;
    toPublicNetworkDebugEnabled: (room: MatchWorkerRoomState | null | undefined) => unknown;
    toPublicChatMessages: (room: MatchWorkerRoomState | null | undefined) => Array<Record<string, unknown>>;
    sendSse: (streamId: string, eventName: string, payload: unknown, options?: Record<string, unknown> | null) => Promise<void>;
    closeStream: (streamId: string) => Promise<void>;
    now?: () => number;
    queueMicrotaskFn?: (callback: () => void) => void;
};

type MatchWorkerInitialStreamDeliveryOptions = {
    room: MatchWorkerRoomState;
    replayEvents: MatchAuthorityBufferedSseReplayEvent[] | null | undefined;
    initialPayload: Record<string, unknown>;
    streamId: string;
};

export function createMatchWorkerStreamSessionController(config: MatchWorkerStreamSessionControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerStreamSessionControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const queueMicrotaskFn = typeof cfg.queueMicrotaskFn === 'function' ? cfg.queueMicrotaskFn : queueMicrotask;

    async function deliverInitialStreamEvents(options: MatchWorkerInitialStreamDeliveryOptions): Promise<void> {
        const opts = (options && typeof options === 'object') ? options : {} as MatchWorkerInitialStreamDeliveryOptions;
        const room = opts.room;
        if (!room) return;

        if (Array.isArray(opts.replayEvents)) {
            cfg.appendAuthorityLog(room, {
                kind: opts.replayEvents.length > 0 ? 'stream_resume_replay' : 'stream_resume_heartbeat',
                stateHashBefore: room.authoritativeStateHash,
                dedupeOutcome: opts.replayEvents.length > 0 ? 'replay' : 'empty_replay'
            }, undefined);
            if (opts.replayEvents.length > 0) {
                for (const event of opts.replayEvents) {
                    await cfg.sendSse(opts.streamId, event.eventName, event.payload, { eventId: event.eventId });
                }
            } else {
                await cfg.sendSse(opts.streamId, 'heartbeat', cfg.buildHeartbeatPayload(room, now()), { eventId: null });
            }
            return;
        }

        cfg.appendAuthorityLog(room, {
            kind: 'stream_resume_full_sync',
            stateHashBefore: room.authoritativeStateHash,
            dedupeOutcome: 'full_sync'
        }, undefined);
        await cfg.sendSse(opts.streamId, 'snapshot', opts.initialPayload);
        await cfg.sendSse(opts.streamId, 'chat', cfg.withPublicSeatState(room, {
            ok: true,
            roomId: room.roomId,
            type: 'history',
            roomDeck: cfg.toPublicRoomDeck(room),
            networkDebugEnabled: cfg.toPublicNetworkDebugEnabled(room),
            messages: cfg.toPublicChatMessages(room)
        }));
    }

    function scheduleInitialStreamDelivery(options: MatchWorkerInitialStreamDeliveryOptions): void {
        const opts = (options && typeof options === 'object') ? options : {} as MatchWorkerInitialStreamDeliveryOptions;
        queueMicrotaskFn(() => {
            (async () => {
                try {
                    await deliverInitialStreamEvents(opts);
                } catch (e) {
                    await cfg.closeStream(opts.streamId);
                }
            })();
        });
    }

    return {
        deliverInitialStreamEvents,
        scheduleInitialStreamDelivery
    };
}
