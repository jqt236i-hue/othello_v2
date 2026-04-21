const http = require('http');
const Core = require('../game/logic/core');
const { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } = require('../scripts/local-match-server');

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
        roomDeck: expect.objectContaining({
          mode: 'shared',
          deckCode: '',
          deckSize: 30,
          source: 'room'
        }),
        roomBoardConfig: expect.objectContaining({
          rows: 8,
          cols: 8,
          standard8x8: true
        }),
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        seats: { black: true, white: false },
        seatNames: { black: 'くろ', white: '' },
        seatHandSkins: { black: '', white: '' },
        turnTimer: expect.objectContaining({
          limitSeconds: 120,
          active: false,
          turnSeatKey: 'black'
        }),
        playbackEvents: [],
        effectLogs: [],
        serverTime: expect.any(Number),
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

  test('seatHandSkins are exposed through create join state and hand-skin update', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        selectedHandSkinId: 'gacha__n__hand-swap'
      });
      expect(created.status).toBe(200);
      expect(created.data.seatHandSkins).toEqual({
        black: 'gacha__n__陽気な手',
        white: ''
      });

      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ',
        selectedHandSkinId: 'gacha__n__小鬼の手'
      });
      expect(joined.status).toBe(200);
      expect(joined.data.seatHandSkins).toEqual({
        black: 'gacha__n__陽気な手',
        white: 'gacha__n__小鬼の手'
      });

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${created.data.roomId}&seatKey=black&seatToken=${created.data.seatToken}`
      );
      expect(state.status).toBe(200);
      expect(state.data.seatHandSkins).toEqual({
        black: 'gacha__n__陽気な手',
        white: 'gacha__n__小鬼の手'
      });

      const updated = await requestJson(port, 'POST', '/api/match/hand-skin', {
        roomId: created.data.roomId,
        seatKey: 'white',
        seatToken: joined.data.seatToken,
        selectedHandSkinId: 'gacha__n__hand.png'
      });
      expect(updated.status).toBe(200);
      expect(updated.data.seatHandSkins).toEqual({
        black: 'gacha__n__陽気な手',
        white: 'gacha__n__人の手'
      });
    } finally {
      await closeServer(server);
    }
  });

  test('missing operationId publish is rejected before command handling', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const authoritativeVersion = Number(created.data.stateVersion);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: authoritativeVersion,
        actionType: 'place'
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'OPERATION_ID_REQUIRED',
        snapshot: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: '',
          actionType: 'place',
          receivedBaseVersion: authoritativeVersion,
          authoritativeStateVersion: authoritativeVersion,
          rejectedReason: 'OPERATION_ID_REQUIRED'
        })
      }));
      expect(response.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        version: authoritativeVersion,
        projectedForSeat: 'black'
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

  test('deferred tempt publish can steal robot vacuum once card-use context is included in command payload', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ'
      });

      const patched = patchRoomSnapshotForTests(created.data.roomId, (room) => {
        const snapshot = room.snapshot;
        snapshot.gameState.currentPlayer = -1;
        snapshot.gameState.turnNumber = 7;
        snapshot.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        snapshot.gameState.board[3][3] = 1;
        snapshot.cardState.turnIndex = 7;
        snapshot.cardState.lastTurnStartedFor = 'white';
        snapshot.cardState.charge.black = 30;
        snapshot.cardState.charge.white = 30;
        snapshot.cardState.hands.black = [];
        snapshot.cardState.hands.white = ['tempt_01'];
        snapshot.cardState.pendingEffectByPlayer = { black: null, white: null };
        snapshot.cardState.markers = [{
          kind: 'specialStone',
          row: 3,
          col: 3,
          owner: 'black',
          data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
        }];
      });
      expect(patched).toBe(true);

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${created.data.roomId}&seatKey=white&seatToken=${joined.data.seatToken}`
      );

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId: created.data.roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: joined.data.seatToken,
        baseVersion: state.data.stateVersion,
        operationId: 'op_tempt_robot_vacuum',
        actionType: 'place',
        actor: 'white',
        params: {
          temptTarget: { row: 3, col: 3 },
          pendingSelectionState: {
            type: 'TEMPT_WILL',
            stage: 'selectTarget',
            cardId: 'tempt_01'
          },
          useCardId: 'tempt_01',
          useCardOwnerKey: 'white'
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({
        ok: true,
        roomId: created.data.roomId,
        snapshot: expect.any(Object),
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_tempt_robot_vacuum',
          actionType: 'place'
        })
      }));
      expect(response.data.snapshot.gameState.currentPlayer).toBe(-1);
      expect(response.data.snapshot.gameState.board[3][3]).toBe(-1);
      expect(response.data.snapshot.cardState.hands.white).toEqual([]);
      expect(response.data.snapshot.cardState.charge.white).toBe(7);
      expect(response.data.snapshot.cardState.pendingEffectByPlayer.white).toBeNull();
      expect(response.data.snapshot.cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 3,
          col: 3,
          owner: 'white',
          data: expect.objectContaining({
            type: 'ROBOT_VACUUM',
            remainingOwnerTurns: 5
          })
        })
      ]));
    } finally {
      await closeServer(server);
    }
  });

  test('stale pendingEffectId publish is rejected before deferred selection is applied', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.gameState.currentPlayer = 1;
        room.snapshot.cardState.turnIndex = 9;
        room.snapshot.cardState.pendingEffectByPlayer = {
          black: {
            type: 'TEMPT_WILL',
            stage: 'selectTarget',
            cardId: 'tempt_01',
            pendingEffectId: 'pending_9_2'
          },
          white: null
        };
      });
      expect(patched).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_stale_pending_1',
        actionType: 'place',
        actor: 'black',
        params: {
          row: 2,
          col: 3,
          pendingSelectionState: {
            type: 'TEMPT_WILL',
            pendingEffectId: 'pending_9_1'
          }
        },
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 3,
          pendingSelectionState: {
            type: 'TEMPT_WILL',
            pendingEffectId: 'pending_9_1'
          },
          turnIndex: 9
        },
        turnIndex: 9
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        roomId,
        rejectedReason: 'STALE_PENDING_SELECTION',
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: 'op_stale_pending_1',
          actionType: 'place',
          rejectedReason: 'STALE_PENDING_SELECTION'
        })
      }));
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
      expect(Array.isArray(first.data.effectLogs)).toBe(true);
      expect(first.data.playbackEvents.length).toBeGreaterThan(0);

      const replay = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        idempotentReplay: true,
        roomDeck: expect.objectContaining({
          mode: 'shared',
          deckCode: '',
          deckSize: 30,
          source: 'room'
        }),
        roomBoardConfig: expect.objectContaining({
          rows: 8,
          cols: 8,
          standard8x8: true
        }),
        networkDebugEnabled: false,
        snapshot: expect.any(Object),
        playbackEvents: [],
        effectLogs: [],
        seats: { black: true, white: false },
        seatNames: { black: 'くろ', white: '' },
        seatHandSkins: { black: '', white: '' },
        turnTimer: expect.objectContaining({
          limitSeconds: 120,
          active: false,
          turnSeatKey: 'white'
        }),
        serverTime: expect.any(Number),
        publishMeta: expect.objectContaining({
          kind: 'idempotent_replay',
          operationId: 'op_place_1',
          actionType: 'place',
          receivedBaseVersion: baseVersion,
          authoritativeStateVersion: Number(first.data.stateVersion),
          replayedStateVersion: Number(first.data.stateVersion)
        })
      }));
      expect(replay.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        version: Number(first.data.stateVersion),
        projectedForSeat: 'black',
        turnStartReconciled: true
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

  test('FATE_WILL controller seat can publish action during controlled opponent turn', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      expect(joined.status).toBe(200);
      const whiteSeatToken = joined.data.seatToken;

      // Set FATE_WILL controller state: black controls white's turn, and it is white's turn.
      // We inject this into the room snapshot directly (test-only escape hatch).
      const stateAfterJoin = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(whiteSeatToken)}`
      );
      expect(stateAfterJoin.status).toBe(200);
      const baseVersion = Number(stateAfterJoin.data.stateVersion);

      // Patch the room: set currentPlayer to 'white' (already the case at game start for white's turn after black's first move)
      // and arm fateWillControllerByTurnOwner so black controls white's turn.
      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        // Ensure it is white's turn
        if (room.snapshot && room.snapshot.gameState) {
          room.snapshot.gameState.currentPlayer = -1; // white
        }
        if (room.snapshot && room.snapshot.cardState) {
          room.snapshot.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
        }
      });
      expect(patched).toBe(true);

      // Fetch the patched state to get legal moves for white
      const patchedState = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(whiteSeatToken)}`
      );
      expect(patchedState.status).toBe(200);
      const patchedVersion = Number(patchedState.data.stateVersion);

      // Black (controller) publishes on behalf of white's turn
      const move = pickFirstLegalMove(patchedState.data.snapshot, 'white');
      const controllerPublish = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: patchedVersion,
        operationId: 'op_fate_will_controller_1',
        actionType: 'place',
        actor: 'black',
        params: { row: move.row, col: move.col },
        action: {
          type: 'place',
          playerKey: 'black',
          row: move.row,
          col: move.col
        }
      });

      // Controller action should be accepted (not OUT_OF_TURN)
      expect(controllerPublish.status).toBe(200);
      expect(controllerPublish.data.ok).toBe(true);
      expect(controllerPublish.data.rejectedReason).toBeUndefined();
    } finally {
      await closeServer(server);
    }
  });

  test('non-controller out-of-turn publish is still rejected with OUT_OF_TURN', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      expect(joined.status).toBe(200);
      const whiteSeatToken = joined.data.seatToken;

      const stateAfterJoin = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(whiteSeatToken)}`
      );
      const stateVersion = Number(stateAfterJoin.data.stateVersion);
      const move = pickFirstLegalMove(stateAfterJoin.data.snapshot, 'white');

      // White tries to publish during black's turn with no FATE_WILL active
      const outOfTurnPublish = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: whiteSeatToken,
        baseVersion: stateVersion,
        operationId: 'op_out_of_turn_1',
        actionType: 'place',
        actor: 'white',
        params: { row: move.row, col: move.col },
        action: { type: 'place', playerKey: 'white', row: move.row, col: move.col }
      });

      expect(outOfTurnPublish.status).toBe(409);
      expect(outOfTurnPublish.data.ok).toBe(false);
      expect(outOfTurnPublish.data.rejectedReason).toBe('OUT_OF_TURN');
    } finally {
      await closeServer(server);
    }
  });
});
