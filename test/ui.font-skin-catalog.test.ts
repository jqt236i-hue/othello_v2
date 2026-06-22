describe('font skin catalog', () => {
  test('uses Shippori Mincho as the default bundled font skin', () => {
    const catalog = require('../ui/font-skin/catalog.ts');

    const skins = catalog.getOwnedFontSkins();
    const ids = skins.map((skin: any) => skin.id);

    expect(ids).toEqual([
      'shippori-mincho',
      'dot-gothic',
      'cinzel',
      'kaisei-tokumin',
      'zen-antique-soft',
      'yusei-magic',
      'rocknroll-one'
    ]);
    expect(skins).toHaveLength(7);
    expect(catalog.DEFAULT_FONT_SKIN_ID).toBe('shippori-mincho');
    expect(catalog.normalizeFontSkinId('default')).toBe('shippori-mincho');
    expect(skins.find((skin: any) => skin.id === 'shippori-mincho').label).toBe('既定');
    expect(skins.slice(2).every((skin: any) => String(skin.fontFamily).includes('assets/fonts') === false)).toBe(true);
    expect(skins.find((skin: any) => skin.id === 'cinzel').fontFamily).toContain('CR-Cinzel');
    expect(skins.find((skin: any) => skin.id === 'shippori-mincho').fontFamily).toContain('CR-Shippori Mincho');
    expect(skins.find((skin: any) => skin.id === 'kaisei-tokumin').fontFamily).toContain('CR-Kaisei Tokumin');
    expect(skins.find((skin: any) => skin.id === 'zen-antique-soft').fontFamily).toContain('CR-Zen Antique Soft');
    expect(skins.find((skin: any) => skin.id === 'yusei-magic').fontFamily).toContain('CR-Yusei Magic');
    expect(skins.find((skin: any) => skin.id === 'rocknroll-one').fontFamily).toContain('CR-RocknRoll One');
  });
});
