import * as path from 'path';

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'tempt_01',
  name_ja: '意志の反転',
  type: 'TEMPT_WILL',
  cost: 34,
  desc_ja: '相手の特殊石を1つ選び、自分の石にする。罠石・時限爆弾・生きる意志付きの石も選べる。効果のない通常石は選べない。',
  display_type_ja: '執行'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '意志の反転',
  desc: '相手の特殊石を1つ選び、自分の石にする。罠石・時限爆弾・生きる意志付きの石も選べる。効果のない通常石は選べない。'
});

const EXPECTED_QUICK_TEXT = '相手の特殊石を1つ選び、自分の石にする。罠石・時限爆弾・生きる意志付きの石も選べる。効果のない通常石は選べない。';
const EXPECTED_DETAIL_TEXT = '相手の特殊石を1つ選び、自分の石にする。\n罠石・時限爆弾・弱い石・強い石・幽体石も選べる。\n生きる意志が付いた石も選べる。\n効果のない通常石、完全保護中の石、顕現石は選べない。\n残りターンなどはそのまま引き継ぐ。\n出稼ぎ石は奪うと効果が消え、通常石になる。\nこの色の変化は反転枚数に数えない。';

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

describe('TEMPT_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for TEMPT_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for TEMPT_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
    const cardDef = {
      type: 'TEMPT_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.TEMPT_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.TEMPT_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });
});
