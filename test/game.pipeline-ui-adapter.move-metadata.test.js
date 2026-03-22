const adapter = require('../game/turn/pipeline_ui_adapter');

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
});
