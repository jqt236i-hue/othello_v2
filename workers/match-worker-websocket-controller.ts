import type { MatchAuthorityViewer } from '../utils/match-authority-types';
import type { DurableObjectStateLike, MatchWorkerRoomState, MatchWorkerSseStreamInfo, MatchWorkerWebSocket } from './match-worker-types';
import { normalizePresentationEnvelopeCapability } from '../shared/network-presentation-envelope';
import { MATCH_STREAM_PING, buildMatchStreamHealth } from '../shared/match-stream-health';

interface Attachment {
    version: 1;
    streamId: string;
    viewer: MatchAuthorityViewer;
    credentials: Record<string, unknown>;
    presentationEnvelopeVersion: 2 | 3 | null;
}

interface WebSocketRuntime {
    WebSocketPair?: new () => { 0: MatchWorkerWebSocket; 1: MatchWorkerWebSocket };
    WebSocketRequestResponsePair?: new (request: string, response: string) => unknown;
    Response: typeof Response;
}

export function createMatchWorkerWebSocketController(cfg: {
    state: DurableObjectStateLike;
    streams: Map<string, MatchWorkerSseStreamInfo>;
    getRoom(): MatchWorkerRoomState | null;
    resolveAuthenticatedViewer(room: MatchWorkerRoomState, credentials: Record<string, unknown>): MatchAuthorityViewer | null;
    closeStream(streamId: string): Promise<void>;
    onClosed(): Promise<unknown>;
    runtime?: WebSocketRuntime;
}) {
    const runtime = cfg.runtime || globalThis as unknown as WebSocketRuntime;
    const decoder = new TextDecoder();

    function register(socket: MatchWorkerWebSocket, attachment: Attachment): void {
        cfg.streams.set(attachment.streamId, {
            viewer: attachment.viewer,
            credentials: attachment.credentials,
            presentationEnvelopeVersion: normalizePresentationEnvelopeCapability(attachment.presentationEnvelopeVersion),
            webSocket: socket,
            writer: {
                async write(data) { socket.send(decoder.decode(data)); },
                async close() { socket.close(1000, 'Session closed'); },
                releaseLock() { /* WebSocket writes have no stream lock. */ }
            }
        });
    }

    function restoreStreams(): void {
        for (const socket of cfg.state.getWebSockets?.() || []) {
            try {
                const data = socket.deserializeAttachment() as Attachment | null;
                if (!data || data.version !== 1 || !data.streamId || !data.credentials || !data.viewer) {
                    socket.close(1008, 'Invalid session');
                    continue;
                }
                if (socket.readyState === 1) register(socket, data);
            } catch { socket.close(1008, 'Invalid session'); }
        }
    }

    async function validateRestoredStreams(): Promise<void> {
        const room = cfg.getRoom();
        for (const [id, stream] of cfg.streams) {
            if (!stream.webSocket) continue;
            const viewer = room && cfg.resolveAuthenticatedViewer(room, { ...stream.credentials, now: Date.now() });
            if (!viewer || JSON.stringify(viewer) !== JSON.stringify(stream.viewer)) await cfg.closeStream(id);
        }
    }

    function updateHealthResponse(): void {
        if (!runtime.WebSocketRequestResponsePair || !cfg.state.setWebSocketAutoResponse) return;
        cfg.state.setWebSocketAutoResponse(new runtime.WebSocketRequestResponsePair(
            MATCH_STREAM_PING, buildMatchStreamHealth(cfg.getRoom()?.stateVersion)
        ));
    }

    function openConnection(streamId: string, viewer: MatchAuthorityViewer, url: URL): Response | null {
        if (!runtime.WebSocketPair || !runtime.WebSocketRequestResponsePair || !cfg.state.acceptWebSocket || !cfg.state.setWebSocketAutoResponse) return null;
        const pair = new runtime.WebSocketPair();
        const credentials: Record<string, unknown> = {};
        for (const key of ['viewerRole', 'seatKey', 'seatToken', 'spectatorId', 'spectatorToken']) credentials[key] = url.searchParams.get(key) || '';
        const attachment: Attachment = {
            version: 1, streamId, viewer, credentials,
            presentationEnvelopeVersion: normalizePresentationEnvelopeCapability(url.searchParams.get('presentationEnvelopeVersion'))
        };
        pair[1].serializeAttachment(attachment);
        cfg.state.acceptWebSocket(pair[1]);
        register(pair[1], attachment);
        updateHealthResponse();
        return new runtime.Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
    }

    async function closeSocket(socket: MatchWorkerWebSocket): Promise<void> {
        for (const [id, stream] of cfg.streams) {
            if (stream.webSocket === socket) { await cfg.closeStream(id); return; }
        }
        socket.close(1000, 'Session closed');
        await cfg.onClosed();
    }

    async function handleMessage(socket: MatchWorkerWebSocket, message: unknown): Promise<void> {
        // Normal pings are answered by Cloudflare without waking the object.
        if (message === MATCH_STREAM_PING) {
            socket.send(buildMatchStreamHealth(cfg.getRoom()?.stateVersion));
            return;
        }
        socket.close(1008, 'Unsupported message');
        await closeSocket(socket);
    }

    return { restoreStreams, validateRestoredStreams, updateHealthResponse, openConnection, closeSocket, handleMessage };
}
