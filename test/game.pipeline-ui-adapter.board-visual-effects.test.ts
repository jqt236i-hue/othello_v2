import * as adapter from '../game/turn/pipeline_ui_adapter.js';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

describe('pipeline_ui_adapter board visual effect mapping', () => {
  test('maps standalone board effects losslessly into backend event types', () => {
    const meta = { source: 'network_timeline', visualSeq: 12 };
    const out = adapter.mapToPlaybackEvents([
      {
        type: 'CROSSFADE_STONE',
        phase: 7,
        row: 2,
        col: 5,
        effectKey: 'regenStone',
        owner: 'black',
        newColor: 1,
        durationMs: 600,
        autoFadeOut: true,
        fadeWholeStone: true,
        meta
      },
      {
        type: 'PROTECTION_EXPIRE',
        row: 3,
        col: 4,
        effectKey: 'protectionExpire',
        durationMs: 600,
        meta
      }
    ], { markers: [] }, { board: createBoard() });

    expect(out).toEqual([
      expect.objectContaining({
        type: 'crossfade_stone',
        phase: 7,
        row: 2,
        col: 5,
        effectKey: 'regenStone',
        owner: 'black',
        newColor: 1,
        durationMs: 600,
        autoFadeOut: true,
        fadeWholeStone: true,
        meta
      }),
      expect.objectContaining({
        type: 'protection_expire',
        row: 3,
        col: 4,
        effectKey: 'protectionExpire',
        durationMs: 600,
        meta
      })
    ]);
  });

  test('preserves raw CHANGE → CROSSFADE_STONE → PROTECTION_EXPIRE order', () => {
    const out = adapter.mapToPlaybackEvents([
      { type: 'CHANGE', row: 1, col: 1, ownerBefore: 'white', ownerAfter: 'black' },
      { type: 'CROSSFADE_STONE', row: 1, col: 1, effectKey: 'regenStone' },
      { type: 'PROTECTION_EXPIRE', row: 4, col: 6, effectKey: 'protectionExpire' }
    ], { markers: [] }, { board: createBoard() });

    expect(out.map((event) => event.type)).toEqual([
      'flip',
      'crossfade_stone',
      'protection_expire'
    ]);
  });
});
