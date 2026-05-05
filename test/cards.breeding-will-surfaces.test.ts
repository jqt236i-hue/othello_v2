import * as fs from 'fs';
import * as path from 'path';

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'breeding_01',
  name_ja: '繁殖の意志',
  type: 'BREEDING_WILL',
  cost: 16,
  desc_ja: '次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)',
  display_type_ja: '守護'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '繁殖の意志',
  desc: '次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)'
});

const EXPECTED_QUICK_TEXT = '次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)';
const EXPECTED_DETAIL_TEXT = '生成先は周囲8マスの空きからランダム1個。\n前回生成石の周囲へ拡散し、5ターン継続。';

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

describe('BREEDING_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for BREEDING_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for BREEDING_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));

    const cardDef = {
      type: 'BREEDING_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.BREEDING_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.BREEDING_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });

  test('shared constants and rulebook keep the breeding wording in sync', () => {
    const SharedConstants = require(path.resolve(__dirname, '..', 'shared-constants.js'));
    const rulebook = fs.readFileSync(path.resolve(__dirname, '..', '01-rulebook.md'), 'utf8');
    const sharedCard = ((SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BREEDING_WILL')) || null;

    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_BASE_CARD.id,
      name: EXPECTED_BASE_CARD.name_ja,
      type: EXPECTED_BASE_CARD.type,
      cost: EXPECTED_BASE_CARD.cost,
      desc: EXPECTED_QUICK_TEXT
    }));
    expect(rulebook).toContain('### 10.15 BREEDING_WILL（繁殖の意志）');
    expect(rulebook).toContain(EXPECTED_QUICK_TEXT);
  });
});
