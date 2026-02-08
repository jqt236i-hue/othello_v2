const adapter = require('../game/turn/pipeline_ui_adapter');

describe('pipeline_ui_adapter destroy phase mapping', () => {
  test('TIME_BOMB destroys stay in one phase for simultaneous playback', () => {
    const pres = [
      { type: 'DESTROY', row: 2, col: 2, stoneId: 's1', ownerBefore: 'black', cause: 'TIME_BOMB' },
      { type: 'DESTROY', row: 2, col: 3, stoneId: 's2', ownerBefore: 'white', cause: 'TIME_BOMB' },
      { type: 'DESTROY', row: 3, col: 2, stoneId: 's3', ownerBefore: 'white', cause: 'TIME_BOMB' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(3);
    expect(out.every(e => e.type === 'destroy')).toBe(true);
    expect(new Set(out.map(e => e.phase)).size).toBe(1);
  });

  test('ULTIMATE_DESTROY_GOD destroys stay in one phase for simultaneous playback', () => {
    const pres = [
      { type: 'DESTROY', row: 4, col: 4, stoneId: 's1', ownerBefore: 'black', cause: 'ULTIMATE_DESTROY_GOD' },
      { type: 'DESTROY', row: 4, col: 5, stoneId: 's2', ownerBefore: 'white', cause: 'ULTIMATE_DESTROY_GOD' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(new Set(out.map(e => e.phase)).size).toBe(1);
  });

  test('CROSS_BOMB destroys are batched, and play after flip phase', () => {
    const pres = [
      { type: 'SPAWN', row: 3, col: 3, stoneId: 's1', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place' },
      { type: 'CHANGE', row: 3, col: 4, stoneId: 's2', ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
      { type: 'DESTROY', row: 3, col: 3, stoneId: 's1', ownerBefore: 'black', cause: 'CROSS_BOMB' },
      { type: 'DESTROY', row: 2, col: 3, stoneId: 's3', ownerBefore: 'white', cause: 'CROSS_BOMB' },
      { type: 'DESTROY', row: 4, col: 3, stoneId: 's4', ownerBefore: 'black', cause: 'CROSS_BOMB' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const flip = out.find(e => e.type === 'flip');
    const destroys = out.filter(e => e.type === 'destroy');
    expect(flip).toBeDefined();
    expect(destroys).toHaveLength(3);
    expect(new Set(destroys.map(e => e.phase)).size).toBe(1);
    expect(destroys[0].phase).toBeGreaterThan(flip.phase);
  });

  test('non-area destroys still advance phase (regression guard)', () => {
    const pres = [
      { type: 'SPAWN', row: 1, col: 1, stoneId: 's1', ownerAfter: 'black' },
      { type: 'DESTROY', row: 1, col: 1, stoneId: 's1', ownerBefore: 'black', cause: 'SYSTEM' },
      { type: 'DESTROY', row: 1, col: 2, stoneId: 's2', ownerBefore: 'white', cause: 'SYSTEM' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(3);
    expect(out[1].phase).toBeGreaterThan(out[0].phase);
    expect(out[2].phase).toBeGreaterThan(out[1].phase);
  });
});
