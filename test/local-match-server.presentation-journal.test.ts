import * as http from 'http';
import * as Core from '../game/logic/core.js';
import {
  createLocalMatchServer,
  patchRoomSnapshotForTests,
  resetRoomsForTests
} from '../scripts/local-match-server.js';

function requestJson(port: number, method: string, path: string, payload?: unknown): Promise<{ status: number; data: any }> {
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
      res.on('end', () => resolve({ status: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(JSON.stringify(payload));
    req.end();
  });
}

function listen(server: ReturnType<typeof createLocalMatchServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function closeServer(server: ReturnType<typeof createLocalMatchServer>): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function pickFirstLegalMove(snapshot: any, player = 1): { row: number; col: number } {
  const legalMoves = Core.getLegalMoves(snapshot.gameState, player);
  if (!Array.isArray(legalMoves) || legalMoves.length === 0) throw new Error('No legal move');
  return legalMoves[0];
}

describe('local match server presentation journal', () => {
  afterEach(() => resetRoomsForTests());

  test('accepted publish can be recovered through presentation journal from visualSeq 0', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'black' });
      const roomId = created.data.roomId;
      const seatToken = created.data.seatToken;
      const move = pickFirstLegalMove(created.data.snapshot);

      const publish = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_local_journal_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: move.row, col: move.col },
        turnIndex: created.data.snapshot.cardState.turnIndex,
        action: {
          type: 'place',
          playerKey: 'black',
          row: move.row,
          col: move.col,
          turnIndex: created.data.snapshot.cardState.turnIndex
        }
      });
      const replay = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken,
        baseVersion: created.data.stateVersion,
        operationId: 'op_local_journal_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: move.row, col: move.col },
        turnIndex: created.data.snapshot.cardState.turnIndex,
        action: {
          type: 'place',
          playerKey: 'black',
          row: move.row,
          col: move.col,
          turnIndex: created.data.snapshot.cardState.turnIndex
        }
      });
      const state = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}`
      );

      const recovery = await requestJson(
        port,
        'GET',
        `/api/match/presentation-journal?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}&afterVisualSeq=0`
      );

      expect(publish.status).toBe(200);
      expect(publish.data.presentationCursor).toMatchObject({ visualSeq: 1, stateVersion: publish.data.stateVersion });
      expect(publish.data.presentationFrames).toHaveLength(1);
      expect(replay.status).toBe(200);
      expect(replay.data.idempotentReplay).toBe(true);
      expect(replay.data.playbackEvents).toEqual(publish.data.playbackEvents);
      expect(replay.data.playbackDigest).toBe(publish.data.playbackDigest);
      expect(replay.data.presentationFrames).toHaveLength(1);
      expect(replay.data.presentationFrames[0].playbackDigest).toBe(publish.data.presentationFrames[0].playbackDigest);
      expect(state.status).toBe(200);
      expect(state.data.presentationFrames).toHaveLength(1);
      expect(state.data.presentationFrames[0].playbackEvents).toEqual(publish.data.playbackEvents);
      expect(recovery.status).toBe(200);
      expect(recovery.data.baseVisualSeq).toBe(0);
      expect(recovery.data.baseSnapshot.stateVersion).toBe(created.data.stateVersion);
      expect(recovery.data.presentationFrames.map((frame: any) => frame.visualSeq)).toEqual([1]);
      expect(recovery.data.presentationFrames[0].snapshotAfter.stateVersion).toBe(publish.data.stateVersion);
      expect(recovery.data.presentationFrames[0].playbackEvents).toEqual(publish.data.playbackEvents);
    } finally {
      await closeServer(server);
    }
  });

  test('timeout pass and the following publish remain consecutive presentation frames', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);

    try {
      const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'black' });
      const joined = await requestJson(port, 'POST', '/api/match/join', {
        roomId: created.data.roomId,
        playerName: 'white'
      });
      expect(created.status).toBe(200);
      expect(joined.status).toBe(200);
      const roomId = created.data.roomId;
      const beforeTimeoutVersion = joined.data.stateVersion;

      expect(patchRoomSnapshotForTests(roomId, (room: any) => {
        room.turnTimer = {
          ...(room.turnTimer || {}),
          active: true,
          turnSeatKey: 'black',
          turnStartedAt: Date.now() - 300000,
          turnDeadlineAt: Date.now() - 1
        };
      })).toBe(true);

      const afterTimeout = await requestJson(
        port,
        'GET',
        `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(created.data.seatToken)}`
      );

      expect(afterTimeout.status).toBe(200);
      expect(afterTimeout.data.stateVersion).toBe(beforeTimeoutVersion + 1);
      expect(afterTimeout.data.presentationCursor).toEqual({
        visualSeq: 1,
        stateVersion: beforeTimeoutVersion + 1
      });
      expect(afterTimeout.data.presentationFrames).toEqual([
        expect.objectContaining({
          visualSeq: 1,
          stateVersionFrom: beforeTimeoutVersion,
          stateVersionTo: beforeTimeoutVersion + 1,
          actorSeatKey: 'black',
          actionType: 'timeout_pass',
          operationId: expect.stringMatching(/^timeout_/),
          snapshotAfter: expect.objectContaining({
            stateVersion: beforeTimeoutVersion + 1
          })
        })
      ]);

      const whiteMove = pickFirstLegalMove(afterTimeout.data.snapshot, -1);
      const whiteTurnIndex = afterTimeout.data.snapshot.cardState.turnIndex;
      const publish = await requestJson(port, 'POST', '/api/match/publish', {
        roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: joined.data.seatToken,
        baseVersion: afterTimeout.data.stateVersion,
        operationId: 'op_after_timeout_white_place',
        actionType: 'place',
        actor: 'white',
        params: { row: whiteMove.row, col: whiteMove.col },
        turnIndex: whiteTurnIndex,
        action: {
          type: 'place',
          playerKey: 'white',
          row: whiteMove.row,
          col: whiteMove.col,
          turnIndex: whiteTurnIndex
        }
      });

      expect(publish.status).toBe(200);
      expect(publish.data.presentationCursor).toEqual({
        visualSeq: 2,
        stateVersion: beforeTimeoutVersion + 2
      });
      expect(publish.data.presentationFrames).toEqual([
        expect.objectContaining({
          visualSeq: 2,
          stateVersionFrom: beforeTimeoutVersion + 1,
          stateVersionTo: beforeTimeoutVersion + 2,
          operationId: 'op_after_timeout_white_place'
        })
      ]);

      const recovery = await requestJson(
        port,
        'GET',
        `/api/match/presentation-journal?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(created.data.seatToken)}&afterVisualSeq=0`
      );

      expect(recovery.status).toBe(200);
      expect(recovery.data.baseSnapshot.stateVersion).toBe(beforeTimeoutVersion);
      expect(recovery.data.presentationFrames).toEqual([
        expect.objectContaining({
          visualSeq: 1,
          stateVersionFrom: beforeTimeoutVersion,
          stateVersionTo: beforeTimeoutVersion + 1,
          actionType: 'timeout_pass'
        }),
        expect.objectContaining({
          visualSeq: 2,
          stateVersionFrom: beforeTimeoutVersion + 1,
          stateVersionTo: beforeTimeoutVersion + 2,
          operationId: 'op_after_timeout_white_place'
        })
      ]);
    } finally {
      await closeServer(server);
    }
  });
});
