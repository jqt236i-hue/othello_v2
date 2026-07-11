const Markers = require('../game/logic/cards/markers.js');

describe('marker cell index', () => {
  test('keeps marker objects in original order per cell', () => {
    const first = { id: 'a', kind: 'specialStone', row: 2, col: 3, owner: 'black', data: { type: 'GUARD' } };
    const second = { id: 'b', kind: 'bomb', row: 2, col: 3, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } };
    const third = { id: 'c', kind: 'specialStone', row: 4, col: 5, owner: 'black', data: { type: 'FREEZE' } };
    const cardState = { markers: [first, second, third] };

    const index = Markers.createMarkerCellIndex(cardState);
    expect(index.get(2, 3)).toEqual([first, second]);
    expect(index.get(4, 5)).toEqual([third]);
    expect(index.get(9, 9)).toEqual([]);
  });

  test('matches existing find helpers for type and owner filters', () => {
    const guard = { id: 'g', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'GUARD' } };
    const freeze = { id: 'f', kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'FREEZE' } };
    const cardState = { markers: [guard, freeze] };

    const index = Markers.createMarkerCellIndex(cardState);
    expect(index.findSpecial(1, 1, 'GUARD', 'black')).toBe(Markers.findSpecialMarkerAt(cardState, 1, 1, 'GUARD', 'black'));
    expect(index.findSpecial(1, 1, 'FREEZE', 'white')).toBe(Markers.findSpecialMarkerAt(cardState, 1, 1, 'FREEZE', 'white'));
    expect(index.isSpecialStoneAt(1, 1)).toBe(Markers.isSpecialStoneAt(cardState, 1, 1));
  });

  test('does not coerce string coordinates into numeric cell lookups', () => {
    const stringCoordMarker = { id: 's', kind: 'specialStone', row: '1', col: '1', owner: 'black', data: { type: 'GUARD' } };
    const cardState = { markers: [stringCoordMarker] };

    const index = Markers.createMarkerCellIndex(cardState);
    expect(index.get(1, 1)).toEqual([]);
    expect(index.findSpecial(1, 1, 'GUARD', 'black')).toBe(Markers.findSpecialMarkerAt(cardState, 1, 1, 'GUARD', 'black'));
    expect(index.isSpecialStoneAt(1, 1)).toBe(Markers.isSpecialStoneAt(cardState, 1, 1));
  });

  test('builds all marker classifications in one ordered scan without cloning markers', () => {
    const guard = { id: 'guard', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'GUARD' } };
    const freeze = { id: 'freeze', kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'FREEZE' } };
    const bomb = { id: 'bomb', kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb' } };
    const manifest = { id: 'manifest', kind: 'manifestStone', row: 4, col: 4, owner: 'white', data: { type: 'OBSERVER_WILL' } };
    const blockade = { id: 'blockade', kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'BLOCKADE' } };
    const markers = [guard, freeze, bomb, manifest, blockade];
    const visits: any[] = [];

    const context = Markers.createMarkerContextIndex({ markers }, {
      onMarkerVisited: (marker, index) => visits.push({ marker, index })
    });

    expect(context.scanCount).toBe(markers.length);
    expect(visits.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4]);
    expect(visits.map((entry) => entry.marker)).toEqual(markers);
    expect(context.markers).toBe(markers);
    expect(context.specialMarkers).toEqual([guard, freeze, blockade]);
    expect(context.manifestMarkers).toEqual([manifest]);
    expect(context.bombMarkers).toEqual([bomb]);
    expect(context.blockingMarkers).toEqual([freeze, blockade]);
    expect(context.specialMarkers[0]).toBe(guard);
    expect(context.blockingMarkers[0]).toBe(freeze);
    expect(context.cellIndex.get(2, 2)[0]).toBe(freeze);
    expect(context.isFrozenCell(2, 2)).toBe(true);
    expect(context.isFrozenCell(2, 3)).toBe(false);
  });

  test('keeps classification parity for invalid coordinates while cell lookup stays numeric-only', () => {
    const stringFreeze = { id: 'string', kind: 'specialStone', row: '2', col: '2', owner: 'white', data: { type: 'FREEZE' } };
    const missingRow = { id: 'missing', kind: 'specialStone', col: 4, owner: 'black', data: { type: 'GUARD' } };
    const cardState = { markers: [stringFreeze, missingRow] };

    const context = Markers.createMarkerContextIndex(cardState);

    expect(context.specialMarkers).toEqual(Markers.getSpecialMarkers(cardState));
    expect(context.blockingMarkers).toEqual(Markers.getBlockingMarkers(cardState));
    expect(context.cellIndex.get(2, 2)).toEqual([]);
    expect(context.isFrozenCell(2, 2)).toBe(false);
    expect(context.isFrozenCell('2', '2')).toBe(true);
  });
});
