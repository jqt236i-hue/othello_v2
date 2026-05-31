import { createMatchWorkerPublishController } from '../workers/match-worker-publish-controller';

function jsonResponse(status: number, data: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
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
      prepareSnapshotBroadcast: (meta: any) => {
        order.push('prepareSnapshotBroadcast');
        preparedMeta = meta;
        return preparedSnapshot;
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
    expect(broadcastMeta).toEqual(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      operationId: 'op_publish_1',
      __preparedSnapshot: preparedSnapshot
    }));
    expect(room.stateVersion).toBe(5);
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      stateVersion: 5,
      operationId: 'op_publish_1'
    }));
  });
});
