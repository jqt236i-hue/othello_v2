import * as fs from 'fs';
const path = require('path');
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'sacrifice_will_01',
  name_ja: '犠牲の意志',
  type: 'SACRIFICE_WILL',
  cost: 14,
  desc_ja: '次に置く自分の石を5ターン持続の犠牲石にする。犠牲石が盤面にいる間、相手が通常カードを使うと自壊してそのカード効果を無効化する。特殊カードは対象外。',
  display_type_ja: '特殊石'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: EXPECTED_BASE_CARD.name_ja,
  desc: EXPECTED_BASE_CARD.desc_ja
});

const EXPECTED_QUICK_TEXT = '次に置く石を犠牲石にする';

function getCardById(catalog, cardId) {
  return ((catalog && catalog.cards) || []).find((card) => card && card.id === cardId) || null;
}

function pickCardFields(card, fields) {
  return fields.reduce((result, field) => {
    result[field] = card ? card[field] : undefined;
    return result;
  }, {});
}

function loadWindowCatalog(relativePath) {
  jest.resetModules();
  global.window = {};
  require(path.resolve(__dirname, '..', relativePath));
  return window.CardCatalog;
}

describe('SACRIFICE_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for SACRIFICE_WILL', () => {
    const jsonCatalog = require(path.resolve(__dirname, '..', 'cards', 'catalog.json'));
    const generatedCatalogObject = generator.generate();
    const browserCatalog = loadWindowCatalog('cards\\catalog.js');
    const generatedWindowCatalog = loadWindowCatalog('cards\\catalog.generated.js');

    const jsonEntry = getCardById(jsonCatalog, EXPECTED_BASE_CARD.id);
    const generatedEntry = getCardById(generatedCatalogObject, EXPECTED_BASE_CARD.id);
    const browserEntry = getCardById(browserCatalog, EXPECTED_BASE_CARD.id);
    const generatedWindowEntry = getCardById(generatedWindowCatalog, EXPECTED_BASE_CARD.id);
    const baseFields = Object.keys(EXPECTED_BASE_CARD);

    expect(jsonEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
    expect(generatedEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
    expect(browserEntry).toEqual(expect.objectContaining(EXPECTED_BROWSER_CARD));
    expect(generatedWindowEntry).toEqual(expect.objectContaining(EXPECTED_BASE_CARD));
    expect(pickCardFields(browserEntry, baseFields)).toEqual(pickCardFields(generatedWindowEntry, baseFields));
    expect(browserEntry.name).toBe(browserEntry.name_ja);
    expect(browserEntry.desc).toBe(browserEntry.desc_ja);
  });

  test('CardInteractionEffects exposes quick/detail help text for SACRIFICE_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
    const cardDef = {
      type: EXPECTED_BASE_CARD.type,
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.SACRIFICE_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toContain('5ターン');
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toContain('通常カード');
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toContain('無効化');
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toContain('特殊カードは対象外');
  });

  test('shared constants and rulebook keep the sacrifice wording in sync', () => {
    const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
    const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === EXPECTED_BASE_CARD.type)) || null;

    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_BASE_CARD.id,
      name: EXPECTED_BASE_CARD.name_ja,
      type: EXPECTED_BASE_CARD.type,
      cost: EXPECTED_BASE_CARD.cost
    }));
    expect(rulebook).toContain('SACRIFICE_WILL（犠牲の意志）');
    expect(rulebook).toContain('特殊カードは対象外');
  });
});
