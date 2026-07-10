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
import { createMatchStreamPreparationController } from '../utils/match-stream-preparation-controller';

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
    const preparationController = createMatchStreamPreparationController({
        loadRoom: () => cfg.loadRoom(),
        awaitLoadRoom: true,
        getRoom: () => cfg.getRoom(),
        expireRoomIfNeeded: () => (
            typeof cfg.expireRoomIfNeeded === 'function' ? cfg.expireRoomIfNeeded(now()) : false
        ),
        awaitExpireRoomIfNeeded: true,
        applyExpiredTurnTimeoutIfNeeded: () => cfg.applyExpiredTurnTimeoutIfNeeded(),
        awaitApplyExpiredTurnTimeoutIfNeeded: true,
        getSearchParam: (urlObj: URL, key: string) => urlObj.searchParams.get(key),
        getSearchParams: (urlObj: URL) => urlObj.searchParams,
        parseSeatKeyOptional: cfg.parseSeatKeyOptional,
        resolveAuthenticatedViewer: cfg.resolveAuthenticatedViewer,
        classifyViewerTokenRejectionReason: cfg.classifyViewerTokenRejectionReason,
        getSseEventBuffer: () => cfg.getSseEventBuffer(),
        getBufferedSseReplayEvents: cfg.getBufferedSseReplayEvents,
        jsonResponse: cfg.jsonResponse,
        now
    });

    async function handleStream(request: Request): Promise<Response> {
        const urlObj = new URL(request.url);
        const prepared = await preparationController.prepareStream(urlObj, request.headers.get('Last-Event-ID'));
        if (prepared.response) return prepared.response;
        const { room, viewer, replayEvents } = prepared;

        const { readable, writable } = new TransformStream<Uint8Array>();
        const writer = writable.getWriter();

        const streamId = cfg.makeSseStreamId(now(), cfg.cryptoLike || null);
        cfg.getStreams().set(streamId, { writer, viewer });
        if (typeof cfg.onStreamOpened === 'function') {
            await cfg.onStreamOpened(streamId);
        }
        cfg.ensureHeartbeatTimer();

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
