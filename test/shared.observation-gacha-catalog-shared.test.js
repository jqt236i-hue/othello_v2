const ObservationGachaCatalogShared = require('../shared/observation-gacha-catalog-shared.js');

describe('observation gacha catalog shared helper', () => {
  test('builds hand and placement sound items from a mixed gacha manifest', () => {
    const catalog = ObservationGachaCatalogShared.buildCatalogFromAssetManifest({
      generatedAt: '2026-04-12T00:00:00.000Z',
      files: [
        { path: 'assets/images/Gacha/N/小鬼の手.png' },
        { path: 'assets/images/Gacha/N/type-1-standard.mp3' },
        { path: 'assets/images/Gacha/R/not-supported.txt' }
      ]
    });

    expect(catalog.sourceDir).toBe('assets/images/Gacha');
    expect(catalog.items).toEqual([
      expect.objectContaining({
        id: 'gacha__n__小鬼の手',
        kind: 'hand_skin',
        imagePath: 'assets/images/Gacha/N/小鬼の手.png'
      }),
      expect.objectContaining({
        id: 'gacha__n__placement_sound__type-1-standard',
        kind: 'placement_sound',
        assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
        soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
      })
    ]);
  });
});
