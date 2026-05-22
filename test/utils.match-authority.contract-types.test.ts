import type {
  MatchAuthorityBufferedSseEventRecord,
  MatchAuthorityBufferedSseReplayEvent,
  MatchAuthorityPublicApi,
  MatchAuthorityPublishMeta,
  MatchAuthorityPublishResponsePayload
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
});
