import { createMatchWorkerWebSocketController } from '../workers/match-worker-websocket-controller';
import { MATCH_STREAM_PING } from '../shared/match-stream-health';

class Socket {
    readyState = 1;
    attachment: any;
    send = jest.fn();
    close = jest.fn(() => { this.readyState = 3; });
    serializeAttachment(data: unknown) { this.attachment = structuredClone(data); }
    deserializeAttachment() { return structuredClone(this.attachment); }
}

function setup(existing: Socket[] = []) {
    let room: any = { roomId: 'ROOM', stateVersion: 8 };
    const streams = new Map<string, any>();
    const state: any = {
        storage: { put: jest.fn() },
        acceptWebSocket: jest.fn((socket: Socket) => existing.push(socket)),
        getWebSockets: () => existing,
        setWebSocketAutoResponse: jest.fn()
    };
    const resolveAuthenticatedViewer = jest.fn((_room, credentials) => credentials.seatToken === 'valid'
        ? { role: 'seat', seatKey: credentials.seatKey }
        : credentials.spectatorToken === 'valid-spectator' ? { role: 'spectator', spectatorId: credentials.spectatorId } : null);
    const onClosed = jest.fn(async () => {});
    const closeStream = jest.fn(async id => { const stream = streams.get(id); streams.delete(id); await stream?.writer.close(); });
    const runtime: any = {
        WebSocketPair: class { 0 = new Socket(); 1 = new Socket(); },
        WebSocketRequestResponsePair: class { constructor(public request: string, public response: string) {} },
        Response: class { constructor(public body: unknown, public init: any) {} }
    };
    const controller = createMatchWorkerWebSocketController({ state, streams, getRoom: () => room, resolveAuthenticatedViewer, closeStream, onClosed, runtime });
    return { controller, streams, state, existing, closeStream, onClosed, setRoom: (next: any) => { room = next; } };
}

test('hibernated player and spectator connections restore their separate projections and credentials', async () => {
    const first = setup();
    first.controller.openConnection('black', { role: 'seat', seatKey: 'black' }, new URL('https://room/api/match/stream?seatKey=black&seatToken=valid&presentationEnvelopeVersion=3'));
    first.controller.openConnection('watch', { role: 'spectator', spectatorId: 'spectator1' }, new URL('https://room/api/match/stream?viewerRole=spectator&spectatorId=spectator1&spectatorToken=valid-spectator&presentationEnvelopeVersion=2'));
    const restored = setup(first.existing);
    restored.controller.restoreStreams();
    await restored.controller.validateRestoredStreams();
    expect(restored.streams.get('black').viewer).toEqual({ role: 'seat', seatKey: 'black' });
    expect(restored.streams.get('watch').viewer).toEqual({ role: 'spectator', spectatorId: 'spectator1' });
    expect(restored.streams.get('watch').presentationEnvelopeVersion).toBe(2);
    await restored.streams.get('black').writer.write(new TextEncoder().encode('private black snapshot'));
    expect(first.existing[0].send).toHaveBeenCalledWith('private black snapshot');
    expect(first.existing[1].send).not.toHaveBeenCalled();
    expect(restored.state.storage.put).not.toHaveBeenCalled();
});

test('revoked credentials cannot receive broadcasts after restoration', async () => {
    const first = setup();
    first.controller.openConnection('old', { role: 'seat', seatKey: 'white' }, new URL('https://room/?seatKey=white&seatToken=revoked'));
    const restored = setup(first.existing);
    restored.controller.restoreStreams();
    await restored.controller.validateRestoredStreams();
    expect(restored.streams.size).toBe(0);
    expect(first.existing[0].close).toHaveBeenCalled();
});

test('auto-response exposes only committed version and needs no storage or heartbeat timer', () => {
    const ctx = setup();
    ctx.controller.updateHealthResponse();
    const pair = ctx.state.setWebSocketAutoResponse.mock.calls[0][0];
    expect(pair.request).toBe(MATCH_STREAM_PING);
    expect(JSON.parse(pair.response)).toEqual({ type: 'match-stream-health-v1', stateVersion: 8 });
    ctx.setRoom({ roomId: 'ROOM', stateVersion: 9, snapshot: { secret: 'hand' } });
    ctx.controller.updateHealthResponse();
    expect(JSON.parse(ctx.state.setWebSocketAutoResponse.mock.calls[1][0].response).stateVersion).toBe(9);
    expect(ctx.state.storage.put).not.toHaveBeenCalled();
});

test('closed sockets missing from the restored list still mark the room idle', async () => {
    const ctx = setup();
    await ctx.controller.closeSocket(new Socket());
    expect(ctx.onClosed).toHaveBeenCalledTimes(1);
});

test('negotiated frame compression sends each event as one raw-deflate frame in write order and survives hibernation', async () => {
    const { decompressMatchStreamFrame } = require('../shared/match-stream-compression');
    const first = setup();
    first.controller.openConnection('black', { role: 'seat', seatKey: 'black' }, new URL('https://room/api/match/stream?seatKey=black&seatToken=valid&presentationEnvelopeVersion=3&frameCompression=deflate-raw'));
    first.controller.openConnection('plain', { role: 'seat', seatKey: 'white' }, new URL('https://room/api/match/stream?seatKey=white&seatToken=valid&presentationEnvelopeVersion=3&frameCompression=gzip'));
    const restored = setup(first.existing);
    restored.controller.restoreStreams();
    await restored.controller.validateRestoredStreams();
    const events = ['id: 1\nevent: snapshot\ndata: {"stateVersion":1}\n\n', 'id: 2\nevent: presence\ndata: {"a":1}\n\n',
        `id: 3\nevent: snapshot\ndata: ${JSON.stringify({ stateVersion: 3, filler: 'x'.repeat(4000) })}\n\n`];
    const encoded = events.map(text => new TextEncoder().encode(text));
    // Writes are issued without awaiting, as a fanout may do.
    await Promise.all(encoded.map(bytes => restored.streams.get('black').writer.write(bytes)));
    await restored.streams.get('plain').writer.write(encoded[0]);
    const frames = first.existing[0].send.mock.calls.map(call => call[0]);
    expect(frames.every(frame => frame instanceof ArrayBuffer)).toBe(true);
    expect(await Promise.all(frames.map(frame => decompressMatchStreamFrame(frame)))).toEqual(events);
    expect(frames[2].byteLength).toBeLessThan(encoded[2].byteLength * 0.1);
    // Unknown formats are not negotiated; that viewer keeps text frames.
    expect(first.existing[1].send).toHaveBeenCalledWith(events[0]);
});
