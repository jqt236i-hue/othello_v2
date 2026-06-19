const PlaybackDigest = require('../shared/playback-digest');

describe('playback digest', () => {
  test('keeps digest stable across harmless object property order differences', () => {
    const a = [
      {
        type: 'destroy',
        phase: 2,
        actionId: 'a',
        effectBlockId: 'a:bomb',
        sequenceIndex: 10,
        targets: [{ r: 1, col: 2 }]
      }
    ];
    const b = [
      {
        targets: [{ col: 2, r: 1 }],
        sequenceIndex: 10,
        effectBlockId: 'a:bomb',
        actionId: 'a',
        phase: 2,
        type: 'destroy'
      }
    ];

    expect(PlaybackDigest.computePlaybackDigest(a)).toBe(PlaybackDigest.computePlaybackDigest(b));
  });

  test('changes digest when semantic playback order changes', () => {
    const aThenB = [
      { type: 'destroy', phase: 1, actionId: 'a', row: 1, col: 1 },
      { type: 'destroy', phase: 2, actionId: 'b', row: 2, col: 2 }
    ];
    const bThenA = [
      { type: 'destroy', phase: 2, actionId: 'b', row: 2, col: 2 },
      { type: 'destroy', phase: 1, actionId: 'a', row: 1, col: 1 }
    ];

    expect(PlaybackDigest.computePlaybackDigest(aThenB)).not.toBe(PlaybackDigest.computePlaybackDigest(bThenA));
  });

  test('changes digest when phase boundaries change', () => {
    const sequential = [
      { type: 'destroy', phase: 1, actionId: 'a', row: 1, col: 1 },
      { type: 'destroy', phase: 2, actionId: 'b', row: 2, col: 2 }
    ];
    const merged = [
      { type: 'destroy', phase: 1, actionId: 'a', row: 1, col: 1 },
      { type: 'destroy', phase: 1, actionId: 'b', row: 2, col: 2 }
    ];

    expect(PlaybackDigest.computePlaybackDigest(sequential)).not.toBe(PlaybackDigest.computePlaybackDigest(merged));
  });
});
