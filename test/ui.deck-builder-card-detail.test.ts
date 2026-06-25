import { JSDOM } from 'jsdom';

describe('deck builder card detail button', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="openBtn" type="button"></button>
      <button id="ratedMatchOpenBtn" type="button"></button>
      <div id="summary"></div>
      <div id="overlay"></div>
      <button id="closeBtn" type="button"></button>
      <div id="header"></div>
      <div id="body"></div>
      <select id="smartBlack"><option value="1" selected>1</option></select>
      <select id="smartWhite"><option value="1" selected>1</option></select>
    </body></html>`, { url: 'http://localhost/' });

    global.window = dom.window as unknown as Window & typeof globalThis;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.history = dom.window.history;
    global.localStorage = dom.window.localStorage;
    global.navigator = dom.window.navigator;
  });

  afterEach(() => {
    try {
      dom.window.close();
    } catch (e) {
      // ignore
    }

    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).location;
    delete (global as any).history;
    delete (global as any).localStorage;
    delete (global as any).navigator;
  });

  function openEditor(body: HTMLElement): void {
    const editButton = Array.from(body.querySelectorAll('button'))
      .find((button) => button.textContent === '編集');
    expect(editButton).toBeTruthy();
    editButton?.click();
  }

  function createController(): any {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    return createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body: document.getElementById('body')
      }
    });
  }

  test('候補カードの詳細ボタンは中央ポップアップでカード効果を表示し、枚数追加を発生させない', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const CardInteractionEffects = require('../cards/card-interaction-effects.js');
    const body = document.getElementById('body') as HTMLElement;
    const controller = createController();

    controller.open();
    openEditor(body);

    const targetCardDef = DeckSpecHelpers.getEnabledCardDefs()
      .find((cardDef: any) => cardDef && cardDef.id === 'sniper_01');
    expect(targetCardDef).toBeTruthy();

    const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardDef.id}"]`) as HTMLElement;
    expect(card).toBeTruthy();

    const detailButton = card.querySelector('.deck-builder-card-detail-btn') as HTMLButtonElement;
    expect(detailButton).toBeTruthy();
    expect(detailButton.textContent).toBe('詳細');

    detailButton.click();

    const refreshedCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardDef.id}"]`) as HTMLElement;
    expect(refreshedCard.querySelector('.deck-builder-count-badge')?.textContent).toBe('x0');

    const detailPopup = body.querySelector('.deck-builder-card-detail-popup') as HTMLElement;
    const effectTexts = CardInteractionEffects.resolveCardDescriptionTexts(targetCardDef, {
      resolveChargeMaxText: () => '99',
      quickTextMaxLength: 42
    });

    expect(body.querySelector('.deck-builder-card-detail-panel')).toBeFalsy();
    expect(detailPopup).toBeTruthy();
    expect(detailPopup.getAttribute('role')).toBe('dialog');
    expect(detailPopup.getAttribute('aria-modal')).toBe('true');
    expect(detailPopup.textContent).toContain(targetCardDef.name);
    expect(detailPopup.textContent).toContain(effectTexts.quickText);

    const closeButton = detailPopup.querySelector('.deck-builder-card-detail-popup-close') as HTMLButtonElement;
    expect(closeButton).toBeTruthy();
    expect(closeButton.textContent).toBe('×');

    closeButton.click();

    expect(body.querySelector('.deck-builder-card-detail-popup')).toBeFalsy();
  });

  test('レート戦から開いたデッキ構築は閉じるとレート戦へ戻る', () => {
    const controller = createController();
    const ratedOpenHandler = jest.fn();
    document.getElementById('ratedMatchOpenBtn')?.addEventListener('click', ratedOpenHandler);

    (window as any).__returnToRatedMatchAfterDeckBuilder = true;
    controller.open();

    document.getElementById('closeBtn')?.click();

    expect(ratedOpenHandler).toHaveBeenCalledTimes(1);
    expect((window as any).__returnToRatedMatchAfterDeckBuilder).toBe(false);
  });

  test('候補カードの詳細ポップアップは専門用語と固有名詞を共通ハイライトで表示する', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const body = document.getElementById('body') as HTMLElement;
    const controller = createController();

    controller.open();
    openEditor(body);

    const targetCardDef = DeckSpecHelpers.getEnabledCardDefs()
      .find((cardDef: any) => cardDef && cardDef.id === 'board_executor_01');
    expect(targetCardDef).toBeTruthy();

    const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardDef.id}"]`) as HTMLElement;
    expect(card).toBeTruthy();

    const detailButton = card.querySelector('.deck-builder-card-detail-btn') as HTMLButtonElement;
    expect(detailButton).toBeTruthy();
    detailButton.click();

    const detailPopup = body.querySelector('.deck-builder-card-detail-popup') as HTMLElement;
    expect(detailPopup).toBeTruthy();

    const highlightedTerms = Array.from(detailPopup.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    const termLabels = highlightedTerms.map((el) => el.textContent);

    expect(termLabels).toEqual(expect.arrayContaining([
      '盤界の執行者',
      '特殊石',
      '不可侵',
      '顕現石'
    ]));
    expect(highlightedTerms.find((el) => el.textContent === '盤界の執行者')).toEqual(expect.objectContaining({
      dataset: expect.objectContaining({
        termCategory: 'unique',
        termTone: 'cell'
      })
    }));
    expect(highlightedTerms.find((el) => el.textContent === '特殊石')).toEqual(expect.objectContaining({
      dataset: expect.objectContaining({ termCategory: 'stone' })
    }));
    expect(highlightedTerms.find((el) => el.textContent === '不可侵')).toEqual(expect.objectContaining({
      dataset: expect.objectContaining({ termCategory: 'protection' })
    }));
  });

  test('候補カードの詳細ポップアップは特殊石のターン数と回避回数を数値付きタグで表示する', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const body = document.getElementById('body') as HTMLElement;
    const controller = createController();

    controller.open();
    openEditor(body);

    const targetCardDef = DeckSpecHelpers.getEnabledCardDefs()
      .find((cardDef: any) => cardDef && cardDef.id === 'afterimage_will_01');
    expect(targetCardDef).toBeTruthy();

    const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardDef.id}"]`) as HTMLElement;
    expect(card).toBeTruthy();

    const detailButton = card.querySelector('.deck-builder-card-detail-btn') as HTMLButtonElement;
    expect(detailButton).toBeTruthy();
    detailButton.click();

    const detailPopup = body.querySelector('.deck-builder-card-detail-popup') as HTMLElement;
    expect(detailPopup).toBeTruthy();

    const tagLabels = Array.from(detailPopup.querySelectorAll('.deck-builder-card-detail-tag'))
      .map((el) => el.textContent);

    expect(tagLabels).toEqual(expect.arrayContaining([
      '特殊石',
      '反転回避3回',
      '破壊回避3回'
    ]));

    const durationCardDef = DeckSpecHelpers.getEnabledCardDefs()
      .find((cardDef: any) => cardDef && cardDef.id === 'sniper_01');
    expect(durationCardDef).toBeTruthy();

    const durationCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${durationCardDef.id}"]`) as HTMLElement;
    expect(durationCard).toBeTruthy();

    const durationDetailButton = durationCard.querySelector('.deck-builder-card-detail-btn') as HTMLButtonElement;
    expect(durationDetailButton).toBeTruthy();
    durationDetailButton.click();

    const durationDetailPopup = body.querySelector('.deck-builder-card-detail-popup') as HTMLElement;
    expect(durationDetailPopup).toBeTruthy();

    const durationTagLabels = Array.from(durationDetailPopup.querySelectorAll('.deck-builder-card-detail-tag'))
      .map((el) => el.textContent);

    expect(durationTagLabels).toEqual(expect.arrayContaining([
      '特殊石',
      '6ターン持続'
    ]));
  });
});
