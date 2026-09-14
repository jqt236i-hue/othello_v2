import { NetworkWebSocketStream } from '../ui/network/websocket-stream';
import { MATCH_STREAM_PING } from '../shared/match-stream-health';

class FakeSocket {
    static instances: FakeSocket[] = [];
    readyState = 0;
    onopen: any; onmessage: any; onerror: any; onclose: any;
    send = jest.fn(); close = jest.fn();
    constructor(public url: string) { FakeSocket.instances.push(this); }
}

beforeEach(() => { jest.useFakeTimers(); FakeSocket.instances = []; });
afterEach(() => { jest.useRealTimers(); });

test('keeps replay ids and spectator credentials while heartbeat carries no cursor or clock', () => {
    const stream = new NetworkWebSocketStream('https://game.test/api/match/stream?viewerRole=spectator&spectatorToken=secret&lastEventId=previous', { WebSocketClass: FakeSocket as any });
    const snapshot = jest.fn(), health = jest.fn();
    stream.addEventListener('snapshot', snapshot);
    stream.addEventListener('transport-health', health);
    const ws = FakeSocket.instances[0];
    expect(ws.url).toContain('wss://game.test/');
    expect(ws.url).toContain('spectatorToken=secret');
    expect(ws.url).toContain('lastEventId=previous');
    ws.readyState = 1; ws.onopen({});
    ws.onmessage({ data: 'id: next\nevent: snapshot\ndata: {"stateVersion":9}\n\n' });
    expect(snapshot).toHaveBeenCalledWith({ lastEventId: 'next', data: '{"stateVersion":9}' });
    jest.advanceTimersByTime(10000);
    expect(ws.send).toHaveBeenCalledWith(MATCH_STREAM_PING);
    ws.onmessage({ data: '{"type":"match-stream-health-v1","stateVersion":9}' });
    expect(health.mock.calls[0][0].lastEventId).toBe('');
    expect(JSON.parse(health.mock.calls[0][0].data)).not.toHaveProperty('serverTime');
    stream.close();
    jest.advanceTimersByTime(30000);
    expect(ws.send).toHaveBeenCalledTimes(1);
});

test('unsupported WebSocket falls back to SSE once; an established connection uses normal reconnect', () => {
    const events: any[] = [];
    class EventSourceFake {
        readyState = 1; onopen: any; onerror: any; close = jest.fn(); listeners: any = {};
        constructor(public url: string) { events.push(this); }
        addEventListener(name: string, callback: any) { this.listeners[name] = callback; }
    }
    const stream = new NetworkWebSocketStream('http://localhost/api/match/stream?roomId=A', { WebSocketClass: FakeSocket as any, EventSourceClass: EventSourceFake as any });
    const snapshot = jest.fn(); stream.addEventListener('snapshot', snapshot);
    FakeSocket.instances[0].onerror({});
    expect(events).toHaveLength(1);
    events[0].listeners.snapshot({ data: '{}', lastEventId: 'sse' });
    expect(snapshot).toHaveBeenCalledWith({ data: '{}', lastEventId: 'sse' });
    stream.close();
    const active = new NetworkWebSocketStream('http://localhost/api/match/stream', { WebSocketClass: FakeSocket as any, EventSourceClass: EventSourceFake as any });
    active.onerror = jest.fn(); const ws = FakeSocket.instances[1]; ws.readyState = 1; ws.onopen({}); ws.onclose({});
    expect(events).toHaveLength(1);
    expect(active.onerror).toHaveBeenCalledTimes(1);
    active.close();
});
