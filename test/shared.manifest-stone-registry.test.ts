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

describe('manifest stone membership is owned by the registry', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../shared/manifest-stone-registry');
  });

  function mockRegistryWithFutureType() {
    jest.resetModules();
    jest.doMock('../shared/manifest-stone-registry', () => {
      const actual = jest.requireActual('../shared/manifest-stone-registry');
      const types = new Set([...actual.MANIFEST_STONE_TYPES, 'FUTURE_MANIFEST']);
      const isManifestStoneType = (raw: unknown) => {
        const type = actual.normalizeManifestStoneType(raw);
        return !!type && types.has(type);
      };
      const isManifestStoneMarker = (marker: any) => !!marker && typeof marker === 'object'
        && isManifestStoneType(marker.data ? marker.data.type : null)
        && (marker.kind === actual.MANIFEST_STONE_KIND || marker.kind === actual.LEGACY_SPECIAL_STONE_KIND);
      return {
        ...actual,
        MANIFEST_STONE_TYPES: Object.freeze(Array.from(types)),
        isManifestStoneType,
        isManifestStoneMarker,
        isActiveManifestStoneMarker: (marker: any) => isManifestStoneMarker(marker)
          && !(Object.prototype.hasOwnProperty.call(marker.data || {}, 'remainingOwnerTurns') && !(Number(marker.data.remainingOwnerTurns) > 0))
      };
    });
  }

  test('a type added to the registry is classified the same way by every game consumer', () => {
    mockRegistryWithFutureType();
    const futureStone = { kind: 'specialStone', row: 2, col: 3, owner: 'black', data: { type: 'FUTURE_MANIFEST', remainingOwnerTurns: 2 } };
    const ordinaryStone = { kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'GLUTTONOUS' } };
    const cardState: any = { markers: [futureStone, ordinaryStone] };

    const CardUtils = require('../game/logic/cards/utils.ts');
    expect(CardUtils.isManifestStoneMarker(futureStone)).toBe(true);
    expect(CardUtils.isManifestStoneMarker(ordinaryStone)).toBe(false);

    const SelectorsCoreUtils = require('../game/logic/cards/selectors-core-utils.ts');
    expect(SelectorsCoreUtils.isPositionSwapProtectedCell(cardState, 2, 3)).toBe(true);

    const CardMarkers = require('../game/logic/cards/markers.ts');
    expect(CardMarkers.getManifestMarkers(cardState)).toEqual([futureStone]);
    expect(CardMarkers.getSpecialMarkers(cardState)).not.toContain(futureStone);
  });

  test('bomb classification still takes precedence over manifest membership', () => {
    mockRegistryWithFutureType();
    const bombLike = { kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'FUTURE_MANIFEST', category: 'bomb' } };
    const CardMarkers = require('../game/logic/cards/markers.ts');
    const futureStone = { kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'FUTURE_MANIFEST' } };
    const index = CardMarkers.createMarkerContextIndex({ markers: [bombLike, futureStone] }, { includeCellIndex: false });
    expect(index.bombMarkers).toEqual([bombLike]);
    expect(index.manifestMarkers).toEqual([futureStone]);
    expect(index.specialMarkers).toEqual([]);
  });
});
