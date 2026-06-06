const ManifestStoneRegistry = require('../shared/manifest-stone-registry');

describe('ManifestStoneRegistry', () => {
  test('knows all current manifestation stone types', () => {
    expect(ManifestStoneRegistry.MANIFEST_STONE_TYPES).toEqual([
      'THEORY_INCARNATION',
      'BOARD_EXECUTOR',
      'OBSERVER_WILL'
    ]);
    expect(ManifestStoneRegistry.isManifestStoneType('THEORY_INCARNATION')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('BOARD_EXECUTOR')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('OBSERVER_WILL')).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneType('GHOST')).toBe(false);
  });

  test('classifies manifestStone and legacy specialStone manifestation markers', () => {
    const current = {
      kind: 'manifestStone',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 }
    };
    const legacy = {
      kind: 'specialStone',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 5 }
    };
    const normalSpecial = {
      kind: 'specialStone',
      data: { type: 'GHOST', remainingOwnerTurns: 3 }
    };

    expect(ManifestStoneRegistry.isManifestStoneMarker(current)).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker(legacy)).toBe(true);
    expect(ManifestStoneRegistry.isManifestStoneMarker(normalSpecial)).toBe(false);
  });

  test('active manifestation marker requires positive remainingOwnerTurns when present', () => {
    expect(ManifestStoneRegistry.isActiveManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 1 }
    })).toBe(true);
    expect(ManifestStoneRegistry.isActiveManifestStoneMarker({
      kind: 'manifestStone',
      data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 0 }
    })).toBe(false);
  });
});
