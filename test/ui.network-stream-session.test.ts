describe('NetworkStreamSessionController', () => {
  let controller: any;
  let stateObj: any;
  let eventSources: any[];
  let EventSourceMock: any;
  let callbacks: any;
  let sessionEpoch: number;

  beforeEach(() => {
    jest.resetModules();

    eventSources = [];
    sessionEpoch = 1;
    callbacks = {
      closeExistingStream: jest.fn(),
      emitStatus: jest.fn(),
      createStreamPayloadHandler: jest.fn((handler: any) => handler),
      markStreamActivity: jest.fn(),
      scheduleStreamWatchdog: jest.fn(),
      clearReconnectTimer: jest.fn(),
      scheduleReconnectRecoverySync: jest.fn(),
      completeReconnectRecoveryFromStream: jest.fn(),
      handlePresencePayload: jest.fn(),
      handleChatPayload: jest.fn(),
      handleStreamSnapshotPayload: jest.fn(),
      applyPayloadSessionState: jest.fn(),
      maybeSyncFromHeartbeat: jest.fn(),
      isActive: jest.fn(() => true),
      scheduleStreamReconnect: jest.fn()
    };

    stateObj = {
      active: true,
      roomId: 'ABC',
      seatKey: 'white',
      seatToken: 'token_white',
      serverUrl: 'http://localhost:8787/',
      lastStreamEventId: 'evt-1',
      reconnectAttempt: 1,
      eventSource: null
    };

    EventSourceMock = class MockEventSource {
      static OPEN = 1;
      url: string;
      readyState: number;
      listeners: Record<string, any>;
      onmessage: any;
      onopen: any;
      onerror: any;
      constructor(url: string) {
        this.url = url;
        this.readyState = 1;
        this.listeners = {};
        this.onmessage = null;
        this.onopen = null;
        this.onerror = null;
        eventSources.push(this);
      }
      addEventListener(name: string, handler: any) {
        this.listeners[name] = handler;
      }
    };

    const { createNetworkStreamSessionController } = require('../ui/network/stream-session.js');
    controller = createNetworkStreamSessionController({
      getState: () => stateObj,
      getSessionEpoch: () => sessionEpoch,
      withTrailingSlashRemoved: (url: any) => String(url || '').replace(/\/+$/, ''),
      eventSourceClass: EventSourceMock,
      ...callbacks
    });
  });

  test('builds reconnect stream URL with lastEventId', () => {
    expect(controller.buildStreamUrl({ reconnect: true })).toBe(
      'http://localhost:8787/api/match/stream?roomId=ABC&seatKey=white&seatToken=token_white&lastEventId=evt-1'
    );
  });

  test('builds stream URL with spectator credentials for spectator sessions', () => {
    stateObj.roomId = 'SPC';
    stateObj.serverUrl = 'https://example.test';
    stateObj.viewerRole = 'spectator';
    stateObj.spectatorId = 'spec_12345678';
    stateObj.spectatorToken = 'spec-token';

    expect(controller.buildStreamUrl()).toBe(
      'https://example.test/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spec-token'
    );
  });

  test('openStream creates EventSource and wires handlers', () => {
    controller.openStream({ reconnect: true });

    expect(callbacks.closeExistingStream).toHaveBeenCalled();
    expect(eventSources).toHaveLength(1);
    expect(stateObj.eventSource).toBe(eventSources[0]);
    expect(callbacks.markStreamActivity).toHaveBeenCalled();
    expect(callbacks.scheduleStreamWatchdog).toHaveBeenCalled();
    expect(typeof eventSources[0].listeners.snapshot).toBe('function');
    expect(eventSources[0].onmessage).toBe(eventSources[0].listeners.snapshot);
  });

  test('onopen resets reconnect attempt and schedules recovery sync after reconnect', () => {
    controller.openStream({ reconnect: true });
    eventSources[0].onopen();

    expect(stateObj.reconnectAttempt).toBe(0);
    expect(callbacks.clearReconnectTimer).toHaveBeenCalled();
    expect(callbacks.emitStatus).toHaveBeenCalledWith('ネット対戦: 接続を回復しました', false);
    expect(callbacks.scheduleReconnectRecoverySync).toHaveBeenCalled();
  });

  test('onerror schedules reconnect when stream is no longer open', () => {
    controller.openStream();
    eventSources[0].readyState = 2;
    eventSources[0].onerror();

    expect(callbacks.emitStatus).toHaveBeenCalledWith('ネット対戦: 接続が不安定です（再接続待機）', true);
    expect(callbacks.scheduleStreamReconnect).toHaveBeenCalled();
  });

  test('ignores events and lifecycle callbacks from an older session stream', () => {
    controller.openStream();
    const staleStream = eventSources[0];

    sessionEpoch += 1;
    stateObj.roomId = 'XYZ';
    controller.openStream();
    const currentStream = eventSources[1];

    staleStream.listeners.snapshot({ roomId: 'ABC' });
    staleStream.listeners.presence({ roomId: 'ABC' });
    staleStream.listeners.chat({ roomId: 'ABC' });
    staleStream.listeners.heartbeat({ roomId: 'ABC' });
    staleStream.onopen();
    staleStream.readyState = 2;
    staleStream.onerror();

    expect(callbacks.handleStreamSnapshotPayload).not.toHaveBeenCalled();
    expect(callbacks.handlePresencePayload).not.toHaveBeenCalled();
    expect(callbacks.handleChatPayload).not.toHaveBeenCalled();
    expect(callbacks.applyPayloadSessionState).not.toHaveBeenCalled();
    expect(callbacks.scheduleStreamReconnect).not.toHaveBeenCalled();

    currentStream.listeners.snapshot({ roomId: 'XYZ' });
    expect(callbacks.handleStreamSnapshotPayload).toHaveBeenCalledWith({ roomId: 'XYZ' });
  });
});
