const ManifestStoneRegistry = require('../shared/manifest-stone-registry');
const SpecialStoneRegistry = require('../shared/special-stone-registry');

describe('ManifestStoneRegistry', () => {
  test('classifies the three special-card stones as manifestation stones', () => {
    expect(ManifestStoneRegistry.MANIFEST_STONE_KIND).toBe('manifestStone');
    expect(ManifestStoneRegistry.isManifestStoneType('THEORY_INCARNATION')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('BOARD_EXECUTOR')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('OBSERVER_WILL')).toBe(true);
    expect(ManifestStoneRegistry.getManifestStoneMetadata('OBSERVER_WILL')).toMatchObject({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者',
      displayCategoryName: '顕現石',
      durationOwnerTurns: 5,
      absoluteProtected: true,
      visualEffectKey: 'observerWillStone'
    });
  });

  test('recognizes new and legacy manifestation markers', () => {
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker({
      kind: 'specialStone',
      data: { type: 'DRAGON' }
    })).toBe(false);
  });

  test('ordinary special-stone registry does not classify manifestation types as true special stones', () => {
    expect(SpecialStoneRegistry.classifySpecialStoneRuleClass('OBSERVER_WILL')).toBe('manifest_stone');
    expect(SpecialStoneRegistry.isTrueSpecialStoneMarker({
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL' }
    })).toBe(false);
    expect(SpecialStoneRegistry.isAbsoluteProtectedSpecialType('OBSERVER_WILL')).toBe(true);
  });
});
