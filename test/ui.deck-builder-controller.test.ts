import { JSDOM } from 'jsdom';

describe('deck builder controller', () => {
  let dom;

  function dispatchWheel(target, props) {
    const ev = new dom.window.Event('wheel', { bubbles: true, cancelable: true });
    const p = props || {};
    Object.defineProperty(ev, 'deltaX', { value: p.deltaX ?? 0 });
    Object.defineProperty(ev, 'deltaY', { value: p.deltaY ?? 0 });
    target.dispatchEvent(ev);
  }

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <button id="openBtn" type="button"></button>
      <div id="summary"></div>
      <div id="overlay"></div>
      <button id="closeBtn" type="button"></button>
      <div id="header"></div>
      <div id="body"></div>
      <button id="boardSizeOpenBtn" type="button"></button>
      <div id="boardSizeControlSummary"></div>
      <div id="boardSizeEditor"></div>
      <select id="boardShapeSelect"><option value="rectangle">通常</option><option value="circle">円形</option></select>
      <input id="boardSizeRowsInput" type="number" value="8" />
      <input id="boardSizeColsInput" type="number" value="8" />
      <button id="boardSizeCloseBtn" type="button"></button>
      <div id="boardSizeEditorNote"></div>
      <select id="smartBlack"><option value="1" selected>1</option><option value="6">6</option></select>
      <select id="smartWhite"><option value="1" selected>1</option><option value="6">6</option></select>
    </body></html>`, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.history = dom.window.history;
    global.localStorage = dom.window.localStorage;
    global.navigator = dom.window.navigator;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.history;
    delete global.localStorage;
    delete global.navigator;
    delete global.__uiImpl_turn_manager;
    delete global.SharedUIBootstrap;
    delete global.GameEvents;
    delete global.cardState;
    delete global.dealInitialCards;
    delete global.updateCpuCharacter;
    delete global.resetGame;
    delete global.handleCellClick;
    delete global.gameState;
  });

  function openEditor(body) {
    const editButton = Array.from(body.querySelectorAll('.deck-builder-saved-deck-column > .deck-builder-preset-grid button')).find((button) => button.textContent === '編集');
    expect(editButton).toBeTruthy();
    editButton.click();
  }

  function buildPresetState(presetId, name, deckCode) {
    return {
      version: 1,
      activePresetId: presetId || '',
      presets: [
        { id: 'preset_1', name: presetId === 'preset_1' ? name : '', deckCode: presetId === 'preset_1' ? deckCode : '', updatedAt: 1 },
        { id: 'preset_2', name: presetId === 'preset_2' ? name : '', deckCode: presetId === 'preset_2' ? deckCode : '', updatedAt: 2 },
        { id: 'preset_3', name: presetId === 'preset_3' ? name : '', deckCode: presetId === 'preset_3' ? deckCode : '', updatedAt: 3 }
      ]
    };
  }

  function createThirtyCardDeck(startIndex = 0) {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const DeckCodecModule = require('../shared/deck-codec.js');
    const ids = DeckSpecHelpers.getEnabledCardDefs()
      .slice(startIndex, startIndex + 10)
      .map((cardDef) => cardDef.id);

    expect(ids).toHaveLength(10);

    const deckSpec = DeckSpecHelpers.createDeckSpecFromCardIds(
      ids.flatMap((cardId) => [cardId, cardId, cardId])
    );

    return {
      deckSpec,
      deckCode: DeckCodecModule.encodeDeckSpec(deckSpec)
    };
  }

  function createController(options = {}) {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    return createDeckBuilderController({
      ...options,
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body: document.getElementById('body'),
        boardSizeOpenBtn: document.getElementById('boardSizeOpenBtn'),
        boardSizeControlSummary: document.getElementById('boardSizeControlSummary'),
        boardSizeEditor: document.getElementById('boardSizeEditor'),
        boardShapeSelect: document.getElementById('boardShapeSelect'),
        boardSizeRowsInput: document.getElementById('boardSizeRowsInput'),
        boardSizeColsInput: document.getElementById('boardSizeColsInput'),
        boardSizeCloseBtn: document.getElementById('boardSizeCloseBtn'),
        boardSizeEditorNote: document.getElementById('boardSizeEditorNote')
      }
    });
  }

  test('controlSummary が無くてもデッキ構築を開ける', () => {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    document.getElementById('summary').remove();

    const controller = createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: null,
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    });

    expect(() => controller.open()).not.toThrow();
    expect(document.getElementById('overlay').getAttribute('aria-hidden')).toBe('false');
    expect(document.getElementById('header').textContent).toContain('ローカル設定');
  });

  test('保存プリセットを6枠まで表示する', () => {
    const body = document.getElementById('body');
    const controller = createController();

    controller.open();

    const localPresetCards = body.querySelectorAll('.deck-builder-saved-deck-column > .deck-builder-preset-grid > .deck-builder-preset-card');
    expect(localPresetCards).toHaveLength(6);
    expect(body.textContent).toContain('6つまで保存できます');
    expect(Array.from(localPresetCards).map((card) => card.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('空きスロット 1'),
      expect.stringContaining('空きスロット 6')
    ]));
  });

  test('専用パネルを置かず、使用中の保存デッキ自体を強調する', () => {
    const body = document.getElementById('body');
    const activeDeck = createThirtyCardDeck(0);
    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '理論デッキ', activeDeck.deckCode)));

    createController().open();

    expect(body.querySelector('.deck-builder-active-deck-hero')).toBeNull();
    const activeCard = body.querySelector('.deck-builder-save-slot-card.is-active');
    expect(activeCard).toBeTruthy();
    expect(activeCard.textContent).toContain('理論デッキ');
    expect(activeCard.textContent).toContain('IN USE');

    expect(body.querySelector('.deck-builder-workspace')).toBeTruthy();
    expect(body.querySelector('.deck-builder-loadout-column')).toBeTruthy();
    expect(body.querySelector('.deck-builder-saved-deck-column')).toBeTruthy();
    expect(body.querySelector('.deck-builder-workshop-grid')).toBeTruthy();
    expect(body.querySelector('.deck-builder-fixed-library')).toBeTruthy();
  });

  test('デフォルトデッキ使用中はデフォルトカード自体を強調する', () => {
    const body = document.getElementById('body');

    createController().open();

    const defaultCard = body.querySelector('.deck-builder-default-hero');
    expect(defaultCard.classList.contains('is-active')).toBe(true);
    expect(defaultCard.textContent).toContain('IN USE');
  });

  test('デッキ選択画面を観測室アーカイブの専用サーフェスで包む', () => {
    const body = document.getElementById('body');

    createController().open();

    const atelier = body.querySelector('.deck-builder-atelier-shell');
    expect(atelier).toBeTruthy();
    expect(atelier.querySelector('.deck-builder-atelier-stage')).toBeTruthy();
    expect(atelier.querySelector('.deck-builder-atelier-rail')).toBeTruthy();
  });

  test('候補カードはコスト降順で表示する', () => {
    const DeckBuilderRenderer = require('../ui/deck-builder-renderer');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    }).open();

    openEditor(body);

    const renderedIds = Array.from(body.querySelectorAll('.deck-builder-candidate-grid .deck-builder-card'))
      .map((element) => element.dataset.cardId);
    const expectedIds = DeckBuilderRenderer.getEnabledCardDefs()
      .slice()
      .sort((left, right) => {
        const leftCost = Number(left.cost) || 0;
        const rightCost = Number(right.cost) || 0;
        if (leftCost !== rightCost) return rightCost - leftCost;
        return String(left.id || '').localeCompare(String(right.id || ''), 'en');
      })
      .map((cardDef) => cardDef.id);

    expect(renderedIds).toEqual(expectedIds);
  });

  test('候補カードのコストはカード直下、タイプはメタデータだけに残す', () => {
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    }).open();

    openEditor(body);

    const firstCard = body.querySelector('.deck-builder-candidate-grid .deck-builder-card');
    expect(firstCard).toBeTruthy();

    const costBadge = firstCard.querySelector('.card-cost-badge');
    expect(costBadge).toBeTruthy();
    expect(costBadge.parentElement).toBe(firstCard);
    expect(firstCard.dataset.cardType).toBeTruthy();
    expect(firstCard.querySelector('.card-badge-row')).toBeNull();
    expect(firstCard.querySelector('.card-type-badge')).toBeNull();
  });

  test('固定プリセットデッキをデフォルトデッキの右側に集約して使用できる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    const controller = createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    });

    controller.open();

    const defaultRow = body.querySelector('.deck-builder-default-preset-row');
    expect(defaultRow).toBeTruthy();
    expect(defaultRow.querySelector('.deck-builder-standard-card .deck-builder-preset-title').textContent).toBe('デフォルトデッキ');

    const builtInSection = defaultRow.querySelector('.deck-builder-built-in-preset-section');
    expect(builtInSection).toBeTruthy();
    const builtInCards = Array.from(builtInSection.querySelectorAll('.deck-builder-built-in-preset-grid .deck-builder-preset-card'));
    expect(builtInCards.map((card) => card.querySelector('.deck-builder-preset-title').textContent)).toEqual([
      '観測デッキ',
      '執行デッキ',
      '理論デッキ',
      '冥灰デッキ'
    ]);

    const presetGrids = Array.from(body.querySelectorAll('.deck-builder-preset-grid'));
    const presetGrid = presetGrids[presetGrids.length - 1];
    expect(presetGrid).toBeTruthy();
    expect(defaultRow.compareDocumentPosition(presetGrid) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const theoryCard = builtInCards[2];
    const buttons = Array.from(theoryCard.querySelectorAll('button'));
    expect(buttons.map((button) => button.textContent)).toEqual(['使用', '編集']);
    buttons[0].click();

    expect(controller.getActiveLocalChoice()).toMatchObject({
      source: 'built-in-preset',
      mode: 'custom',
      name: '理論デッキ',
      deckCode: DeckSpecHelpers.getCpuLv7TheoryIncarnationWhiteDeckCode(),
      presetId: 'theory'
    });
    expect(document.getElementById('summary').textContent).toBe('理論デッキ / 30枚');
    expect(body.querySelector('.deck-builder-notice')).toBeNull();
    expect(body.querySelector('.deck-builder-effective-summary')).toBeNull();

    const endingAshCard = builtInCards[3];
    const endingAshButtons = Array.from(endingAshCard.querySelectorAll('button'));
    expect(endingAshButtons.map((button) => button.textContent)).toEqual(['使用', '編集']);
    endingAshButtons[0].click();

    expect(controller.getActiveLocalChoice()).toMatchObject({
      source: 'built-in-preset',
      mode: 'custom',
      name: '冥灰デッキ',
      deckCode: DeckSpecHelpers.getCpuLv8EndingAshDeckCode(),
      presetId: 'ending-ash'
    });
    expect(document.getElementById('summary').textContent).toBe('冥灰デッキ / 30枚');
  });

  test('固定プリセットデッキを編集し、保存先プリセットを選んで上書きできる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const body = document.getElementById('body');
    const controller = createController();

    controller.open();

    const builtInCards = Array.from(body.querySelectorAll('.deck-builder-built-in-preset-grid .deck-builder-preset-card'));
    const observeCard = builtInCards[0];
    const editButton = Array.from(observeCard.querySelectorAll('button')).find((button) => button.textContent === '編集');
    expect(editButton).toBeTruthy();

    editButton.click();

    const destinationSelect = body.querySelector('.deck-builder-preset-destination-select');
    expect(destinationSelect).toBeTruthy();
    expect(Array.from(destinationSelect.options).map((option) => option.textContent)).toEqual([
      '空きスロット 1',
      '空きスロット 2',
      '空きスロット 3',
      '空きスロット 4',
      '空きスロット 5',
      '空きスロット 6'
    ]);
    expect(destinationSelect.value).toBe('preset_1');
    expect(body.querySelector('.deck-builder-name-row input').value).toBe('観測デッキ');
    expect(body.querySelector('.deck-builder-code-input').value).toBe(DeckSpecHelpers.getCpuLv6WhiteDeckCode());

    destinationSelect.value = 'preset_4';
    destinationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    body.querySelector('.deck-builder-actions-row button').click();

    const stored = JSON.parse(localStorage.getItem('deck_builder_presets_v1'));
    const preset4 = stored.presets.find((preset) => preset.id === 'preset_4');
    expect(preset4).toMatchObject({
      id: 'preset_4',
      name: '観測デッキ',
      deckCode: DeckSpecHelpers.getCpuLv6WhiteDeckCode()
    });
  });

  test('デッキコード入力をコードコピーの右側へ1行で表示する', () => {
    const body = document.getElementById('body');

    createController().open();
    body.querySelector('.deck-builder-save-slot-card .btn-small:last-child').click();

    const actionRow = body.querySelector('.deck-builder-editor-actions');
    const codeInput = actionRow.querySelector('.deck-builder-code-input');
    const children = Array.from(actionRow.children);
    expect(codeInput.tagName).toBe('INPUT');
    expect(children[children.indexOf(codeInput) - 1].textContent).toBe('コードコピー');
    expect(body.querySelector('.deck-builder-code-block')).toBeNull();
  });

  test('保存先の右側から合法な30枚をランダム生成し、保存前の設定を維持する', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const DeckCodecModule = require('../shared/deck-codec.js');
    const body = document.getElementById('body');
    const controller = createController({ randomSource: () => 0 });

    controller.open();
    openEditor(body);

    const nameInput = body.querySelector('.deck-builder-name-row input');
    const destinationSelect = body.querySelector('.deck-builder-preset-destination-select');
    nameInput.value = 'ランダム候補';
    nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    destinationSelect.value = 'preset_3';
    destinationSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const storedBefore = localStorage.getItem('deck_builder_presets_v1');

    const randomizeButton = body.querySelector('.deck-builder-randomize-btn');
    expect(randomizeButton).toBeTruthy();
    expect(randomizeButton.textContent).toBe('ランダム生成');
    expect(randomizeButton.getAttribute('aria-label')).toBe('ランダムな30枚デッキを生成');
    expect(randomizeButton.querySelector('.deck-builder-randomize-die')?.getAttribute('aria-hidden')).toBe('true');
    expect(randomizeButton.previousElementSibling).toBe(destinationSelect);
    randomizeButton.click();

    const refreshedNameInput = body.querySelector('.deck-builder-name-row input');
    const refreshedDestinationSelect = body.querySelector('.deck-builder-preset-destination-select');
    const codeInput = body.querySelector('.deck-builder-code-input');
    const deckSpec = DeckCodecModule.decodeDeckCode(codeInput.value);
    const counts = deckSpec.cards.map((entry) => entry.count);

    expect(body.querySelector('.deck-builder-editor-summary').textContent).toBe('30/30枚 ・ 残り0枚');
    expect(document.getElementById('header').textContent).toBe('編集中: 30/30枚');
    expect(refreshedNameInput.value).toBe('ランダム候補');
    expect(refreshedDestinationSelect.value).toBe('preset_3');
    expect(localStorage.getItem('deck_builder_presets_v1')).toBe(storedBefore);
    expect(deckSpec.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(DeckSpecHelpers.CUSTOM_DECK_SIZE);
    expect(counts.some((count) => count > 1)).toBe(true);
    deckSpec.cards.forEach((entry) => {
      expect(entry.count).toBeLessThanOrEqual(DeckSpecHelpers.getMaxCopiesForCardId(entry.cardId));
    });
  });

  test('保存先選択は空欄と保存済みスロットを区別して表示する', () => {
    const { deckCode } = createThirtyCardDeck();
    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_2', 'お気に入り', deckCode)));

    const body = document.getElementById('body');
    const controller = createController();

    controller.open();

    const builtInCards = Array.from(body.querySelectorAll('.deck-builder-built-in-preset-grid .deck-builder-preset-card'));
    const observeCard = builtInCards[0];
    const editButton = Array.from(observeCard.querySelectorAll('button')).find((button) => button.textContent === '編集');
    expect(editButton).toBeTruthy();

    editButton.click();

    const destinationSelect = body.querySelector('.deck-builder-preset-destination-select');
    expect(destinationSelect).toBeTruthy();
    expect(Array.from(destinationSelect.options).map((option) => option.textContent)).toEqual([
      '空きスロット 1',
      '保存スロット 2（お気に入り）',
      '空きスロット 3',
      '空きスロット 4',
      '空きスロット 5',
      '空きスロット 6'
    ]);
  });

  test('候補カードは4回目の押下で0枚に戻り、スクロール位置を保つ', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    }).open();

    openEditor(body);

    const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
      .slice()
      .sort((left, right) => {
        const leftCost = Number(left.cost) || 0;
        const rightCost = Number(right.cost) || 0;
        if (leftCost !== rightCost) return rightCost - leftCost;
        return String(left.id || '').localeCompare(String(right.id || ''), 'en');
      })[0].id;

    body.scrollTop = 180;

    for (let index = 0; index < 4; index += 1) {
      const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
      expect(card).toBeTruthy();
      card.click();
    }

    const refreshedCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
    const countBadge = refreshedCard.querySelector('.deck-builder-count-badge');
    const footer = refreshedCard.querySelector('.deck-builder-card-footer');

    expect(body.scrollTop).toBe(180);
    expect(countBadge.textContent).toBe('x0');
    expect(footer.textContent).toBe('押すと追加');
  });

  test('候補カード追加で上側の内容が伸びても見えている位置を維持する', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    }).open();

    openEditor(body);

    const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
      .slice()
      .sort((left, right) => {
        const leftCost = Number(left.cost) || 0;
        const rightCost = Number(right.cost) || 0;
        if (leftCost !== rightCost) return rightCost - leftCost;
        return String(left.id || '').localeCompare(String(right.id || ''), 'en');
      })[0].id;

    const makeRect = (top) => ({
      top,
      left: 0,
      right: 120,
      bottom: top + 140,
      width: 120,
      height: 140
    });
    const originalGetBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect;
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this === body) {
        return makeRect(0);
      }
      const isTargetCandidate = this.classList &&
        this.classList.contains('deck-builder-card') &&
        this.dataset.cardId === targetCardId &&
        typeof this.closest === 'function' &&
        this.closest('.deck-builder-candidate-grid');
      if (isTargetCandidate) {
        const selectedCount = body.querySelectorAll('.deck-builder-selected-grid .deck-builder-card').length;
        return makeRect(selectedCount > 0 ? 320 : 220);
      }
      return makeRect(0);
    };

    try {
      body.scrollTop = 180;

      const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
      expect(card).toBeTruthy();
      card.click();

      expect(body.scrollTop).toBe(280);
    } finally {
      window.HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  test('候補カードが3枚のときは次の押下が0枚戻しになる案内を出す', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: document.getElementById('header'),
        body
      }
    }).open();

    openEditor(body);

    const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
      .slice()
      .sort((left, right) => {
        const leftCost = Number(left.cost) || 0;
        const rightCost = Number(right.cost) || 0;
        if (leftCost !== rightCost) return rightCost - leftCost;
        return String(left.id || '').localeCompare(String(right.id || ''), 'en');
      })[0].id;

    for (let index = 0; index < 3; index += 1) {
      const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
      expect(card).toBeTruthy();
      card.click();
    }

    const refreshedCard = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
    const countBadge = refreshedCard.querySelector('.deck-builder-count-badge');
    const footer = refreshedCard.querySelector('.deck-builder-card-footer');

    expect(countBadge.textContent).toBe('x3');
    expect(footer.textContent).toBe('次で0枚に戻す');
    expect(refreshedCard.classList.contains('deck-builder-card-disabled')).toBe(false);
  });

  test('編集中ヘッダに現在枚数を常時表示する', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const { createDeckBuilderController } = require('../ui/deck-builder-controller.js');
    const body = document.getElementById('body');
    const header = document.getElementById('header');

    createDeckBuilderController({
      root: window,
      refs: {
        openBtn: document.getElementById('openBtn'),
        controlSummary: document.getElementById('summary'),
        overlay: document.getElementById('overlay'),
        closeBtn: document.getElementById('closeBtn'),
        headerSummary: header,
        body
      }
    }).open();

    openEditor(body);
    expect(header.textContent).toBe('編集中: 0/30枚');

    const targetCardId = DeckSpecHelpers.getEnabledCardDefs()
      .slice()
      .sort((left, right) => {
        const leftCost = Number(left.cost) || 0;
        const rightCost = Number(right.cost) || 0;
        if (leftCost !== rightCost) return rightCost - leftCost;
        return String(left.id || '').localeCompare(String(right.id || ''), 'en');
      })[0].id;

    const card = body.querySelector(`.deck-builder-candidate-grid .deck-builder-card[data-card-id="${targetCardId}"]`);
    expect(card).toBeTruthy();
    card.click();

    expect(header.textContent).toBe('編集中: 1/30枚');
  });

  test('0枚デッキでも保存して使用できる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const DeckCodecModule = require('../shared/deck-codec.js');
    const body = document.getElementById('body');
    const controller = createController();
    const emptyDeckCode = `D1C${DeckSpecHelpers.getCatalogVersion()}:`;
    const emptyDeckSpec = DeckCodecModule.decodeDeckCode(emptyDeckCode);

    controller.open();
    openEditor(body);

    const buttons = Array.from(body.querySelectorAll('button'));
    const saveButton = buttons.find((button) => button.textContent === '保存');
    const useButton = buttons.find((button) => button.textContent === '使用');

    expect(saveButton).toBeTruthy();
    expect(useButton).toBeTruthy();
    expect(saveButton.disabled).toBe(false);
    expect(useButton.disabled).toBe(false);

    saveButton.click();

    const storedAfterSave = JSON.parse(localStorage.getItem('deck_builder_presets_v1'));
    expect(storedAfterSave.presets[0].deckCode).toBe(emptyDeckCode);

    const useButtonAfterSave = Array.from(body.querySelectorAll('button')).find((button) => button.textContent === '使用');
    expect(useButtonAfterSave).toBeTruthy();
    useButtonAfterSave.click();

    expect(controller.getActiveLocalChoice()).toMatchObject({
      mode: 'custom',
      source: 'preset',
      presetId: 'preset_1',
      deckCode: emptyDeckCode,
      deckSize: 0
    });
    expect(controller.readActiveDeckSpec()).toEqual(emptyDeckSpec);
    expect(controller.buildCardInitOptions()).toMatchObject({
      initialDeckSpecByPlayer: {
        black: emptyDeckSpec
      },
      boardConfig: expect.objectContaining({
        rows: 8,
        cols: 8,
        standard8x8: true
      })
    });
  });

  test('無効なURL deckCode は保存済みプリセットへ戻し、URLもローカル設定へ戻す', () => {
    const { deckSpec, deckCode } = createThirtyCardDeck(0);

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '保存デッキ', deckCode)));
    history.replaceState(null, '', '/?deck=broken-deck-code');

    const controller = createController();

    expect(controller.getActiveLocalChoice()).toMatchObject({
      mode: 'custom',
      source: 'preset',
      presetId: 'preset_1',
      deckCode
    });
    expect(controller.readActiveDeckSpec()).toEqual(deckSpec);
    expect(new URLSearchParams(window.location.search).get('deck')).toBe(deckCode);
  });

  test('room deck はローカル choice を残したまま実対局用の初期デッキを上書きする', () => {
    const localDeck = createThirtyCardDeck(0);
    const roomDeck = createThirtyCardDeck(10);

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', localDeck.deckCode)));
    window.NetworkMatchClient = {
      isActive: () => true,
      getRoomDeck: () => ({
        mode: 'shared',
        deckCode: roomDeck.deckCode,
        deckSize: 30,
        source: 'room'
      })
    };

      try {
        const controller = createController();

        expect(controller.getActiveLocalChoice()).toMatchObject({
          mode: 'custom',
          source: 'preset',
          deckCode: localDeck.deckCode
        });
      expect(controller.buildCardInitOptions()).toMatchObject({
        initialDeckSpec: roomDeck.deckSpec,
        boardConfig: expect.objectContaining({
          rows: 8,
          cols: 8,
          standard8x8: true
        })
      });
      expect(controller.readActiveDeckSpec()).toEqual(roomDeck.deckSpec);
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('ネット対戦中に保存プリセットを使用すると room の自席デッキへ同期する', () => {
    const { deckCode } = createThirtyCardDeck(0);
    const updateDeckSelection = jest.fn(() => Promise.resolve({ ok: true }));

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '保存デッキ', deckCode)));
    window.NetworkMatchClient = {
      isActive: () => true,
      isSpectator: () => false,
      getRoomDeck: () => null,
      updateDeckSelection
    };

    try {
      const controller = createController();
      controller.open();

      const presetUseButton = Array.from(document.querySelectorAll('.deck-builder-saved-deck-column > .deck-builder-preset-grid .deck-builder-preset-card button'))
        .find((button) => button.textContent === '使用');
      expect(presetUseButton).toBeTruthy();
      presetUseButton.click();

      expect(updateDeckSelection).toHaveBeenCalledTimes(1);
      expect(updateDeckSelection).toHaveBeenCalledWith(deckCode);
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('ネット対戦中にデフォルトデッキを使用すると room の自席デッキをデフォルトへ戻す', () => {
    const updateDeckSelection = jest.fn(() => Promise.resolve({ ok: true }));

    window.NetworkMatchClient = {
      isActive: () => true,
      isSpectator: () => false,
      getRoomDeck: () => null,
      updateDeckSelection
    };

    try {
      const controller = createController();
      controller.open();

      const standardUseButton = document.querySelector('.deck-builder-standard-card button');
      expect(standardUseButton).toBeTruthy();
      standardUseButton.click();

      expect(updateDeckSelection).toHaveBeenCalledTimes(1);
      expect(updateDeckSelection).toHaveBeenCalledWith('');
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('ネット対戦中のデッキ同期は直列化し、明示同期は最新選択の完了を待つ', async () => {
    const firstDeck = createThirtyCardDeck(0);
    const secondDeck = createThirtyCardDeck(10);
    let resolveFirstSync;
    const updateDeckSelection = jest.fn((deckCode) => {
      if (deckCode === firstDeck.deckCode) {
        return new Promise((resolve) => {
          resolveFirstSync = () => resolve({ ok: true });
        });
      }
      return Promise.resolve({ ok: true });
    });

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify({
      version: 1,
      activePresetId: '',
      presets: [
        { id: 'preset_1', name: '先のデッキ', deckCode: firstDeck.deckCode, updatedAt: 1 },
        { id: 'preset_2', name: '後のデッキ', deckCode: secondDeck.deckCode, updatedAt: 2 },
        { id: 'preset_3', name: '', deckCode: '', updatedAt: 3 },
        { id: 'preset_4', name: '', deckCode: '', updatedAt: 4 },
        { id: 'preset_5', name: '', deckCode: '', updatedAt: 5 },
        { id: 'preset_6', name: '', deckCode: '', updatedAt: 6 }
      ]
    }));
    window.NetworkMatchClient = {
      isActive: () => true,
      isSpectator: () => false,
      getRoomDeck: () => null,
      updateDeckSelection
    };

    try {
      const controller = createController();
      controller.open();

      const useButtons = Array.from(document.querySelectorAll('.deck-builder-saved-deck-column > .deck-builder-preset-grid .deck-builder-preset-card button'))
        .filter((button) => button.textContent === '使用' && !button.disabled);
      expect(useButtons).toHaveLength(2);

      useButtons[0].click();
      useButtons[1].click();

      expect(updateDeckSelection).toHaveBeenCalledTimes(1);
      expect(updateDeckSelection).toHaveBeenCalledWith(firstDeck.deckCode);

      const flushPromise = controller.syncActiveNetworkDeckSelection();
      await Promise.resolve();
      expect(updateDeckSelection).toHaveBeenCalledTimes(1);

      expect(typeof resolveFirstSync).toBe('function');
      resolveFirstSync();
      const flushResult = await flushPromise;

      expect(flushResult.ok).toBe(true);
      expect(updateDeckSelection.mock.calls.map((call) => call[0])).toEqual([
        firstDeck.deckCode,
        secondDeck.deckCode
      ]);
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('network room deck が player別なら黒白それぞれの初期デッキを返す', () => {
    const blackDeck = createThirtyCardDeck(0);
    const whiteDeck = createThirtyCardDeck(10);

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', blackDeck.deckCode)));
    window.NetworkMatchClient = {
      isActive: () => true,
      getSeatKey: () => 'black',
      getRoomDeck: () => ({
        mode: 'perPlayer',
        deckCodeByPlayer: {
          black: blackDeck.deckCode,
          white: whiteDeck.deckCode
        },
        deckSizeByPlayer: {
          black: 30,
          white: 30
        },
        source: 'room'
      })
    };

    try {
      const controller = createController();

      expect(controller.buildCardInitOptions()).toMatchObject({
        initialDeckSpecByPlayer: {
          black: blackDeck.deckSpec,
          white: whiteDeck.deckSpec
        },
        boardConfig: expect.objectContaining({
          rows: 8,
          cols: 8,
          standard8x8: true
        })
      });
      expect(controller.readActiveDeckSpec()).toEqual(blackDeck.deckSpec);
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('network room deck が player別 custom でも実対局の重複サマリーは表示しない', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const DeckCodecModule = require('../shared/deck-codec.js');
    const whiteDeck = createThirtyCardDeck(10);
    const emptyDeckCode = `D1C${DeckSpecHelpers.getCatalogVersion()}:`;

    window.NetworkMatchClient = {
      isActive: () => true,
      getSeatKey: () => 'black',
      getRoomDeck: () => ({
        mode: 'perPlayer',
        deckCodeByPlayer: {
          black: emptyDeckCode,
          white: whiteDeck.deckCode
        },
        deckSizeByPlayer: {
          black: 0,
          white: 30
        },
        source: 'room'
      })
    };

    try {
      const controller = createController();
      controller.open();

      expect(document.querySelector('.deck-builder-effective-summary')).toBeNull();
      expect(controller.readActiveDeckSpec()).toEqual(DeckCodecModule.decodeDeckCode(emptyDeckCode));
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('CPU対戦ではプレイヤー黒だけにカスタムデッキを渡し、CPU白はデフォルトデッキを維持する', () => {
    const localDeck = createThirtyCardDeck(0);

    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', localDeck.deckCode)));
    window.getCurrentMatchMode = () => 'cpu';

    const controller = createController();

    expect(controller.buildCardInitOptions()).toMatchObject({
      initialDeckSpecByPlayer: {
        black: localDeck.deckSpec
      },
      boardConfig: expect.objectContaining({
        rows: 8,
        cols: 8,
        standard8x8: true
      })
    });
    expect(controller.readActiveDeckSpec()).toEqual(localDeck.deckSpec);
  });

  test('network room boardConfig はローカル設定より優先される', () => {
    window.NetworkMatchClient = {
      isActive: () => true,
      getRoomBoardConfig: () => ({ rows: 7, cols: 9 })
    };

    try {
      const controller = createController();

      expect(controller.getLocalBoardConfig()).toMatchObject({
        rows: 8,
        cols: 8,
        standard8x8: true
      });
      expect(controller.readBoardConfig()).toMatchObject({
        rows: 7,
        cols: 9,
        standard8x8: false
      });
      expect(controller.buildCardInitOptions()).toMatchObject({
        boardConfig: expect.objectContaining({
          rows: 7,
          cols: 9,
          standard8x8: false
        })
      });
    } finally {
      delete window.NetworkMatchClient;
    }
  });

  test('SharedUIBootstrap helper 経由で turn_manager binding を同期する', () => {
    window.SharedUIBootstrap = require('../shared/ui-bootstrap-shared');

    createController();

    expect(window.__uiImpl_turn_manager).toEqual(expect.objectContaining({
      buildCardInitOptions: expect.any(Function),
      readBoardConfig: expect.any(Function),
      getLocalBoardConfig: expect.any(Function)
    }));
    expect(global.__uiImpl_turn_manager).toEqual(expect.objectContaining({
      buildCardInitOptions: expect.any(Function),
      readBoardConfig: expect.any(Function),
      getLocalBoardConfig: expect.any(Function)
    }));
    expect(window.__uiImpl_turn_manager.readBoardConfig()).toMatchObject({
      rows: 8,
      cols: 8,
      standard8x8: true
    });
  });

  test('setLocalBoardConfig はローカル盤面サイズを 16x16 上限で更新する', () => {
    const controller = createController();

    controller.setLocalBoardConfig({ rows: 17, cols: 18 });

    expect(controller.getLocalBoardConfig()).toMatchObject({
      rows: 16,
      cols: 16,
      standard8x8: false
    });
    expect(controller.readBoardConfig()).toMatchObject({
      rows: 16,
      cols: 16,
      standard8x8: false
    });
  });

  test('盤面サイズ入力はホイールで 16x16 まで増減できる', () => {
    const controller = createController();
    const rowsInput = document.getElementById('boardSizeRowsInput');
    const colsInput = document.getElementById('boardSizeColsInput');

    expect(rowsInput.max).toBe('16');
    expect(colsInput.max).toBe('16');

    rowsInput.value = '15';
    colsInput.value = '15';
    dispatchWheel(rowsInput, { deltaY: -100 });
    dispatchWheel(colsInput, { deltaY: -100 });

    expect(rowsInput.value).toBe('16');
    expect(colsInput.value).toBe('16');
    expect(controller.getLocalBoardConfig()).toMatchObject({
      rows: 16,
      cols: 16,
      standard8x8: false
    });
  });

  test('CPU対戦の片側カスタム指定でも白はデフォルトデッキ枚数を維持する', () => {
    const localDeck = createThirtyCardDeck(0);
    const CardLogic = require('../game/logic/cards.js');
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };

    const cardState = CardLogic.createCardState(prng, {
      initialDeckSpecByPlayer: {
        black: localDeck.deckSpec
      }
    });

    expect(cardState.decks.black).toEqual(DeckSpecHelpers.expandDeckSpec(localDeck.deckSpec));
    expect(cardState.initialDeckSizeByPlayer.black).toBe(30);
    expect(cardState.initialDeckSizeByPlayer.white).toBe(DeckSpecHelpers.getDefaultDeckSize());
    expect(cardState.decks.white).toHaveLength(DeckSpecHelpers.getDefaultDeckSize());
  });

  test('CPU Lv6対戦では白CPUだけ専用デッキを初期化オプションへ入れる', () => {
    window.getCurrentMatchMode = () => 'cpu';
    document.getElementById('smartWhite').value = '6';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const whiteCardIds = options.initialDeckSpecByPlayer.white.cards.map((entry) => entry.cardId);

    expect(options.initialDeckSpecByPlayer.black).toBeUndefined();
    expect(whiteCardIds).toContain('reinforcement_01');
    expect(whiteCardIds).toContain('observer_will_01');
    expect(whiteCardIds).toContain('support_troops_01');
    expect(options.initialDeckSpecByPlayer.white.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
  });

  test('CPU Lv6対戦ではプレイヤー黒カスタムと白CPU専用デッキを両立する', () => {
    const localDeck = createThirtyCardDeck(0);
    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', 'ローカル', localDeck.deckCode)));
    window.getCurrentMatchMode = () => 'cpu';
    document.getElementById('smartWhite').value = '6';

    const controller = createController();
    const options = controller.buildCardInitOptions();

    expect(options.initialDeckSpecByPlayer.black).toEqual(localDeck.deckSpec);
    expect(options.initialDeckSpecByPlayer.white.cards.map((entry) => entry.cardId)).toContain('reinforcement_01');
    expect(options.initialDeckSpecByPlayer.white.cards.map((entry) => entry.cardId)).toContain('observer_will_01');
    expect(options.initialDeckSpecByPlayer.white).not.toEqual(localDeck.deckSpec);
  });

  test('CPU Lv7盤界の執行者対戦では白CPUへ執行者専用デッキを入れる', () => {
    window.getCurrentMatchMode = () => 'cpu';
    const smartWhite = document.getElementById('smartWhite');
    const option = document.createElement('option');
    option.value = '7-board-executor';
    option.textContent = 'Lv7: 盤界の執行者';
    smartWhite.appendChild(option);
    smartWhite.value = '7-board-executor';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const whiteCardIds = options.initialDeckSpecByPlayer.white.cards.map((entry) => entry.cardId);

    expect(whiteCardIds).toContain('board_executor_01');
    expect(whiteCardIds).toContain('equality_will_01');
    expect(whiteCardIds).toContain('afterimage_will_01');
    expect(whiteCardIds).toContain('proliferation_01');
    expect(whiteCardIds).toContain('hyperactive_01');
    expect(whiteCardIds).not.toContain('observer_will_01');
    expect(whiteCardIds).not.toContain('hard_01');
    expect(whiteCardIds).not.toContain('buoyancy_01');
    expect(whiteCardIds).not.toContain('gravity_01');
    expect(whiteCardIds).not.toContain('heaven_01');
    expect(options.initialDeckSpecByPlayer.white.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
  });

  test('CPU Lv7盤界の執行者を黒に選ぶと黒CPUへ執行者専用デッキを入れる', () => {
    window.getCurrentMatchMode = () => 'cpu';
    const smartBlack = document.getElementById('smartBlack');
    const option = document.createElement('option');
    option.value = '7-board-executor';
    option.textContent = 'Lv7: 盤界の執行者';
    smartBlack.appendChild(option);
    smartBlack.value = '7-board-executor';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const blackCardIds = options.initialDeckSpecByPlayer.black.cards.map((entry) => entry.cardId);

    expect(blackCardIds).toContain('board_executor_01');
    expect(blackCardIds).toContain('equality_will_01');
    expect(blackCardIds).toContain('afterimage_will_01');
    expect(blackCardIds).toContain('proliferation_01');
    expect(blackCardIds).not.toContain('observer_will_01');
    expect(blackCardIds).not.toContain('hard_01');
    expect(options.initialDeckSpecByPlayer.white).toBeUndefined();
    expect(options.initialDeckSpecByPlayer.black.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
  });

  test('CPU Lv8理論の化身対戦では白CPUへ理論専用デッキと初期布石50を入れる', () => {
    window.getCurrentMatchMode = () => 'cpu';
    const smartWhite = document.getElementById('smartWhite');
    const option = document.createElement('option');
    option.value = '8-theory-incarnation';
    option.textContent = 'Lv8: 理論の化身';
    smartWhite.appendChild(option);
    smartWhite.value = '8-theory-incarnation';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const whiteCardIds = options.initialDeckSpecByPlayer.white.cards.map((entry) => entry.cardId);

    expect(whiteCardIds).toContain('theory_incarnation_01');
    expect(whiteCardIds).toContain('meteor_god_01');
    expect(whiteCardIds).not.toContain('observer_will_01');
    expect(whiteCardIds).not.toContain('board_executor_01');
    expect(options.initialDeckSpecByPlayer.white.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
    expect(options.initialChargeByPlayer).toEqual({ white: 50 });
  });

  test('CPU Lv8理論の化身を黒に選ぶと黒CPUへ理論専用デッキと初期布石50を入れる', () => {
    window.getCurrentMatchMode = () => 'cpu';
    const smartBlack = document.getElementById('smartBlack');
    const option = document.createElement('option');
    option.value = '8-theory-incarnation';
    option.textContent = 'Lv8: 理論の化身';
    smartBlack.appendChild(option);
    smartBlack.value = '8-theory-incarnation';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const blackCardIds = options.initialDeckSpecByPlayer.black.cards.map((entry) => entry.cardId);

    expect(blackCardIds).toContain('theory_incarnation_01');
    expect(blackCardIds).toContain('meteor_god_01');
    expect(blackCardIds).not.toContain('observer_will_01');
    expect(blackCardIds).not.toContain('board_executor_01');
    expect(options.initialDeckSpecByPlayer.white).toBeUndefined();
    expect(options.initialDeckSpecByPlayer.black.cards.reduce((sum, entry) => sum + entry.count, 0)).toBe(30);
    expect(options.initialChargeByPlayer).toEqual({ black: 50 });
  });

  test('CPU Lv9終焉の冥灰対戦では白CPUへ冥灰専用デッキと初期布石99を入れる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    window.getCurrentMatchMode = () => 'cpu';
    const smartWhite = document.getElementById('smartWhite');
    const option = document.createElement('option');
    option.value = '9-ending-ash';
    option.textContent = 'Lv9: 終焉の冥灰';
    smartWhite.appendChild(option);
    smartWhite.value = '9-ending-ash';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const whiteCardIds = options.initialDeckCardIdsByPlayer.white;

    expect(whiteCardIds).toContain('observer_will_01');
    expect(whiteCardIds).toContain('theory_incarnation_01');
    expect(whiteCardIds).toContain('board_executor_01');
    expect(whiteCardIds).toContain('meteor_god_01');
    expect(whiteCardIds).toContain('destroy_01');
    expect(whiteCardIds).toContain('board_expand_01');
    expect(whiteCardIds).not.toContain('triple_chain_01');
    expect(whiteCardIds).not.toContain('quad_chain_01');
    expect(whiteCardIds).not.toContain('infinite_chain_01');
    expect(whiteCardIds).not.toContain('triple_01');
    expect(whiteCardIds).not.toContain('quad_01');
    expect(whiteCardIds).not.toContain('infinite_01');
    expect(whiteCardIds).toEqual(DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds());
    expect(options.initialDeckSpecByPlayer).toBeUndefined();
    expect(options.initialChargeByPlayer).toEqual({ white: 99 });
    expect(options.chargeGainMultiplierByPlayer).toEqual({ white: 2 });
  });

  test('円形を選ぶと偶数の正方形サイズへ同期する', () => {
    const controller = createController();
    const shapeSelect = document.getElementById('boardShapeSelect');
    const rowsInput = document.getElementById('boardSizeRowsInput');
    const colsInput = document.getElementById('boardSizeColsInput');

    shapeSelect.value = 'circle';
    shapeSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

    expect(controller.getLocalBoardConfig()).toMatchObject({
      rows: 8,
      cols: 8,
      shape: 'circle',
      standard8x8: false,
    });
    expect(rowsInput.disabled).toBe(false);
    expect(colsInput.disabled).toBe(false);
    expect(rowsInput.min).toBe('6');
    expect(rowsInput.max).toBe('16');
    expect(rowsInput.step).toBe('2');
    expect(document.getElementById('boardSizeControlSummary').textContent).toBe('円形 8x8 / 52マス');
    expect(document.getElementById('boardSizeEditorNote').textContent).toContain('6〜16の偶数');

    rowsInput.value = '12';
    rowsInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(colsInput.value).toBe('12');
    expect(controller.getLocalBoardConfig()).toMatchObject({ rows: 12, cols: 12, shape: 'circle' });
    expect(document.getElementById('boardSizeControlSummary').textContent).toBe('円形 12x12 / 112マス');
  });

  test('CPU Lv9終焉の冥灰を黒に選ぶと黒CPUへ冥灰専用デッキと初期布石99を入れる', () => {
    const DeckSpecHelpers = require('../shared/deck-spec.js');
    window.getCurrentMatchMode = () => 'cpu';
    const smartBlack = document.getElementById('smartBlack');
    const option = document.createElement('option');
    option.value = '9-ending-ash';
    option.textContent = 'Lv9: 終焉の冥灰';
    smartBlack.appendChild(option);
    smartBlack.value = '9-ending-ash';
    const controller = createController();

    const options = controller.buildCardInitOptions();
    const blackCardIds = options.initialDeckCardIdsByPlayer.black;

    expect(blackCardIds).toContain('observer_will_01');
    expect(blackCardIds).toContain('theory_incarnation_01');
    expect(blackCardIds).toContain('board_executor_01');
    expect(blackCardIds).toContain('meteor_god_01');
    expect(blackCardIds).toContain('destroy_01');
    expect(blackCardIds).toContain('board_expand_01');
    expect(blackCardIds).not.toContain('triple_chain_01');
    expect(blackCardIds).not.toContain('quad_chain_01');
    expect(blackCardIds).not.toContain('infinite_chain_01');
    expect(blackCardIds).not.toContain('triple_01');
    expect(blackCardIds).not.toContain('quad_01');
    expect(blackCardIds).not.toContain('infinite_01');
    expect(blackCardIds).toEqual(DeckSpecHelpers.getCpuLv9EndingAshDeckCardIds());
    expect(options.initialDeckSpecByPlayer).toBeUndefined();
    expect(options.initialChargeByPlayer).toEqual({ black: 99 });
    expect(options.chargeGainMultiplierByPlayer).toEqual({ black: 2 });
  });

  test('無効な保存済みプリセットは activePresetId を外してデフォルトデッキへ戻す', () => {
    localStorage.setItem('deck_builder_presets_v1', JSON.stringify(buildPresetState('preset_1', '壊れたプリセット', 'broken-deck-code')));

    const controller = createController();

    expect(controller.getActiveLocalChoice()).toMatchObject({ mode: 'standard', source: 'standard' });
    expect(controller.buildCardInitOptions()).toMatchObject({
      boardConfig: expect.objectContaining({
        rows: 8,
        cols: 8,
        standard8x8: true
      })
    });

    const stored = JSON.parse(localStorage.getItem('deck_builder_presets_v1'));
    expect(stored.activePresetId).toBe('');
  });
});
