import * as adapter from '../game/turn/pipeline_ui_adapter.js';

describe('pipeline_ui_adapter move mapping', () => {
  test('maps MOVE presentation event using col keys for from/to', () => {
    const pres = [{ type: 'MOVE', prevRow: 2, prevCol: 3, row: 4, col: 5, stoneId: 's10' }];
    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 2, col: 3 },
      to: { r: 4, col: 5 },
      stoneId: 's10'
    });
    expect(typeof out[0].targets[0].from.col).toBe('number');
    expect(typeof out[0].targets[0].to.col).toBe('number');
  });

  test('maps CLONE_WILL SPAWN into clone move event from source cell', () => {
    const pres = [{
      type: 'SPAWN',
      row: 4,
      col: 4,
      stoneId: 's99',
      ownerAfter: 'black',
      cause: 'CLONE_WILL',
      reason: 'clone_spawn',
      meta: { fromRow: 3, fromCol: 3, cloneVisual: true }
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 3, col: 3 },
      to: { r: 4, col: 4 },
      stoneId: 's99',
      clone: true
    });
  });

  test('maps PROLIFERATION_WILL SPAWN into clone-like move event from proliferation origin', () => {
    const pres = [{
      type: 'SPAWN',
      row: 2,
      col: 2,
      stoneId: 's209',
      ownerAfter: 'white',
      cause: 'PROLIFERATION_WILL',
      reason: 'proliferation_spawn',
      meta: {
        fromRow: 3,
        fromCol: 3,
        cloneVisual: true,
        proliferationOriginRow: 3,
        proliferationOriginCol: 3
      }
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 3, col: 3 },
      to: { r: 2, col: 2 },
      stoneId: 's209',
      clone: true,
      cause: 'PROLIFERATION_WILL',
      reason: 'proliferation_spawn'
    });
  });

  test('maps distant PROLIFERATION_WILL SPAWN into clone-like move event from proliferation origin', () => {
    const pres = [{
      type: 'SPAWN',
      row: 1,
      col: 6,
      stoneId: 's210',
      ownerAfter: 'white',
      cause: 'PROLIFERATION_WILL',
      reason: 'proliferation_spawn',
      meta: {
        fromRow: 3,
        fromCol: 3,
        cloneVisual: true,
        proliferationOriginRow: 3,
        proliferationOriginCol: 3
      }
    }];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      from: { r: 3, col: 3 },
      to: { r: 1, col: 6 },
      stoneId: 's210',
      clone: true,
      cause: 'PROLIFERATION_WILL',
      reason: 'proliferation_spawn'
    });
  });

  test.each([
    ['GLUTTONOUS_WILL', 'gluttonous_eat', 'gluttonous_eat_overlap_return'],
    ['WILL_HUNTER_KING', 'will_hunter_king_slash', 'will_hunter_king_slash_overlap_return']
  ])(
    'keeps %s proliferation overlap-return on the destroy phase and sends spawn to the next phase',
    (triggerCause, triggerReason, overlapReason) => {
      const pres = [
        {
          type: 'DESTROY',
          row: 4,
          col: 4,
          stoneId: 's-target',
          ownerBefore: 'white',
          cause: triggerCause,
          reason: triggerReason,
          meta: {
            proliferated: true,
            special: 'PROLIFERATION'
          }
        },
        {
          type: 'SPAWN',
          row: 4,
          col: 5,
          stoneId: 's-child',
          ownerAfter: 'white',
          cause: 'PROLIFERATION_WILL',
          reason: 'proliferation_spawn',
          meta: {
            fromRow: 4,
            fromCol: 4,
            cloneVisual: true,
            sourceRow: 4,
            sourceCol: 3,
            proliferationOriginRow: 4,
            proliferationOriginCol: 4,
            proliferationTriggeredBy: triggerCause,
            proliferationTriggerReason: triggerReason,
            timer: 4,
            owner: 'black',
            projectileOwner: 'black',
            inheritedTimer: 2,
            inheritedOwner: 'white',
            flipEvadeRemaining: 1,
            inheritedFlipEvadeRemaining: 3,
            destroyEvadeRemaining: 2
          }
        }
      ];

      const out = adapter.mapToPlaybackEvents(
        pres,
        { markers: [] },
        { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
      );

      expect(out).toHaveLength(3);
      const destroy = out.find((ev) => ev && ev.type === 'destroy');
      const overlap = out.find((ev) => ev && ev.type === 'move' && ev.targets && ev.targets[0] && ev.targets[0].reason === overlapReason);
      const spawnMove = out.find((ev) => ev && ev.type === 'move' && ev.targets && ev.targets[0] && ev.targets[0].reason === 'proliferation_spawn');

      expect(destroy).toBeTruthy();
      expect(overlap).toBeTruthy();
      expect(spawnMove).toBeTruthy();
      expect(destroy.phase).toBe(overlap.phase);
      expect(spawnMove.phase).toBeGreaterThan(overlap.phase);
      expect(out.indexOf(destroy)).toBeLessThan(out.indexOf(overlap));
      expect(out.indexOf(overlap)).toBeLessThan(out.indexOf(spawnMove));
      expect(overlap.targets[0].after).toEqual(expect.objectContaining({
        color: 1,
        special: triggerCause === 'GLUTTONOUS_WILL' ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
        timer: 4,
        owner: 'black',
        inheritedTimer: 2,
        inheritedOwner: 'white',
        flipEvadeRemaining: 1,
        inheritedFlipEvadeRemaining: 3,
        destroyEvadeRemaining: 2
      }));
    }
  );

  test.each([
    ['GLUTTONOUS_WILL', 'gluttonous_eat', 'gluttonous_eat_overlap_return'],
    ['WILL_HUNTER_KING', 'will_hunter_king_slash', 'will_hunter_king_slash_overlap_return']
  ])(
    'keeps %s ghost-block overlap-return on the destroy phase',
    (triggerCause, triggerReason, overlapReason) => {
      const pres = [{
        type: 'DESTROY',
        row: 4,
        col: 4,
        stoneId: 's-ghost',
        ownerBefore: 'white',
        cause: triggerCause,
        reason: triggerReason,
        meta: {
          blockedByGhost: true,
          special: 'GHOST',
          timer: 5,
          owner: 'white',
          sourceRow: 4,
          sourceCol: 3,
          projectileOwner: 'black',
          projectileStone: triggerCause === 'GLUTTONOUS_WILL' ? 'gluttonous' : 'will_hunter_king'
        }
      }];

      const out = adapter.mapToPlaybackEvents(
        pres,
        { markers: [] },
        { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
      );

      expect(out).toHaveLength(2);
      const destroy = out.find((ev) => ev && ev.type === 'destroy');
      const overlap = out.find((ev) => ev && ev.type === 'move' && ev.targets && ev.targets[0] && ev.targets[0].reason === overlapReason);

      expect(destroy).toBeTruthy();
      expect(overlap).toBeTruthy();
      expect(destroy.phase).toBe(overlap.phase);
      expect(out.indexOf(destroy)).toBeLessThan(out.indexOf(overlap));
      expect(overlap.targets[0].after).toEqual(expect.objectContaining({
        color: 1,
        special: triggerCause === 'GLUTTONOUS_WILL' ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
        timer: null,
        owner: 'black',
        inheritedTimer: null,
        inheritedOwner: null,
        flipEvadeRemaining: null,
        inheritedFlipEvadeRemaining: null,
        destroyEvadeRemaining: null
      }));
    }
  );
});
