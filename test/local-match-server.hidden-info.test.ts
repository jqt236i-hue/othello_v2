import * as http from 'http';
import * as Core from '../game/logic/core.js';
import MatchAuthority from '../utils/match-authority';
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

async function createStartedRoom(port: number) {
  const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'black' });
  const roomId = created.data.roomId;
  const joined = await requestJson(port, 'POST', '/api/match/join', { roomId, seatKey: 'white', playerName: 'white' });
  const spectate = await requestJson(port, 'POST', '/api/match/spectate', { roomId, spectatorName: 'viewer' });
  const tokens: Record<string, string> = { black: created.data.seatToken, white: joined.data.seatToken };
  const getState = async (seat: string) => (await requestJson(
    port,
    'GET',
    `/api/match/state?roomId=${roomId}&seatKey=${seat}&seatToken=${encodeURIComponent(tokens[seat])}`
  )).data;
  return { roomId, tokens, spectate: spectate.data, getState };
}

async function placeFirstMove(port: number, roomId: string, seat: string, token: string, operationId: string) {
  const sign = seat === 'black' ? 1 : -1;
  const state = (await requestJson(
    port,
    'GET',
    `/api/match/state?roomId=${roomId}&seatKey=${seat}&seatToken=${encodeURIComponent(token)}`
  )).data;
  const move = Core.getLegalMoves(state.snapshot.gameState, sign)[0];
  return requestJson(port, 'POST', '/api/match/publish', {
    roomId,
    seatKey: seat,
    playerKey: seat,
    seatToken: token,
    baseVersion: state.stateVersion,
    operationId,
    actionType: 'place',
    actor: seat,
    params: { row: move.row, col: move.col },
    turnIndex: state.snapshot.cardState.turnIndex,
    action: { type: 'place', playerKey: seat, row: move.row, col: move.col, turnIndex: state.snapshot.cardState.turnIndex }
  });
}

function collectHandAddTargets(events: any[]): any[] {
  return (events || []).filter((event) => event && event.type === 'hand_add').flatMap((event) => event.targets || []);
}

describe('local match server hidden information', () => {
  afterEach(() => resetRoomsForTests());

  test('shuffle seed is not projected to any viewer but stays in canonical state', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const { roomId, tokens, spectate, getState } = await createStartedRoom(port);
      const placed = await placeFirstMove(port, roomId, 'black', tokens.black, 'op_shuffle_place');
      expect(placed.status).toBe(200);

      const blackState = await getState('black');
      const whiteState = await getState('white');
      const frameResponse = await requestJson(
        port,
        'GET',
        `/api/match/presentation-journal?roomId=${roomId}&seatKey=white&seatToken=${encodeURIComponent(tokens.white)}&afterVisualSeq=0`
      );
      const viewerPayloads = [blackState, whiteState, spectate, placed.data, frameResponse.data];
      for (const payload of viewerPayloads) {
        expect(JSON.stringify(payload)).not.toContain('_defaultRandomSource');
        expect(JSON.stringify(payload)).not.toContain('"_seed"');
      }
      expect(frameResponse.data.presentationFrames.length).toBeGreaterThan(0);

      let canonicalSeed: unknown = null;
      patchRoomSnapshotForTests(roomId, (room: any) => {
        canonicalSeed = room.snapshot.cardState._defaultRandomSource;
      });
      expect(canonicalSeed).toBeTruthy();
    } finally {
      await closeServer(server);
    }
  });

  test('card drawn into the opponent hand is hidden from seat viewers but not from the owner or spectators', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const { roomId, tokens, spectate } = await createStartedRoom(port);
      const placed = await placeFirstMove(port, roomId, 'black', tokens.black, 'op_draw_place');
      expect(placed.status).toBe(200);

      let whiteHand: string[] = [];
      patchRoomSnapshotForTests(roomId, (room: any) => {
        whiteHand = room.snapshot.cardState.hands.white.slice();
      });
      expect(whiteHand.length).toBeGreaterThan(0);

      // Black placed, so the draw belongs to white: black must only see a hand token.
      const toBlack = collectHandAddTargets(placed.data.playbackEvents).filter((target) => target.player === 'white');
      expect(toBlack.length).toBeGreaterThan(0);
      for (const target of toBlack) {
        expect(target.cardId).toMatch(/^__hidden_hand__:white:\d+$/);
        expect(target.visualDescriptor).toBeNull();
        expect(target.count).toBe(1);
      }
      expect(JSON.stringify(placed.data.playbackEvents)).not.toContain(whiteHand[whiteHand.length - 1]);
      expect(JSON.stringify(placed.data.presentationFrames)).not.toContain(whiteHand[whiteHand.length - 1]);

      const frames = (viewerKey: string, query: string) => requestJson(
        port,
        'GET',
        `/api/match/presentation-journal?roomId=${roomId}&${query}&afterVisualSeq=0`
      ).then((res) => res.data.presentationFrames);
      const blackFrames = await frames('black', `seatKey=black&seatToken=${encodeURIComponent(tokens.black)}`);
      const whiteFrames = await frames('white', `seatKey=white&seatToken=${encodeURIComponent(tokens.white)}`);
      const spectatorFrames = await frames('spectator', `viewerRole=spectator&spectatorId=${spectate.spectatorId}&spectatorToken=${encodeURIComponent(spectate.spectatorToken)}`);
      const whiteOwnCards = collectHandAddTargets(whiteFrames.flatMap((frame: any) => frame.playbackEvents)).map((t) => t.cardId);
      expect(whiteOwnCards).toContain(whiteHand[whiteHand.length - 1]);
      expect(collectHandAddTargets(spectatorFrames.flatMap((frame: any) => frame.playbackEvents)).map((t) => t.cardId))
        .toContain(whiteHand[whiteHand.length - 1]);
      expect(JSON.stringify(blackFrames)).not.toContain(whiteHand[whiteHand.length - 1]);
      // The publisher response carries the same events/digest as the matching journal frame.
      expect(placed.data.playbackDigest).toBe(placed.data.presentationFrames[0].playbackDigest);
      expect(placed.data.playbackDigest).toBe(blackFrames[0].playbackDigest);
    } finally {
      await closeServer(server);
    }
  });

  test('masking keeps own-seat events and cards the viewer is allowed to inspect', () => {
    const events = [{
      type: 'hand_add',
      targets: [{ player: 'white', cardId: 'secret_01', count: 1, visualDescriptor: { cardId: 'secret_01' } }]
    }, {
      type: 'hand_add',
      targets: [{ player: 'white', cardId: 'revealed_01', count: 1, visualDescriptor: { cardId: 'revealed_01' } }]
    }];
    const blackView = { cardState: { hands: { black: [], white: ['__hidden_hand__:white:0', 'revealed_01'] } } };
    const masked = MatchAuthority.maskPlaybackEventsForSeat(events, 'black', blackView) as any[];
    expect(masked[0].targets[0].cardId).toBe('__hidden_hand__:white:1');
    expect(masked[0].targets[0].visualDescriptor).toBeNull();
    expect(masked[1]).toBe(events[1]);
    expect(MatchAuthority.maskPlaybackEventsForSeat(events, 'white', blackView)).toBe(events);
    expect(MatchAuthority.maskPlaybackEventsForSeat(events, null, blackView)).toBe(events);
    expect(events[0].targets[0].cardId).toBe('secret_01');
  });

  test('reset_game needs the opponent to accept a rematch request recorded by the server', async () => {
    const server = createLocalMatchServer();
    const port = await listen(server);
    try {
      const { roomId, tokens, getState } = await createStartedRoom(port);
      const publishReset = async (seat: string, operationId: string) => {
        const state = await getState(seat);
        return requestJson(port, 'POST', '/api/match/publish', {
          roomId,
          seatKey: seat,
          playerKey: seat,
          seatToken: tokens[seat],
          baseVersion: state.stateVersion,
          operationId,
          actionType: 'reset_game',
          actor: seat,
          action: { type: 'reset_game', playerKey: seat }
        });
      };
      const respond = (seat: string, requestId: string, accepted: boolean) => requestJson(port, 'POST', '/api/match/rematch-response', {
        roomId, seatKey: seat, seatToken: tokens[seat], requestId, accepted
      });

      const placed = await placeFirstMove(port, roomId, 'black', tokens.black, 'op_reset_place');
      expect(placed.status).toBe(200);
      const versionBefore = (await getState('black')).stateVersion;

      const unrequested = await publishReset('black', 'op_reset_none');
      expect(unrequested.status).toBe(409);
      expect(unrequested.data.rejectedReason).toBe('REMATCH_NOT_AGREED');
      expect((await getState('black')).stateVersion).toBe(versionBefore);

      const request = await requestJson(port, 'POST', '/api/match/rematch-request', {
        roomId, seatKey: 'black', seatToken: tokens.black
      });
      expect(request.status).toBe(200);
      expect((await publishReset('black', 'op_reset_pending')).data.rejectedReason).toBe('REMATCH_NOT_AGREED');

      // The requester cannot accept their own request; a decline discards it.
      await respond('black', request.data.requestId, true);
      expect((await publishReset('black', 'op_reset_self')).data.rejectedReason).toBe('REMATCH_NOT_AGREED');
      await respond('white', request.data.requestId, false);
      expect((await publishReset('white', 'op_reset_declined')).data.rejectedReason).toBe('REMATCH_NOT_AGREED');

      const second = await requestJson(port, 'POST', '/api/match/rematch-request', {
        roomId, seatKey: 'black', seatToken: tokens.black
      });
      await respond('white', second.data.requestId, true);
      const reset = await publishReset('white', 'op_reset_agreed');
      expect(reset.status).toBe(200);
      expect(reset.data.ok).toBe(true);
      expect(reset.data.stateVersion).toBe(versionBefore + 1);

      // The agreement is consumed by the reset.
      const again = await publishReset('black', 'op_reset_again');
      expect(again.status).toBe(409);
      expect(again.data.rejectedReason).toBe('REMATCH_NOT_AGREED');
    } finally {
      await closeServer(server);
    }
  });
});
