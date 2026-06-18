const Contract = require('../shared/playback-event-contract');

describe('playback event replay contract', () => {
  test('accepts board-target events with explicit target coordinates and owner', () => {
    expect(Contract.validatePlaybackEventsForNetworkReplay([
      { type: 'flip', phase: 2, targets: [{ r: 3, col: 4, owner: 'black' }] },
      { type: 'destroy', phase: 3, targets: [{ r: 2, col: 2, owner: 'white', cause: 'SNIPER_WILL' }] }
    ])).toEqual([]);
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
});
