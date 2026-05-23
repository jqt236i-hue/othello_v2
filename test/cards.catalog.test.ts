/* eslint-env jest */
import * as path from 'path';

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

  test('swap/position-swap costs are reversed as specified', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('swap_01').cost)).toBe(17);
    expect(Number(byId.get('position_swap_01').cost)).toBe(13);
  });

  test('x bomb card is present with expected cost/type', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('x_bomb_01')).toBe(true);
    expect(byId.get('x_bomb_01').type).toBe('X_BOMB');
    expect(Number(byId.get('x_bomb_01').cost)).toBe(18);
  });

  test('reinforcement will card is present with expected cost/type/display', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('reinforcement_01')).toBe(true);
    expect(byId.get('reinforcement_01').type).toBe('REINFORCEMENT_WILL');
    expect(Number(byId.get('reinforcement_01').cost)).toBe(6);
    expect(byId.get('reinforcement_01').display_type_ja).toBe('繁栄');
  });

  test('regen/perma costs are swapped as specified', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('regen_01').cost)).toBe(12);
    expect(Number(byId.get('perma_01').cost)).toBe(15);
  });

  test('free placement and buoyancy/gravity costs reflect latest balance', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(Number(byId.get('free_01').cost)).toBe(14);
    expect(Number(byId.get('buoyancy_01').cost)).toBe(9);
    expect(Number(byId.get('super_buoyancy_01').cost)).toBe(16);
    expect(Number(byId.get('gravity_01').cost)).toBe(9);
    expect(Number(byId.get('super_gravity_01').cost)).toBe(16);
  });

  test('perma_01 (強い意志) describes evolution into 最強の意志 after 10 turns', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    const card = byId.get('perma_01');
    expect(card).toBeTruthy();
    expect(card.type).toBe('PERMA_PROTECT_NEXT_STONE');
    expect(Number(card.cost)).toBe(15);
    expect(card.name_ja).toBe('強い意志');
    expect(card.desc_ja).toContain('10ターン');
    expect(card.desc_ja).toContain('最強の意志');
    expect(card.desc_ja).toContain('絶対保護');
  });

  test('absolute_protect_01 (最強の意志) is no longer a playable catalog card', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const byId = new Map(jsonCatalog.cards.map(c => [c.id, c]));
    expect(byId.has('absolute_protect_01')).toBe(false);
  });
});
