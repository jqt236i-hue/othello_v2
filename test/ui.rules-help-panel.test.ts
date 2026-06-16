import { JSDOM } from 'jsdom';
const fs = require('fs');
const path = require('path');
describe('rules help panel', () => {
  function setDom(html) {
    const dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
  }

  function dispatchPointer(target) {
    const ev = new Event('pointerdown', { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
  }

  beforeEach(() => {
    jest.resetModules();
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-backdrop" aria-hidden="true"></div>
      <div id="rules-help-panel" aria-hidden="true"><button id="rules-help-close-btn" type="button"></button><div id="inner"></div></div>
      <div id="board"></div>
    </body></html>`);
  });

  afterEach(() => {
    try { delete global.CardInteractionEffects; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.Event; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('opens by button and closes by outside click', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    const backdrop = document.getElementById('rules-help-backdrop');

    mod.setupRulesHelp(btn, panel);

    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(backdrop.classList.contains('is-open')).toBe(true);
    expect(backdrop.getAttribute('aria-hidden')).toBe('false');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    dispatchPointer(document.getElementById('inner'));
    expect(panel.classList.contains('is-open')).toBe(true);

    dispatchPointer(document.body);
    expect(panel.classList.contains('is-open')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(backdrop.classList.contains('is-open')).toBe(false);
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('backdrop click closes without reaching board handler', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    const backdrop = document.getElementById('rules-help-backdrop');
    const board = document.getElementById('board');

    let hit = 0;
    board.addEventListener('pointerdown', () => { hit += 1; });

    mod.setupRulesHelp(btn, panel);
    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);

    dispatchPointer(backdrop);
    expect(hit).toBe(0);
    expect(panel.classList.contains('is-open')).toBe(false);
  });

  test('closes by top-right close button', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    const backdrop = document.getElementById('rules-help-backdrop');
    const closeBtn = document.getElementById('rules-help-close-btn');

    mod.setupRulesHelp(btn, panel);
    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);

    closeBtn.click();
    expect(panel.classList.contains('is-open')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(backdrop.classList.contains('is-open')).toBe(false);
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('switches tabs and shows selected card effect from catalog', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
      </div>
    </body></html>`);
    window.CardInteractionEffects = {
      getQuickCardEffect: () => '多動状態 と 反転回避',
      getDetailCardEffect: () => '詳細: 特殊石'
    };
    window.GameVisualEffectsMap = {
      PENDING_TYPE_TO_EFFECT_KEY: { SPECIAL_A: 'specialStoneA' },
      STONE_VISUAL_EFFECTS: {
        specialStoneA: {
          imagePathByOwner: { '1': 'assets/images/stones/special-a-black.png' }
        }
      }
    };
    window.CardCatalog = {
      cards: [
        { id: 'c3', name: 'カード高', type: 'SPECIAL_A', cost: 7, desc: '効果3', display_type_ja: '禁忌' },
        { id: 'c1', name: 'カード低', type: 'SPECIAL_A', cost: 1, desc: '効果1', display_type_ja: '守護' },
        { id: 'c2', name: 'カード中', type: 'NORMAL_X', cost: 3, desc: '効果2', display_type_ja: '執行' }
      ]
    };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');

    mod.setupRulesHelp(btn, panel);
    btn.click();

    const cardButtons = Array.from(document.querySelectorAll('.rules-help-card-item'));
    expect(cardButtons).toHaveLength(3);
    expect(cardButtons[0].querySelector('.rules-help-type-badge').textContent).toBe('守護');
    expect(cardButtons[0].querySelector('.rules-help-card-cost-label').textContent).toBe('コスト1');
    expect(cardButtons[0].querySelector('.rules-help-card-item-name').textContent).toBe('カード低');
    expect(cardButtons[1].querySelector('.rules-help-type-badge').textContent).toBe('執行');
    expect(cardButtons[1].querySelector('.rules-help-card-cost-label').textContent).toBe('コスト3');
    expect(cardButtons[1].querySelector('.rules-help-card-item-name').textContent).toBe('カード中');
    expect(cardButtons[2].querySelector('.rules-help-type-badge').textContent).toBe('禁忌');
    expect(cardButtons[2].querySelector('.rules-help-card-cost-label').textContent).toBe('コスト7');
    expect(cardButtons[2].querySelector('.rules-help-card-item-name').textContent).toBe('カード高');
    const selectedHeading = document.getElementById('rules-help-card-name');
    expect(selectedHeading.querySelector('.rules-help-type-badge').textContent).toBe('守護');
    expect(selectedHeading.querySelector('.rules-help-card-cost-label').textContent).toBe('コスト1');
    expect(selectedHeading.querySelector('.rules-help-card-title').textContent).toBe('カード低');

    const cardDescEl = document.getElementById('rules-help-card-desc');
    expect(cardDescEl.textContent).toContain('簡易説明');
    expect(cardDescEl.textContent).toContain('詳細効果');
    expect(cardDescEl.querySelectorAll('.rules-help-term-highlight').length).toBeGreaterThan(0);
    expect(cardDescEl.querySelector('.rules-help-card-visual-image')).toBeTruthy();

    cardButtons[1].click();
    expect(selectedHeading.querySelector('.rules-help-type-badge').textContent).toBe('執行');
    expect(selectedHeading.querySelector('.rules-help-card-cost-label').textContent).toBe('コスト3');
    expect(selectedHeading.querySelector('.rules-help-card-title').textContent).toBe('カード中');
    expect(cardDescEl.querySelector('.rules-help-card-visual-image')).toBeFalsy();

    document.querySelector('[data-help-tab="effects"]').click();
    expect(document.getElementById('rules-help-page-effects').classList.contains('is-active')).toBe(true);
    expect(document.getElementById('rules-help-page-catalog').classList.contains('is-active')).toBe(false);

    document.querySelector('[data-help-tab="guide"]').click();
    expect(document.getElementById('rules-help-page-guide').classList.contains('is-active')).toBe(true);

    document.querySelector('[data-help-tab="counters"]').click();
    expect(document.getElementById('rules-help-page-counters').classList.contains('is-active')).toBe(true);

  });

  test('hides fully duplicated detail and keeps only non-duplicate detail sentences', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
      </div>
    </body></html>`);

    window.CardInteractionEffects = {
      getQuickCardEffect: () => '反転0でも空きマスに置ける。',
      getDetailCardEffect: (cardDef) => {
        if (cardDef && cardDef.id === 'dup-only') return '反転0でも空きマスに置ける。';
        return '反転0でも空きマスに置ける。\n次の1手だけ有効。';
      }
    };
    window.CardCatalog = {
      cards: [
        { id: 'dup-only', name: '重複カード', type: 'NORMAL_X', cost: 1, desc: '効果A' },
        { id: 'has-extra', name: '追加情報カード', type: 'NORMAL_Y', cost: 2, desc: '効果B' }
      ]
    };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const cardDescEl = document.getElementById('rules-help-card-desc');
    const titlesFirst = Array.from(cardDescEl.querySelectorAll('.rules-help-card-section-title')).map((el) => el.textContent);
    expect(titlesFirst).toContain('簡易説明');
    expect(titlesFirst).not.toContain('詳細効果');

    const cardButtons = Array.from(document.querySelectorAll('.rules-help-card-item'));
    cardButtons[1].click();

    const sections = Array.from(cardDescEl.querySelectorAll('.rules-help-card-section'));
    const detailSection = sections.find((section) => {
      const titleEl = section.querySelector('.rules-help-card-section-title');
      return titleEl && titleEl.textContent === '詳細効果';
    });

    expect(detailSection).toBeTruthy();
    const detailBody = detailSection.querySelector('.rules-help-card-section-body');
    expect(detailBody.textContent).toContain('次の1手だけ有効。');
    expect(detailBody.textContent).not.toContain('反転0でも空きマスに置ける。');
  });

  test('renders effect tag section from shared resolver and omits it when tags are empty', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
      </div>
    </body></html>`);

    window.CardInteractionEffects = {
      resolveCardDescriptionTexts: (cardDef) => ({
        quickText: cardDef.id === 'afterimage_will_01'
          ? '次に置く石は反転または破壊されたとき3回まで復活する。'
          : '自分石1つに完全保護を付与する。3ターン持続。',
        detailText: cardDef.id === 'afterimage_will_01'
          ? '次に置く石を残像石化する。\n回避に成功した時だけ対応する回数を消費する。'
          : '完全保護中は敵対的・強制的な石効果を受けない。',
        distinctDetailText: cardDef.id === 'afterimage_will_01'
          ? '次に置く石を残像石化する。\n回避に成功した時だけ対応する回数を消費する。'
          : '完全保護中は敵対的・強制的な石効果を受けない。',
        effectTags: cardDef.id === 'afterimage_will_01'
          ? [
            { kind: 'special-stone', label: '特殊石' },
            { kind: 'flip-evasion', value: 3, label: '反転回避' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避' }
          ]
          : [
            { kind: 'full-protection', label: '完全保護' },
            { kind: 'duration-turns', value: 3, label: '3ターン持続' }
          ],
        numericTags: cardDef.id === 'afterimage_will_01'
          ? [
            { kind: 'flip-evasion', value: 3, label: '反転回避' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避' }
          ]
          : [
            { kind: 'duration-turns', value: 3, label: '3ターン持続' }
          ]
      })
    };
    global.CardInteractionEffects = window.CardInteractionEffects;
    window.CardCatalog = {
      cards: [
        { id: 'afterimage_will_01', name: '避ける意志', type: 'AFTERIMAGE_WILL', cost: 1, desc: '効果A' },
        { id: 'guard_01', name: '守る意志', type: 'GUARD_WILL', cost: 4, desc: '効果B' }
      ]
    };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const cardDescEl = document.getElementById('rules-help-card-desc');
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-section-title')).map((el) => el.textContent)).toContain('効果タグ');
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).map((el) => el.textContent)).toEqual(['特殊石', '反転回避', '破壊回避']);
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).every((el) => el.tagName === 'BUTTON')).toBe(true);

    const specialStoneTag = Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag'))
      .find((el) => el.textContent === '特殊石') as HTMLButtonElement;
    specialStoneTag.click();
    const popover = document.querySelector('.rules-help-tag-popover') as HTMLElement;
    expect(popover.getAttribute('aria-hidden')).toBe('false');
    expect(popover.querySelector('.rules-help-tag-popover-title').textContent).toBe('特殊石');
    expect(popover.querySelector('.rules-help-tag-popover-body').textContent).toContain('盤面に残って次ターン以降も能力主体');

    const popoverClose = popover.querySelector('.rules-help-tag-popover-close') as HTMLButtonElement;
    popoverClose.click();
    expect(popover.getAttribute('aria-hidden')).toBe('true');

    const cardButtons = Array.from(document.querySelectorAll('.rules-help-card-item'));
    cardButtons[1].click();

    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-section-title')).map((el) => el.textContent)).toContain('効果タグ');
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).map((el) => el.textContent)).toEqual(['完全保護', '3ターン持続']);
    expect(cardDescEl.textContent).toContain('完全保護中は敵対的・強制的な石効果を受けない。');
  });

  test('filters card encyclopedia by search text and effect tag chips', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-catalog-controls">
            <input id="rules-help-card-search" type="search" />
            <button id="rules-help-card-filter-clear" type="button"></button>
            <div id="rules-help-card-tag-filters"></div>
            <div id="rules-help-card-filter-status"></div>
          </div>
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
      </div>
    </body></html>`);

    window.CardInteractionEffects = {
      resolveCardDescriptionTexts: (cardDef) => {
        const byId = {
          afterimage_will_01: {
            quickText: '次に置く石を残像石化する。',
            distinctDetailText: '反転回避と破壊回避を持つ。',
            effectTags: [
              { kind: 'special-stone', label: '特殊石' },
              { kind: 'delayed-activation-turns', value: 5, label: '5ターン後に発動' },
              { kind: 'flip-evasion', value: 3, label: '反転回避' },
              { kind: 'destroy-evasion', value: 3, label: '破壊回避' }
            ]
          },
          meteor_01: {
            quickText: 'マス1つを永続の穴にする。',
            distinctDetailText: '穴マスは配置できず反転経路を遮断する。',
            effectTags: [
              { kind: 'hole-cell', label: '穴マス化' }
            ]
          },
          guard_01: {
            quickText: '自分石1つに完全保護を付与する。',
            distinctDetailText: '完全保護中は敵対的な効果を受けない。',
            effectTags: [
              { kind: 'full-protection', label: '完全保護' },
              { kind: 'duration-turns', value: 3, label: '3ターン持続' }
            ]
          },
          hard_will_01: {
            quickText: '自分石1つに破壊保護を付与する。',
            distinctDetailText: '破壊保護中は石破壊と爆破による消滅だけを受けない。',
            effectTags: [
              { kind: 'destroy-protection', label: '破壊保護' },
              { kind: 'duration-turns', value: 8, label: '8ターン持続' }
            ]
          },
          blockade_01: {
            quickText: '空きマス1つを封鎖する。',
            distinctDetailText: '3ターン持続する封鎖マスを作る。',
            effectTags: [
              { kind: 'duration-turns', value: 3, label: '3ターン持続' }
            ]
          },
          supply_01: {
            quickText: '山札から2枚ドローする。',
            distinctDetailText: '',
            effectTags: []
          }
        };
        return byId[cardDef.id] || { quickText: cardDef.desc, distinctDetailText: '', effectTags: [] };
      }
    };
    global.CardInteractionEffects = window.CardInteractionEffects;
    window.CardCatalog = {
      cards: [
        { id: 'guard_01', name: '守る意志', type: 'GUARD_WILL', cost: 1, desc: '完全保護を付与する', display_type_ja: '守護' },
        { id: 'hard_will_01', name: '硬い意志', type: 'HARD_WILL', cost: 4, desc: '破壊保護を付与する', display_type_ja: '守護' },
        { id: 'meteor_01', name: '因果抹消', type: 'METEOR_WILL', cost: 10, desc: 'マスを穴にする', display_type_ja: '禁忌' },
        { id: 'afterimage_will_01', name: '避ける意志', type: 'AFTERIMAGE_WILL', cost: 8, desc: '残像石化する', display_type_ja: '回避' },
        { id: 'blockade_01', name: '封鎖の意志', type: 'BLOCKADE_WILL', cost: 7, desc: '封鎖マスを作る', display_type_ja: '妨害' },
        { id: 'supply_01', name: '補給の意志', type: 'SUPPLY_WILL', cost: 2, desc: '山札から2枚ドロー', display_type_ja: '補給' }
      ]
    };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const searchInput = document.getElementById('rules-help-card-search') as HTMLInputElement;
    const clearButton = document.getElementById('rules-help-card-filter-clear');
    const filterStatus = document.getElementById('rules-help-card-filter-status');
    const tagLabels = () => Array.from(document.querySelectorAll('.rules-help-card-tag-filter')).map((el) => el.textContent);
    const cardNames = () => Array.from(document.querySelectorAll('.rules-help-card-item-name')).map((el) => el.textContent);
    const selectedTitle = () => document.querySelector('#rules-help-card-name .rules-help-card-title').textContent;

    expect(cardNames()).toEqual(['守る意志', '補給の意志', '硬い意志', '封鎖の意志', '避ける意志', '因果抹消']);
    expect(tagLabels()).toEqual(['特殊石', '穴マス化', '完全保護', '破壊保護', '反転回避', '破壊回避']);
    expect(tagLabels()).not.toContain('5ターン後に発動');
    expect(tagLabels()).not.toContain('3ターン持続');
    expect(filterStatus.textContent).toContain('6 / 6枚');

    searchInput.value = '完全保護';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(cardNames()).toEqual(['守る意志']);
    expect(selectedTitle()).toBe('守る意志');
    expect(filterStatus.textContent).toContain('1 / 6枚');

    clearButton.click();
    expect(cardNames()).toEqual(['守る意志', '補給の意志', '硬い意志', '封鎖の意志', '避ける意志', '因果抹消']);
    expect(searchInput.value).toBe('');

    const specialStoneFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '特殊石') as HTMLButtonElement;
    specialStoneFilter.click();

    expect(specialStoneFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['避ける意志']);
    expect(selectedTitle()).toBe('避ける意志');

    clearButton.click();

    const holeCellFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '穴マス化') as HTMLButtonElement;
    holeCellFilter.click();

    expect(holeCellFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['因果抹消']);
    expect(selectedTitle()).toBe('因果抹消');

    clearButton.click();

    const destroyProtectionFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '破壊保護') as HTMLButtonElement;
    destroyProtectionFilter.click();

    expect(destroyProtectionFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['硬い意志']);
    expect(selectedTitle()).toBe('硬い意志');

    clearButton.click();

    const flipEvasionFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '反転回避') as HTMLButtonElement;
    flipEvasionFilter.click();

    expect(flipEvasionFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['避ける意志']);
    expect(selectedTitle()).toBe('避ける意志');
    expect(filterStatus.textContent).toContain('1 / 6枚');

    searchInput.value = '山札';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(document.querySelectorAll('.rules-help-card-item')).toHaveLength(0);
    expect(document.getElementById('rules-help-card-list').textContent).toContain('条件に合うカードがありません');
    expect(document.getElementById('rules-help-card-name').textContent).toBe('検索結果なし');
  });

  test('effect glossary list includes 反転回避 and 破壊回避 entries', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*反転回避\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*破壊回避\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*破壊保護\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*破壊／爆発\s*<\/dt>\s*<dd>石を消滅させる。完全保護や破壊保護など、破壊を防ぐ状態の石は消滅しない。<\/dd>/);
  });

  test('effect glossary list includes 封鎖 and 凍結 and 時間停止 entries', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*封鎖\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*凍結\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*時間停止\s*<\/dt>/);
  });

  test('effect glossary shares card tag descriptions and includes inviolable', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page">
          <dl id="rules-help-effects-list"></dl>
        </section>
      </div>
    </body></html>`);
    window.CardCatalog = { cards: [] };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);

    const effectTerms = Array.from(document.querySelectorAll('#rules-help-effects-list dt')).map((el) => el.textContent);
    expect(effectTerms).toEqual(expect.arrayContaining(['特殊石', '穴マス化', '不可侵', '反転保護', '完全保護', '破壊保護', '反転回避', '破壊回避']));

    const inviolableButton = Array.from(document.querySelectorAll('#rules-help-effects-list .rules-help-effect-term-button'))
      .find((el) => el.textContent === '不可侵') as HTMLButtonElement;
    inviolableButton.click();

    const popover = document.querySelector('.rules-help-tag-popover') as HTMLElement;
    expect(popover.getAttribute('aria-hidden')).toBe('false');
    expect(popover.querySelector('.rules-help-tag-popover-title').textContent).toBe('不可侵');
    expect(popover.querySelector('.rules-help-tag-popover-body').textContent).toContain('通常のカード効果や手札効果の対象から外す');

    const destroyProtectionButton = Array.from(document.querySelectorAll('#rules-help-effects-list .rules-help-effect-term-button'))
      .find((el) => el.textContent === '破壊保護') as HTMLButtonElement;
    destroyProtectionButton.click();

    expect(popover.querySelector('.rules-help-tag-popover-title').textContent).toBe('破壊保護');
    expect(popover.querySelector('.rules-help-tag-popover-body').textContent).toContain('破壊効果だけを受けない');
  });

  test('effect glossary explains taboo reverse absolute-protection exception', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*禁忌反転\s*<\/dt>\s*<dd>挟めなくても反転可能。絶対保護を除いて強制反転し、実際に反転する枚数が最大の列1方向のみ選ぶ。<\/dd>/);
  });

  test('rules-help.js EFFECT_GLOSSARY_TERMS includes glossary highlight additions', () => {
    // Load the module and check the exported or internal glossary terms list.
    // The module uses EFFECT_GLOSSARY_TERMS to highlight card descriptions.
    // This test verifies newly documented terms are registered for highlight.
    const source = fs.readFileSync(path.resolve(__dirname, '../ui/handlers/rules-help.js'), 'utf8');
    expect(source).toContain('絶対保護');
    expect(source).toContain('封鎖');
    expect(source).toContain('凍結');
    expect(source).toContain('時間停止');
    expect(source).toContain('破壊保護');
  });

  test('index html omits update info help tab', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).not.toMatch(/data-help-tab="updates"/);
    expect(html).not.toMatch(/アップデート情報/);
    expect(html).not.toMatch(/id="rules-help-updates-list"/);
  });

  test('index html includes card encyclopedia search and tag filter controls', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/id="rules-help-card-search"/);
    expect(html).toMatch(/id="rules-help-card-tag-filters"/);
    expect(html).toMatch(/id="rules-help-card-filter-status"/);
    expect(html).toMatch(/id="rules-help-card-filter-clear"/);
  });

  test('index html and css include rules help backdrop layer', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const css = fs.readFileSync(path.resolve(__dirname, '../styles-layout-info.css'), 'utf8');

    expect(html).toMatch(/id="rules-help-backdrop"/);
    expect(css).toMatch(/#rules-help-backdrop\s*\{/);
    expect(css).toMatch(/#rules-help-backdrop\.is-open\s*\{/);
    expect(css).toMatch(/#rules-help-panel\.is-open\s*\{/);
  });

  test('index html includes stone marker help tab and key legend texts', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const boardCss = fs.readFileSync(path.resolve(__dirname, '../styles-board.css'), 'utf8');
    expect(html).toMatch(/data-help-tab="guide">ルールと操作<\/button>/);
    expect(html).toMatch(/data-help-tab="counters">石マーカー<\/button>/);
    expect(html).not.toMatch(/data-help-tab="counters">数字UI<\/button>/);
    expect(html).toMatch(/盤面の緑の強調マスが置ける場所です。マスを押すと石を置きます。/);
    expect(html).toMatch(/完全保護の残りターン/);
    expect(html).toMatch(/特殊石本体の持続ターン/);
    expect(html).toMatch(/下中央の赤い三角形数字/);
    expect(html).toMatch(/カウントダウン専用の残り回数/);
    expect(html).toMatch(/中央左の灰色バッジ/);
    expect(html).toMatch(/反転保護の目印/);
    expect(html).toMatch(/stone-flip-protection-badge/);
    expect(html).toMatch(/右上の数字/);
    expect(html).not.toMatch(/右側の縦寄り数字/);
    expect(boardCss).toMatch(/\.guard-timer\s*\{[\s\S]*?top:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.bomb-timer,\s*\.countdown-timer\s*\{[\s\S]*?bottom:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.stone-destroy-protection-timer\s*\{[\s\S]*?top:\s*calc\(-5px \* var\(--layout-stage-scale\)\);[\s\S]*?left:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.stone-flip-protection-badge\s*\{[\s\S]*?left:\s*calc\(-7px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.stone-timer\.flip-evade-timer,[\s\S]*?right:\s*calc\(-5px \* var\(--layout-stage-scale\)\);[\s\S]*?top:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.stone-timer\.destroy-evade-timer,[\s\S]*?left:\s*calc\(-5px \* var\(--layout-stage-scale\)\);[\s\S]*?bottom:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).not.toMatch(/\.stone-timer\.flip-evade-timer,[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(-50%\);/);
    expect(html).not.toMatch(/下中央のひし形数字/);
    expect(html).toMatch(/破壊回避の残り回数/);
  });

  test('special stone duration timer classes share the green duration palette', () => {
    const boardCss = fs.readFileSync(path.resolve(__dirname, '../styles-board.css'), 'utf8');
    const cssRules = Array.from(boardCss.matchAll(/([^{}]+)\{([^{}]+)\}/g)).map((match) => ({
      selectors: match[1].split(',').map((selector) => selector.trim()),
      body: match[2]
    }));

    for (const className of ['special-timer', 'dragon-timer', 'breeding-timer', 'work-timer', 'udg-timer']) {
      const hasGreenDurationRule = cssRules.some((one) => (
        one.selectors.includes(`.${className}`) &&
        /rgba\(40, 86, 60, 0\.64\)/.test(one.body)
      ));
      expect(hasGreenDurationRule).toBe(true);
    }
  });

  test('special stone duration timer frames stay compact around the number', () => {
    const boardCss = fs.readFileSync(path.resolve(__dirname, '../styles-board.css'), 'utf8');
    const cssRules = Array.from(boardCss.matchAll(/([^{}]+)\{([^{}]+)\}/g)).map((match) => ({
      selectors: match[1].split(',').map((selector) => selector.trim()),
      body: match[2]
    }));

    for (const className of ['special-timer', 'dragon-timer', 'breeding-timer', 'work-timer', 'udg-timer']) {
      const declarations = cssRules
        .filter((one) => one.selectors.includes(`.${className}`))
        .map((one) => one.body)
        .join('\n');
      expect(declarations).toMatch(/line-height:\s*1;/);
      expect(declarations).toMatch(/height:\s*calc\(14px \* var\(--layout-stage-scale\)\);/);
      expect(declarations).toMatch(/padding:\s*0 calc\(4px \* var\(--layout-stage-scale\)\);/);
    }
  });

  test('index html guide copy points to current menu and stone-info controls', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/左下メニューで「CPU」\/「リバーシ」\/「ネット対戦」を切り替えられます。/);
    expect(html).toMatch(/音量やBGMはクイック操作や設定から調整できます。/);
    expect(html).toMatch(/石情報は、マウスでは石にカーソルを合わせるだけで、タッチでは石を1回タップすると確認できます。/);
    expect(html).toMatch(/数字の詳しい意味も、石情報で確認できます。/);
    expect(html).not.toMatch(/右下パネルで「CPU \/ ネット対戦」、音量、BGMを調整できます。/);
    expect(html).not.toMatch(/長押しすると/);
  });

});
