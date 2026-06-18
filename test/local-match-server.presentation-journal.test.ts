import * as http from 'http';
import * as Core from '../game/logic/core.js';
import { createLocalMatchServer, resetRoomsForTests } from '../scripts/local-match-server.js';

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

function pickFirstLegalMove(snapshot: any): { row: number; col: number } {
  const legalMoves = Core.getLegalMoves(snapshot.gameState, 1);
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

      const recovery = await requestJson(
        port,
        'GET',
        `/api/match/presentation-journal?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(seatToken)}&afterVisualSeq=0`
      );

      expect(publish.status).toBe(200);
      expect(publish.data.presentationCursor).toMatchObject({ visualSeq: 1, stateVersion: publish.data.stateVersion });
      expect(publish.data.presentationFrames).toHaveLength(1);
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
});
