import type {
    MatchAuthorityBufferedSseEventRecord,
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthoritySeatKey
} from '../utils/match-authority-types';
import type { MatchWorkerRoomState, MatchWorkerSseStreamInfo } from './match-worker-types';

type MatchWorkerCryptoLike = {
    getRandomValues(array: Uint8Array): Uint8Array;
};

type MatchWorkerStreamControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    getSseEventBuffer: () => MatchAuthorityBufferedSseEventRecord[];
    setSseEventBuffer: (buffer: MatchAuthorityBufferedSseEventRecord[]) => void;
    getStreams: () => Map<string, MatchWorkerSseStreamInfo>;
    getHeartbeatTimerId: () => any;
    setHeartbeatTimerId: (value: any) => void;
    encoder: TextEncoder;
    normalizeRoomId: (value: unknown) => string;
    appendBufferedSseEvent: (
        buffer: MatchAuthorityBufferedSseEventRecord[] | null | undefined,
        record: MatchAuthorityBufferedSseEventRecordInput
    ) => MatchAuthorityBufferedSseEventRecord[];
    makeSseStreamId: (nowValue: unknown, explicitCrypto?: MatchWorkerCryptoLike | null) => string;
    cryptoLike?: MatchWorkerCryptoLike | null;
    buildHeartbeatPayload: (room: MatchWorkerRoomState, serverTime: unknown) => Record<string, unknown>;
    saveRoom: () => Promise<void>;
    onStreamCountChanged?: (streamCount: number) => Promise<void> | void;
    sseChunk: (eventName: unknown, payload: unknown, eventId?: unknown) => string;
    heartbeatIntervalMs: number;
    writeTimeoutMs: number;
    now?: () => number;
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
};

export function createMatchWorkerStreamController(config: MatchWorkerStreamControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerStreamControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
    const setTimeoutFn = typeof cfg.setTimeoutFn === 'function' ? cfg.setTimeoutFn : setTimeout;
    const clearTimeoutFn = typeof cfg.clearTimeoutFn === 'function' ? cfg.clearTimeoutFn : clearTimeout;

    function nextSseEventId(): string {
        const room = cfg.getRoom();
        if (!room || typeof room !== 'object') {
            return cfg.makeSseStreamId(now(), cfg.cryptoLike || null);
        }

        const prevSeq = Number.isFinite(Number(room.eventSeq))
            ? Math.max(0, Math.trunc(Number(room.eventSeq)))
            : 0;
        const nextSeq = prevSeq + 1;
        room.eventSeq = nextSeq;

        const roomId = cfg.normalizeRoomId(room.roomId || 'room') || 'room';
        const stateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion)))
            : 0;

        return `${roomId}_${stateVersion}_${nextSeq}`;
    }

    function rememberBufferedSseEvent(record: MatchAuthorityBufferedSseEventRecordInput): void {
        const room = cfg.getRoom();
        const nextBuffer = cfg.appendBufferedSseEvent(
            room && Array.isArray(room.sseEventBuffer) ? room.sseEventBuffer : cfg.getSseEventBuffer(),
            record
        );
        cfg.setSseEventBuffer(nextBuffer);
        if (room && typeof room === 'object') {
            room.sseEventBuffer = nextBuffer.slice();
        }
    }

    async function closeStream(streamId: string): Promise<void> {
        const streams = cfg.getStreams();
        const stream = streams.get(streamId);
        if (!stream) return;
        streams.delete(streamId);
        if (streams.size === 0 && cfg.getHeartbeatTimerId() !== null) {
            try { clearTimeoutFn(cfg.getHeartbeatTimerId()); } catch (e) { /* ignore */ }
            cfg.setHeartbeatTimerId(null);
        }
        try {
            const closePromise = stream.writer.close();
            const closeTimeoutMs = cfg.writeTimeoutMs > 0 ? Math.min(cfg.writeTimeoutMs, 1000) : 0;
            if (closeTimeoutMs > 0) {
                let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
                try {
                    await Promise.race([
                        closePromise,
                        new Promise((_, reject) => {
                            timeoutHandle = setTimeout(() => reject(new Error('SSE_CLOSE_TIMEOUT')), closeTimeoutMs);
                        })
                    ]);
                } finally {
                    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
                }
            } else {
                await closePromise;
            }
        } catch (e) {
            try { stream.writer.releaseLock(); } catch (inner) { /* ignore */ }
        }
        if (typeof cfg.onStreamCountChanged === 'function') {
            await cfg.onStreamCountChanged(streams.size);
        }
    }

    async function closeStreamsForSeat(seatKey: unknown): Promise<void> {
        const streams = cfg.getStreams();
        if (!seatKey || !streams || streams.size === 0) return;
        for (const [streamId, stream] of Array.from(streams.entries())) {
            if (!stream || !stream.viewer || stream.viewer.role !== 'seat' || stream.viewer.seatKey !== seatKey) continue;
            await closeStream(streamId);
        }
    }

    async function sendSse(streamId: string, eventName: string, payload: unknown, options?: Record<string, unknown> | null): Promise<void> {
        const streams = cfg.getStreams();
        const stream = streams.get(streamId);
        if (!stream) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const hasEventId = Object.prototype.hasOwnProperty.call(opts, 'eventId');
        const eventId = hasEventId ? opts.eventId : nextSseEventId();
        const timeoutMs = Number.isFinite(Number(opts.timeoutMs))
            ? Math.max(0, Math.trunc(Number(opts.timeoutMs)))
            : cfg.writeTimeoutMs;
            const chunk = cfg.sseChunk(eventName, payload, eventId);
        try {
            const writePromise = stream.writer.write(cfg.encoder.encode(chunk));
            if (timeoutMs > 0) {
                let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
                try {
                    await Promise.race([
                        writePromise,
                        new Promise((_, reject) => {
                            timeoutHandle = setTimeoutFn(() => reject(new Error('SSE_WRITE_TIMEOUT')), timeoutMs);
                        })
                    ]);
                } finally {
                    if (timeoutHandle !== null) clearTimeoutFn(timeoutHandle);
                }
            } else {
                await writePromise;
            }
        } catch (e) {
            await closeStream(streamId);
        }
    }

    async function broadcastHeartbeat(): Promise<void> {
        const room = cfg.getRoom();
        if (!room) return;
        const streamEntries = Array.from(cfg.getStreams().entries());
        if (streamEntries.length === 0) return;

        const serverTime = now();
        const payload = cfg.buildHeartbeatPayload(room, serverTime);
        const eventId = nextSseEventId();
        rememberBufferedSseEvent({
            eventId,
            eventName: 'heartbeat',
            payload
        });
        await cfg.saveRoom();

        await Promise.all(streamEntries.map(([streamId]) => (
            sendSse(streamId, 'heartbeat', payload, { eventId })
        )));
    }

    function ensureHeartbeatTimer(): void {
        if (cfg.getHeartbeatTimerId() !== null) return;
        if (cfg.getStreams().size === 0) return;

        const handle = setTimeoutFn(() => {
            cfg.setHeartbeatTimerId(null);
            if (cfg.getStreams().size === 0) return;

            broadcastHeartbeat().catch(() => {
                // Keep heartbeat loop resilient even if one tick fails.
            }).finally(() => {
                ensureHeartbeatTimer();
            });
        }, cfg.heartbeatIntervalMs);
        cfg.setHeartbeatTimerId(handle);
    }

    return {
        nextSseEventId,
        rememberBufferedSseEvent,
        ensureHeartbeatTimer,
        broadcastHeartbeat,
        closeStream,
        closeStreamsForSeat,
        sendSse
    };
}
