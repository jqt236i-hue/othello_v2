const SpecialCardRegistry = require('../shared/special-card-registry');

describe('SpecialCardRegistry', () => {
  test('finds presentation by marker type', () => {
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('OBSERVER_WILL')).toEqual(expect.objectContaining({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者'
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('THEORY_INCARNATION')).toEqual(expect.objectContaining({
      cardId: 'theory_incarnation_01',
      markerType: 'THEORY_INCARNATION',
      displayName: '理論の化身'
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('GHOST')).toBeNull();
  });
});
