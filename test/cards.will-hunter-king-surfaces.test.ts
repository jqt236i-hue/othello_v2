import * as fs from 'fs';
const path = require('path');
const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'will_hunter_king_01',
  name_ja: '意志狩りの王',
  type: 'WILL_HUNTER_KING',
  cost: 33,
  desc_ja: '次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。',
  display_type_ja: '戦闘'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '意志狩りの王',
  desc: '次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。'
});

const EXPECTED_QUICK_TEXT = '次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。';
const EXPECTED_DETAIL_TEXT = '次に置く石を意志狩りの王石化する。\n自ターン開始時、敵石を1つ選んでそのマスへ移動しながら破壊する。\n敵の特殊石があればそちらを優先して狙う。\n反転回避2回と破壊回避2回を持ち、回避時は盤面上の最も近い有効な空きマスへ移動する。';

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

describe('WILL_HUNTER_KING catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for WILL_HUNTER_KING', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for WILL_HUNTER_KING', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

    const cardDef = {
      type: 'WILL_HUNTER_KING',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.WILL_HUNTER_KING).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.WILL_HUNTER_KING).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });

  test('shared constants and rulebook keep the king wording in sync', () => {
    const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
    const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'WILL_HUNTER_KING')) || null;

    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_BASE_CARD.id,
      name: EXPECTED_BASE_CARD.name_ja,
      type: EXPECTED_BASE_CARD.type,
      cost: EXPECTED_BASE_CARD.cost,
      desc: EXPECTED_QUICK_TEXT
    }));
    expect(rulebook).toContain('### 10.17.4 WILL_HUNTER_KING（意志狩りの王）');
    expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
  });
});
