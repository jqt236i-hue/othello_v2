import * as adapter from '../game/turn/pipeline_ui_adapter.js';

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

  test('separate TIME_BOMB actions do not merge into one phase', () => {
    const pres = [
      {
        type: 'DESTROY',
        row: 2,
        col: 2,
        stoneId: 's1',
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        actionId: 'turn-7:bomb-A',
        effectBlockId: 'turn-7:bomb-A:explode'
      },
      {
        type: 'DESTROY',
        row: 2,
        col: 3,
        stoneId: 's2',
        ownerBefore: 'white',
        cause: 'TIME_BOMB',
        actionId: 'turn-7:bomb-A',
        effectBlockId: 'turn-7:bomb-A:explode'
      },
      {
        type: 'DESTROY',
        row: 5,
        col: 5,
        stoneId: 's3',
        ownerBefore: 'black',
        cause: 'TIME_BOMB',
        actionId: 'turn-7:bomb-B',
        effectBlockId: 'turn-7:bomb-B:explode'
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(3);
    expect(out[0].phase).toBe(out[1].phase);
    expect(out[2].phase).toBeGreaterThan(out[1].phase);
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

  test('BOARD_SHRINK_WILL destroys and frame holes stay in one shrink phase', () => {
    const pres = [
      { type: 'DESTROY', row: 0, col: 7, stoneId: 's1', ownerBefore: 'white', cause: 'BOARD_SHRINK_WILL', reason: 'board_shrink_cell_destroy' },
      { type: 'STATUS_APPLIED', row: 0, col: 7, meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', owner: 'black' } },
      { type: 'DESTROY', row: 7, col: 0, stoneId: 's2', ownerBefore: 'black', cause: 'BOARD_SHRINK_WILL', reason: 'board_shrink_cell_destroy' },
      { type: 'STATUS_APPLIED', row: 7, col: 0, meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', owner: 'black' } },
      { type: 'STATUS_APPLIED', row: 7, col: 7, meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', owner: 'black' } }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const shrinkEvents = out.filter((e) => e.type === 'destroy' || e.type === 'status_applied');
    expect(shrinkEvents).toHaveLength(5);
    expect(new Set(shrinkEvents.map((e) => e.phase)).size).toBe(1);
  });

  test('BOARD_SHRINK_GOD line destroys and frame holes stay in one shrink phase', () => {
    const pres = [
      { type: 'DESTROY', row: 0, col: 0, stoneId: 's1', ownerBefore: 'white', cause: 'BOARD_SHRINK_GOD', reason: 'board_shrink_god_cell_destroy' },
      { type: 'STATUS_APPLIED', row: 0, col: 0, meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', owner: 'black' } },
      { type: 'DESTROY', row: 0, col: 1, stoneId: 's2', ownerBefore: 'black', cause: 'BOARD_SHRINK_GOD', reason: 'board_shrink_god_cell_destroy' },
      { type: 'STATUS_APPLIED', row: 0, col: 1, meta: { special: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', owner: 'black' } },
      { type: 'DESTROY', row: 0, col: 2, stoneId: 's3', ownerBefore: 'white', cause: 'BOARD_SHRINK_GOD', reason: 'board_shrink_god_cell_destroy' }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    const shrinkEvents = out.filter((e) => e.type === 'destroy' || e.type === 'status_applied');
    expect(shrinkEvents).toHaveLength(5);
    expect(new Set(shrinkEvents.map((e) => e.phase)).size).toBe(1);
  });

  test.each([
    ['SUPER_BUOYANCY_WILL', 'super_buoyancy_collision', 'super_buoyancy_move'],
    ['SUPER_ATTRACTION_WILL', 'super_attraction_collision', 'super_attraction_move']
  ])('%s collision destroys and move share one phase', (cause, destroyReason, moveReason) => {
    const pres = [
      {
        type: 'DESTROY',
        row: 3,
        col: 4,
        stoneId: 's1',
        ownerBefore: 'white',
        cause,
        reason: destroyReason,
        meta: { collisionProgress: 0.25 }
      },
      {
        type: 'DESTROY',
        row: 2,
        col: 4,
        stoneId: 's2',
        ownerBefore: 'black',
        cause,
        reason: destroyReason,
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
        cause,
        reason: moveReason
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

  test('CHANGE meta is preserved on flip targets for ghost-block playback', () => {
    const pres = [
      {
        type: 'CHANGE',
        row: 2,
        col: 3,
        stoneId: 's1',
        ownerBefore: 'black',
        ownerAfter: 'white',
        cause: 'SYSTEM',
        reason: 'standard_flip',
        meta: { blockedByGhost: true, special: 'GHOST', timer: 5, owner: 'black' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('flip');
    expect(out[0].targets[0].meta).toEqual(expect.objectContaining({
      blockedByGhost: true,
      special: 'GHOST',
      timer: 5
    }));
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
