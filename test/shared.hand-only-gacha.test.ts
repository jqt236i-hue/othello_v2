const catalog = require('../shared/observation-gacha-catalog-shared.js');
const helpers = require('../shared/gacha-helpers.js');
const access = require('../ui/gacha/catalog-access.js');
const transaction = require('../ui/gacha/gacha-transaction.js');

describe('hand-only gacha', () => {
  const hand = { id: 'hand', kind: 'hand_skin', rarity: 'N' };
  const retired = [
    { id: 'background', kind: 'background_skin', rarity: 'EXR' },
    { id: 'sound', kind: 'placement_sound', rarity: 'N' }
  ];

  test('does not recreate retired rewards from an older asset manifest', () => {
    const result = catalog.buildCatalogFromAssetManifest({ files: [
      'assets/images/Gacha/N/人の手.png',
      'assets/images/Gacha/EXR/background/観測の意志.png',
      'assets/images/Gacha/N/type-1-standard.mp3'
    ] }, {});
    expect(result.items.map((item: any) => item.kind)).toEqual(['hand_skin']);
  });

  test('filters a stale generated catalog and never rolls retired rewards', () => {
    const items = [...retired, hand];
    expect(access.getObservationCatalogItems({ catalog: { items } })).toEqual([hand]);
    for (const random of [0, 0.001, 0.1, 0.5, 0.999999]) {
      expect(helpers.rollObservationGacha(items, { randomFn: () => random }).item).toEqual(hand);
    }
    expect(helpers.rollObservationGacha(retired, {})).toBeNull();
  });

  test('does not charge observation stones for a catalog with no hands', () => {
    const spendObservationStones = jest.fn();
    const result = transaction.commitPullTransaction({}, 10, {
      catalogItems: retired, helpersModule: helpers, storageModule: { spendObservationStones }
    });
    expect(result.code).toBe('catalog-empty');
    expect(spendObservationStones).not.toHaveBeenCalled();
  });
});
