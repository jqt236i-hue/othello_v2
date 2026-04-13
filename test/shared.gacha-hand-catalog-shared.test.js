const GachaHandCatalogShared = require('../shared/gacha-hand-catalog-shared.js');

describe('gacha hand catalog shared helper', () => {
  test('normalizes legacy renamed hand ids to canonical ids', () => {
    expect(GachaHandCatalogShared.normalizeCatalogItemId('gacha__n__hand')).toBe('gacha__n__人の手');
    expect(GachaHandCatalogShared.normalizeCatalogItemId('gacha__n__hand-swap')).toBe('gacha__n__陽気な手');
    expect(GachaHandCatalogShared.normalizeCatalogItemId('gacha__n__hand.png')).toBe('gacha__n__人の手');
  });

  test('builds catalog items from asset manifest gacha paths only', () => {
    const catalog = GachaHandCatalogShared.buildCatalogFromAssetManifest({
      generatedAt: '2026-04-12T00:00:00.000Z',
      files: [
        { path: 'assets/images/other/観測石.png' },
        { path: 'assets/images/Gacha/N/小鬼の手.png' },
        { path: 'assets/images/Gacha/UR/天空の手.png' },
        { path: 'assets/images/Gacha/BAD/無効.png' },
        { path: 'assets/images/Gacha/R/not-image.txt' }
      ]
    });

    expect(catalog.sourceDir).toBe('assets/images/Gacha');
    expect(catalog.items).toEqual([
      {
        id: 'gacha__ur__天空の手',
        label: '天空の手',
        note: 'レアリティ UR',
        rarity: 'UR',
        imagePath: 'assets/images/Gacha/UR/天空の手.png'
      },
      {
        id: 'gacha__n__小鬼の手',
        label: '小鬼の手',
        note: 'レアリティ N',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/小鬼の手.png'
      }
    ]);
  });
});
