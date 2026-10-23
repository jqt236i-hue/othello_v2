import CardCatalog = require('../cards/catalog');
import CardInteractionEffects = require('../cards/card-interaction-effects');
import { getLastUsedPanelCopy } from '../cards/card-last-used-panel-copy';

test('every runtime card has copy so a canonical card ID cannot produce an empty last-used panel', () => {
    const missing = CardCatalog.cards.filter(card => !getLastUsedPanelCopy(card.id).trim()).map(card => card.id);
    expect(missing).toEqual([]);
});

test('混沌召喚の詳細効果は出現時の反転も反転布石もないと説明する', () => {
    const card = CardCatalog.cards.find(entry => entry.id === 'chaos_summon_01');
    expect(card).toBeDefined();
    const texts = CardInteractionEffects.resolveCardDescriptionTexts(card);
    expect(texts.quickText).toContain('反転しない');
    for (const detail of [texts.detailText, texts.distinctDetailText]) {
        expect(detail).toContain('挟める列があっても反転しない');
        expect(detail).toContain('反転由来の布石も獲得しない');
        expect(detail).not.toContain('通常配置と同じ反転判定');
    }
});

test('救済の意志の使用済み説明は敵味方の破壊石を自分の通常石として復活させると案内する', () => {
    const copy = getLastUsedPanelCopy('salvation_01');
    expect(copy).toContain('直前の相手ターン');
    expect(copy).toContain('敵味方すべての石');
    expect(copy).toContain('自分の通常石として');
    expect(copy).not.toContain('破壊された自分の石');
});

test.each([
    ['reinforcement_01', '1個'],
    ['support_troops_01', '最大3個']
])('%s の使用済み説明は盤面全体の空きマスへのランダム配置を案内する', (cardId, count) => {
    const copy = getLastUsedPanelCopy(cardId);
    expect(copy).toContain('盤面の空きマスからランダム');
    expect(copy).toContain(`自分の通常石を${count}配置`);
    expect(copy).not.toContain('既存石の近く');
});
