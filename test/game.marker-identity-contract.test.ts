const CardLogic = require('../game/logic/cards.js');
const MarkersAdapter = require('../game/logic/markers_adapter');

test('CardLogic.addMarker assigns canonical string markerId and createdSeq', () => {
  const cardState: any = { markers: [], _nextMarkerId: 1, _nextCreatedSeq: 10 };

  const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 3, 'black', {
    type: 'TIME_BOMB',
    category: 'bomb'
  });

  expect(marker.markerId).toBe('1');
  expect(typeof marker.markerId).toBe('string');
  expect(marker.id).toBe(1);
  expect(marker.createdSeq).toBe(10);
});

test('MarkersAdapter.ensureMarkers backfills markerId without changing existing createdSeq', () => {
  const cardState: any = {
    markers: [
      {
        id: 7,
        row: 1,
        col: 1,
        kind: 'specialStone',
        owner: 'white',
        createdSeq: 99,
        data: { type: 'DRAGON' }
      }
    ],
    _nextMarkerId: 8
  };

  MarkersAdapter.ensureMarkers(cardState);

  expect(cardState.markers[0].markerId).toBe('7');
  expect(cardState.markers[0].createdSeq).toBe(99);
});

test('legacy marker without id gets deterministic markerId from canonical order', () => {
  const cardState: any = {
    markers: [
      { row: 0, col: 0, kind: 'specialStone', owner: 'black', createdSeq: 2, data: { type: 'SNIPER' } },
      { row: 0, col: 1, kind: 'specialStone', owner: 'white', createdSeq: 3, data: { type: 'TIME_BOMB', category: 'bomb' } }
    ],
    _nextMarkerId: 20
  };

  MarkersAdapter.ensureMarkers(cardState);

  expect(cardState.markers.map((m: any) => m.markerId)).toEqual(['20', '21']);
  expect(cardState._nextMarkerId).toBe(22);
});
