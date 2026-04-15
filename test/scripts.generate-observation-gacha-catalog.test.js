const path = require('path');

describe('generate observation gacha catalog', () => {
  test('derives rarity and display name from assets/images/Gacha', () => {
    const { generateObservationGachaCatalogs } = require('../scripts/generate-observation-gacha-catalog.js');
    const result = generateObservationGachaCatalogs({
      root: path.resolve(__dirname, '..'),
      write: false
    });

    expect(result.handCatalog.sourceDir).toBe('assets/images/Gacha');
    expect(result.handCatalog.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gacha__n__人の手',
        label: '人の手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/人の手.png'
      }),
      expect.objectContaining({
        id: 'gacha__n__陽気な手',
        label: '陽気な手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/陽気な手.png'
      }),
      expect.objectContaining({
        id: 'gacha__n__小鬼の手',
        label: '小鬼の手',
        rarity: 'N',
        imagePath: 'assets/images/Gacha/N/小鬼の手.png'
      }),
      expect.objectContaining({
        id: 'gacha__sr__虹の手',
        label: '虹の手',
        rarity: 'SR',
        imagePath: 'assets/images/Gacha/SR/虹の手.png'
      })
    ]));

    expect(result.observationCatalog.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gacha__n__placement_sound__type-1-standard',
        label: 'type-1-standard',
        rarity: 'N',
        kind: 'placement_sound',
        assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
        soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
      })
    ]));
  });
});
