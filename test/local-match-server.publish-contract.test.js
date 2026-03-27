const http = require('http');
const Core = require('../game/logic/core');
const { createLocalMatchServer, resetRoomsForTests } = require('../scripts/local-match-server');

function requestJson(port, method, path, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(() => resolve()));
}

function getSeatPlayer(seatKey) {
  return seatKey === 'white' ? -1 : 1;
}

function pickFirstLegalMove(snapshot, seatKey) {
  const legalMoves = Core.getLegalMoves(snapshot.gameState, getSeatPlayer(seatKey));
  if (!Array.isArray(legalMoves) || legalMoves.length === 0) {
    throw new Error(`No legal moves available for ${seatKey}`);
  }
  return legalMoves[0];
}

function buildPlacePublishBody({ roomId, snapshot, stateVersion, seatKey, seatToken, operationId }) {
  const move = pickFirstLegalMove(snapshot, seatKey);
  const turnIndex = snapshot && snapshot.cardState && Number.isFinite(Number(snapshot.cardState.turnIndex))
    ? Number(snapshot.cardState.turnIndex)
    : 0;
  return {
    roomId,
    seatKey,
    playerKey: seatKey,
    seatToken,
    baseVersion: Number(stateVersion),
    operationId,
    actionType: 'place',
    actor: seatKey,
    params: { row: move.row, col: move.col },
    turnIndex,
    action: {
      type: 'place',
      playerKey: seatKey,
      row: move.row,
      col: move.col,
      turnIndex
    }
  };
}

describe('local match server publish contract', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('VERSION_BEHIND response keeps room context and shared publishMeta shape', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baselineSnapshot = created.data.snapshot;
      const authoritativeVersion = Number(created.data.stateVersion);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: authoritativeVersion + 1,
        operationId: 'op_vm_1',
        actionType: 'place'
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'VERSION_BEHIND',
        roomDeck: null,
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        seats: expect.any(Object),
        seatNames: expect.any(Object),
        turnTimer: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: 'op_vm_1',
          actionType: 'place',
          receivedBaseVersion: authoritativeVersion + 1,
          authoritativeStateVersion: authoritativeVersion,
          rejectedReason: 'VERSION_BEHIND'
        })
      }));
      expect(response.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        version: authoritativeVersion,
        projectedForSeat: 'black',
        turnStartReconciled: true
      }));
    } finally {
      await closeServer(server);
    }
  });

  test('legacy snapshot-only publish is rejected and authoritative state stays unchanged', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baselineSnapshot = created.data.snapshot;

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_legacy_snapshot_1',
        actionType: 'use_card',
        snapshot: {
          stateVersion: created.data.stateVersion,
          gameState: { currentPlayer: 1, turnNumber: 99, __resultShown: true },
          cardState: {
            hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] },
            discard: ['__hidden_hand__:white:0'],
            selectedCardId: '__hidden_hand__:white:0',
            selectedCardOwnerKey: 'white',
            pendingEffectByPlayer: {
              black: {
                type: 'CONDEMN_WILL',
                stage: 'selectTarget',
                offers: [{ handIndex: 0, cardId: '__hidden_hand__:white:0' }]
              },
              white: null
            },
            presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }],
            _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }]
          }
        }
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'COMMAND_REQUIRED'
      }));

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
      );
      expect(state.status).toBe(200);
      expect(state.data.snapshot.gameState.turnNumber).toBe(baselineSnapshot.gameState.turnNumber);
      expect(state.data.snapshot.cardState.selectedCardId || null).toBeNull();
      expect(state.data.snapshot.cardState.pendingEffectByPlayer.black || null).toBeNull();
    } finally {
      await closeServer(server);
    }
  });

  test('idempotent replay response keeps shared publishMeta shape', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baseVersion = Number(created.data.stateVersion);
      const publishBody = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion,
        operationId: 'op_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: 2, col: 3 },
        turnIndex: 1,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 3,
          turnIndex: 1
        }
      };

      const first = await requestJson(port, 'POST', '/api/match/publish', publishBody);
      expect(first.status).toBe(200);
      expect(Array.isArray(first.data.playbackEvents)).toBe(true);
      expect(first.data.playbackEvents.length).toBeGreaterThan(0);

      const replay = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        idempotentReplay: true,
        roomDeck: null,
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        playbackEvents: expect.any(Array),
        seats: expect.any(Object),
        seatNames: expect.any(Object),
        turnTimer: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'idempotent_replay',
          operationId: 'op_place_1',
          actionType: 'place',
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: Number(first.data.stateVersion),
          replayedStateVersion: Number(first.data.stateVersion)
        })
      }));
    } finally {
      await closeServer(server);
    }
  });

  test('different same-seat operationId is not treated as idempotent replay', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baseVersion = Number(created.data.stateVersion);
      const firstBody = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion,
        operationId: 'op_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: 2, col: 3 },
        turnIndex: 1,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 3,
          turnIndex: 1
        }
      };

      const first = await requestJson(port, 'POST', '/api/match/publish', firstBody);
      expect(first.status).toBe(200);
      expect(first.data && first.data.ok).toBe(true);

      const second = await requestJson(port, 'POST', '/api/match/publish', {
        ...firstBody,
        operationId: 'op_place_2'
      });

      expect(second.status).toBe(409);
      expect(second.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'VERSION_AHEAD',
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: 'op_place_2',
          actionType: 'place',
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: Number(first.data.stateVersion),
          rejectedReason: 'VERSION_AHEAD'
        })
      }));
      expect(second.data.idempotentReplay).toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });

  test('older accepted operationId is replayed even after a newer same-seat action', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackToken = created.data.seatToken;
      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      const whiteToken = joined.data.seatToken;
      const afterJoinState = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackToken)}`
      );

      const firstBody = buildPlacePublishBody({
        roomId,
        snapshot: afterJoinState.data.snapshot,
        stateVersion: afterJoinState.data.stateVersion,
        seatKey: 'black',
        seatToken: blackToken,
        operationId: 'op_history_black_1'
      });
      const first = await requestJson(port, 'POST', '/api/match/publish', firstBody);

      const secondBody = buildPlacePublishBody({
        roomId,
        snapshot: first.data.snapshot,
        stateVersion: first.data.stateVersion,
        seatKey: 'white',
        seatToken: whiteToken,
        operationId: 'op_history_white_1'
      });
      const second = await requestJson(port, 'POST', '/api/match/publish', secondBody);

      const thirdBody = buildPlacePublishBody({
        roomId,
        snapshot: second.data.snapshot,
        stateVersion: second.data.stateVersion,
        seatKey: 'black',
        seatToken: blackToken,
        operationId: 'op_history_black_2'
      });
      const third = await requestJson(port, 'POST', '/api/match/publish', thirdBody);

      const replay = await requestJson(port, 'POST', '/api/match/publish', firstBody);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(200);
      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        idempotentReplay: true,
        stateVersion: Number(third.data.stateVersion),
        publishMeta: expect.objectContaining({
          kind: 'idempotent_replay',
          operationId: 'op_history_black_1',
          authoritativeStateVersion: Number(third.data.stateVersion),
          replayedStateVersion: Number(first.data.stateVersion)
        })
      }));

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackToken)}`
      );
      expect(state.status).toBe(200);
      expect(state.data.stateVersion).toBe(Number(third.data.stateVersion));
    } finally {
      await closeServer(server);
    }
  });

  test('second publish snapshot does not replay stale charge delta events from the previous turn', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ'
      });
      expect(joined.status).toBe(200);
      const whiteSeatToken = joined.data.seatToken;

      const blackPublish = await requestJson(
        port,
        'POST',
        '/api/match/publish',
        buildPlacePublishBody({
          roomId,
          snapshot: joined.data.snapshot,
          stateVersion: joined.data.stateVersion,
          seatKey: 'black',
          seatToken: blackSeatToken,
          operationId: 'op_charge_black_1'
        })
      );
      expect(blackPublish.status).toBe(200);
      expect(blackPublish.data.snapshot.cardState.chargeDeltaEvents).toEqual([
        expect.objectContaining({ player: 'black', delta: 1 })
      ]);

      const whitePublish = await requestJson(
        port,
        'POST',
        '/api/match/publish',
        buildPlacePublishBody({
          roomId,
          snapshot: blackPublish.data.snapshot,
          stateVersion: blackPublish.data.stateVersion,
          seatKey: 'white',
          seatToken: whiteSeatToken,
          operationId: 'op_charge_white_1'
        })
      );

      expect(whitePublish.status).toBe(200);
      expect(Array.isArray(whitePublish.data.snapshot.cardState.chargeDeltaEvents)).toBe(true);
      expect(whitePublish.data.snapshot.cardState.chargeDeltaEvents.length).toBeGreaterThan(0);
      expect(whitePublish.data.snapshot.cardState.chargeDeltaEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ player: 'white', delta: 1 })])
      );
      expect(
        whitePublish.data.snapshot.cardState.chargeDeltaEvents.every((event) => event && event.player === 'white')
      ).toBe(true);

      const currentState = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackSeatToken)}`
      );
      expect(currentState.status).toBe(200);
      expect(currentState.data.snapshot.cardState.chargeDeltaEvents).toEqual([]);
    } finally {
      await closeServer(server);
    }
  });
});
