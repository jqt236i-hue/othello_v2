import * as path from 'path';

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'execution_01',
  name_ja: '執行の意志',
  type: 'EXECUTION_WILL',
  cost: 2,
  desc_ja: '直前の相手ターンで自分の石が破壊されていた場合に使用可能。相手手札をランダムで最大3枚破壊する。',
  display_type_ja: '執行'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '執行の意志',
  desc: '直前の相手ターンで自分の石が破壊されていた場合に使用可能。相手手札をランダムで最大3枚破壊する。'
});

const EXPECTED_QUICK_TEXT = '直前の相手ターンで自分石が破壊されていれば、相手手札をランダムで最大3枚破壊。';
const EXPECTED_DETAIL_TEXT = '使用条件は、直前に終了した相手ターン中に自分の石が1つ以上破壊されていること。\n使用時、相手の現在の手札からランダムに最大3枚を破壊する。\n相手手札が3枚未満なら、存在する枚数ぶんだけ破壊する。';

function getCardById(catalog: any, cardId: string) {
  return ((catalog && catalog.cards) || []).find((card: any) => card && card.id === cardId) || null;
}

function pickCardFields(card: any, fields: string[]) {
  return fields.reduce((result: Record<string, unknown>, field: string) => {
    result[field] = card ? card[field] : undefined;
    return result;
  }, {});
}

function loadWindowCatalog(relativePath: string) {
  jest.resetModules();
  (global as any).window = {};
  require(path.resolve(__dirname, '..', relativePath));
  return (window as any).CardCatalog;
}

describe('EXECUTION_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete (global as any).window; } catch (error) { /* cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for EXECUTION_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for EXECUTION_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.ts'));
    const cardDef = {
      type: 'EXECUTION_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.EXECUTION_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.EXECUTION_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });
});
