const Contract = require('../shared/playback-event-contract');

describe('playback event replay contract', () => {
  test('accepts board-target events with explicit target coordinates and owner', () => {
    expect(Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'flip', phase: 2, targets: [{ r: 3, col: 4, owner: 'black' }] },
      { type: 'destroy', phase: 3, targets: [{ r: 2, col: 2, owner: 'white', cause: 'SNIPER_WILL' }] },
      { type: 'move', phase: 4, targets: [{ from: { r: 1, col: 1 }, to: { r: 2, col: 2 }, ownerAfter: 'black' }] }
    ])).toEqual([]);
  });

  test('reports move target events missing from/to coordinates', () => {
    const errors = Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'move', phase: 2, targets: [{ r: 1, col: 2, owner: 'black' }] }
    ]);
    expect(errors).toEqual([expect.objectContaining({ code: 'target_move_coordinates_required' })]);
  });

  test('reports target events missing coordinates', () => {
    const errors = Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'flip', phase: 2, targets: [{ owner: 'black' }] }
    ]);
    expect(errors).toEqual([expect.objectContaining({ code: 'target_coordinates_required' })]);
  });

  test('reports board target events missing owner', () => {
    const errors = Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'spawn', phase: 2, targets: [{ row: 1, col: 2 }] }
    ]);
    expect(errors).toEqual([expect.objectContaining({ code: 'target_owner_required' })]);
  });

  test('accepts ownerless hazard-cell status targets only when they preserve the stone', () => {
    expect(Contract.validatePlaybackEventsForNetworkReplay([{
      type: 'status_applied',
      phase: 2,
      meta: { special: 'SCORCHED_CELL' },
      targets: [{
        r: 3,
        col: 4,
        subjectKind: 'cell_marker',
        stoneMutation: 'preserve'
      }]
    }])).toEqual([]);
  });

  test('accepts ownerless healing-cell status targets only when they preserve the stone', () => {
    expect(Contract.validatePlaybackEventsForNetworkReplay([{
      type: 'status_applied',
      phase: 2,
      meta: { special: 'HEALING_CELL' },
      targets: [{
        r: 3,
        col: 4,
        subjectKind: 'cell_marker',
        stoneMutation: 'preserve'
      }]
    }])).toEqual([]);
  });

  test.each(['status_applied', 'status_removed'])(
    'rejects %s hazard-cell targets without explicit semantic traits',
    (type) => {
      const errors = Contract.validatePlaybackEventsForNetworkReplay([{
        type,
        phase: 2,
        meta: { special: 'SCORCHED_CELL' },
        targets: [{ r: 3, col: 4 }]
      }]);
      expect(errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'target_status_subject_kind_required' }),
        expect.objectContaining({ code: 'target_status_stone_mutation_required' })
      ]));
    }
  );

  test('rejects a hazard cell that claims to replace the stone', () => {
    const errors = Contract.validatePlaybackEventsForNetworkReplay([{
      type: 'status_applied',
      phase: 2,
      meta: { special: 'POISON_CELL' },
      targets: [{
        r: 3,
        col: 4,
        subjectKind: 'cell_marker',
        stoneMutation: 'replace'
      }]
    }]);
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'target_status_cell_marker_must_preserve_stone' })
    ]));
  });
});
