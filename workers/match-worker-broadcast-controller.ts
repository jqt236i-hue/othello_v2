import type {
    MatchWorkerPreparedSnapshotBroadcast,
    MatchWorkerPresencePayloadMeta,
    MatchWorkerRoomState,
    MatchWorkerSnapshotPayloadMeta,
    MatchWorkerSseStreamInfo
} from './match-worker-types';
import type {
    MatchAuthorityBufferedSseEventRecordInput,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
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
        viewer: MatchAuthorityViewer
    ) => Record<string, unknown>;
    buildPresencePayload: (
        room: MatchWorkerRoomState,
        meta: MatchWorkerPresencePayloadMeta | null | undefined
    ) => Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeStreamViewer(streamInfo: MatchWorkerSseStreamInfo | null | undefined): MatchAuthorityViewer {
    const source = asRecord(streamInfo);
    const viewer = asRecord(source.viewer);
    const viewerSeatKey = viewer.seatKey === 'black' || viewer.seatKey === 'white' ? viewer.seatKey : null;
    if (viewer.role === 'seat' && viewerSeatKey) {
        return { role: 'seat', seatKey: viewerSeatKey };
    }
    if (viewer.role === 'spectator') {
        return { role: 'spectator', spectatorId: String(viewer.spectatorId || '').trim() };
    }
    const legacySeatKey = source.seatKey === 'black' || source.seatKey === 'white' ? source.seatKey : null;
    return legacySeatKey ? { role: 'seat', seatKey: legacySeatKey } : { role: 'spectator', spectatorId: '' };
}

function getPayloadKeyForViewer(viewer: MatchAuthorityViewer): MatchAuthoritySeatKey | 'spectator' {
    return viewer.role === 'seat' ? viewer.seatKey : 'spectator';
}

export function createMatchWorkerBroadcastController(config: MatchWorkerBroadcastControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerBroadcastControllerConfig;

    function buildBufferedSnapshotEvent(
        meta: MatchWorkerSnapshotPayloadMeta | null | undefined,
        eventId: string
    ): {
        record: MatchAuthorityBufferedSseEventRecordInput;
        payloadByViewer: Partial<Record<MatchAuthoritySeatKey | 'spectator', unknown>>;
    } {
        const room = cfg.getRoom();
        if (!room) {
            return {
                record: { eventId, eventName: 'snapshot', payloadByViewer: {} },
                payloadByViewer: {}
            };
        }
        const metaRecord = asRecord(meta);
        const publishViewerArtifacts = asRecord(metaRecord.__publishViewerArtifacts);
        const cachedPayloads = asRecord(publishViewerArtifacts.snapshotPayloads);
        const hasPublishViewerArtifacts = Object.keys(publishViewerArtifacts).length > 0;
        const payloadByViewer = hasPublishViewerArtifacts ? cachedPayloads : {};
        if (!payloadByViewer.black) payloadByViewer.black = cfg.buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'black' });
        if (!payloadByViewer.white) payloadByViewer.white = cfg.buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'white' });
        if (!payloadByViewer.spectator) payloadByViewer.spectator = cfg.buildSnapshotPayload(room, meta, { role: 'spectator', spectatorId: '' });
        if (hasPublishViewerArtifacts) publishViewerArtifacts.snapshotPayloads = payloadByViewer;
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
            fallbackPayload: room ? payloadByViewer.spectator : {}
        };
    }

    function stagePreparedSnapshotBroadcast(
        preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast | null | undefined
    ): boolean {
        if (!cfg.getRoom() || !preparedSnapshot) return false;
        if (preparedSnapshot.stagedForPersistence === true) return false;
        cfg.rememberBufferedSseEvent(preparedSnapshot.record);
        preparedSnapshot.stagedForPersistence = true;
        return true;
    }

    async function broadcastPreparedSnapshot(preparedSnapshot: MatchWorkerPreparedSnapshotBroadcast | null | undefined): Promise<void> {
        if (!cfg.getRoom() || !preparedSnapshot) return;
        if (stagePreparedSnapshotBroadcast(preparedSnapshot)) {
            await cfg.saveRoom();
        }
        const streamEntries = Array.from(cfg.getStreams().entries());
        if (streamEntries.length === 0) return;
        const encodedPayloadCache = new Map<unknown, Map<string, Uint8Array>>();
        await Promise.all(streamEntries.map(([streamId, streamInfo]) => {
            const viewer = normalizeStreamViewer(streamInfo);
            const payloadKey = getPayloadKeyForViewer(viewer);
            const payload = preparedSnapshot.payloadByViewer[payloadKey]
                ? preparedSnapshot.payloadByViewer[payloadKey]
                : preparedSnapshot.fallbackPayload;
            return cfg.sendSse(streamId, 'snapshot', payload, { eventId: preparedSnapshot.eventId, encodedPayloadCache });
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
        stagePreparedSnapshotBroadcast,
        broadcastPreparedSnapshot,
        broadcastSnapshot,
        broadcastPresence,
        broadcastChat
    };
}
