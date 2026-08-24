import type {
  MatchAuthorityAcceptedOperationEntry,
  MatchAuthorityAcceptedOperationHistoryBySeat,
  MatchAuthorityBufferedSseEventRecord,
  MatchAuthorityBufferedSseReplayEvent,
  MatchAuthorityPublicSnapshot,
  MatchAuthorityPublicApi,
  MatchAuthorityPublishMeta,
  MatchAuthorityPublishResponsePayload,
  MatchAuthorityRoomPayload,
  MatchAuthorityRoomState,
  MatchAuthoritySeatLeaveResult,
  MatchAuthoritySeatTokenRejectionReason
} from '../utils/match-authority-types';

const MatchAuthority: MatchAuthorityPublicApi = require('../utils/match-authority');

describe('match-authority public contract types', () => {
  test('exports shared network room constants used by worker and local server', () => {
    expect(MatchAuthority.CHAT_MAX_LENGTH).toBe(20);
    expect(MatchAuthority.CHAT_HISTORY_LIMIT).toBe(40);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_SECONDS).toBe(120);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_MS).toBe(120000);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_MIN_SECONDS).toBe(3);
    expect(MatchAuthority.NETWORK_TURN_LIMIT_MAX_SECONDS).toBe(1800);
    expect(MatchAuthority.normalizeNetworkTurnLimitSeconds(1801)).toBe(1800);
    expect(MatchAuthority.SSE_HEARTBEAT_INTERVAL_MS).toBe(10000);
  });

  test('shared spectator and rematch id factories preserve transport formats', () => {
    const makeSeatToken = jest.fn(() => 'abc.DEF-123_extra');
    const now = jest.fn(() => 1234567890);

    expect(MatchAuthority.makeSpectatorToken(makeSeatToken)).toBe('abc.DEF-123_extra');
    expect(MatchAuthority.makeSpectatorId(makeSeatToken)).toBe('spec_abcDEF-123_extra'.slice(0, 'spec_'.length + 16));
    expect(MatchAuthority.makeRematchRequestId(makeSeatToken, now)).toBe('rematch_1234567890_abcDEF-123_e');
  });

  test('randomFromChars rejects biased bytes before selecting output characters', () => {
    const bytes = [255, 0, 1, 2];
    const fakeCrypto = {
      getRandomValues(array: Uint8Array) {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = bytes.shift() ?? 0;
        }
        return array;
      }
    };

    expect(MatchAuthority.randomFromChars('ABC', 3, fakeCrypto)).toBe('ABC');
  });

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
        payload: {
          visible: 'both',
          sseReplay: {
            replayed: true,
            lastEventId: 'ROOM_1_1',
            index: 1,
            count: 1,
            remaining: 0
          }
        },
        replayIndex: 1,
        replayCount: 1,
        replayRemaining: 0
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

  test('accepted operation helpers expose typed idempotency history', () => {
    const room: MatchAuthorityRoomState = {
      lastAcceptedOperationBySeat: {
        black: { operationId: 'op-1', stateVersion: 1, updatedAt: 100 },
        white: null
      }
    };

    const history: MatchAuthorityAcceptedOperationHistoryBySeat =
      MatchAuthority.ensureAcceptedOperationHistoryBySeat(room);
    const remembered: MatchAuthorityAcceptedOperationEntry | null =
      MatchAuthority.rememberAcceptedOperationBySeat(room, 'black', {
        operationId: 'op-2',
        stateVersion: 2,
        updatedAt: 200
      });
    const found: MatchAuthorityAcceptedOperationEntry | null =
      MatchAuthority.findAcceptedOperationBySeat(room, 'black', 'op-2');
    const resolved: MatchAuthorityAcceptedOperationEntry | null =
      MatchAuthority.resolveAcceptedOperation(room, 'black', 'op-3', {
        operationId: 'op-3',
        stateVersion: 3,
        updatedAt: 300
      });

    expect(history.black[0].operationId).toBe('op-1');
    expect(remembered && remembered.operationId).toBe('op-2');
    expect(found && found.stateVersion).toBe(2);
    expect(resolved && resolved.updatedAt).toBe(300);
  });

  test('seat-token helpers expose typed authentication outcomes', () => {
    const room: MatchAuthorityRoomState = {
      seats: { black: true, white: true },
      seatTokens: { black: 'token-black', white: 'token-white' }
    };
    const seatKey = MatchAuthority.resolveAuthenticatedSeatKey(room, 'black', 'token-black');
    const inferredSeatKey = MatchAuthority.resolveAuthenticatedSeatKey(room, null, 'token-white');
    const missingReason: MatchAuthoritySeatTokenRejectionReason =
      MatchAuthority.classifySeatTokenRejectionReason('');
    const mismatchReason: MatchAuthoritySeatTokenRejectionReason =
      MatchAuthority.classifySeatTokenRejectionReason('wrong-token');

    expect(seatKey).toBe('black');
    expect(inferredSeatKey).toBe('white');
    expect(missingReason).toBe('SEAT_TOKEN_REQUIRED');
    expect(mismatchReason).toBe('SEAT_TOKEN_MISMATCH');
  });
});
