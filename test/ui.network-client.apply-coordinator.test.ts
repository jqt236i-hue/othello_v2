import { JSDOM } from 'jsdom';

jest.mock('../ui/board-renderer.ts', () => ({
  getBoardVisualControllerReady: jest.fn(async () => undefined)
}));

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createSnapshot(stateVersion, options = {}) {
  const topLevelStateVersion = Number.isFinite(Number(options.topLevelStateVersion))
    ? Number(options.topLevelStateVersion)
    : stateVersion;
  const metaVersion = Number.isFinite(Number(options.metaVersion))
    ? Number(options.metaVersion)
    : stateVersion;
  return {
    stateVersion: topLevelStateVersion,
    _meta: {
      authority: 'server',
      version: metaVersion,
      projectedForSeat: Object.prototype.hasOwnProperty.call(options, 'projectedForSeat')
        ? options.projectedForSeat
        : null,
      turnStartReconciled: options.turnStartReconciled !== false
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

function createPlaceAction(playerKey = 'black', turnIndex = 1) {
  return {
    type: 'place',
    playerKey,
    row: 2,
    col: 3,
    turnIndex
  };
}

describe('NetworkMatchClient apply coordinator', () => {
  let dom;
  let eventSources;
  let publishPayloads;
  let resolvePublishResponse;
  let responsePayload;
  let stateResponsePayload;
  let journalResponsePayload;
  let requestedPaths;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = createSnapshot(10).gameState;
    global.cardState = createSnapshot(10).cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.showResult = jest.fn();
    global.isGameOver = jest.fn((gs) => !!(gs && gs.currentPlayer === -1));
    global.PresentationHandler = {
      handlePresentationEvent: jest.fn(async () => undefined),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    eventSources = [];
    publishPayloads = [];
    responsePayload = null;
    stateResponsePayload = null;
    journalResponsePayload = null;
    requestedPaths = [];
    resolvePublishResponse = null;

    global.EventSource = class MockEventSource {
      constructor() {
        eventSources.push(this);
      }
      addEventListener() {}
      close() {}
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;
      requestedPaths.push(path);

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        return new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, responsePayload));
        });
      }

      if (path === '/api/match/presentation-journal' && journalResponsePayload) {
        return jsonResponse(journalResponsePayload.ok === true ? 200 : 409, journalResponsePayload);
      }

      if (path === '/api/match/state' && stateResponsePayload) {
        return jsonResponse(stateResponsePayload.ok === true ? 200 : 409, stateResponsePayload);
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.PresentationHandler;
    delete global.BoardOps;
    delete global.showResult;
    delete global.isGameOver;
    delete global.EventSource;
    delete global.fetch;
  });

  test('self stream snapshot を適用済みなら同版 publish response snapshot を再適用しない', async () => {    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const streamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    streamSnapshot.gameState.turnNumber = 2;
    streamSnapshot.cardState.markers = [{ row: 4, col: 4, type: 'STREAM_MARKER' }];

    const staleResponseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    staleResponseSnapshot.gameState.turnNumber = 99;
    staleResponseSnapshot.cardState.markers = [{ row: 7, col: 7, type: 'STALE_RESPONSE_MARKER' }];

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: staleResponseSnapshot,
      playbackEvents: [{
        type: 'move',
        phase: 1,
        targets: [{ from: { r: 2, col: 3 }, to: { r: 2, col: 4 } }]
      }]
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        presentationCursor: { visualSeq: 1, stateVersion: 11 },
        playbackEvents: [{
          type: 'move',
          phase: 1,
          targets: [{ from: { r: 2, col: 3 }, to: { r: 2, col: 4 } }]
        }],
        snapshot: streamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(global.gameState.turnNumber).toBe(2);
    expect(global.cardState.markers).toEqual([{ row: 4, col: 4, type: 'STREAM_MARKER' }]);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(0);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getStateVersion()).toBe(11);
    expect(global.gameState.turnNumber).toBe(2);
    expect(global.cardState.markers).toEqual([{ row: 4, col: 4, type: 'STREAM_MARKER' }]);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(0);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);
  });

  test('self stream snapshot 適用後に古い publish response が返っても stateVersion を巻き戻さない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const streamSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    streamSnapshot.gameState.turnNumber = 2;

    const staleResponseSnapshot = createSnapshot(10, { topLevelStateVersion: 10, metaVersion: 10 });
    staleResponseSnapshot.gameState.turnNumber = 99;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 10,
      snapshot: staleResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: streamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(client.getStateVersion()).toBe(11);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getStateVersion()).toBe(11);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);
  });

  // REGRESSION: terminal self-operation stream snapshots must still present the result once.
  test('終局操作が自操作の場合も結果画面を表示すべき（自操作スキップバグ）', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    // Terminal stream snapshot (self-operation match): game ends with black's move
    const terminalStreamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    terminalStreamSnapshot.gameState.currentPlayer = -1; // terminal state
    terminalStreamSnapshot.gameState.turnNumber = 40;

    // Publish-response snapshot (same metaVersion=11, will be skipped by coordinator)
    const terminalResponseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    terminalResponseSnapshot.gameState.currentPlayer = -1;
    terminalResponseSnapshot.gameState.turnNumber = 40;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: terminalResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    // Stream arrives with matching operationId. Terminal self snapshots must not suppress result display.
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: terminalStreamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    // Game state should now be terminal
    expect(global.gameState.currentPlayer).toBe(-1);

    // Publish response arrives → skipped (same stateVersion already applied via stream)
    resolvePublishResponse();
    const result = await publishPromise;
    expect(result.ok).toBe(true);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);

    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('終局自操作でより新しい publish response が適用されても結果表示は一度だけ', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const terminalStreamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    terminalStreamSnapshot.gameState.currentPlayer = -1;
    terminalStreamSnapshot.gameState.turnNumber = 40;

    const newerTerminalResponseSnapshot = createSnapshot(12, { topLevelStateVersion: 12, metaVersion: 12 });
    newerTerminalResponseSnapshot.gameState.currentPlayer = -1;
    newerTerminalResponseSnapshot.gameState.turnNumber = 40;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 12,
      snapshot: newerTerminalResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: terminalStreamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(global.showResult).toHaveBeenCalledTimes(1);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_applied).toBe(1);
    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('publish response with autoPassNotice shows notice even when actionType is omitted', async () => {
    const showAutoPassNotice = jest.fn();
    jest.doMock('../ui/animation-feedback-events', () => ({
      showAutoPassNotice
    }));
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: createSnapshot(11),
      playbackEvents: [],
      autoPassNotice: {
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      }
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black',
        turnIndex: 1,
        autoNoActionPass: true
      }
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    resolvePublishResponse();
    await expect(publishPromise).resolves.toEqual({ ok: true });

    expect(showAutoPassNotice).toHaveBeenCalledWith({
      playerKey: 'black',
      reason: 'no_legal_moves_or_usable_cards'
    });
  });

  test('authoritative auto_turn pass response shows its auto-pass notice', async () => {
    const showAutoPassNotice = jest.fn();
    jest.doMock('../ui/animation-feedback-events', () => ({
      showAutoPassNotice
    }));
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      actionType: 'auto_turn',
      snapshot: createSnapshot(11),
      playbackEvents: [],
      autoPassNotice: {
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      }
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'auto_turn',
      action: {
        type: 'auto_turn',
        preferredActionType: 'pass',
        preferredAction: {
          type: 'pass',
          playerKey: 'black',
          autoNoActionPass: true
        }
      }
    });

    await Promise.resolve();
    resolvePublishResponse();
    await expect(publishPromise).resolves.toEqual({ ok: true });
    expect(showAutoPassNotice).toHaveBeenCalledWith({
      playerKey: 'black',
      reason: 'no_legal_moves_or_usable_cards'
    });
  });

  test('frame-less publish response and duplicate stream never bypass the presentation timeline', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const responseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    const playbackEvents = [{ type: 'hand_add', phase: 1, targets: [{ player: 'black', count: 1 }] }];
    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      presentationCursor: { visualSeq: 7, stateVersion: 11 },
      snapshot: responseSnapshot,
      playbackEvents
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents,
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;
    responsePayload.operationId = operationId;

    resolvePublishResponse();
    const result = await publishPromise;
    expect(result.ok).toBe(true);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        presentationCursor: { visualSeq: 7, stateVersion: 11 },
        playbackEvents,
        snapshot: responseSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync || 0).toBe(0);
    const intakeEntries = window.__networkDebugTrace.entries()
      .filter((entry) => entry.type === 'network_intake_submit' && entry.operationId === operationId);
    expect(intakeEntries).toEqual([
      expect.objectContaining({
        source: 'publish_response',
        stateVersion: 11,
        visualSeq: 7,
        decision: 'visual_rebased',
        accepted: true
      }),
      expect.objectContaining({
        source: 'stream',
        stateVersion: 11,
        visualSeq: 7,
        decision: 'deduped',
        accepted: false,
        reason: 'duplicate_operation_state'
      })
    ]);
  });

  test('frame-less canonical advance rebases before the following visual frame', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const snapshot11 = createSnapshot(11);
    snapshot11.gameState.turnNumber = 11;
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        stateVersion: 11,
        presentationCursor: { visualSeq: 1, stateVersion: 11 },
        snapshot: snapshot11,
        playbackEvents: [{ type: 'legacy_direct_playback_must_not_run' }]
      })
    });

    await Promise.resolve();
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 11,
      pendingFrameCount: 0
    });
    expect(global.NetworkVisualStateStore.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 11
    });
    expect(global.NetworkVisualSettlementTracker.getDiagnostics()).toMatchObject({
      completedVisualSeq: 1
    });

    global.PresentationHandler.handlePresentationEvent = jest.fn(async (event) => Object.freeze({
      kind: 'strict-network-settlement',
      visualSeq: event.meta.visualSeq,
      applyCommittedFrame: jest.fn(async () => true),
      settle: jest.fn(async () => true),
      cancel: jest.fn(async () => true)
    }));
    const snapshot12 = createSnapshot(12);
    snapshot12.gameState.turnNumber = 12;
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId: 'op_after_frameless',
        stateVersion: 12,
        presentationCursor: { visualSeq: 2, stateVersion: 12 },
        snapshot: snapshot12,
        presentationFrames: [{
          roomId: 'ABC',
          visualSeq: 2,
          stateVersionFrom: 11,
          stateVersionTo: 12,
          operationId: 'op_after_frameless',
          actionType: 'place',
          playbackEvents: [{ type: 'flip' }],
          snapshotAfter: snapshot12
        }]
      })
    });

    for (let index = 0; index < 8; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 12,
      pendingFrameCount: 0,
      paused: false
    });
    expect(global.NetworkVisualStateStore.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 12
    });
    expect(global.NetworkVisualSettlementTracker.getDiagnostics()).toMatchObject({
      completedVisualSeq: 2
    });
    expect(global.gameState.turnNumber).toBe(12);
    expect(client.getNetworkTelemetry().counts.network_visual_rebase_completed).toBe(1);
  });

  test('unsafe strict dispatch failure cancels replay and automatically rebases from authority', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const dispatchFailure: any = new Error('board_renderer_failed:spawn');
    dispatchFailure.code = 'board_renderer_failed';
    global.PresentationHandler.handlePresentationEvent = jest.fn(async () => {
      throw dispatchFailure;
    });

    const snapshot11 = createSnapshot(11);
    snapshot11.gameState.turnNumber = 11;
    stateResponsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      presentationCursor: { visualSeq: 1, stateVersion: 11 },
      presentationFrames: [],
      playbackEvents: [],
      snapshot: snapshot11
    };

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId: 'op_renderer_failed',
        stateVersion: 11,
        presentationCursor: { visualSeq: 1, stateVersion: 11 },
        snapshot: snapshot11,
        presentationFrames: [{
          roomId: 'ABC',
          visualSeq: 1,
          stateVersionFrom: 10,
          stateVersionTo: 11,
          operationId: 'op_renderer_failed',
          actionType: 'place',
          playbackEvents: [{ type: 'spawn' }],
          snapshotAfter: snapshot11
        }]
      })
    });

    for (let index = 0; index < 40; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      if ((client.getNetworkTelemetry().counts.network_visual_authoritative_recovery_completed || 0) > 0) break;
    }

    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(requestedPaths).toContain('/api/match/state');
    expect(client.getNetworkTelemetry().counts).toMatchObject({
      network_presentation_timeline_paused: 1,
      network_presentation_authoritative_recovery_scheduled: 1,
      network_visual_authoritative_recovery_completed: 1
    });
    expect(client.getNetworkTelemetry().counts.network_presentation_reload_required || 0).toBe(0);
    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 11,
      pendingFrameCount: 0,
      paused: false
    });
    expect(global.NetworkVisualStateStore.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 11
    });
    expect(global.NetworkVisualSettlementTracker.getDiagnostics()).toMatchObject({
      completedVisualSeq: 1
    });
    expect(global.gameState.turnNumber).toBe(11);
  });

  test('successful but empty journal recovery escalates to authoritative visual rebase', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const snapshot12 = createSnapshot(12);
    snapshot12.gameState.turnNumber = 12;
    journalResponsePayload = {
      ok: true,
      roomId: 'ABC',
      baseVisualSeq: 0,
      baseSnapshot: createSnapshot(10),
      presentationCursor: { visualSeq: 2, stateVersion: 12 },
      presentationFrames: []
    };
    stateResponsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 12,
      presentationCursor: { visualSeq: 2, stateVersion: 12 },
      presentationFrames: [],
      playbackEvents: [],
      snapshot: snapshot12
    };

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId: 'op_gap_2',
        stateVersion: 12,
        presentationCursor: { visualSeq: 2, stateVersion: 12 },
        snapshot: snapshot12,
        presentationFrames: [{
          roomId: 'ABC',
          visualSeq: 2,
          stateVersionFrom: 11,
          stateVersionTo: 12,
          operationId: 'op_gap_2',
          actionType: 'place',
          playbackEvents: [{ type: 'flip' }],
          snapshotAfter: snapshot12
        }]
      })
    });

    for (let index = 0; index < 30; index += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      if ((client.getNetworkTelemetry().counts.network_visual_authoritative_recovery_completed || 0) > 0) break;
    }

    expect(requestedPaths).toContain('/api/match/presentation-journal');
    expect(requestedPaths).toContain('/api/match/state');
    expect(client.getNetworkTelemetry().counts.network_presentation_timeline_gap_unresolved).toBe(1);
    expect(client.getNetworkTelemetry().counts.network_visual_authoritative_recovery_completed).toBe(1);
    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 12,
      pendingFrameCount: 0,
      paused: false
    });
    expect(global.NetworkVisualStateStore.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 12
    });
    expect(global.NetworkVisualSettlementTracker.getDiagnostics()).toMatchObject({
      completedVisualSeq: 2
    });
    expect(global.gameState.turnNumber).toBe(12);
  });
});
