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
      'http://localhost:8787/api/match/stream?roomId=ABC&seatKey=white&seatToken=token_white&lastEventId=evt-1&presentationEnvelopeVersion=3'
    );
  });

  test('builds stream URL with spectator credentials for spectator sessions', () => {
    stateObj.roomId = 'SPC';
    stateObj.serverUrl = 'https://example.test';
    stateObj.viewerRole = 'spectator';
    stateObj.spectatorId = 'spec_12345678';
    stateObj.spectatorToken = 'spec-token';

    expect(controller.buildStreamUrl()).toBe(
      'https://example.test/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spec-token&presentationEnvelopeVersion=3'
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

describe('NetworkStreamSessionController with the real transport parser and reconnect markers', () => {
  function createRealHarness() {
    jest.resetModules();
    const { createNetworkStreamSessionController } = require('../ui/network/stream-session.js');
    const { createNetworkTransportController } = require('../ui/network/transport.js');
    const { createNetworkReconnectController } = require('../ui/network/reconnect-controller.js');

    let sessionEpoch = 1;
    const eventSources: any[] = [];
    const EventSourceMock = class {
      static OPEN = 1;
      url: string;
      readyState = 1;
      listeners: Record<string, any> = {};
      onmessage: any = null;
      onopen: any = null;
      onerror: any = null;
      constructor(url: string) {
        this.url = url;
        eventSources.push(this);
      }
      addEventListener(name: string, handler: any) {
        this.listeners[name] = handler;
      }
      close() {
        this.readyState = 2;
      }
    };
    const state: any = {
      active: true,
      roomId: 'ROOM1',
      seatKey: 'black',
      seatToken: 'token-black',
      serverUrl: 'http://localhost:8787',
      lastStreamEventId: '',
      lastStreamActivityAt: 0,
      reconnectAttempt: 0,
      reconnectTimerId: null,
      reconnectRecoveryTimerId: null,
      reconnectRecoveryPending: false,
      networkRecoverySyncInFlight: false,
      heartbeatResyncInFlight: false,
      streamWatchdogTimerId: 0,
      eventSource: null
    };
    const reconnect = createNetworkReconnectController({
      state,
      isActive: () => state.active === true,
      scheduleTimeout: () => 0,
      clearScheduledTimeout: () => undefined
    });
    const transport = createNetworkTransportController({ getState: () => state });
    const effects = {
      snapshot: jest.fn(),
      presence: jest.fn(),
      chat: jest.fn(),
      sessionState: jest.fn(),
      heartbeatSync: jest.fn(),
      telemetry: jest.fn()
    };
    const markStreamActivity = jest.fn(() => reconnect.markStreamActivity());
    const controller = createNetworkStreamSessionController({
      state,
      getSessionEpoch: () => sessionEpoch,
      eventSourceClass: EventSourceMock,
      closeExistingStream: () => { state.eventSource = null; },
      createStreamPayloadHandler: (handler: any) => transport.createStreamPayloadHandler(handler, {
        rememberStreamEventId: (event: any) => reconnect.rememberStreamEventId(event),
        markStreamActivity
      }),
      completeReconnectRecoveryFromStream: () => reconnect.completeReconnectRecoveryFromStream(),
      handleStreamSnapshotPayload: effects.snapshot,
      handlePresencePayload: effects.presence,
      handleChatPayload: effects.chat,
      applyPayloadSessionState: effects.sessionState,
      maybeSyncFromHeartbeat: effects.heartbeatSync,
      recordNetworkTelemetry: effects.telemetry,
      isActive: () => state.active === true
    });
    return {
      controller,
      effects,
      eventSources,
      markStreamActivity,
      state,
      advanceEpoch: () => { sessionEpoch += 1; }
    };
  }

  function emitAll(stream: any, eventId: string) {
    const data = JSON.stringify({ roomId: 'ROOM1', stateVersion: 99 });
    for (const name of ['snapshot', 'presence', 'chat', 'heartbeat', 'transport-health']) {
      stream.listeners[name]({ data, lastEventId: `${eventId}-${name}` });
    }
    stream.onmessage({ data, lastEventId: `${eventId}-message` });
  }

  function expectNoStaleEffects(harness: any, before: { cursor: string; activityCalls: number; recoveryPending: boolean }) {
    expect(harness.state.lastStreamEventId).toBe(before.cursor);
    expect(harness.markStreamActivity).toHaveBeenCalledTimes(before.activityCalls);
    expect(harness.state.reconnectRecoveryPending).toBe(before.recoveryPending);
    expect(harness.effects.snapshot).not.toHaveBeenCalled();
    expect(harness.effects.presence).not.toHaveBeenCalled();
    expect(harness.effects.chat).not.toHaveBeenCalled();
    expect(harness.effects.sessionState).not.toHaveBeenCalled();
    expect(harness.effects.heartbeatSync).not.toHaveBeenCalled();
    expect(harness.effects.telemetry).toHaveBeenCalledWith('stream_event_stale_session_ignored', expect.any(Object));
  }

  test.each([
    ['same-room reconnect', (h: any) => { h.controller.openStream({ reconnect: true }); }],
    ['switch to another room', (h: any) => { h.advanceEpoch(); h.state.roomId = 'ROOM2'; h.controller.openStream(); }],
    ['leave the room', (h: any) => { h.advanceEpoch(); h.state.active = false; h.state.roomId = ''; }]
  ])('a stale stream callback after %s changes no cursor, activity, recovery state, or board', (_label, transition) => {
    const harness = createRealHarness();
    harness.controller.openStream();
    const staleStream = harness.eventSources[0];
    staleStream.listeners.snapshot({ data: JSON.stringify({ roomId: 'ROOM1' }), lastEventId: 'evt-current' });
    expect(harness.state.lastStreamEventId).toBe('evt-current');
    harness.effects.snapshot.mockClear();

    transition(harness);
    harness.state.reconnectRecoveryPending = true;
    const before = {
      cursor: harness.state.lastStreamEventId,
      activityCalls: harness.markStreamActivity.mock.calls.length,
      recoveryPending: harness.state.reconnectRecoveryPending
    };

    emitAll(staleStream, 'evt-stale');

    expectNoStaleEffects(harness, before);
  });

  test('the current stream still records the cursor and applies payloads after a same-room reconnect', () => {
    const harness = createRealHarness();
    harness.controller.openStream();
    harness.controller.openStream({ reconnect: true });
    const currentStream = harness.eventSources[1];

    currentStream.listeners.snapshot({ data: JSON.stringify({ roomId: 'ROOM1' }), lastEventId: 'evt-new' });

    expect(harness.state.lastStreamEventId).toBe('evt-new');
    expect(harness.effects.snapshot).toHaveBeenCalledWith({ roomId: 'ROOM1' });
  });
});
