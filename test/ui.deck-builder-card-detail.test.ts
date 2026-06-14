import { JSDOM } from 'jsdom';

describe('deck builder card detail button', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="openBtn" type="button"></button>
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
});
