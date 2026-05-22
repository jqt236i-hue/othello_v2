import type {
  MatchAuthorityBufferedSseEventRecord,
  MatchAuthorityBufferedSseReplayEvent,
  MatchAuthorityPublicSnapshot,
  MatchAuthorityPublicApi,
  MatchAuthorityPublishMeta,
  MatchAuthorityPublishResponsePayload,
  MatchAuthorityRoomPayload,
  MatchAuthorityRoomState,
  MatchAuthoritySeatLeaveResult
} from '../utils/match-authority-types';

const MatchAuthority: MatchAuthorityPublicApi = require('../utils/match-authority');

describe('match-authority public contract types', () => {
  test('publish response exposes typed authority metadata', () => {
    const payload: MatchAuthorityPublishResponsePayload = MatchAuthority.buildPublishResponsePayload({
      ok: false,
      roomId: 'abc',
      stateVersion: 7,
      rejectedReason: 'VERSION_MISMATCH',
      publishMeta: {
        kind: 'action',
        operationId: 'op-1',
        actionType: 'place',
        receivedBaseVersion: 6,
        authoritativeStateVersion: 7,
        rejectedReason: 'VERSION_MISMATCH'
      }
    });

    const meta: MatchAuthorityPublishMeta | undefined = payload.publishMeta;
    expect(payload.ok).toBe(false);
    expect(payload.roomId).toBe('ABC');
    expect(payload.stateVersion).toBe(7);
    expect(meta && meta.operationId).toBe('op-1');
    expect(meta && meta.authoritativeStateVersion).toBe(7);
  });

  test('SSE buffer replay exposes typed event records', () => {
    let buffer: MatchAuthorityBufferedSseEventRecord[] = [];
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_1_1',
      eventName: 'snapshot',
      payloadByViewer: {
        black: { visible: 'black' },
        white: { visible: 'white' }
      }
    });
    buffer = MatchAuthority.appendBufferedSseEvent(buffer, {
      eventId: 'ROOM_1_2',
      eventName: 'snapshot',
      payload: { visible: 'both' }
    });

    const replay: MatchAuthorityBufferedSseReplayEvent[] | null =
      MatchAuthority.getBufferedSseReplayEvents(buffer, 'ROOM_1_1', 'white');

    expect(replay).toEqual([
      {
        eventId: 'ROOM_1_2',
        eventName: 'snapshot',
        payload: { visible: 'both' }
      }
    ]);
  });

  test('room and snapshot helpers expose typed boundary payloads', () => {
    const room: MatchAuthorityRoomState = {
      roomId: 'abc',
      stateVersion: 3,
      updatedAt: 123,
      seats: { black: true, white: false },
      seatNames: { black: '先手', white: '' },
      seatHandSkins: { black: 'classic', white: '' },
      seatTokens: { black: 'token-black', white: 'token-white' },
      snapshot: {
        gameState: { currentPlayer: 'black' },
        cardState: { hands: { black: [], white: [] } }
      }
    };

    const roomPayload: MatchAuthorityRoomPayload =
      MatchAuthority.buildRoomPayloadFromRoom(room, { ok: true });
    const snapshotPayload: MatchAuthorityRoomPayload =
      MatchAuthority.buildSnapshotPayloadFromRoom(room, {
        snapshot: MatchAuthority.buildPublicSnapshot(room, 'black'),
        operationId: 'op-2',
        actionType: 'place'
      });
    const publishPayload: MatchAuthorityPublishResponsePayload =
      MatchAuthority.buildPublishPayloadFromRoom(room, {
        ok: true,
        snapshot: snapshotPayload.snapshot,
        publishMeta: { operationId: 'op-2', kind: 'action' }
      });
    const projected: MatchAuthorityPublicSnapshot =
      MatchAuthority.projectSnapshotForViewer(room.snapshot, 'white', { stateVersion: 3 });
    const joined = MatchAuthority.resolveSeatForJoin(room, 'white', '');
    const leaveResult: MatchAuthoritySeatLeaveResult | null =
      MatchAuthority.applySeatLeaveToRoom(room, 'black', {
        now: 456,
        makeSeatToken: () => 'next-token'
      });

    expect(roomPayload.roomId).toBe('ABC');
    expect(snapshotPayload.operationId).toBe('op-2');
    expect(publishPayload.publishMeta && publishPayload.publishMeta.operationId).toBe('op-2');
    expect(projected.stateVersion).toBe(3);
    expect(joined).toBe('white');
    expect(leaveResult && leaveResult.seatToken).toBe('next-token');
  });
});
