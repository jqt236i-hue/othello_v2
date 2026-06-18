import type {
    MatchAuthorityBufferedSseReplayEvent,
    MatchAuthoritySeatKey,
    MatchAuthorityViewer
} from '../utils/match-authority-types';
import type {
    MatchWorkerRoomState,
    MatchWorkerSnapshotPayloadMeta,
    MatchWorkerSseStreamInfo
} from './match-worker-types';

type MatchWorkerCryptoLike = {
    getRandomValues(array: Uint8Array): Uint8Array;
};

type MatchWorkerStreamRouteControllerConfig = {
    getRoom: () => MatchWorkerRoomState | null;
    getStreams: () => Map<string, MatchWorkerSseStreamInfo>;
    getSseEventBuffer: () => unknown[];
    loadRoom: () => Promise<void>;
    expireRoomIfNeeded?: (nowMs?: number) => Promise<boolean>;
    applyExpiredTurnTimeoutIfNeeded: () => Promise<unknown>;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
    resolveAuthenticatedViewer: (
        room: MatchWorkerRoomState,
        options: Record<string, unknown>
    ) => MatchAuthorityViewer | null;
    classifyViewerTokenRejectionReason: (searchParams: URLSearchParams) => string;
    getBufferedSseReplayEvents: (
        replayBuffer: unknown,
        lastEventId: unknown,
        viewer: MatchAuthorityViewer
    ) => MatchAuthorityBufferedSseReplayEvent[] | null;
    makeSseStreamId: (nowValue: unknown, explicitCrypto?: MatchWorkerCryptoLike | null) => string;
    buildSnapshotPayload: (
        room: MatchWorkerRoomState,
        meta: MatchWorkerSnapshotPayloadMeta | null | undefined,
        viewer: MatchAuthorityViewer
    ) => Record<string, unknown>;
    scheduleInitialStreamDelivery: (options: {
        room: MatchWorkerRoomState;
        replayEvents: MatchAuthorityBufferedSseReplayEvent[] | null | undefined;
        initialPayload: Record<string, unknown>;
        streamId: string;
    }) => void;
    closeStream: (streamId: string) => Promise<void>;
    ensureHeartbeatTimer: () => void;
    onStreamOpened?: (streamId: string) => Promise<void> | void;
    jsonResponse: (statusCode: number, payload: unknown) => Response;
    corsHeaders: Record<string, string>;
    cryptoLike?: MatchWorkerCryptoLike | null;
    now?: () => number;
};

export function createMatchWorkerStreamRouteController(config: MatchWorkerStreamRouteControllerConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as MatchWorkerStreamRouteControllerConfig;
    const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();

    async function handleStream(request: Request): Promise<Response> {
        await cfg.loadRoom();
        const room = cfg.getRoom();
        if (!room) {
            return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (typeof cfg.expireRoomIfNeeded === 'function' && await cfg.expireRoomIfNeeded(now())) {
            return cfg.jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await cfg.applyExpiredTurnTimeoutIfNeeded();

        const urlObj = new URL(request.url);
        const seatKey = cfg.parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
        const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
        const resumeEventId = String(urlObj.searchParams.get('lastEventId') || '').trim();
        const viewer = cfg.resolveAuthenticatedViewer(room, {
            viewerRole: urlObj.searchParams.get('viewerRole') || '',
            seatKey,
            seatToken,
            spectatorId: urlObj.searchParams.get('spectatorId') || '',
            spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
            now: now()
        });
        if (!viewer) {
            return cfg.jsonResponse(403, { ok: false, reason: cfg.classifyViewerTokenRejectionReason(urlObj.searchParams) });
        }

        const { readable, writable } = new TransformStream<Uint8Array>();
        const writer = writable.getWriter();

        const streamId = cfg.makeSseStreamId(now(), cfg.cryptoLike || null);
        cfg.getStreams().set(streamId, { writer, viewer });
        if (typeof cfg.onStreamOpened === 'function') {
            await cfg.onStreamOpened(streamId);
        }
        cfg.ensureHeartbeatTimer();

        const lastEventId = String(request.headers.get('Last-Event-ID') || resumeEventId).trim();
        const replayBuffer = Array.isArray(room.sseEventBuffer) ? room.sseEventBuffer : cfg.getSseEventBuffer();
        const replayEvents = cfg.getBufferedSseReplayEvents(replayBuffer, lastEventId, viewer);

        const onAbort = () => {
            cfg.closeStream(streamId).catch(() => {});
        };

        try {
            if (request.signal && typeof request.signal.addEventListener === 'function') {
                request.signal.addEventListener('abort', onAbort, { once: true });
            }
        } catch (e) { /* ignore */ }

        const initialPayload = cfg.buildSnapshotPayload(room, { playbackEvents: [] }, viewer);
        cfg.scheduleInitialStreamDelivery({
            room,
            replayEvents,
            initialPayload,
            streamId
        });

        return new Response(readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                ...cfg.corsHeaders
            }
        });
    }

    return {
        handleStream
    };
}
