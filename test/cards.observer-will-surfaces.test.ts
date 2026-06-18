import * as path from 'path';

const generator = require(path.resolve(__dirname, '..', 'scripts', 'generate-catalog.js'));

const EXPECTED_BASE_CARD = Object.freeze({
  id: 'observer_will_01',
  name_ja: '盤理の観測者',
  type: 'OBSERVER_WILL',
  cost: 0,
  desc_ja: '18手以上経過後に使用可能。相手手札を1枚奪い、観測済みの相手手札のコストを5増やす。盤理の観測者を顕現させる。観測済みの相手手札は顕現終了後も表表示になる。',
  display_type_ja: '観測'
});

const EXPECTED_BROWSER_CARD = Object.freeze({
  ...EXPECTED_BASE_CARD,
  name: '盤理の観測者',
  desc: EXPECTED_BASE_CARD.desc_ja
});

const EXPECTED_QUICK_TEXT = '相手手札を1枚奪い、観測済みの相手手札のコストを5増やす。盤理の観測者を顕現させる。観測済みの相手手札は顕現終了後も表表示になる。';
const EXPECTED_DETAIL_TEXT = '18手以上経過後に使用可能。\n盤面に顕現石が存在する間は使用できない。\n使用時に相手手札を公開して1枚選ぶ。選んだカードは自分の手札に加わり0コストになる。\n観測済みになった相手手札はカードcopyごとに1回だけコスト+5になる。奪ったカードは0コストになり、盤理の観測者による+5は残らない。特殊カードは観測で表表示にはなるが、コスト+5は受けない。\n選択後、次に置く自石として盤理の観測者を5T不可侵の顕現石として出す。盤理の観測者が盤上にいる間、相手手札は常に表表示。\n一度観測した相手手札は観測済みとなり、盤理の観測者が消滅した後も表表示のまま残る。盤理の観測者が盤上にいる間に相手が新たに引いた手札も観測済みになる。観測済みカードには双方にタグを表示する。\n盤理の観測者が消滅した後、奪ったカードの元コスト20%を自ターン開始時に最大9回返済する。布石不足時は自石4個をランダム破壊する。';

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

describe('OBSERVER_WILL catalog/help surfaces', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (error) { /* Intentionally empty: test cleanup guard */ }
  });

  test('catalog json / catalog.js / catalog.generated.js / generator output stay aligned for OBSERVER_WILL', () => {
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

  test('CardInteractionEffects exposes quick/detail help text for OBSERVER_WILL', () => {
    const CardInteractionEffects = require(path.resolve(__dirname, '..', 'cards', 'card-interaction-effects.js'));
    const cardDef = {
      type: 'OBSERVER_WILL',
      desc: EXPECTED_BROWSER_CARD.desc
    };

    expect(CardInteractionEffects.quickCardEffectByType.OBSERVER_WILL).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.detailCardEffectByType.OBSERVER_WILL).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).toBe(EXPECTED_QUICK_TEXT);
    expect(CardInteractionEffects.getDetailCardEffect(cardDef)).toBe(EXPECTED_DETAIL_TEXT);
    expect(CardInteractionEffects.getQuickCardEffect(cardDef)).not.toContain('...');
  });
});
