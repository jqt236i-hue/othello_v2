import { createNetworkClientState } from '../ui/network/client-state';
import Reconnect = require('../ui/network/reconnect-controller');

const createState = () => createNetworkClientState({
    serverUrl: 'http://localhost', turnLimitSeconds: 120,
    resultState: { lastResultVersionShown: null, resultShownForUnversioned: false }
});

test('domain state and compatibility facade share writes without sharing all capabilities', () => {
    const client = createState();
    client.reconnection.reconnectAttempt = 4;
    expect(client.connection.reconnectAttempt).toBe(4);
    expect(client.state.reconnectAttempt).toBe(4);
    client.state.stateVersion = 12;
    expect(client.reconnection.stateVersion).toBe(12);
    expect(client.reconnection).not.toHaveProperty('seatToken');
    expect(client.reconnection).not.toHaveProperty('publishTracker');
    expect(() => Object.assign(client.reconnection, { seatToken: 'unexpected' })).toThrow();
    expect(createState().connection.reconnectAttempt).toBe(0);
});

test('reconnect operates through its port and closes the stream visible to the session', () => {
    const client = createState();
    const close = jest.fn();
    client.stream.eventSource = { close };
    client.reconnection.reconnectRecoveryPending = true;
    const controller = Reconnect.createNetworkReconnectController({ state: client.reconnection });
    controller.closeStream();
    expect(close).toHaveBeenCalledTimes(1);
    expect(client.stream.eventSource).toBeNull();
    expect(client.connection.reconnectRecoveryPending).toBe(false);
});
