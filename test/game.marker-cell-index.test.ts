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
});
