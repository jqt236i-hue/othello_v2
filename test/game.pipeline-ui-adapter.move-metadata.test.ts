import * as adapter from '../game/turn/pipeline_ui_adapter.js';

describe('pipeline_ui_adapter move metadata', () => {
  test('keeps move owner/cause/reason and maps after color', () => {
    const pres = [
      {
        type: 'MOVE',
        prevRow: 1,
        prevCol: 1,
        row: 2,
        col: 2,
        stoneId: 's1',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'HYPERACTIVE',
        reason: 'hyperactive_move',
        meta: { special: 'HYPERACTIVE', owner: 'black' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0]).toMatchObject({
      ownerBefore: 'black',
      ownerAfter: 'black',
      cause: 'HYPERACTIVE',
      reason: 'hyperactive_move'
    });
    expect(out[0].targets[0].after).toMatchObject({
      color: 1,
      special: 'HYPERACTIVE',
      owner: 'black'
    });
  });

  test('keeps expansion-cell special stone color on status_applied', () => {
    const pres = [
      {
        type: 'STATUS_APPLIED',
        row: 2,
        col: 8,
        meta: { special: 'LIGHTNING', timer: 5, owner: 'black' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      {
        markers: [
          {
            id: 1,
            kind: 'specialStone',
            row: 2,
            col: 8,
            owner: 'black',
            data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
          }
        ]
      },
      {
        board: Array(8).fill(null).map(() => Array(8).fill(0)),
        boardExpansion: {
          active: true,
          side: 'right',
          row: 2,
          owner: 1,
          cells: [
            { side: 'right', row: 2, col: 8, owner: 1 }
          ]
        }
      }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('status_applied');
    expect(out[0].targets[0].after).toMatchObject({
      color: 1,
      special: 'LIGHTNING',
      timer: 5,
      owner: 'black'
    });
  });

  test('guard status_applied on an existing special stone keeps the final visible special', () => {
    const pres = [
      {
        type: 'STATUS_APPLIED',
        row: 4,
        col: 4,
        meta: { special: 'GUARD', timer: 10, owner: 'black' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      {
        markers: [
          {
            id: 1,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'WORK', remainingOwnerTurns: 5 }
          },
          {
            id: 2,
            kind: 'specialStone',
            row: 4,
            col: 4,
            owner: 'black',
            data: { type: 'GUARD', remainingOwnerTurns: 10 }
          }
        ]
      },
      {
        board: Array(8).fill(null).map(() => Array(8).fill(0)).map((rowValues, rowIndex) => {
          if (rowIndex === 4) {
            const nextRow = rowValues.slice();
            nextRow[4] = 1;
            return nextRow;
          }
          return rowValues;
        })
      }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('status_applied');
    expect(out[0].targets[0].after).toMatchObject({
      color: 1,
      special: 'WORK',
      timer: 5,
      owner: 'black'
    });
  });

  test('will hunter king slash destroy and move stay in the same phase with evade counters', () => {
    const pres = [
      {
        type: 'DESTROY',
        row: 4,
        col: 5,
        stoneId: 'enemy1',
        ownerBefore: 'white',
        cause: 'WILL_HUNTER_KING',
        reason: 'will_hunter_king_slash',
        meta: {
          sourceRow: 4,
          sourceCol: 3,
          projectileOwner: 'black',
          projectileStone: 'will_hunter_king'
        }
      },
      {
        type: 'MOVE',
        prevRow: 4,
        prevCol: 3,
        row: 4,
        col: 5,
        stoneId: 'king1',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'WILL_HUNTER_KING',
        reason: 'will_hunter_king_slash_move',
        meta: {
          special: 'WILL_HUNTER_KING',
          timer: 7,
          owner: 'black',
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 1
        }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('destroy');
    expect(out[1].type).toBe('move');
    expect(out[0].phase).toBe(out[1].phase);
    expect(out[1].targets[0].after).toMatchObject({
      color: 1,
      special: 'WILL_HUNTER_KING',
      owner: 'black',
      flipEvadeRemaining: 2,
      destroyEvadeRemaining: 1
    });
  });

  test('afterimage destroy-evade move keeps both evade counters in move metadata', () => {
    const pres = [
      {
        type: 'MOVE',
        prevRow: 4,
        prevCol: 4,
        row: 7,
        col: 7,
        stoneId: 'after1',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'DESTROY_EVADE',
        reason: 'destroy_evade_move',
        meta: {
          special: 'AFTERIMAGE_WILL',
          owner: 'black',
          flipEvadeRemaining: 3,
          destroyEvadeRemaining: 2
        }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].targets[0].after).toMatchObject({
      color: 1,
      special: 'AFTERIMAGE_WILL',
      owner: 'black',
      flipEvadeRemaining: 3,
      destroyEvadeRemaining: 2
    });
  });

  test('bundles extreme hyperactive forced swap pair into one playback move with per-target after state', () => {
    const pres = [
      {
        type: 'MOVE',
        actionId: 'extreme-swap-1',
        prevRow: 4,
        prevCol: 4,
        row: 4,
        col: 5,
        stoneId: 'extreme1',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        meta: {
          special: 'EXTREME_HYPERACTIVE',
          timer: 8,
          owner: 'black',
          destroyEvadeRemaining: 5
        }
      },
      {
        type: 'MOVE',
        actionId: 'extreme-swap-1',
        prevRow: 4,
        prevCol: 5,
        row: 4,
        col: 4,
        stoneId: 'target1',
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        meta: {
          owner: 'white'
        }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('move');
    expect(out[0].meta).toMatchObject({
      sequence: 'extreme_hyperactive_forced_swap'
    });
    expect(out[0].targets).toHaveLength(2);
    expect(out[0].targets[0]).toMatchObject({
      extremeForcedSwapRole: 'lead',
      from: { r: 4, col: 4 },
      to: { r: 4, col: 5 },
      ownerBefore: 'black',
      ownerAfter: 'black',
      cause: 'EXTREME_HYPERACTIVE_WILL',
      reason: 'extreme_hyperactive_forced_swap',
      after: {
        color: 1,
        special: 'EXTREME_HYPERACTIVE',
        owner: 'black',
        timer: 8,
        destroyEvadeRemaining: 5
      }
    });
    expect(out[0].targets[1]).toMatchObject({
      extremeForcedSwapRole: 'follow',
      from: { r: 4, col: 5 },
      to: { r: 4, col: 4 },
      ownerBefore: 'white',
      ownerAfter: 'white',
      cause: 'EXTREME_HYPERACTIVE_WILL',
      reason: 'extreme_hyperactive_forced_swap',
      after: {
        color: -1,
        special: null,
        owner: 'white',
        timer: null
      }
    });
  });

  test('bundles extreme hyperactive forced swap across interleaved passive status events', () => {
    const pres = [
      {
        type: 'MOVE',
        actionId: 'extreme-swap-2',
        prevRow: 5,
        prevCol: 5,
        row: 5,
        col: 6,
        stoneId: 'extreme2',
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        meta: {
          special: 'EXTREME_HYPERACTIVE',
          owner: 'black',
          timer: 7
        }
      },
      {
        type: 'STATUS_APPLIED',
        actionId: 'extreme-swap-2',
        row: 5,
        col: 6,
        meta: { special: 'EXTREME_HYPERACTIVE', owner: 'black', timer: 7 }
      },
      {
        type: 'MOVE',
        actionId: 'extreme-swap-2',
        prevRow: 5,
        prevCol: 6,
        row: 5,
        col: 5,
        stoneId: 'target2',
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_hyperactive_forced_swap',
        meta: { owner: 'white' }
      }
    ];

    const out = adapter.mapToPlaybackEvents(
      pres,
      { markers: [] },
      { board: Array(8).fill(null).map(() => Array(8).fill(0)) }
    );

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: 'move',
      meta: { sequence: 'extreme_hyperactive_forced_swap' }
    });
    expect(out[0].targets).toHaveLength(2);
    expect(out[1]).toMatchObject({
      type: 'status_applied',
      targets: [expect.objectContaining({ r: 5, col: 6 })]
    });
  });

  test('極悪躍動魔が動かした石への反転は移動の後の段階で再生する', () => {
    const emptyBoard = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };
    const pres = [
      {
        type: 'MOVE',
        prevRow: 5,
        prevCol: 1,
        row: 4,
        col: 2,
        ownerBefore: 'white',
        ownerAfter: 'white',
        cause: 'EXTREME_HYPERACTIVE_WILL',
        reason: 'extreme_repel_push',
        meta: { sourceRow: 5, sourceCol: 2 }
      },
      { type: 'CHANGE', row: 5, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'EXTREME_HYPERACTIVE_WILL', reason: 'extreme_hyperactive_flip' },
      { type: 'CHANGE', row: 4, col: 2, ownerBefore: 'white', ownerAfter: 'black', cause: 'EXTREME_HYPERACTIVE_WILL', reason: 'extreme_hyperactive_flip' }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, emptyBoard);
    const move = out.find((ev) => ev.type === 'move');
    const flips = out.filter((ev) => ev.type === 'flip');

    expect(flips).toHaveLength(2);
    expect(flips[0].phase).toBeGreaterThan(move.phase);
    expect(flips[1].phase).toBe(flips[0].phase);
  });

  test('移動していないマスへの反転は移動と同じ段階のまま再生する', () => {
    const emptyBoard = { board: Array(8).fill(null).map(() => Array(8).fill(0)) };
    const pres = [
      {
        type: 'MOVE',
        prevRow: 1,
        prevCol: 1,
        row: 2,
        col: 2,
        ownerBefore: 'black',
        ownerAfter: 'black',
        cause: 'HYPERACTIVE',
        reason: 'hyperactive_move',
        meta: { special: 'HYPERACTIVE', owner: 'black' }
      },
      { type: 'CHANGE', row: 3, col: 3, ownerBefore: 'white', ownerAfter: 'black', cause: 'HYPERACTIVE', reason: 'hyperactive_flip' }
    ];

    const out = adapter.mapToPlaybackEvents(pres, { markers: [] }, emptyBoard);
    const move = out.find((ev) => ev.type === 'move');
    const flip = out.find((ev) => ev.type === 'flip');

    expect(flip.phase).toBe(move.phase);
  });
});
