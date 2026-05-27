import type {
    MatchWorkerPreparedSnapshotBroadcast,
    MatchWorkerPresencePayloadMeta,
    MatchWorkerRoomState,
    MatchWorkerSnapshotPayloadMeta,
    MatchWorkerSseStreamInfo
} from './match-worker-types';
import type {
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthoritySeatKey
} from '../utils/match-authority-types';

type MatchWorkerBroadcastControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    getStreams: () => Map<string, MatchWorkerSseStreamInfo>;
    nextSseEventId: () => string;
    rememberBufferedSseEvent: (record: MatchAuthorityBufferedSseEventRecordInput) => void;
    saveRoom: () => Promise<void>;
    sendSse: (streamId: string, eventName: string, payload: unknown, options?: Record<string, unknown> | null) => Promise<void>;
    buildSnapshotPayload: (
        room: MatchWorkerRoomState,
        meta: MatchWorkerSnapshotPayloadMeta | null | undefined,
        viewerSeatKey: MatchAuthoritySeatKey | null
    ) => Record<string, unknown>;
    buildPresencePayload: (
        room: MatchWorkerRoomState,
        meta: MatchWorkerPresencePayloadMeta | null | undefined
    ) => Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function createMatchWorkerBroadcastController(config: MatchWorkerBroadcastControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerBroadcastControllerConfig;

    function buildBufferedSnapshotEvent(
        meta: MatchWorkerSnapshotPayloadMeta | null | undefined,
        eventId: string
    ): {
        record: MatchAuthorityBufferedSseEventRecordInput;
        payloadByViewer: Partial<Record<MatchAuthoritySeatKey, unknown>>;
    } {
        const room = cfg.getRoom();
        if (!room) {
            return {
                record: { eventId, eventName: 'snapshot', payloadByViewer: {} },
                payloadByViewer: {}
            };
        }
        const payloadByViewer = {
            black: cfg.buildSnapshotPayload(room, meta, 'black'),
            white: cfg.buildSnapshotPayload(room, meta, 'white')
        };
        return {
            record: {
                eventId,
                eventName: 'snapshot',
                payloadByViewer
            },
            payloadByViewer
        };
    }

    function prepareSnapshotBroadcast(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): MatchWorkerPreparedSnapshotBroadcast {
        const room = cfg.getRoom();
        const eventId = cfg.nextSseEventId();
        const { record, payloadByViewer } = buildBufferedSnapshotEvent(meta, eventId);
        return {
            eventId,
            record,
            payloadByViewer,
            fallbackPayload: room ? cfg.buildSnapshotPayload(room, meta, null) : {}
        };
    }

    async function broadcastPreparedSnapshot(preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast | null | undefined): Promise<void> {
        if (!cfg.getRoom() || !preparedSnapshot) return;
        cfg.rememberBufferedSseEvent(preparedSnapshot.record);
        await cfg.saveRoom();
        const streamEntries = Array.from(cfg.getStreams().entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId, streamInfo]) => {
            const viewerSeatKey = streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null;
            const payload = (viewerSeatKey && preparedSnapshot.payloadByViewer[viewerSeatKey])
                ? preparedSnapshot.payloadByViewer[viewerSeatKey]
                : preparedSnapshot.fallbackPayload;
            return cfg.sendSse(streamId, 'snapshot', payload, { eventId: preparedSnapshot.eventId });
        }));
    }

    async function broadcastSnapshot(meta: MatchWorkerSnapshotPayloadMeta | null | undefined): Promise<void> {
        if (!cfg.getRoom()) return;
        const preparedCandidate = asRecord(meta).__preparedSnapshot;
        const preparedSnapshot = preparedCandidate && typeof preparedCandidate === 'object'
            ? preparedCandidate as MatchWorkerPreparedSnapshotBroadcast
            : prepareSnapshotBroadcast(meta);
        await broadcastPreparedSnapshot(preparedSnapshot);
    }

    async function broadcastPresence(meta: MatchWorkerPresencePayloadMeta | null | undefined): Promise<void> {
        const room = cfg.getRoom();
        if (!room) return;
        const payload = cfg.buildPresencePayload(room, meta || {});
        const eventId = cfg.nextSseEventId();
        cfg.rememberBufferedSseEvent({
            eventId,
            eventName: 'presence',
            payload
        });
        await cfg.saveRoom();
        const streamEntries = Array.from(cfg.getStreams().entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            cfg.sendSse(streamId, 'presence', payload, { eventId })
        )));
    }

    async function broadcastChat(payload: unknown): Promise<void> {
        if (!cfg.getRoom()) return;
        const eventId = cfg.nextSseEventId();
        cfg.rememberBufferedSseEvent({
            eventId,
            eventName: 'chat',
            payload
        });
        await cfg.saveRoom();
        const streamEntries = Array.from(cfg.getStreams().entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            cfg.sendSse(streamId, 'chat', payload, { eventId })
        )));
    }

    return {
        buildBufferedSnapshotEvent,
        prepareSnapshotBroadcast,
        broadcastPreparedSnapshot,
        broadcastSnapshot,
        broadcastPresence,
        broadcastChat
    };
}
