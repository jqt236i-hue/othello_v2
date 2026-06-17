import { JSDOM } from 'jsdom';
import { createCardInteractionDetailPanel } from '../cards/card-interaction-detail-panel';
import * as TextTermHighlighter from '../ui/text-term-highlighter';

function createController(overrides?: Record<string, unknown>) {
  const dom = new JSDOM(`
    <!doctype html><html><body>
      <div id="card-detail-panel">
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-more"></div>
      </div>
    </body></html>
  `);
  const cardState = {
    turnIndex: 0
  } as any;
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0))
  } as any;
  const cardLogic = {
    getSalvationWillTargetCount: jest.fn(() => 0),
    getEqualityWillBoardCounts: jest.fn(() => ({ black: 3, white: 5 })),
    getReinforcementWillTargetCount: jest.fn(() => 0),
    getSupportTroopsWillTargetCount: jest.fn(() => 0)
  } as any;
  const effectsModule = {
    resolveCardDescriptionTexts: jest.fn((cardDef: any) => ({
      quickText: cardDef && cardDef.quickText ? cardDef.quickText : '通常要約',
      detailText: cardDef && cardDef.detailText ? cardDef.detailText : '通常詳細',
      distinctDetailText: cardDef && cardDef.distinctDetailText ? cardDef.distinctDetailText : '通常詳細',
      effectTags: cardDef && Array.isArray(cardDef.effectTags) ? cardDef.effectTags : [],
      numericTags: []
    }))
  } as any;

  const controller = createCardInteractionDetailPanel({
    effectsModule,
    textTermHighlighterModule: TextTermHighlighter,
    getQuickCardEffect: (cardDef: any) => (cardDef && cardDef.quickText) || '通常要約',
    getDetailCardEffect: (cardDef: any) => (cardDef && cardDef.detailText) || '通常詳細',
    resolveChargeMaxText: () => '99',
    isHiddenHandToken: (cardId: any) => String(cardId || '').startsWith('hidden_'),
    getDocumentRef: () => dom.window.document,
    getCardStateValue: () => cardState,
    getGameStateValue: () => gameState,
    getCardLogic: () => cardLogic,
    getRiboWillUnlockTurnIndex: () => 19
  });

  if (overrides && overrides.cardState) Object.assign(cardState, overrides.cardState);
  if (overrides && overrides.gameState) Object.assign(gameState, overrides.gameState);
  if (overrides && overrides.cardLogic) Object.assign(cardLogic, overrides.cardLogic);
  if (overrides && overrides.effectsModule) Object.assign(effectsModule, overrides.effectsModule);

  return {
    controller,
    dom,
    cardState,
    gameState,
    cardLogic,
    effectsModule
  };
}

describe('card interaction detail panel module', () => {
  test('ensure detail helper elements under the card detail panel', () => {
    const ctx = createController();
    const tagsEl = ctx.controller.ensureCardDetailEffectTagsElement();
    const liveStateEl = ctx.controller.ensureCardDetailLiveStateElement();
    const panelEl = ctx.dom.window.document.getElementById('card-detail-panel');

    expect(tagsEl).toBeTruthy();
    expect(liveStateEl).toBeTruthy();
    expect(panelEl?.children[2]?.id).toBe('card-detail-live-state');
    expect(panelEl?.children[3]?.id).toBe('card-detail-effect-tags');
  });

  test('build and apply display model render stripped summary, live state, and deduped tags', () => {
    const ctx = createController({ cardState: { turnIndex: 0 } });
    const cardDef = {
      id: 'ribo_01',
      name: 'リボの意志',
      type: 'RIBO_WILL',
      quickText: '反転保護を持つ特殊石として扱われ、次に置く石を龍化',
      detailText: '詳細本文',
      distinctDetailText: '詳細本文',
      effectTags: [
        { kind: 'status', label: '反転保護' },
        { kind: 'status', label: '反転保護' },
        { kind: 'special-stone', label: '特殊石' },
        { kind: 'special-stone', label: '特殊石' },
        { kind: 'numeric', label: '8ターン持続' }
      ]
    };
    const model = ctx.controller.buildCardDetailDisplayModel(cardDef, 'black');
    const doc = ctx.dom.window.document;
    const nameEl = doc.getElementById('card-detail-name');
    const descEl = doc.getElementById('card-detail-desc');
    const detailMoreEl = doc.getElementById('card-detail-more');
    const liveStateEl = ctx.controller.ensureCardDetailLiveStateElement();
    const tagsEl = ctx.controller.ensureCardDetailEffectTagsElement();

    ctx.controller.applyCardDetailDisplayModel(nameEl, descEl, liveStateEl, detailMoreEl, tagsEl, model);

    expect(model.summaryText).toBe('次に置く石を龍化。');
    expect(nameEl?.textContent).toBe('リボの意志');
    expect(descEl?.textContent).toBe('次に置く石を龍化。');
    expect(liveStateEl?.textContent).toBe('18手後使用可能');
    expect(liveStateEl?.style.display).toBe('block');
    expect(Array.from(tagsEl?.querySelectorAll('.card-detail-effect-tag') || []).map((el) => el.textContent)).toEqual([
      '反転保護',
      '特殊石',
      '8ターン持続'
    ]);
    const tagButtons = Array.from(tagsEl?.querySelectorAll('.card-detail-effect-tag-button') || []);
    expect(tagButtons).toHaveLength(3);
    expect(tagButtons[0].tagName).toBe('BUTTON');
    expect(tagButtons[0].getAttribute('data-card-tag-label')).toBe('反転保護');
    expect(tagButtons[0].getAttribute('aria-label')).toBe('反転保護の説明を表示');
  });

  test('overlay description respects hidden hand tokens and detail text fallback', () => {
    const ctx = createController();

    expect(ctx.controller.getOverlayCardDescriptionText(null, 'hidden_card_01')).toBe('この対戦モードでは詳細は非公開です');
    expect(ctx.controller.getOverlayCardDescriptionText({
      id: 'plain_01',
      detailText: '効果詳細',
      quickText: '効果要約'
    }, 'plain_01')).toBe('効果詳細');
  });

  test('applies shared term highlighting to summary and expanded detail text', () => {
    const ctx = createController();
    const cardDef = {
      id: 'sample_01',
      name: '確認カード',
      type: 'SAMPLE',
      quickText: '次に置く特殊石を反転保護状態で置く',
      detailText: '破壊<script>alert(1)</script>とマス破壊を受ける。',
      distinctDetailText: '破壊<script>alert(1)</script>とマス破壊を受ける。',
      effectTags: []
    };
    const model = ctx.controller.buildCardDetailDisplayModel(cardDef, 'black');
    const doc = ctx.dom.window.document;
    const nameEl = doc.getElementById('card-detail-name');
    const descEl = doc.getElementById('card-detail-desc') as HTMLElement;
    const detailMoreEl = doc.getElementById('card-detail-more') as HTMLElement;
    const liveStateEl = ctx.controller.ensureCardDetailLiveStateElement();
    const tagsEl = ctx.controller.ensureCardDetailEffectTagsElement();

    ctx.controller.applyCardDetailDisplayModel(nameEl, descEl, liveStateEl, detailMoreEl, tagsEl, model);

    expect(descEl.textContent).toBe('次に置く特殊石を反転保護状態で置く。');
    expect(Array.from(descEl.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['特殊石', '反転保護']);
    expect(detailMoreEl.querySelector('script')).toBeNull();
    expect(detailMoreEl.textContent).toBe('破壊<script>alert(1)</script>とマス破壊を受ける。');
    expect(Array.from(detailMoreEl.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['破壊', 'マス破壊']);
  });
});
