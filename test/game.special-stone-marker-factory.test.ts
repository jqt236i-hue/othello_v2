import * as SpecialStoneMarkerFactory from '../game/logic/card-resolution/special-stone-marker-factory';

describe('special stone marker factory', () => {
  test('builds WILL_HUNTER_KING marker data with visible evasion counters', () => {
    const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType('WILL_HUNTER_KING', {
      constants: { WILL_HUNTER_KING_TURNS: 8 },
      SpecialStoneRegistry: {
        getSpecialStoneInfo: (type: string) => type === 'WILL_HUNTER_KING' ? {
          tagFlipEvadeDefault: 2,
          tagDestroyEvadeDefault: 2
        } : null
      }
    });

    expect(markerData).toEqual({
      type: 'WILL_HUNTER_KING',
      remainingOwnerTurns: 8,
      flipEvadeRemaining: 2,
      destroyEvadeRemaining: 2
    });
  });

  test('builds owner-sensitive WORK marker data', () => {
    const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType('WORK_WILL', {
      ownerKey: 'white'
    });

    expect(markerData).toEqual(expect.objectContaining({
      type: 'WORK',
      ownerColor: 'white',
      workStage: 0
    }));
  });

  test('does not build markers for non-spawnable instant or trap effects', () => {
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('INSTANT_HYPERACTIVE_WILL')).toBeNull();
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('TRAP_WILL')).toBeNull();
  });
});
