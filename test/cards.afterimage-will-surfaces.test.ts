import * as path from 'path';

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'afterimage_will_01',
  name_ja: '避ける意志',
  type: 'AFTERIMAGE_WILL',
  cost: 8,
  desc_ja: '次に置く石を残像石化。反転回避3回と破壊回避3回を持つ特殊石。',
  display_type_ja: '守護'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '避ける意志',
  desc: '次に置く石を残像石化。反転回避3回と破壊回避3回を持つ特殊石。'
});

const EXPECTED_QUICK_TEXT = '次に置く石を残像石化。反転回避3回と破壊回避3回を持つ特殊石。';
const EXPECTED_DETAIL_TEXT = '次に置く石を残像石化する。\n残像石は反転回避3回と破壊回避3回を持つ特殊石。\n意志の喪失で通常石に戻る。\n回避に成功した時だけ対応する回数を1消費する。\n片方だけ0になっても、もう片方が残る間は残像石のまま継続する。\n反転・破壊対象時は、盤面上の最も近い有効な空きマスへ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\n同距離候補が複数ある場合はランダムで選ばれる。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。\n両方0になると通常石へ戻る。';

function getCardById(catalog: any, cardId: string) {
  return ((catalog && catalog.cards) || []).find((card: any) => card && card.id === cardId) || null;
}

function pickCardFields(card: any, fields: string[]) {
  return fields.reduce((result: any, field: string) => {
    result[field] = card ? card[field] : undefined;
    return result;
  }, {});
}

function loadWindowCatalog(relativePath: string) {
  jest.resetModules();
  (global as any).window = {};
  require(path.resolve(__dirname, '..', relativePath));
  return (global as any).window.CardCatalog;
}

describe('AFTERIMAGE_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete (global as any).window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for AFTERIMAGE_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for AFTERIMAGE_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
    const cardDef = {
      type: 'AFTERIMAGE_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.AFTERIMAGE_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.AFTERIMAGE_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });
});
