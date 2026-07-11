const Markers = require('../game/logic/cards/markers.js');

describe('marker context performance contract', () => {
  test('visits each canonical marker exactly once and preserves source order and identity', () => {
    const markers = Array.from({ length: 20 }, (_, index) => ({
      id: `marker-${index}`,
      kind: 'specialStone',
      row: Math.floor(index / 8),
      col: index % 8,
      owner: index % 2 === 0 ? 'black' : 'white',
      data: {
        type: index % 5 === 0 ? 'FREEZE' : (index % 3 === 0 ? 'TIME_BOMB' : 'PROTECTED'),
        ...(index % 3 === 0 ? { category: 'bomb', remainingTurns: 2 } : {})
      }
    }));
    const visited: any[] = [];

    const context = Markers.createMarkerContextIndex({ markers }, {
      onMarkerVisited: (marker, index) => visited.push([marker, index])
    });

    expect(context.scanCount).toBe(20);
    expect(visited).toHaveLength(20);
    expect(visited.map(([, index]) => index)).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(context.specialMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(context.bombMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(context.blockingMarkers.every((marker) => markers.includes(marker))).toBe(true);
    expect(markers.map((marker) => marker.id)).toEqual(Array.from({ length: 20 }, (_, index) => `marker-${index}`));
  });
});
