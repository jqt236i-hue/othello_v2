const path = require('path');

describe('generate gacha hand catalog', () => {
  test('derives rarity and display name from assets/images/Gacha', () => {
    const { generateGachaHandCatalog } = require('../scripts/generate-gacha-hand-catalog.js');
    const result = generateGachaHandCatalog({
      root: path.resolve(__dirname, '..'),
      write: false
    });

    expect(result.catalog.sourceDir).toBe('assets/images/Gacha');
    expect(result.catalog.items).toEqual(expect.arrayContaining([
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
  });
});
