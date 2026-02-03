const path = require('path');
const fs = require('fs');

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

describe('catalog generator', () => {
  test('generated object matches cards/catalog.json', () => {
    const generated = generator.generate();
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    expect(generated).toEqual(jsonCatalog);
  });

  test('generated file content parses to same object as cards/catalog.js', () => {
    // ensure window.CardCatalog is set by requiring browser file
    if (typeof window === 'undefined') global.window = {};
    require(path.resolve(__dirname, '..', 'cards', 'catalog.js'));
    const jsCatalog = window.CardCatalog;
    expect(jsCatalog).toBeDefined();

    const generated = generator.generate();
    // Check core properties (avoid brittle full-object equality): version, length, and per-card id/name/desc/type/cost
    expect(jsCatalog.version).toBe(generated.version);
    expect(jsCatalog.cards.length).toBe(generated.cards.length);

    const mapJson = new Map(generated.cards.map(c => [c.id, c]));
    const mapJs = new Map(jsCatalog.cards.map(c => [c.id, c]));

    for (const [id, jsonCard] of mapJson.entries()) {
      expect(mapJs.has(id)).toBe(true);
      const jsCard = mapJs.get(id);
      expect(jsCard.id).toBe(jsonCard.id);
      expect(jsCard.name).toBe(jsonCard.name_ja || jsonCard.name);
      expect(jsCard.type).toBe(jsonCard.type);
      expect(Number(jsCard.cost)).toBe(Number(jsonCard.cost));
      expect(jsCard.desc).toBe(jsonCard.desc_ja || jsonCard.desc || '');
    }
  });
});
