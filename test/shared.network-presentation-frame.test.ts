const FrameContract = require('../shared/network-presentation-frame');

describe('network presentation frame contract', () => {
  test('normalizes a valid frame with stable numeric cursors', () => {
    const frame = FrameContract.normalizePresentationFrame({
      roomId: 'ABC',
      visualSeq: '4',
      stateVersionFrom: '3',
      stateVersionTo: 4,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 2, targets: [{ r: 3, col: 4, owner: 'black' }] }],
      effectLogs: ['黒が石を置いた'],
      projectedSnapshotHash: 'hash_4',
      snapshotAfter: { stateVersion: 4, gameState: { board: [[1]] }, cardState: { hands: { black: [], white: [] } } },
      createdAt: 1781800000000
    });

    expect(frame).toMatchObject({
      roomId: 'ABC',
      visualSeq: 4,
      stateVersionFrom: 3,
      stateVersionTo: 4,
      operationId: 'op_1',
      actorSeatKey: 'black',
      actionType: 'place',
      projectedSnapshotHash: 'hash_4',
      snapshotAfter: { stateVersion: 4, gameState: { board: [[1]] }, cardState: { hands: { black: [], white: [] } } }
    });
    expect(frame.playbackEvents).toHaveLength(1);
  });

  test('rejects frames that cannot preserve contiguous visual order', () => {
    expect(() => FrameContract.normalizePresentationFrame({
      roomId: 'ABC',
      visualSeq: 4,
      stateVersionFrom: 4,
      stateVersionTo: 4,
      playbackEvents: []
    })).toThrow(/stateVersionTo/);
  });

  test('dedupes and sorts frames after a cursor', () => {
    const frames = FrameContract.collectFramesAfter([
      { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'a' }] },
      { visualSeq: 2, stateVersionFrom: 1, stateVersionTo: 2, playbackEvents: [{ type: 'b' }] },
      { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, playbackEvents: [{ type: 'duplicate' }] }
    ], 1);

    expect(frames.map((frame: any) => frame.visualSeq)).toEqual([2, 3]);
    expect(frames[1].playbackEvents[0].type).toBe('a');
  });
});
