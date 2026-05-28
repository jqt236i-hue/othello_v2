import * as fs from 'fs';
const path = require('path');
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'super_attraction_01',
  name_ja: '超引力',
  type: 'SUPER_ATTRACTION_WILL',
  cost: 40,
  desc_ja: '盤面の石1つを選び、盤面上の別マスまで最短経路で引き寄せる。経路上と指定マス上の石はすべて破壊する。',
  display_type_ja: '殲滅'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '超引力',
  desc: EXPECTED_BASE_CARD.desc_ja
});

const EXPECTED_QUICK_TEXT = '石1つを任意マスまで引き寄せ、経路上の石を破壊';

function getCardById(catalog, cardId) {
  return ((catalog && catalog.cards) || []).find((card) => card && card.id === cardId) || null;
}

function loadWindowCatalog(relativePath) {
  jest.resetModules();
  global.window = {};
  require(path.resolve(__dirname, '..', relativePath));
  return window.CardCatalog;
}

describe('SUPER_ATTRACTION_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* cleanup guard */ }
  });

  test('catalog json / generated projections stay aligned for SUPER_ATTRACTION_WILL', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const generatedCatalogObject = generator.generate();
    const browserCatalog = loadWindowCatalog('cards\\catalog.js');
    const generatedWindowCatalog = loadWindowCatalog('cards\\catalog.generated.js');

    expect(getCardById(jsonCatalog, EXPECTED_BASE_CARD.id)).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
    expect(getCardById(generatedCatalogObject, EXPECTED_BASE_CARD.id)).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
    expect(getCardById(browserCatalog, EXPECTED_BASE_CARD.id)).toEqual(expect.objectContaining(EXPECTED_BROWSER_CARD));
    expect(getCardById(generatedWindowCatalog, EXPECTED_BASE_CARD.id)).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
  });

  test('help text and rulebook expose SUPER_ATTRACTION_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
    const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
    const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'SUPER_ATTRACTION_WILL')) || null;

    expect(CardInteractionEffects.quickCardEffectByType.SUPER_ATTRACTION_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.SUPER_ATTRACTION_WILL).toContain('盤面上の別マス');
    expect(CardInteractionEffects.detailCardEffectByType.SUPER_ATTRACTION_WILL).toContain('最短経路');
    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_BASE_CARD.id,
      name: EXPECTED_BASE_CARD.name_ja,
      type: EXPECTED_BASE_CARD.type,
      cost: EXPECTED_BASE_CARD.cost
    }));
    expect(rulebook).toContain('### 10.35.3.1 SUPER_ATTRACTION_WILL（超引力）');
    expect(rulebook).toContain('- コスト40');
  });
});
