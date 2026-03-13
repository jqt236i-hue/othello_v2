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
    expect(out[0].targets[0].cause).toBe('TIME_BOMB');
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

  test('X_BOMB destroys are batched, and play after flip phase', () => {
    const pres = [
      { type: 'SPAWN', row: 3, col: 3, stoneId: 's1', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_place' },
      { type: 'CHANGE', row: 3, col: 4, stoneId: 's2', ownerBefore: 'white', ownerAfter: 'black', cause: 'SYSTEM', reason: 'standard_flip' },
      { type: 'DESTROY', row: 3, col: 3, stoneId: 's1', ownerBefore: 'black', cause: 'X_BOMB' },
      { type: 'DESTROY', row: 2, col: 2, stoneId: 's3', ownerBefore: 'white', cause: 'X_BOMB' },
      { type: 'DESTROY', row: 4, col: 4, stoneId: 's4', ownerBefore: 'black', cause: 'X_BOMB' }
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

  test('ESCAPE_HYPERACTIVE explosion destroys stay in one phase for simultaneous playback', () => {
    const pres = [
      { type: 'DESTROY', row: 4, col: 4, stoneId: 's1', ownerBefore: 'black', cause: 'ESCAPE_HYPERACTIVE', reason: 'escape_no_candidates_explosion' },
      { type: 'DESTROY', row: 3, col: 4, stoneId: 's2', ownerBefore: 'white', cause: 'ESCAPE_HYPERACTIVE', reason: 'escape_no_candidates_explosion' },
      { type: 'DESTROY', row: 5, col: 4, stoneId: 's3', ownerBefore: 'white', cause: 'ESCAPE_HYPERACTIVE', reason: 'escape_no_candidates_explosion' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(3);
    expect(out.every(e => e.type === 'destroy')).toBe(true);
    expect(new Set(out.map(e => e.phase)).size).toBe(1);
    expect(out[0].targets[0].cause).toBe('ESCAPE_HYPERACTIVE');
  });

  test('SUPER_BUOYANCY_WILL collision destroys and move share one phase', () => {
    const pres = [
      {
        type: 'DESTROY',
        row: 3,
        col: 4,
        stoneId: 's1',
        ownerBefore: 'white',
        cause: 'SUPER_BUOYANCY_WILL',
        reason: 'super_buoyancy_collision',
        meta: { collisionProgress: 0.25 }
      },
      {
        type: 'DESTROY',
        row: 2,
        col: 4,
        stoneId: 's2',
        ownerBefore: 'black',
        cause: 'SUPER_BUOYANCY_WILL',
        reason: 'super_buoyancy_collision',
        meta: { collisionProgress: 0.5 }
      },
      {
        type: 'MOVE',
        prevRow: 4,
        prevCol: 4,
        row: 1,
        col: 4,
        stoneId: 'm1',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'SUPER_BUOYANCY_WILL',
        reason: 'super_buoyancy_move'
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const destroys = out.filter((e) => e.type === 'destroy');
    const move = out.find((e) => e.type === 'move');

    expect(destroys).toHaveLength(2);
    expect(move).toBeDefined();
    expect(destroys[0].phase).toBe(move.phase);
    expect(destroys[1].phase).toBe(move.phase);
    expect(destroys[0].targets[0].meta.collisionProgress).toBe(0.25);
    expect(destroys[1].targets[0].meta.collisionProgress).toBe(0.5);
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
