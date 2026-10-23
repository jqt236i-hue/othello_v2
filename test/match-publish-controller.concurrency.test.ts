import { createMatchPublishController } from '../utils/match-publish-controller';
import * as Authority from '../utils/match-authority';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  const room: any = {
    roomId: 'CONCURRENT', stateVersion: 0, updatedAt: 1,
    seats: { black: true, white: true }, seatTokens: { black: 'black-token', white: 'white-token' },
    snapshot: { gameState: { currentPlayer: 1, board: [[0, 0]] }, cardState: { hands: { black: [], white: [] } } }
  };
  const apply = jest.fn(async (_room: any, body: any) => {
    const snapshot = JSON.parse(JSON.stringify(room.snapshot));
    snapshot.gameState.board[0][body.params.col] = 1;
    snapshot.gameState.currentPlayer = -1;
    return { ok: true, snapshot, action: { type: 'place' }, playbackEvents: [{ type: 'place', col: body.params.col }] };
  });
  const save = jest.fn(async () => undefined);
  const stage = jest.fn();
  const config: any = {
    loadRoom: async () => undefined, getRoom: () => room,
    applyExpiredTurnTimeoutIfNeeded: async () => undefined,
    normalizePlayerKey: Authority.normalizePlayerKey, normalizeOperationId: Authority.normalizeOperationId,
    isNetworkDebugFillHandPayload: () => false,
    resolveAuthenticatedSeatKey: Authority.resolveAuthenticatedSeatKey,
    ensureAcceptedOperationsBySeat: Authority.ensureAcceptedOperationsBySeat,
    asRecord: (value: any) => value && typeof value === 'object' ? value : {},
    MatchAuthority: { ...Authority, normalizeSnapshotBoardContract: () => ({ ok: true }) },
    getCurrentPlayerKey: Authority.getCurrentPlayerKey,
    toPublicNetworkDebugEnabled: () => false,
    isSnapshotGameOver: async () => false,
    applyCommandPublishToSnapshot: apply,
    refreshTurnTimer: async () => undefined,
    buildPublishViewerArtifacts: () => ({
      canonicalHash: 'hash', projectedSnapshots: {
        black: JSON.parse(JSON.stringify(room.snapshot)),
        white: JSON.parse(JSON.stringify(room.snapshot)),
        spectator: JSON.parse(JSON.stringify(room.snapshot))
      }
    }),
    appendPresentationFrameForAcceptedPublish: (_room: any, options: any) => Authority.appendPresentationFrame(room, {
      stateVersionFrom: options.previousStateVersion, stateVersionTo: options.nextStateVersion,
      operationId: options.operationId, actorSeatKey: options.actorSeatKey, actionType: options.actionType,
      payloadByViewer: { black: { playbackEvents: options.playbackEvents } },
      snapshotAfterByViewer: options.publishViewerArtifacts.projectedSnapshots
    }),
    buildPublishPayload: (_room: any, _seat: any, options: any) => ({
      ...options, stateVersion: room.stateVersion,
      snapshot: options.snapshot || JSON.parse(JSON.stringify(room.snapshot))
    }),
    prepareSnapshotBroadcast: (meta: any) => meta,
    stagePreparedSnapshotBroadcast: stage, saveRoom: save,
    broadcastSnapshot: async () => undefined,
    jsonResponse: (status: number, payload: any) => ({ status, payload })
  };
  const body = (operationId: string, col = 0) => ({
    seatKey: 'black', playerKey: 'black', seatToken: 'black-token',
    baseVersion: 0, operationId, actionType: 'place', actor: 'black', params: { col }
  });
  return { room, config, body, apply, save, stage, controller: createMatchPublishController(config) };
}

describe('publish authority concurrency', () => {
  test('simultaneous retries commit once and reuse the accepted operation frame', async () => {
    const h = harness();
    const [first, retry] = await Promise.all([
      h.controller.handlePublish(h.body('same')),
      h.controller.handlePublish(h.body('same'))
    ]);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.payload.idempotentReplay).toBe(true);
    expect(h.apply).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.room.stateVersion).toBe(1);
    expect(h.room.presentationJournal).toHaveLength(1);
    expect(h.room.presentationJournal[0]).toMatchObject({ stateVersionFrom: 0, stateVersionTo: 1 });
    expect(retry.payload.presentationFrameEntry).toBe(h.room.presentationJournal[0]);
  });

  test('different same-version commands serialize even across controller instances', async () => {
    const h = harness();
    const other = createMatchPublishController(h.config);
    const [first, second] = await Promise.all([
      h.controller.handlePublish(h.body('first')),
      other.handlePublish(h.body('second', 1))
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.payload.rejectedReason).toBe('VERSION_AHEAD');
    expect(h.apply).toHaveBeenCalledTimes(1);
    expect(h.room.snapshot.gameState.board).toEqual([[1, 0]]);
    expect(h.room.stateVersion).toBe(1);
    expect(h.room.presentationJournal).toHaveLength(1);
  });

  test('keeps retry behind durable save and journal/replay staging', async () => {
    const h = harness();
    const saving = deferred();
    const started = deferred();
    h.save.mockImplementationOnce(async () => { started.resolve(); await saving.promise; });
    const first = h.controller.handlePublish(h.body('same'));
    await started.promise;
    expect(h.stage).toHaveBeenCalledTimes(1);
    let replied = false;
    const retry = h.controller.handlePublish(h.body('same')).then((response: any) => { replied = true; return response; });
    await Promise.resolve();
    await Promise.resolve();
    expect(replied).toBe(false);
    saving.resolve();
    await first;
    expect((await retry).payload.idempotentReplay).toBe(true);
  });

  test.each(['version', 'seat', 'turn'] as const)('discards preparation when external %s authority changes', async (change) => {
    const h = harness();
    const started = deferred();
    const finish = deferred();
    h.apply.mockImplementationOnce(async () => {
      const snapshot = JSON.parse(JSON.stringify(h.room.snapshot));
      snapshot.gameState.board[0][0] = 1;
      started.resolve();
      await finish.promise;
      return { ok: true, snapshot, action: { type: 'place' }, playbackEvents: [] };
    });
    const result = h.controller.handlePublish(h.body('stale'));
    await started.promise;
    if (change === 'version') {
      h.room.stateVersion = 1;
      h.room.snapshot = JSON.parse(JSON.stringify(h.room.snapshot));
    } else if (change === 'seat') {
      h.room.seatTokens.black = 'replacement-token';
    } else {
      h.room.snapshot.gameState.currentPlayer = -1;
    }
    finish.resolve();
    const response = await result;
    expect(response.status).toBe(change === 'seat' ? 403 : 409);
    expect(response.payload.rejectedReason).toBe({
      version: 'VERSION_AHEAD', seat: 'SEAT_TOKEN_MISMATCH', turn: 'OUT_OF_TURN'
    }[change]);
    expect(h.room.snapshot.gameState.board).toEqual([[0, 0]]);
    expect(h.stage).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  test('one room awaiting persistence does not block another room', async () => {
    const firstRoom = harness();
    const otherRoom = harness();
    const started = deferred();
    const saving = deferred();
    firstRoom.save.mockImplementationOnce(async () => { started.resolve(); await saving.promise; });
    const first = firstRoom.controller.handlePublish(firstRoom.body('first-room'));
    await started.promise;
    try {
      expect((await otherRoom.controller.handlePublish(otherRoom.body('other-room'))).status).toBe(200);
    } finally {
      saving.resolve();
      await first;
    }
  });

  test('a throwing command releases the lane for the next request', async () => {
    const h = harness();
    h.apply.mockRejectedValueOnce(new Error('preparation failed'));
    const failed = h.controller.handlePublish(h.body('failed'));
    const next = h.controller.handlePublish(h.body('next'));
    await expect(failed).rejects.toThrow('preparation failed');
    expect((await next).status).toBe(200);
    expect(h.room.stateVersion).toBe(1);
  });
});
