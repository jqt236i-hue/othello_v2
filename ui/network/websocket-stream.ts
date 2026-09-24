import { MATCH_STREAM_HEALTH_TYPE, MATCH_STREAM_PING, MATCH_STREAM_PING_INTERVAL_MS } from '../../shared/match-stream-health';
import { decompressMatchStreamFrame } from '../../shared/match-stream-compression';

/** EventSource-shaped transport so all snapshot/replay/session guards stay shared. */
export class NetworkWebSocketStream {
    onopen: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onmessage: ((event: unknown) => void) | null = null;
    private listeners = new Map<string, Array<(event: any) => void>>();
    private socket: WebSocket | null = null;
    private fallback: EventSource | null = null;
    private pingTimer: ReturnType<typeof setTimeout> | null = null;
    private closed = false;
    private opened = false;
    private failed = false;
    // With negotiated frame compression, frames are decoded asynchronously;
    // this chain keeps text and binary frames in arrival order.
    private inbound: Promise<void> = Promise.resolve();

    constructor(private url: string, private options: {
        WebSocketClass: typeof WebSocket;
        EventSourceClass?: typeof EventSource | null;
        /** Set only when the page can decompress; the Worker then sends binary frames. */
        frameCompression?: string | null;
    }) {
        const socketUrl = new URL(url);
        socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        if (options.frameCompression) socketUrl.searchParams.set('frameCompression', options.frameCompression);
        try {
            const socket = this.socket = new options.WebSocketClass(socketUrl.toString());
            if (options.frameCompression) socket.binaryType = 'arraybuffer';
            socket.onopen = event => {
                if (this.closed || this.socket !== socket) return;
                this.opened = true;
                this.onopen?.(event);
                this.schedulePing();
            };
            socket.onmessage = event => {
                if (this.closed || this.socket !== socket) return;
                if (!options.frameCompression) {
                    this.receive(String(event.data));
                    return;
                }
                const data = event.data;
                this.inbound = this.inbound.then(async () => {
                    const text = typeof data === 'string' ? data : await decompressMatchStreamFrame(data);
                    if (this.closed || this.socket !== socket) return;
                    this.receive(text);
                }).catch(error => this.handleFailure(error));
            };
            socket.onerror = event => this.handleFailure(event);
            socket.onclose = event => this.handleFailure(event);
        } catch (error) {
            // Let the session controller install its callbacks first.
            queueMicrotask(() => this.handleFailure(error));
        }
    }

    get readyState(): number { return this.closed ? 2 : this.fallback?.readyState ?? (this.socket?.readyState === 1 ? 1 : this.failed ? 2 : 0); }

    addEventListener(name: string, handler: (event: any) => void): void {
        const handlers = this.listeners.get(name) || [];
        handlers.push(handler);
        this.listeners.set(name, handlers);
    }

    private dispatch(name: string, event: any): void {
        for (const handler of this.listeners.get(name) || []) handler(event);
        if (name === 'message') this.onmessage?.(event);
    }

    private receive(text: string): void {
        if (text.startsWith('{')) {
            try {
                const health = JSON.parse(text);
                if (health.type === MATCH_STREAM_HEALTH_TYPE) this.dispatch('transport-health', { data: JSON.stringify(health), lastEventId: '' });
            } catch { /* Invalid health packets never enter game state. */ }
            return;
        }
        // The Worker sends the existing SSE event envelope in one WebSocket frame.
        let name = 'message', id = '';
        const data: string[] = [];
        for (const line of text.split(/\r?\n/)) {
            if (line.startsWith('event:')) name = line.slice(6).trim();
            else if (line.startsWith('id:')) id = line.slice(3).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        }
        if (data.length) this.dispatch(name, { data: data.join('\n'), lastEventId: id });
    }

    private schedulePing(): void {
        this.clearPing();
        this.pingTimer = setTimeout(() => {
            this.pingTimer = null;
            if (this.closed || this.socket?.readyState !== 1) return;
            try { this.socket.send(MATCH_STREAM_PING); }
            catch (error) { this.handleFailure(error); return; }
            this.schedulePing();
        }, MATCH_STREAM_PING_INTERVAL_MS);
    }

    private clearPing(): void {
        if (this.pingTimer !== null) clearTimeout(this.pingTimer);
        this.pingTimer = null;
    }

    private handleFailure(event: unknown): void {
        if (this.closed || this.failed) return;
        this.failed = true;
        this.clearPing();
        if (this.socket) {
            this.socket.onopen = this.socket.onmessage = this.socket.onerror = this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }
        if (!this.opened && this.options.EventSourceClass) {
            // Local Node servers and networks without WebSocket retain the existing SSE path.
            const fallback = this.fallback = new this.options.EventSourceClass(this.url);
            fallback.onopen = event => { if (!this.closed) this.onopen?.(event); };
            fallback.onerror = event => { if (!this.closed) this.onerror?.(event); };
            for (const name of ['snapshot', 'presence', 'chat', 'heartbeat', 'message']) {
                fallback.addEventListener(name, event => { if (!this.closed) this.dispatch(name, event); });
            }
            return;
        }
        this.onerror?.(event);
    }

    close(): void {
        this.closed = true;
        this.clearPing();
        this.fallback?.close();
        if (this.socket) {
            this.socket.onopen = this.socket.onmessage = this.socket.onerror = this.socket.onclose = null;
            this.socket.close();
        }
    }
}
