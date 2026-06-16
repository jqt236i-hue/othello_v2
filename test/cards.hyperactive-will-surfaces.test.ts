import * as fs from 'fs';
const path = require('path');
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'hyperactive_01',
  name_ja: '多動の意志',
  type: 'HYPERACTIVE_WILL',
  cost: 5,
  desc_ja: '次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。',
  display_type_ja: '戦闘'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '多動の意志',
  desc: '次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。'
});

const EXPECTED_QUICK_TEXT = '次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。';
const EXPECTED_DETAIL_TEXT = 'ターン開始移動の移動先は周囲の空きマスから選ばれる。\nターン開始移動で空きが無い場合は同色の通常石に戻る。\n移動後に挟める列があれば反転する。\n反転対象時は、盤面上の最も近い有効な空きマスへ1回だけ移動して回避する。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。';

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

describe('HYPERACTIVE_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for HYPERACTIVE_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for HYPERACTIVE_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

    const cardDef = {
      type: 'HYPERACTIVE_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.HYPERACTIVE_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.HYPERACTIVE_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });

  test('shared constants and rulebook keep the hyperactive wording in sync', () => {
    const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
    const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'HYPERACTIVE_WILL')) || null;

    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_BASE_CARD.id,
      name: EXPECTED_BASE_CARD.name_ja,
      type: EXPECTED_BASE_CARD.type,
      cost: EXPECTED_BASE_CARD.cost,
      desc: EXPECTED_QUICK_TEXT
    }));
    expect(rulebook).toContain('### 10.17 HYPERACTIVE_WILL（多動の意志）');
    expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
  });
});
