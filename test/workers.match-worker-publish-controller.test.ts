import { createMatchWorkerPublishController } from '../workers/match-worker-publish-controller';

function jsonResponse(status: number, data: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function buildPublishViewerArtifacts(room: any, options: any = {}) {
  const clone = (value: any) => JSON.parse(JSON.stringify(value));
  const counters = options.perfCounters;
  if (counters) {
    counters.viewerProjectionBlack = Number(counters.viewerProjectionBlack || 0) + 1;
    counters.viewerProjectionWhite = Number(counters.viewerProjectionWhite || 0) + 1;
    counters.viewerProjectionSpectator = Number(counters.viewerProjectionSpectator || 0) + 1;
  }
  return {
    canonicalHash: 'hash_state',
    projectedSnapshots: {
      black: clone(room.snapshot),
      white: clone(room.snapshot),
      spectator: clone(room.snapshot)
    }
  };
}

describe('match worker publish controller', () => {
  test('accepted publish keeps refresh/save/broadcast side-effect order and reuses prepared snapshot', async () => {
    const order: string[] = [];
    const room: any = {
      roomId: 'ROOMP',
      stateVersion: 4,
      updatedAt: 1000,
      seats: { black: true, white: true },
      seatTokens: { black: 'token_black', white: 'token_white' },
      acceptedOperationsBySeat: { black: null, white: null },
      authorityLog: [],
      sseEventBuffer: [],
      snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 8 },
        cardState: { pendingEffectByPlayer: { black: null, white: null } }
      }
    };
    let preparedMeta: any = null;
    let broadcastMeta: any = null;
    let appendedOptions: any = null;
    const publishPerfCounters: Record<string, number> = {};
    const preparedSnapshot = {
      eventId: 'prepared_publish_1',
      record: { eventId: 'prepared_publish_1', eventName: 'snapshot' }
    };

    const controller = createMatchWorkerPublishController({
      loadRoom: async () => {
        order.push('loadRoom');
      },
      getRoom: () => room,
      applyExpiredTurnTimeoutIfNeeded: async () => {
        order.push('applyExpiredTurnTimeoutIfNeeded');
      },
      normalizePlayerKey: (value: any) => (value === 'white' ? 'white' : 'black'),
      normalizeOperationId: (value: any) => String(value || '').trim(),
      isNetworkDebugFillHandPayload: () => false,
      resolveAuthenticatedSeatKey: (_room: any, seatKey: any) => seatKey,
      ensureAcceptedOperationsBySeat: (currentRoom: any) => currentRoom.acceptedOperationsBySeat,
      MatchAuthority: {
        computeAuthoritativeStateHash: () => 'hash_state',
        buildPublishResponseOptions: (options: any) => options,
        hasRequiredOperationId: () => true,
        resolveAcceptedOperation: () => null,
        buildVersionRejectedPublishResponseOptions: () => ({ ok: false, rejectedReason: 'VERSION_MISMATCH' }),
        appendAuthorityLog: () => undefined,
        isFateWillControllerForCurrentTurn: () => false,
        rememberAcceptedOperationBySeat: (currentRoom: any, seatKey: any, entry: any) => {
          currentRoom.acceptedOperationsBySeat[seatKey] = entry;
        },
        stripTransientChargeDeltaState: () => undefined
      },
      asRecord: (value: any) => (value && typeof value === 'object' ? value : {}),
      buildPublishPayload: (_room: any, _viewerSeatKey: any, options: any) => ({
        ok: options.ok,
        stateVersion: room.stateVersion,
        operationId: options.operationId || null,
        snapshot: room.snapshot
      }),
      getCurrentPlayerKey: () => 'black',
      isSnapshotGameOver: async () => false,
      toPublicNetworkDebugEnabled: () => false,
      deepClone: (value: any) => JSON.parse(JSON.stringify(value)),
      buildPublishViewerArtifacts,
      publishPerfCounters,
      applyCommandPublishToSnapshot: async () => {
        order.push('applyCommandPublishToSnapshot');
        return {
          ok: true,
          snapshot: {
            gameState: { currentPlayer: -1, turnNumber: 9 },
            cardState: { pendingEffectByPlayer: { black: null, white: null } }
          },
          playbackEvents: [{ type: 'flip', phase: 1 }],
          effectLogs: ['effect-log'],
          playbackDiagnostics: { accepted: true },
          action: { type: 'place' },
          pendingEffectId: 'pending_publish_1'
        };
      },
      refreshTurnTimer: async () => {
        order.push('refreshTurnTimer');
        return true;
      },
      appendPresentationFrameForAcceptedPublish: (_room: any, options: any) => {
        appendedOptions = options;
        return { visualSeq: 1, stateVersionTo: room.stateVersion };
      },
      prepareSnapshotBroadcast: (meta: any) => {
        order.push('prepareSnapshotBroadcast');
        preparedMeta = meta;
        return preparedSnapshot;
      },
      stagePreparedSnapshotBroadcast: (prepared: any) => {
        order.push('stagePreparedSnapshotBroadcast');
        prepared.stagedForPersistence = true;
      },
      saveRoom: async () => {
        order.push('saveRoom');
      },
      broadcastSnapshot: async (meta: any) => {
        order.push('broadcastSnapshot');
        broadcastMeta = meta;
      },
      jsonResponse
    });

    const response = await controller.handlePublish({
      seatKey: 'black',
      playerKey: 'black',
      seatToken: 'token_black',
      baseVersion: 4,
      operationId: 'op_publish_1',
      actionType: 'place',
      actor: 'black',
      action: {
        type: 'place',
        playerKey: 'black',
        row: 2,
        col: 3,
        turnIndex: 8
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(order).toEqual([
      'loadRoom',
      'applyExpiredTurnTimeoutIfNeeded',
      'applyCommandPublishToSnapshot',
      'refreshTurnTimer',
      'prepareSnapshotBroadcast',
      'stagePreparedSnapshotBroadcast',
      'saveRoom',
      'broadcastSnapshot'
    ]);
    expect(preparedMeta).toEqual(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      operationId: 'op_publish_1',
      playbackEvents: [{ type: 'flip', phase: 1 }],
      effectLogs: ['effect-log'],
      playbackDiagnostics: { accepted: true }
    }));
    expect(preparedMeta.__publishViewerArtifacts).toBe(appendedOptions.publishViewerArtifacts);
    expect(preparedMeta.__publishViewerArtifacts.projectedSnapshots.black).toEqual(room.snapshot);
    expect(broadcastMeta).toEqual(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      operationId: 'op_publish_1',
      __preparedSnapshot: preparedSnapshot
    }));
    expect(room.stateVersion).toBe(5);
    expect(publishPerfCounters).toEqual({
      viewerProjectionBlack: 1,
      viewerProjectionWhite: 1,
      viewerProjectionSpectator: 1
    });
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 5,
      operationId: 'op_publish_1'
    }));
  });
});

describe('match worker publish controller: FATE_WILL controller can publish owner-side action', () => {
  function jsonResponse(status: number, data: any) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data
    };
  }

  function makeController(opts: {
    isFateWillController: boolean;
    currentPlayer: 'black' | 'white';
  }) {
    const room: any = {
      roomId: 'R_FW',
      stateVersion: 5,
      updatedAt: 1000,
      seats: { black: true, white: true },
      seatTokens: { black: 'token_black', white: 'token_white' },
      acceptedOperationsBySeat: { black: null, white: null },
      authorityLog: [],
      sseEventBuffer: [],
      snapshot: {
        gameState: { currentPlayer: opts.currentPlayer === 'white' ? -1 : 1, turnNumber: 5 },
        cardState: {
          pendingEffectByPlayer: { black: null, white: null },
          fateWillControllerByTurnOwner: {
            black: null,
            white: opts.isFateWillController ? 'black' : null
          }
        }
      }
    };
    const order: string[] = [];
    return {
      room,
      order,
      controller: createMatchWorkerPublishController({
        loadRoom: async () => { order.push('loadRoom'); },
        getRoom: () => room,
        applyExpiredTurnTimeoutIfNeeded: async () => { order.push('applyExpiredTurnTimeoutIfNeeded'); },
        normalizePlayerKey: (value: any) => (value === 'white' || value === -1 || value === '-1' ? 'white' : 'black'),
        normalizeOperationId: (value: any) => String(value || '').trim(),
        isNetworkDebugFillHandPayload: () => false,
        resolveAuthenticatedSeatKey: (_room: any, seatKey: any) => seatKey,
        ensureAcceptedOperationsBySeat: (currentRoom: any) => currentRoom.acceptedOperationsBySeat,
        MatchAuthority: {
          computeAuthoritativeStateHash: () => 'hash_state',
          buildPublishResponseOptions: (options: any) => options,
          hasRequiredOperationId: () => true,
          resolveAcceptedOperation: () => null,
          buildVersionRejectedPublishResponseOptions: () => ({ ok: false, rejectedReason: 'VERSION_MISMATCH' }),
          appendAuthorityLog: () => undefined,
          isFateWillControllerForCurrentTurn: (_snapshot: any, seatKey: any) => {
            // Returns true only if seatKey is the FATE_WILL controller for the current turn owner.
            return opts.isFateWillController && seatKey === 'black' && opts.currentPlayer === 'white';
          },
          getCurrentPlayerKey: (gameState: any) => {
            if (!gameState) return 'black';
            return gameState.currentPlayer === -1 ? 'white' : 'black';
          },
          rememberAcceptedOperationBySeat: (currentRoom: any, seatKey: any, entry: any) => {
            currentRoom.acceptedOperationsBySeat[seatKey] = entry;
          },
          stripTransientChargeDeltaState: () => undefined,
          buildPublishPayload: (_room: any, _viewerSeatKey: any, options: any) => ({
            ok: options.ok,
            stateVersion: _room.stateVersion,
            operationId: options.operationId || null,
            rejectedReason: options.rejectedReason,
            snapshot: _room.snapshot
          })
        },
        asRecord: (value: any) => (value && typeof value === 'object' ? value : {}),
        getCurrentPlayerKey: (gameState: any) => {
          if (!gameState) return 'black';
          return gameState.currentPlayer === -1 ? 'white' : 'black';
        },
        buildPublishPayload: (_room: any, _viewerSeatKey: any, options: any) => ({
          ok: options.ok !== false,
          stateVersion: _room.stateVersion,
          operationId: options.operationId || null,
          rejectedReason: options.rejectedReason,
          snapshot: options.snapshot || _room.snapshot
        }),
        getSnapshotGameOver: async () => false,
        toPublicNetworkDebugEnabled: () => false,
        deepClone: (value: any) => JSON.parse(JSON.stringify(value)),
        buildPublishViewerArtifacts,
        applyCommandPublishToSnapshot: async () => ({
          ok: true,
          snapshot: {
            gameState: { currentPlayer: -1, turnNumber: 6 },
            cardState: { pendingEffectByPlayer: { black: null, white: null } }
          },
          playbackEvents: [],
          effectLogs: [],
          playbackDiagnostics: { accepted: true },
          action: { type: 'place' },
          pendingEffectId: 'pending_fw_1'
        }),
        refreshTurnTimer: async () => { order.push('refreshTurnTimer'); return true; },
        prepareSnapshotBroadcast: (meta: any) => { order.push('prepareSnapshotBroadcast'); return null; },
        stagePreparedSnapshotBroadcast: () => { order.push('stagePreparedSnapshotBroadcast'); },
        saveRoom: async () => { order.push('saveRoom'); },
        broadcastSnapshot: async () => { order.push('broadcastSnapshot'); },
        jsonResponse
      })
    };
  }

  test('FATE_WILL controller (black) publishing an owner-side (white) action is allowed', async () => {
    const { controller, order } = makeController({ isFateWillController: true, currentPlayer: 'white' });
    const response: any = await controller.handlePublish({
      seatKey: 'black',  // controller
      playerKey: 'white', // owner
      seatToken: 'token_black',
      baseVersion: 5,
      operationId: 'op_fw_publish_1',
      actionType: 'place',
      actor: 'black', // HTTP seat (after Round 1 fix)
      action: {
        type: 'place',
        playerKey: 'white',
        row: 2,
        col: 3,
        turnIndex: 5
      }
    });
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  test('non-FATE_WILL controller (black) publishing a white action is still rejected with 403 SEAT_MISMATCH', async () => {
    const { controller } = makeController({ isFateWillController: false, currentPlayer: 'white' });
    const response: any = await controller.handlePublish({
      seatKey: 'black',  // not the FATE_WILL controller
      playerKey: 'white', // impersonation
      seatToken: 'token_black',
      baseVersion: 5,
      operationId: 'op_no_fw',
      actionType: 'place',
      actor: 'black',
      action: { type: 'place', playerKey: 'white', row: 2, col: 3 }
    });
    expect(response.status).toBe(403);
    expect((await response.json()).rejectedReason).toBe('SEAT_MISMATCH');
  });

  test('regression: same-seat (black publishes black) is allowed', async () => {
    const { controller } = makeController({ isFateWillController: false, currentPlayer: 'black' });
    const response: any = await controller.handlePublish({
      seatKey: 'black',
      playerKey: 'black',
      seatToken: 'token_black',
      baseVersion: 5,
      operationId: 'op_same_seat',
      actionType: 'use_card',
      actor: 'black',
      action: { type: 'use_card', useCardId: 'super_attraction' }
    });
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });
});
