const catalog = require('../cards/catalog.json');
const CardInteractionEffects = require('../cards/card-interaction-effects.ts');
const DetailActions = require('../cards/card-interaction-detail-actions.ts');

describe('CAUSAL_REPLAY_WILL surfaces', () => {
  test('catalog defines 因果再生 with cost 12 and target usage text', () => {
    const card = catalog.cards.find((one: any) => one && one.id === 'causal_replay_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'causal_replay_01',
      name_ja: '因果再生',
      type: 'CAUSAL_REPLAY_WILL',
      cost: 12,
      display_type_ja: '禁忌'
    }));
    expect(card.desc_ja).toBe('盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。');
  });

  test('quick/detail text and prompt explain hole-only restoration', () => {
    expect(CardInteractionEffects.getQuickCardEffect({ type: 'CAUSAL_REPLAY_WILL' }))
      .toBe('盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。');
    expect(CardInteractionEffects.resolveCardDescriptionTexts({ type: 'CAUSAL_REPLAY_WILL' }).distinctDetailText)
      .toContain('石・特殊石・数字マスなど、穴化前の状態は戻らない。');
    expect(DetailActions.getPendingSelectionPrompt({
      type: 'CAUSAL_REPLAY_WILL',
      stage: 'selectTarget'
    })).toBe('再生する穴マスを選んでください');
  });

  test('effect tags include hole-cell but not erasure', () => {
    const labels = CardInteractionEffects.resolveCardEffectTags({ type: 'CAUSAL_REPLAY_WILL' })
      .map((tag: any) => tag && tag.label);
    expect(labels).toContain('穴マス');
    expect(labels).not.toContain('抹消');
  });
});
