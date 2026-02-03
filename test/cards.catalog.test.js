/* eslint-env jest */
const path = require('path');

describe('cards catalog consistency', () => {
  test('cards/catalog.js mirrors cards/catalog.json', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    // load catalog.js which assigns to window.CardCatalog in browser env
    // Jest uses jsdom by default so window should exist; ensure it.
    if (typeof window === 'undefined') global.window = {};
    // require the browser catalog file to populate window.CardCatalog
    require(path.resolve(__dirname, '..', 'cards', 'catalog.js'));

    const jsCatalog = window.CardCatalog;
    expect(jsCatalog).toBeDefined();
    expect(Array.isArray(jsCatalog.cards)).toBe(true);

    // Compare lengths
    expect(jsCatalog.cards.length).toBe(jsonCatalog.cards.length);

    // Compare by id -> object (shallow compare of key properties)
    const mapJson = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const mapJs = new Map(jsCatalog.cards.map(c => [c.id, c]));

    for (const [id, jsonCard] of mapJson.entries()) {
      expect(mapJs.has(id)).toBe(true);
      const jsCard = mapJs.get(id);
      // key fields should match (JSON uses localized keys like name_ja / desc_ja)
      expect(jsCard.id).toBe(jsonCard.id);
      expect(jsCard.name).toBe(jsonCard.name_ja || jsonCard.name);
      expect(jsCard.type).toBe(jsonCard.type);
      // description and cost
      expect(jsCard.desc).toBe(jsonCard.desc_ja || jsonCard.desc || '');
      expect(Number(jsCard.cost)).toBe(Number(jsonCard.cost));
    }
  });
});
