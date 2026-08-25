import { createMatchWorkerPublishController } from '../workers/match-worker-publish-controller';
import { createMatchWorkerBroadcastController } from '../workers/match-worker-broadcast-controller';
import * as MatchAuthority from '../utils/match-authority.js';
import deepClone from '../utils/deepClone.js';

type HarnessOptions = {
  failSaveAt?: number;
  failSend?: boolean;
  streamCount?: number;
  deferBroadcast?: boolean;
  pendingSend?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const events: string[] = [];
  const persistedRooms: any[] = [];
  const sent: any[] = [];
  const pendingSendResolvers: Array<() => void> = [];
  const deferredBroadcasts: Promise<unknown>[] = [];
  const deferredBroadcastErrors: unknown[] = [];
  let saveCount = 0;
  let eventSeq = 0;
  const room: any = {
    roomId: 'PERSIST',
    stateVersion: 4,
    updatedAt: 1000,
    seats: { black: true, white: true },
    seatTokens: { black: 'token_black', white: 'token_white' },
    lastAcceptedOperationBySeat: { black: null, white: null },
    acceptedOperationHistoryBySeat: { black: [], white: [] },
    authorityLog: [],
    visualSeq: 0,
    presentationJournal: [],
    sseEventBuffer: [{
      id: 'PERSIST_0',
      event: 'snapshot',
      payloadByViewer: {
        black: { stateVersion: 4 },
        white: { stateVersion: 4 },
        spectator: { stateVersion: 4 }
      }
    }],
    snapshot: {
      stateVersion: 4,
      updatedAt: 1000,
      gameState: {
        currentPlayer: 1,
        turnNumber: 8,
        board: [
          [0, 0, 0, 0],
          [0, 1, -1, 0],
          [0, -1, 1, 0],
          [0, 0, 0, 0]
        ],
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: { cells: [] }
      },
      cardState: {
        hands: { black: ['b1'], white: ['w1'] },
        pendingEffectByPlayer: { black: null, white: null },
        markers: []
      }
    }
  };
  room.authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(room.snapshot);

  const streams = new Map<string, any>();
  for (let index = 0; index < (options.streamCount ?? 1); index += 1) {
    streams.set(`stream-${index}`, { viewer: { role: 'seat', seatKey: index % 2 === 0 ? 'black' : 'white' } });
  }

  const saveRoom = async () => {
    saveCount += 1;
    events.push(`save:${saveCount}`);
    if (options.failSaveAt === saveCount) throw new Error(`save_failed_${saveCount}`);
    persistedRooms.push(deepClone(room));
  };
  const broadcastController = createMatchWorkerBroadcastController({
    getRoom: () => room,
    getStreams: () => streams,
    nextSseEventId: () => {
      events.push('prepare-sse');
      eventSeq += 1;
      return `PERSIST_${eventSeq}`;
    },
    rememberBufferedSseEvent: (record) => {
      events.push('remember-sse');
      room.sseEventBuffer = MatchAuthority.appendBufferedSseEvent(room.sseEventBuffer, record);
    },
    saveRoom,
    sendSse: async (streamId, eventName, payload, sendOptions) => {
      events.push(`send:${streamId}:${sendOptions && sendOptions.eventId}`);
      sent.push({ streamId, eventName, payload, sendOptions });
      if (options.pendingSend) {
        await new Promise<void>((resolve) => pendingSendResolvers.push(resolve));
      }
      if (options.failSend) throw new Error('sse_send_failed');
    },
    buildSnapshotPayload: (_room, meta: any, viewer) => {
      const artifacts = meta && meta.__publishViewerArtifacts;
      const viewerKey = MatchAuthority.getPayloadKeyForViewer(viewer);
      return {
        ok: true,
        roomId: room.roomId,
        stateVersion: room.stateVersion,
        operationId: meta && meta.operationId,
        snapshot: deepClone(artifacts.projectedSnapshots[viewerKey])
      };
    },
    buildPresencePayload: () => ({ ok: true })
  });

  const controller = createMatchWorkerPublishController({
    loadRoom: async () => undefined,
    getRoom: () => room,
    applyExpiredTurnTimeoutIfNeeded: async () => undefined,
    normalizePlayerKey: (value: any) => value === 'white' || value === -1 ? 'white' : 'black',
    normalizeOperationId: MatchAuthority.normalizeOperationId,
    isNetworkDebugFillHandPayload: () => false,
    resolveAuthenticatedSeatKey: (_room: any, seatKey: any, seatToken: any) => (
      _room.seatTokens[seatKey] === seatToken ? seatKey : null
    ),
    ensureAcceptedOperationsBySeat: MatchAuthority.ensureAcceptedOperationsBySeat,
    MatchAuthority,
    asRecord: (value: any) => value && typeof value === 'object' ? value : {},
    buildPublishPayload: (_room: any, _viewerSeatKey: any, publishOptions: any) => ({
      ok: publishOptions.ok === true,
      roomId: room.roomId,
      stateVersion: room.stateVersion,
      idempotentReplay: publishOptions.idempotentReplay === true,
      playbackEvents: publishOptions.playbackEvents || [],
      presentationFrames: publishOptions.presentationFrameEntry ? [publishOptions.presentationFrameEntry] : [],
      snapshot: publishOptions.snapshot || null
    }),
    getCurrentPlayerKey: (gameState: any) => gameState && gameState.currentPlayer === -1 ? 'white' : 'black',
    isSnapshotGameOver: async () => false,
    toPublicNetworkDebugEnabled: () => false,
    deepClone,
    applyCommandPublishToSnapshot: async () => ({
      ok: true,
      snapshot: {
        stateVersion: 4,
        gameState: {
          currentPlayer: -1,
          turnNumber: 9,
          board: [
            [0, 0, 0, 0],
            [0, 1, -1, 0],
            [0, -1, 1, 0],
            [0, 0, 0, 0]
          ],
          boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
          boardExpansion: { cells: [] }
        },
        cardState: {
          hands: { black: ['b1'], white: ['w1'] },
          pendingEffectByPlayer: { black: null, white: null },
          markers: []
        }
      },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      effectLogs: ['flip'],
      playbackDiagnostics: null,
      action: { type: 'place' },
      pendingEffectId: null
    }),
    refreshTurnTimer: async () => {
      events.push('refresh-turn-timer');
    },
    buildPublishViewerArtifacts: (currentRoom: any, artifactOptions: any) => (
      MatchAuthority.buildPublishViewerArtifacts(currentRoom, artifactOptions)
    ),
    ensureInitialPresentationSnapshots: () => undefined,
    appendPresentationFrameForAcceptedPublish: (currentRoom: any, frameOptions: any) => {
      const artifacts = frameOptions.publishViewerArtifacts;
      return MatchAuthority.appendPresentationFrame(currentRoom, {
        stateVersionFrom: frameOptions.previousStateVersion,
        stateVersionTo: frameOptions.nextStateVersion,
        operationId: frameOptions.operationId,
        actorSeatKey: frameOptions.actorSeatKey,
        actionType: frameOptions.actionType,
        payloadByViewer: {
          black: { playbackEvents: frameOptions.playbackEvents, effectLogs: frameOptions.effectLogs },
          white: { playbackEvents: frameOptions.playbackEvents, effectLogs: frameOptions.effectLogs },
          spectator: { playbackEvents: frameOptions.playbackEvents, effectLogs: frameOptions.effectLogs }
        },
        snapshotAfterByViewer: artifacts.projectedSnapshots,
        createdAt: frameOptions.createdAt
      });
    },
    prepareSnapshotBroadcast: (meta: any) => broadcastController.prepareSnapshotBroadcast(meta),
    stagePreparedSnapshotBroadcast: (preparedSnapshot: any) => (
      broadcastController.stagePreparedSnapshotBroadcast(preparedSnapshot)
    ),
    saveRoom,
    broadcastSnapshot: (meta: any) => broadcastController.broadcastSnapshot(meta),
    ...(options.deferBroadcast ? {
      deferSnapshotBroadcast: (promise: Promise<unknown>) => {
        const observed = promise.catch((error) => {
          deferredBroadcastErrors.push(error);
        });
        deferredBroadcasts.push(observed);
      }
    } : {}),
    jsonResponse: (status: number, payload: any) => ({ status, payload })
  });

  const publishBody = {
    seatKey: 'black',
    playerKey: 'black',
    seatToken: 'token_black',
    baseVersion: 4,
    operationId: 'op_persist_1',
    actionType: 'place',
    actor: 'black',
    params: { row: 2, col: 3 },
    action: { type: 'place', playerKey: 'black', row: 2, col: 3 }
  };

  return {
    room,
    events,
    persistedRooms,
    sent,
    controller,
    publishBody,
    getSaveCount: () => saveCount,
    pendingSendResolvers,
    deferredBroadcasts,
    deferredBroadcastErrors
  };
}

describe('match worker accepted publish persistence characterization', () => {
  test('success path stages accepted state and resume buffer into one persist before SSE send', async () => {
    const harness = createHarness();

    const response = await harness.controller.handlePublish(harness.publishBody);

    expect(response.status).toBe(200);
    expect(harness.getSaveCount()).toBe(1);
    expect(harness.events).toEqual([
      'refresh-turn-timer',
      'prepare-sse',
      'remember-sse',
      'save:1',
      'send:stream-0:PERSIST_1'
    ]);
    expect(harness.persistedRooms[0].sseEventBuffer).toHaveLength(2);
    expect(harness.persistedRooms[0].stateVersion).toBe(5);
    expect(harness.persistedRooms[0].presentationJournal[0].stateVersionTo).toBe(5);
    expect(harness.persistedRooms[0].sseEventBuffer[1].payloadByViewer.black.stateVersion).toBe(5);

    const replay = MatchAuthority.getBufferedSseReplayEvents(
      harness.persistedRooms[0].sseEventBuffer,
      'PERSIST_0',
      { role: 'seat', seatKey: 'black' }
    );
    expect(replay).toHaveLength(1);
    expect(replay[0]).toMatchObject({ eventId: 'PERSIST_1', eventName: 'snapshot' });
    expect(replay[0].payload.stateVersion).toBe(5);
  });

  test('save failure rejects success and prevents SSE send', async () => {
    const harness = createHarness({ failSaveAt: 1 });

    await expect(harness.controller.handlePublish(harness.publishBody)).rejects.toThrow('save_failed_1');

    expect(harness.sent).toEqual([]);
    expect(harness.getSaveCount()).toBe(1);
    expect(harness.events).toContain('remember-sse');
    expect(harness.persistedRooms).toHaveLength(0);
  });

  test('SSE failure occurs after resume record is persisted and remains reconnectable', async () => {
    const harness = createHarness({ failSend: true });

    await expect(harness.controller.handlePublish(harness.publishBody)).rejects.toThrow('sse_send_failed');

    expect(harness.getSaveCount()).toBe(1);
    const persisted = harness.persistedRooms[0];
    expect(persisted.sseEventBuffer).toHaveLength(2);
    const replay = MatchAuthority.getBufferedSseReplayEvents(
      persisted.sseEventBuffer,
      'PERSIST_0',
      { role: 'seat', seatKey: 'black' }
    );
    expect(replay).toHaveLength(1);
    expect(replay[0].payload.stateVersion).toBe(5);
  });

  test('zero streams persists the resume record once and returns success', async () => {
    const harness = createHarness({ streamCount: 0 });

    const response = await harness.controller.handlePublish(harness.publishBody);

    expect(response.status).toBe(200);
    expect(harness.getSaveCount()).toBe(1);
    expect(harness.sent).toEqual([]);
    expect(harness.persistedRooms[0].sseEventBuffer).toHaveLength(2);
  });

  test('two accepted publishes respond after save without waiting for the same slow writer and persist ordered replay', async () => {
    const harness = createHarness({ deferBroadcast: true, pendingSend: true });

    const first = await harness.controller.handlePublish(harness.publishBody);
    const secondBody = {
      ...harness.publishBody,
      seatKey: 'white',
      playerKey: 'white',
      actor: 'white',
      seatToken: 'token_white',
      baseVersion: 5,
      operationId: 'op_persist_2',
      action: { type: 'place', playerKey: 'white', row: 2, col: 0 }
    };
    const second = await harness.controller.handlePublish(secondBody);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(harness.getSaveCount()).toBe(2);
    expect(harness.events.filter((event) => event.startsWith('send:'))).toEqual([
      'send:stream-0:PERSIST_1',
      'send:stream-0:PERSIST_2'
    ]);
    expect(harness.pendingSendResolvers).toHaveLength(2);
    expect(harness.room.stateVersion).toBe(6);
    const persisted = harness.persistedRooms[1];
    expect(persisted.stateVersion).toBe(6);
    const replay = MatchAuthority.getBufferedSseReplayEvents(
      persisted.sseEventBuffer,
      'PERSIST_0',
      { role: 'seat', seatKey: 'black' }
    );
    expect(replay.map((event: any) => event.eventId)).toEqual(['PERSIST_1', 'PERSIST_2']);
    expect(replay.map((event: any) => event.payload.stateVersion)).toEqual([5, 6]);

    for (const resolve of harness.pendingSendResolvers) resolve();
    await Promise.all(harness.deferredBroadcasts);
    expect(harness.deferredBroadcastErrors).toEqual([]);
  });

  test('duplicate operation replay does not persist, broadcast, or advance version twice', async () => {
    const harness = createHarness();
    const accepted = await harness.controller.handlePublish(harness.publishBody);
    const saveCountAfterAccepted = harness.getSaveCount();
    const sentCountAfterAccepted = harness.sent.length;

    const replay = await harness.controller.handlePublish(harness.publishBody);

    expect(accepted.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.payload.idempotentReplay).toBe(true);
    expect(harness.room.stateVersion).toBe(5);
    expect(harness.room.presentationJournal).toHaveLength(1);
    expect(harness.room.sseEventBuffer).toHaveLength(2);
    expect(harness.getSaveCount()).toBe(saveCountAfterAccepted);
    expect(harness.sent).toHaveLength(sentCountAfterAccepted);
  });
});
