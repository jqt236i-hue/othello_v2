import * as SpecialStoneMarkerFactory from '../game/logic/card-resolution/special-stone-marker-factory';
import * as SpecialStoneRegistry from '../shared/special-stone-registry.js';

describe('special stone marker factory', () => {
  test('special-stone marker factory follows registry card mappings', () => {
    const expectedTypes = [
      'PROTECTED_NEXT_STONE',
      'PERMA_PROTECT_NEXT_STONE',
      'GHOST_WILL',
      'AFTERIMAGE_WILL',
      'REGEN_WILL',
      'BREEDING_WILL',
      'PROLIFERATION_WILL',
      'ULTIMATE_REVERSE_DRAGON',
      'ULTIMATE_DESTROY_GOD',
      'STONE_SALVATION_GOD',
      'SNIPER_WILL',
      'DESTROY_DRAGON_WILL',
      'LIGHTNING_WILL',
      'METEOR_GOD',
      'TIME_STOP_GOD',
      'TIME_STOP_DEITY',
      'WILL_HUNTER_KING',
      'HYPERACTIVE_WILL',
      'EXTREME_HYPERACTIVE_WILL',
      'ESCAPE_WILL',
      'ROBOT_VACUUM_WILL',
      'GLUTTONOUS_WILL',
      'ULTIMATE_HYPERACTIVE_GOD',
      'WORK_WILL',
      'ULTIMATE_WORK_GOD'
    ];

    for (const cardType of expectedTypes) {
      const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType(cardType, {
        constants: {},
        SpecialStoneRegistry
      });
      expect(markerData).toEqual(expect.objectContaining({
        type: SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard(cardType)
      }));
    }
  });

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

  test('builds owner-sensitive ULTIMATE_WORK_GOD marker data at 0%', () => {
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('ULTIMATE_WORK_GOD', {
      ownerKey: 'white',
      SpecialStoneRegistry
    })).toEqual({
      type: 'ULTIMATE_WORK_GOD',
      ownerColor: 'white',
      selfDestructChancePercent: 0
    });
  });

  test('does not build markers for non-spawnable instant or trap effects', () => {
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('INSTANT_HYPERACTIVE_WILL')).toBeNull();
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('TRAP_WILL')).toBeNull();
  });
});
