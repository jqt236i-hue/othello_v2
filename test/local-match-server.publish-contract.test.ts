import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } from '../scripts/local-match-server.js';

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

function requestRaw(port, method, requestPath, rawBody) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, data: raw, errorCode: '' });
      });
    });
    req.on('error', (error) => {
      resolve({ status: 0, data: '', errorCode: error && error.code ? String(error.code) : 'REQUEST_ERROR' });
    });
    req.write(rawBody);
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

function createEmptyBoard(rows = 8, cols = 8) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createFinalDoublePlaceBoard() {
  const board = createEmptyBoard();
  for (let row = 1; row <= 2; row += 1) {
    board[row][0] = 1;
    for (let col = 1; col <= 5; col += 1) {
      board[row][col] = -1;
    }
  }
  board[1][6] = 1;
  board[3][3] = -1;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = -1;
  return board;
}

describe('local match server publish contract', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('state response recovers buffered playback for current state version', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      patchRoomSnapshotForTests(roomId, (room) => {
        room.stateVersion = 2;
        room.snapshot.stateVersion = 2;
        room.snapshot._meta = Object.assign({}, room.snapshot._meta || {}, { version: 2 });
        room.sseEventBuffer = [{
          id: `${roomId}_2_2`,
          event: 'snapshot',
          payloadByViewer: {
            black: {
              ok: true,
              roomId,
              stateVersion: 2,
              operationId: 'op_playback_recovery',
              playbackEvents: [{ type: 'move', phase: 1, targets: [{ from: { r: 3, col: 3 }, to: { r: 4, col: 3 }, reason: 'hyperactive_move' }] }],
              effectLogs: ['黒: 多動石が移動'],
              snapshot: room.snapshot
            },
            white: {
              ok: true,
              roomId,
              stateVersion: 2,
              playbackEvents: [],
              effectLogs: ['黒: 多動石が移動'],
              snapshot: room.snapshot
            }
          }
        }];
      });

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
      );

      expect(state.status).toBe(200);
      expect(state.data.stateVersion).toBe(2);
      expect(state.data.operationId).toBe('op_playback_recovery');
      expect(state.data.playbackEvents).toEqual([
        expect.objectContaining({ type: 'move' })
      ]);
      expect(state.data.effectLogs).toEqual(['黒: 多動石が移動']);
    } finally {
      await closeServer(server);
    }
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

  test('network debug fill hand is rejected even when create payload requests debug', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        networkDebugEnabled: true
      });
      expect(created.status).toBe(200);
      expect(created.data.networkDebugEnabled).toBe(false);
      const initialBlackHand = created.data.snapshot.cardState.hands.black.slice();

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId: created.data.roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: created.data.seatToken,
        baseVersion: Number(created.data.stateVersion),
        operationId: 'op_debug_targeted_fill',
        actionType: 'debug_fill_hand',
        actor: 'black',
        params: {
          cardIds: ['heaven_01'],
          replaceExisting: true
        },
        action: {
          type: 'debug_fill_hand',
          playerKey: 'black',
          cardIds: ['heaven_01'],
          replaceExisting: true
        }
      });

      expect(response.status).toBe(409);
      expect(response.data.ok).toBe(false);
      expect(response.data.rejectedReason).toBe('NETWORK_DEBUG_DISABLED');
      expect(response.data.snapshot.cardState.hands.black).toEqual(initialBlackHand);
      expect(response.data.publishMeta).toEqual(expect.objectContaining({
        kind: 'rejected',
        actionType: 'debug_fill_hand',
        operationId: 'op_debug_targeted_fill',
        rejectedReason: 'NETWORK_DEBUG_DISABLED'
      }));
    } finally {
      await closeServer(server);
    }
  });

  test('card-use debug options are authority-gated and allowlisted by the room', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const baseVersion = Number(created.data.stateVersion);
      const turnIndex = 17;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        const snapshot = room.snapshot;
        room.networkDebugEnabled = false;
        snapshot.gameState.currentPlayer = Core.BLACK;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = turnIndex;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState._activeTurnPlayer = 'black';
        snapshot.cardState.pendingEffectByPlayer.black = null;
        snapshot.cardState.hands.black = [];
        snapshot.cardState._handCopyIdsByPlayer.black = [];
        snapshot.cardState.discard = [];
        CardLogic.addCardToHand(snapshot.cardState, 'black', 'hard_01');
        snapshot.cardState.charge.black = 99;
        snapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
        snapshot.cardState.lastUsedCardByPlayer.black = 'work_01';
      })).toBe(true);

      const publishWithDebugOptions = (operationId, debugOptions) => requestJson(
        port,
        'POST',
        '/api/match/publish',
        {
          roomId,
          seatKey: 'black',
          playerKey: 'black',
          seatToken: created.data.seatToken,
          baseVersion,
          operationId,
          actionType: 'use_card',
          actor: 'black',
          params: {
            useCardId: 'hard_01',
            useCardOwnerKey: 'black',
            useCardHandIndex: 0,
            debugOptions
          },
          turnIndex,
          action: {
            type: 'use_card',
            playerKey: 'black',
            useCardId: 'hard_01',
            useCardOwnerKey: 'black',
            useCardHandIndex: 0,
            debugOptions,
            turnIndex
          }
        }
      );

      const unspecified = await publishWithDebugOptions(
        'op_debug_options_null_unspecified',
        null
      );
      expect(unspecified.status).toBe(409);
      expect(unspecified.data.rejectedReason).toBe('CARD_USE_FAILED');
      expect(unspecified.data.stateVersion).toBe(baseVersion);

      for (const [operationId, debugOptions] of [
        ['op_debug_options_no_consume_disabled', { ignoreCost: true, noConsume: true }],
        ['op_debug_options_turn_limit_disabled', { skipCostAndTurnLimit: true }]
      ]) {
        const rejected = await publishWithDebugOptions(operationId, debugOptions);
        expect(rejected.status).toBe(409);
        expect(rejected.data.rejectedReason).toBe('NETWORK_DEBUG_DISABLED');
        expect(rejected.data.stateVersion).toBe(baseVersion);
        expect(rejected.data.snapshot.cardState.hands.black).toEqual(['hard_01']);
        expect(rejected.data.snapshot.cardState.charge.black).toBe(99);
        expect(rejected.data.snapshot.cardState.lastUsedCardByPlayer.black).toBe('work_01');
      }

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkDebugEnabled = true;
      })).toBe(true);

      const invalid = await publishWithDebugOptions(
        'op_debug_options_unknown_enabled',
        { ignoreCost: true, noConsume: true, skipCostAndTurnLimit: true }
      );
      expect(invalid.status).toBe(409);
      expect(invalid.data.rejectedReason).toBe('NETWORK_DEBUG_OPTIONS_INVALID');
      expect(invalid.data.stateVersion).toBe(baseVersion);

      const allowed = await publishWithDebugOptions(
        'op_debug_options_allowlisted_enabled',
        { noConsume: true, ignoreCost: true }
      );
      expect(allowed.status).toBe(200);
      expect(allowed.data.ok).toBe(true);
      expect(allowed.data.stateVersion).toBe(baseVersion + 1);
      expect(allowed.data.snapshot.cardState.hands.black).toEqual(['hard_01']);
      expect(allowed.data.snapshot.cardState.charge.black).toBe(99);
      expect(allowed.data.snapshot.cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
      expect(allowed.data.snapshot.cardState.lastUsedCardByPlayer.black).toBe('hard_01');
    } finally {
      await closeServer(server);
    }
  });

  test('oversized request body closes the local connection while rejecting parse', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const oversizedBody = `{"padding":"${'x'.repeat(5 * 1024 * 1024 + 1)}"}`;
      const response = await requestRaw(port, 'POST', '/api/match/create', oversizedBody);

      expect(response.status).toBe(0);
      expect(response.errorCode).toBeTruthy();
    } finally {
      await closeServer(server);
    }
  });

  test('local randomFromChars uses rejection sampling instead of modulo bias', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../scripts/local-match-server.ts'), 'utf8');
    const match = source.match(/function randomFromChars[\s\S]*?\r?\n}\r?\n/);

    expect(match && match[0]).toContain('maxUnbiasedByte');
    expect(match && match[0]).toContain('if (byte >= maxUnbiasedByte) continue;');
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

  test('authoritative tempt follow-up strips redundant card-use context and can steal robot vacuum', async () => {
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
        snapshot.cardState.charge.white = 7;
        snapshot.cardState.hands.black = [];
        snapshot.cardState.hands.white = [];
        snapshot.cardState.pendingEffectByPlayer = {
          black: null,
          white: {
            type: 'TEMPT_WILL',
            stage: 'selectTarget',
            cardId: 'tempt_01',
            pendingEffectId: 'pending_7_1'
          }
        };
        snapshot.cardState.hasUsedCardThisTurnByPlayer = { black: false, white: true };
        snapshot.cardState.lastUsedCardByPlayer = { black: null, white: 'tempt_01' };
        snapshot.cardState.discard = ['tempt_01'];
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
            cardId: 'tempt_01',
            pendingEffectId: 'pending_7_1'
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

  test('authoritative reverse will selection keeps the actor turn open for follow-up placement', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        const snapshot = room.snapshot;
        const board = createEmptyBoard();
        board[2][2] = 1;
        board[2][3] = -1;
        board[2][4] = 1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.turnNumber = 5;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.board = board;
        snapshot.cardState.turnIndex = 5;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState.charge.black = 0;
        snapshot.cardState.charge.white = 0;
        snapshot.cardState.hands.black = [];
        snapshot.cardState.hands.white = [];
        snapshot.cardState.pendingEffectByPlayer = {
          black: {
            type: 'REVERSE_WILL',
            stage: 'selectTarget',
            cardId: 'reverse_will_01',
            pendingEffectId: 'pending_5_1'
          },
          white: null
        };
        snapshot.cardState.hasUsedCardThisTurnByPlayer = { black: true, white: false };
        snapshot.cardState.lastUsedCardByPlayer = { black: 'reverse_will_01', white: null };
        snapshot.cardState.discard = ['reverse_will_01'];
        snapshot.cardState.markers = [];
      });
      expect(patched).toBe(true);

      const reverseSelection = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_reverse_will_select_1',
        actionType: 'place',
        actor: 'black',
        params: {
          reverseWillTarget: { row: 2, col: 2 },
          player: 'black',
          pendingSelectionState: {
            type: 'REVERSE_WILL',
            stage: 'selectTarget',
            cardId: 'reverse_will_01',
            pendingEffectId: 'pending_5_1'
          }
        },
        turnIndex: 5
      });

      expect(reverseSelection.status).toBe(200);
      expect(reverseSelection.data.ok).toBe(true);
      expect(reverseSelection.data.snapshot.gameState.currentPlayer).toBe(1);
      expect(reverseSelection.data.snapshot.gameState.board[2][3]).toBe(1);
      expect(reverseSelection.data.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(reverseSelection.data.playbackEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'flip',
          targets: expect.arrayContaining([
            expect.objectContaining({
              r: 2,
              col: 3,
              cause: 'REVERSE_WILL',
              reason: 'reverse_will_flip'
            })
          ])
        })
      ]));

      const followUpBody = buildPlacePublishBody({
        roomId,
        snapshot: reverseSelection.data.snapshot,
        stateVersion: reverseSelection.data.stateVersion,
        seatKey: 'black',
        seatToken,
        operationId: 'op_reverse_will_followup_place_1'
      });
      const followUp = await requestJson(port, 'POST', '/api/match/publish', followUpBody);

      expect(followUp.status).toBe(200);
      expect(followUp.data.ok).toBe(true);
      expect(followUp.data.snapshot.gameState.currentPlayer).toBe(-1);
      expect(followUp.data.snapshot.gameState.board[followUpBody.params.row][followUpBody.params.col]).toBe(1);
    } finally {
      await closeServer(server);
    }
  });

  test('standard network placement lets flip-evasion stones dodge instead of flipping', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'しろ'
      });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      patchRoomSnapshotForTests(roomId, (room) => {
        const board = createEmptyBoard();
        board[3][2] = Core.BLACK;
        board[3][3] = Core.WHITE;
        board[3][4] = Core.EMPTY;

        room.snapshot.gameState.board = board;
        room.snapshot.gameState.currentPlayer = Core.BLACK;
        room.snapshot.gameState.turnNumber = 1;
        room.snapshot.cardState.markers = [{
          id: 'afterimage_evade_1',
          kind: 'specialStone',
          row: 3,
          col: 3,
          owner: 'white',
          data: {
            type: 'AFTERIMAGE_WILL',
            flipEvadeRemaining: 3,
            destroyEvadeRemaining: 3
          }
        }];
        room.snapshot.cardState.turnIndex = 1;
        room.snapshot.cardState.lastTurnStartedFor = 'black';
        room.snapshot.cardState._activeTurnPlayer = 'black';
        room.snapshot.cardState.pendingEffectByPlayer = { black: null, white: null };
      });

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: joined.data.stateVersion,
        operationId: 'op_afterimage_flip_evade_place',
        actionType: 'place',
        actor: 'black',
        params: { row: 3, col: 4 },
        turnIndex: 1,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 3,
          col: 4,
          turnIndex: 1
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.ok).toBe(true);
      const snapshot = response.data.snapshot;
      expect(snapshot.gameState.board[3][3]).toBe(Core.EMPTY);
      expect(snapshot.gameState.board[3][4]).toBe(Core.BLACK);

      const marker = snapshot.cardState.markers.find((item) => item && item.id === 'afterimage_evade_1');
      expect(marker).toEqual(expect.objectContaining({
        owner: 'white',
        data: expect.objectContaining({
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 2
        })
      }));
      expect(marker.row === 3 && marker.col === 3).toBe(false);
      expect(snapshot.gameState.board[marker.row][marker.col]).toBe(Core.WHITE);
      expect(response.data.playbackEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'move',
          targets: expect.arrayContaining([
            expect.objectContaining({
              from: { r: 3, col: 3 },
              cause: 'AFTERIMAGE_WILL',
              reason: 'afterimage_will_flip_evade_move'
            })
          ])
        })
      ]));
    } finally {
      await closeServer(server);
    }
  });

  test('network card-use placement lets afterimage stones dodge standard flips', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        networkDebugEnabled: true
      });
      const roomId = created.data.roomId;
      const blackToken = created.data.seatToken;
      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId,
        playerName: 'しろ'
      });
      const whiteToken = joined.data.seatToken;

      let snapshot = joined.data.snapshot;
      let stateVersion = joined.data.stateVersion;
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.cardState.hands.white = ['afterimage_will_01'];
        room.snapshot.cardState.charge.white = 99;
      })).toBe(true);

      const publish = async (seatKey, seatToken, actionType, params, operationId) => {
        const turnIndex = snapshot && snapshot.cardState && Number.isFinite(Number(snapshot.cardState.turnIndex))
          ? Number(snapshot.cardState.turnIndex)
          : 0;
        const response = await requestJson(port, 'POST', '/api/match/publish', {
          roomId,
          seatKey,
          playerKey: seatKey,
          seatToken,
          baseVersion: stateVersion,
          operationId,
          actionType,
          actor: seatKey,
          params,
          turnIndex,
          action: Object.assign({ type: actionType, playerKey: seatKey, turnIndex }, params)
        });
        expect(response.status).toBe(200);
        expect(response.data.ok).toBe(true);
        snapshot = response.data.snapshot;
        stateVersion = response.data.stateVersion;
        return response;
      };

      await publish('black', blackToken, 'place', { row: 2, col: 3 }, 'op_afterimage_card_use_black_opening');
      await publish('white', whiteToken, 'use_card', {
        useCardId: 'afterimage_will_01',
        useCardOwnerKey: 'white'
      }, 'op_afterimage_card_use_use_card');

      const placed = await publish('white', whiteToken, 'place', { row: 2, col: 2 }, 'op_afterimage_card_use_white_place');
      const placedMarker = placed.data.snapshot.cardState.markers.find((marker) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.row === 2 &&
        marker.col === 2 &&
        marker.data &&
        marker.data.type === 'AFTERIMAGE_WILL'
      ));
      expect(placedMarker).toEqual(expect.objectContaining({
        owner: 'white',
        data: expect.objectContaining({
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 6,
          destroyEvadeRemaining: 6
        })
      }));

      const flipped = await publish('black', blackToken, 'place', { row: 2, col: 1 }, 'op_afterimage_card_use_black_flip_attempt');
      const afterSnapshot = flipped.data.snapshot;
      expect(afterSnapshot.gameState.board[2][1]).toBe(Core.BLACK);
      expect(afterSnapshot.gameState.board[2][2]).toBe(Core.EMPTY);

      const movedMarker = afterSnapshot.cardState.markers.find((marker) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.owner === 'white' &&
        marker.data &&
        marker.data.type === 'AFTERIMAGE_WILL'
      ));
      expect(movedMarker).toEqual(expect.objectContaining({
        owner: 'white',
        data: expect.objectContaining({
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 5,
          destroyEvadeRemaining: 6
        })
      }));
      expect(movedMarker.row === 2 && movedMarker.col === 2).toBe(false);
      expect(afterSnapshot.gameState.board[movedMarker.row][movedMarker.col]).toBe(Core.WHITE);
      expect(flipped.data.playbackEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'move',
          targets: expect.arrayContaining([
            expect.objectContaining({
              from: { r: 2, col: 2 },
              cause: 'AFTERIMAGE_WILL',
              reason: 'afterimage_will_flip_evade_move'
            })
          ])
        })
      ]));
    } finally {
      await closeServer(server);
    }
  });

  test('authoritative reverse will selection lets flip-evasion stones dodge on publish', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        const snapshot = room.snapshot;
        const board = createEmptyBoard();
        board[2][2] = 1;
        board[2][3] = -1;
        board[2][4] = 1;
        board[3][3] = -1;
        board[3][4] = 1;
        board[4][3] = 1;
        board[4][4] = -1;

        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.turnNumber = 5;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.board = board;
        snapshot.cardState.turnIndex = 5;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState.charge.black = 0;
        snapshot.cardState.charge.white = 0;
        snapshot.cardState.hands.black = [];
        snapshot.cardState.hands.white = [];
        snapshot.cardState.pendingEffectByPlayer = {
          black: {
            type: 'REVERSE_WILL',
            stage: 'selectTarget',
            cardId: 'reverse_will_01',
            pendingEffectId: 'pending_5_1'
          },
          white: null
        };
        snapshot.cardState.hasUsedCardThisTurnByPlayer = { black: true, white: false };
        snapshot.cardState.lastUsedCardByPlayer = { black: 'reverse_will_01', white: null };
        snapshot.cardState.discard = ['reverse_will_01'];
        snapshot.cardState.markers = [{
          id: 'afterimage_reverse_target',
          kind: 'specialStone',
          row: 2,
          col: 3,
          owner: 'white',
          data: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
        }];
      });
      expect(patched).toBe(true);

      const reverseSelection = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_reverse_will_evade_select_1',
        actionType: 'place',
        actor: 'black',
        params: {
          reverseWillTarget: { row: 2, col: 2 },
          player: 'black',
          pendingSelectionState: {
            type: 'REVERSE_WILL',
            stage: 'selectTarget',
            cardId: 'reverse_will_01',
            pendingEffectId: 'pending_5_1'
          }
        },
        turnIndex: 5
      });

      expect(reverseSelection.status).toBe(200);
      expect(reverseSelection.data.ok).toBe(true);
      expect(reverseSelection.data.snapshot.gameState.currentPlayer).toBe(1);
      expect(reverseSelection.data.snapshot.gameState.board[2][3]).toBe(0);
      expect(reverseSelection.data.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();

      const marker = reverseSelection.data.snapshot.cardState.markers.find((entry) => (
        entry && entry.id === 'afterimage_reverse_target'
      ));
      expect(marker).toEqual(expect.objectContaining({
        owner: 'white',
        data: expect.objectContaining({
          type: 'AFTERIMAGE_WILL',
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 3
        })
      }));
      expect(marker.row === 2 && marker.col === 3).toBe(false);
      expect(reverseSelection.data.snapshot.gameState.board[marker.row][marker.col]).toBe(-1);
      expect(reverseSelection.data.playbackEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'move',
          targets: expect.arrayContaining([
            expect.objectContaining({
              from: expect.objectContaining({ r: 2, col: 3 }),
              cause: 'AFTERIMAGE_WILL',
              reason: 'afterimage_will_flip_evade_move'
            })
          ])
        })
      ]));
      expect(reverseSelection.data.playbackEvents).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'flip',
          targets: expect.arrayContaining([
            expect.objectContaining({
              r: 2,
              col: 3,
              cause: 'REVERSE_WILL',
              reason: 'reverse_will_flip'
            })
          ])
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
        playbackEvents: first.data.playbackEvents,
        playbackDigest: first.data.playbackDigest,
        presentationFrames: expect.arrayContaining([
          expect.objectContaining({
            playbackDigest: first.data.playbackDigest,
            playbackEvents: first.data.playbackEvents,
            operationId: 'op_place_1',
            actionType: 'place'
          })
        ]),
        effectLogs: first.data.effectLogs,
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

  test('ack-only publish response omits snapshot and playback payloads when room flag is enabled', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      patchRoomSnapshotForTests(roomId, (room) => {
        room.publishResponseMode = 'ack_only';
      });

      const publishBody = buildPlacePublishBody({
        roomId,
        snapshot: created.data.snapshot,
        stateVersion: created.data.stateVersion,
        seatKey: 'black',
        seatToken,
        operationId: 'op_ack_only_local_1'
      });
      const publish = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(publish.status).toBe(200);
      expect(publish.data).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        stateVersion: Number(created.data.stateVersion) + 1,
        operationId: 'op_ack_only_local_1',
        serverTime: expect.any(Number),
        presentationCursor: expect.objectContaining({
          visualSeq: 1,
          stateVersion: Number(created.data.stateVersion) + 1
        }),
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_ack_only_local_1',
          actionType: 'place',
          receivedBaseVersion: Number(created.data.stateVersion),
          authoritativeStateVersion: Number(created.data.stateVersion) + 1
        })
      }));
      expect(publish.data).not.toHaveProperty('snapshot');
      expect(publish.data).not.toHaveProperty('playbackEvents');
      expect(publish.data).not.toHaveProperty('presentationFrames');
      expect(publish.data).not.toHaveProperty('roomDeck');
      expect(publish.data).not.toHaveProperty('turnTimer');
    } finally {
      await closeServer(server);
    }
  });

  test('auto pass idempotent replay response preserves auto pass notice metadata', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const baseVersion = Number(created.data.stateVersion);
      const turnIndex = 5;
      patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.gameState.board = createEmptyBoard();
        room.snapshot.gameState.currentPlayer = 1;
        room.snapshot.gameState.consecutivePasses = 0;
        room.snapshot.cardState.turnIndex = turnIndex;
        room.snapshot.cardState.hands = { black: [], white: [] };
        room.snapshot.cardState.decks = { black: [], white: [] };
        room.snapshot.cardState.deck = [];
        room.snapshot.cardState._deckCopyIdsByPlayer = { black: [], white: [] };
        room.snapshot.cardState.charge = { black: 0, white: 0 };
        room.snapshot.cardState.pendingEffectByPlayer = { black: null, white: null };
      });

      const publishBody = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion,
        operationId: 'op_auto_pass_replay_1',
        actionType: 'pass',
        actor: 'black',
        params: { autoNoActionPass: true },
        turnIndex,
        action: {
          type: 'pass',
          playerKey: 'black',
          turnIndex,
          autoNoActionPass: true
        }
      };

      const first = await requestJson(port, 'POST', '/api/match/publish', publishBody);
      expect(first.status).toBe(200);
      expect(first.data.autoPassNotice).toEqual({
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      });

      const replay = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        idempotentReplay: true,
        autoPassNotice: {
          playerKey: 'black',
          reason: 'no_legal_moves_or_usable_cards'
        },
        publishMeta: expect.objectContaining({
          kind: 'idempotent_replay',
          operationId: 'op_auto_pass_replay_1',
          actionType: 'pass'
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

  test('FATE_WILL controlled seat cannot publish during its controlled turn', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      const whiteSeatToken = joined.data.seatToken;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.gameState.currentPlayer = -1;
        room.snapshot.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
      })).toBe(true);

      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=white&seatToken=${encodeURIComponent(whiteSeatToken)}`
      );
      const move = pickFirstLegalMove(state.data.snapshot, 'white');
      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: whiteSeatToken,
        baseVersion: state.data.stateVersion,
        operationId: 'op_fate_will_controlled_owner_1',
        actionType: 'place',
        actor: 'white',
        params: { row: move.row, col: move.col },
        action: { type: 'place', playerKey: 'white', row: move.row, col: move.col }
      });

      expect(response.status).toBe(409);
      expect(response.data.rejectedReason).toBe('TURN_CONTROLLED_BY_FATE_WILL');
    } finally {
      await closeServer(server);
    }
  });

  test('legacy FATE_WILL controller auto_turn is planned for the canonical turn owner', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;
      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      const whiteOnlyMoveBoard = Array.from({ length: 8 }, () => Array(8).fill(-1));
      whiteOnlyMoveBoard[0][0] = 0;
      whiteOnlyMoveBoard[0][1] = 1;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        room.snapshot.gameState.board = whiteOnlyMoveBoard;
        room.snapshot.gameState.currentPlayer = -1;
        room.snapshot.gameState.consecutivePasses = 0;
        room.snapshot.cardState.hands.black = [];
        room.snapshot.cardState.hands.white = [];
        room.snapshot.cardState._handCopyIdsByPlayer.black = [];
        room.snapshot.cardState._handCopyIdsByPlayer.white = [];
        room.snapshot.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: joined.data.stateVersion,
        operationId: 'op_fate_will_auto_owner_1',
        actionType: 'auto_turn',
        actor: 'black',
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

      expect(response.status).toBe(200);
      expect(response.data.snapshot.gameState.board[0][0]).toBe(-1);
      expect(response.data.snapshot.gameState.consecutivePasses).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  test('rematch presence buffer preserves requestId and accepted metadata', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, playerName: 'しろ' });
      expect(joined.status).toBe(200);
      const whiteSeatToken = joined.data.seatToken;

      const requestResult = await requestJson(port, 'POST', '/api/match/rematch-request', {
        roomId,
        seatKey: 'black',
        seatToken: blackSeatToken
      });
      expect(requestResult.status).toBe(200);
      expect(requestResult.data.requestId).toMatch(/^rematch_/);

      let requestPayload: any = null;
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        const buffer = Array.isArray(room.sseEventBuffer) ? room.sseEventBuffer : [];
        const record = buffer[buffer.length - 1] || null;
        requestPayload = record && record.payload;
      })).toBe(true);

      const responseResult = await requestJson(port, 'POST', '/api/match/rematch-response', {
        roomId,
        seatKey: 'white',
        seatToken: whiteSeatToken,
        requestId: requestResult.data.requestId,
        accepted: true
      });
      expect(responseResult.status).toBe(200);

      let responsePayload: any = null;
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        const buffer = Array.isArray(room.sseEventBuffer) ? room.sseEventBuffer : [];
        const record = buffer[buffer.length - 1] || null;
        responsePayload = record && record.payload;
      })).toBe(true);

      expect(requestPayload).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        type: 'rematch_request',
        seatKey: 'black',
        requestId: requestResult.data.requestId
      }));
      expect(responsePayload).toEqual(expect.objectContaining({
        ok: true,
        roomId,
        type: 'rematch_response',
        seatKey: 'white',
        requestId: requestResult.data.requestId,
        accepted: true
      }));
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

  test('final DOUBLE_PLACE sub-placement starts the next player turn exactly once', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;
      const board = createFinalDoublePlaceBoard();
      const turnIndex = 11;

      expect(Core.getLegalMoves({ board }, 1)).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 2, col: 6 })
      ]));
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        const snapshot = room.snapshot;
        snapshot.gameState.board = board;
        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.turnNumber = 9;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = turnIndex;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState._activeTurnPlayer = 'black';
        snapshot.cardState.pendingEffectByPlayer.black = null;
        snapshot.cardState.extraPlaceRemainingByPlayer.black = 1;
        snapshot.cardState.multiPlaceSourceTypeByPlayer.black = 'DOUBLE_PLACE';
        snapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_final_double_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: 2, col: 6 },
        turnIndex,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 6,
          turnIndex
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({
        ok: true,
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_final_double_place_1'
        })
      }));
      expect(response.data.snapshot.gameState.currentPlayer).toBe(-1);
      expect(response.data.snapshot.gameState.turnNumber).toBe(10);
      expect(Core.isGameOver(response.data.snapshot.gameState)).toBe(false);
      expect(response.data.snapshot.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
      expect(response.data.snapshot.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
      expect(response.data.snapshot.cardState.lastTurnStartedFor).toBe('white');
      expect(response.data.snapshot.cardState._activeTurnPlayer).toBe('white');
      expect(response.data.snapshot.cardState.turnIndex).toBe(turnIndex + 1);
    } finally {
      await closeServer(server);
    }
  });

  test('direct second use_card is rejected without changing authoritative card state', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;
      const turnIndex = 21;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        const snapshot = room.snapshot;
        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.turnNumber = 8;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = turnIndex;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState._activeTurnPlayer = 'black';
        snapshot.cardState.pendingEffectByPlayer.black = null;
        snapshot.cardState.extraPlaceRemainingByPlayer.black = 0;
        snapshot.cardState.infinitePlaceActiveByPlayer.black = false;
        snapshot.cardState.hands.black = [];
        snapshot.cardState._handCopyIdsByPlayer.black = [];
        snapshot.cardState.discard = [];
        CardLogic.addCardToHand(snapshot.cardState, 'black', 'work_01');
        snapshot.cardState.charge.black = 99;
        snapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
        snapshot.cardState.lastUsedCardByPlayer.black = 'hard_01';
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_second_card_rejected_1',
        actionType: 'use_card',
        actor: 'black',
        params: {
          useCardId: 'work_01',
          useCardOwnerKey: 'black',
          useCardHandIndex: 0
        },
        turnIndex,
        action: {
          type: 'use_card',
          playerKey: 'black',
          useCardId: 'work_01',
          useCardOwnerKey: 'black',
          useCardHandIndex: 0,
          turnIndex
        }
      });

      expect(response.status).toBe(409);
      expect(response.data).toEqual(expect.objectContaining({
        ok: false,
        stateVersion: created.data.stateVersion,
        rejectedReason: 'CARD_USE_FAILED',
        publishMeta: expect.objectContaining({
          kind: 'rejected',
          operationId: 'op_second_card_rejected_1',
          rejectedReason: 'CARD_USE_FAILED'
        })
      }));
      expect(response.data.snapshot.cardState.hands.black).toEqual(['work_01']);
      expect(response.data.snapshot.cardState.charge.black).toBe(99);
      expect(response.data.snapshot.cardState.discard).toEqual([]);
      expect(response.data.snapshot.cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
      expect(response.data.snapshot.cardState.lastUsedCardByPlayer.black).toBe('hard_01');
    } finally {
      await closeServer(server);
    }
  });

  test('auto_turn places the continuation stone instead of selecting a card during DOUBLE_PLACE', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', {
        playerName: 'くろ',
        networkAutoEnabled: true
      });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;
      const turnIndex = 22;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        const snapshot = room.snapshot;
        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.turnNumber = 8;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = turnIndex;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState._activeTurnPlayer = 'black';
        snapshot.cardState.pendingEffectByPlayer.black = null;
        snapshot.cardState.extraPlaceRemainingByPlayer.black = 1;
        snapshot.cardState.infinitePlaceActiveByPlayer.black = false;
        snapshot.cardState.multiPlaceSourceTypeByPlayer.black = 'DOUBLE_PLACE';
        snapshot.cardState.hands.black = [];
        snapshot.cardState._handCopyIdsByPlayer.black = [];
        snapshot.cardState.discard = [];
        CardLogic.addCardToHand(snapshot.cardState, 'black', 'work_01');
        snapshot.cardState.charge.black = 99;
        snapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
        snapshot.cardState.lastUsedCardByPlayer.black = 'double_01';
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_auto_double_continuation_1',
        actionType: 'auto_turn',
        actor: 'black',
        turnIndex,
        action: {
          type: 'auto_turn',
          preferredActionType: 'use_card',
          preferredAction: {
            type: 'use_card',
            playerKey: 'black',
            useCardId: 'work_01',
            useCardOwnerKey: 'black',
            useCardHandIndex: 0
          }
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({
        ok: true,
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_auto_double_continuation_1',
          actionType: 'auto_turn'
        })
      }));
      expect(response.data.snapshot.gameState.board[2][3]).toBe(1);
      expect(response.data.snapshot.cardState.hands.black).toEqual(['work_01']);
      expect(response.data.snapshot.cardState.discard).toEqual([]);
      expect(response.data.snapshot.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
      expect(response.data.snapshot.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
      expect(response.data.snapshot.gameState.currentPlayer).toBe(-1);
    } finally {
      await closeServer(server);
    }
  });

  test('auto_turn uses canonical private card cost state instead of accepting a projected illegal pass', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;
      const noBlackMoveBoard = Array.from({ length: 8 }, () => Array(8).fill(-1));
      noBlackMoveBoard[0][0] = 0;
      noBlackMoveBoard[0][1] = 1;

      const patched = patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        const snapshot = room.snapshot;
        snapshot.gameState.board = noBlackMoveBoard;
        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = 12;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
        snapshot.cardState.pendingEffectByPlayer = { black: null, white: null };
        snapshot.cardState.hands.black = [];
        snapshot.cardState._handCopyIdsByPlayer.black = [];
        snapshot.cardState.cardCostOverridesByCopyId = {};
        snapshot.cardState.cardCostModifiersByCopyId = {};
        snapshot.cardState.charge.black = 0;
        CardLogic.addCardToHand(snapshot.cardState, 'black', 'hard_01');
        const added = CardLogic.addCardToHand(snapshot.cardState, 'black', 'hard_01');
        CardLogic.setCardCostOverrideForCopyId(
          snapshot.cardState,
          added.cardCopyId,
          0,
          'OBSERVER_WILL'
        );
      });
      expect(patched).toBe(true);
      expect(Core.getLegalMoves({ board: noBlackMoveBoard }, 1)).toEqual([]);
      expect(Core.getLegalMoves({ board: noBlackMoveBoard }, -1)).toHaveLength(1);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_auto_canonical_cost_1',
        actionType: 'auto_turn',
        actor: 'black',
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

      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({
        ok: true,
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_auto_canonical_cost_1',
          actionType: 'auto_turn'
        })
      }));
      expect(response.data.autoPassNotice).toBeUndefined();
      expect(response.data.playbackEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'card_use_animation',
          targets: expect.arrayContaining([
            expect.objectContaining({ cardId: 'hard_01', cost: 0 })
          ])
        })
      ]));
      expect(response.data.snapshot.cardState.discard).toContain('hard_01');
      expect(response.data.snapshot.cardState.lastUsedCardByPlayer.black).toBe('hard_01');
      expect(response.data.snapshot.cardState.hands.black).toEqual(['hard_01']);
    } finally {
      await closeServer(server);
    }
  });

  test('auto_turn canonically cancels a target selection when no target remains', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const blackSeatToken = created.data.seatToken;

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        const snapshot = room.snapshot;
        snapshot.gameState.board = createEmptyBoard();
        snapshot.gameState.currentPlayer = 1;
        snapshot.gameState.consecutivePasses = 0;
        snapshot.gameState.resultShown = false;
        snapshot.cardState.turnIndex = 23;
        snapshot.cardState.lastTurnStartedFor = 'black';
        snapshot.cardState.hands.black = [];
        snapshot.cardState.discard = ['destroy_01'];
        snapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
        snapshot.cardState.cardUseCountByPlayer.black = 1;
        snapshot.cardState.pendingEffectByPlayer.black = {
          type: 'DESTROY_ONE_STONE',
          stage: 'selectTarget',
          cardId: 'destroy_01',
          pendingEffectId: 'pending_auto_cancel_23_1'
        };
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: blackSeatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_auto_cancel_empty_target_1',
        actionType: 'auto_turn',
        actor: 'black',
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

      expect(response.status).toBe(200);
      expect(response.data).toEqual(expect.objectContaining({
        ok: true,
        publishMeta: expect.objectContaining({
          kind: 'accepted',
          operationId: 'op_auto_cancel_empty_target_1',
          actionType: 'auto_turn'
        })
      }));
      expect(response.data.snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(response.data.snapshot.cardState.cardUseCountByPlayer.black).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  test('auto_turn is rejected when room AUTO is disabled and after the game is over', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const buildAutoBody = (operationId: string) => ({
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId,
        actionType: 'auto_turn',
        actor: 'black',
        action: {
          type: 'auto_turn',
          preferredActionType: 'place',
          preferredAction: { type: 'place', row: 2, col: 3 }
        }
      });

      const disabled = await requestJson(
        port,
        'POST',
        '/api/match/publish',
        buildAutoBody('op_auto_disabled_1')
      );
      expect(disabled.status).toBe(409);
      expect(disabled.data.rejectedReason).toBe('AUTO_COMMAND_DISABLED');

      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        room.snapshot.gameState.consecutivePasses = 2;
      })).toBe(true);
      const terminal = await requestJson(
        port,
        'POST',
        '/api/match/publish',
        buildAutoBody('op_auto_terminal_1')
      );
      expect(terminal.status).toBe(409);
      expect(terminal.data.rejectedReason).toBe('GAME_ALREADY_OVER');
      expect(terminal.data.stateVersion).toBe(created.data.stateVersion);
    } finally {
      await closeServer(server);
    }
  });

  test('regular commands are rejected after the game is over', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.snapshot.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(1));
        room.snapshot.gameState.currentPlayer = 1;
        room.snapshot.gameState.consecutivePasses = 2;
        room.snapshot.cardState.turnIndex = 62;
        room.snapshot.cardState.hands.black = [];
        room.snapshot.cardState._handCopyIdsByPlayer.black = [];
        room.snapshot.cardState.pendingEffectByPlayer.black = null;
      })).toBe(true);

      const response = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_terminal_pass_rejected_1',
        actionType: 'pass',
        actor: 'black',
        action: {
          type: 'pass',
          playerKey: 'black',
          turnIndex: 62,
          autoNoActionPass: true
        }
      });

      expect(response.status).toBe(409);
      expect(response.data.rejectedReason).toBe('GAME_ALREADY_OVER');
      expect(response.data.stateVersion).toBe(created.data.stateVersion);
    } finally {
      await closeServer(server);
    }
  });

  test('auto_turn canonical pass keeps auto-pass notice on idempotent replay', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      expect(patchRoomSnapshotForTests(roomId, (room) => {
        room.networkAutoEnabled = true;
        room.snapshot.gameState.board = Array.from({ length: 8 }, () => Array(8).fill(1));
        room.snapshot.gameState.currentPlayer = 1;
        room.snapshot.gameState.consecutivePasses = 0;
        room.snapshot.cardState.hands.black = [];
        room.snapshot.cardState._handCopyIdsByPlayer.black = [];
        room.snapshot.cardState.pendingEffectByPlayer.black = null;
      })).toBe(true);

      const publishBody = {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_auto_pass_replay_2',
        actionType: 'auto_turn',
        actor: 'black',
        action: {
          type: 'auto_turn',
          preferredActionType: 'pass',
          preferredAction: {
            type: 'pass',
            playerKey: 'black',
            autoNoActionPass: true
          }
        }
      };

      const first = await requestJson(port, 'POST', '/api/match/publish', publishBody);
      const replay = await requestJson(port, 'POST', '/api/match/publish', publishBody);

      expect(first.status).toBe(200);
      expect(first.data.autoPassNotice).toEqual({
        playerKey: 'black',
        reason: 'no_legal_moves_or_usable_cards'
      });
      expect(replay.status).toBe(200);
      expect(replay.data).toEqual(expect.objectContaining({
        ok: true,
        idempotentReplay: true,
        autoPassNotice: {
          playerKey: 'black',
          reason: 'no_legal_moves_or_usable_cards'
        }
      }));
    } finally {
      await closeServer(server);
    }
  });
});
