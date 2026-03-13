const { JSDOM } = require('jsdom');
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
      <div id="rules-help-panel" aria-hidden="true"><button id="rules-help-close-btn" type="button"></button><div id="inner"></div></div>
      <div id="board"></div>
    </body></html>`);
  });

  afterEach(() => {
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.Event; } catch (e) {}
  });

  test('opens by button and closes by outside click', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');

    mod.setupRulesHelp(btn, panel);

    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    dispatchPointer(document.getElementById('inner'));
    expect(panel.classList.contains('is-open')).toBe(true);

    dispatchPointer(document.body);
    expect(panel.classList.contains('is-open')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('outside click still reaches board handler', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    const board = document.getElementById('board');

    let hit = 0;
    board.addEventListener('pointerdown', () => { hit += 1; });

    mod.setupRulesHelp(btn, panel);
    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);

    dispatchPointer(board);
    expect(hit).toBe(1);
    expect(panel.classList.contains('is-open')).toBe(false);
  });

  test('closes by top-right close button', () => {
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    const closeBtn = document.getElementById('rules-help-close-btn');

    mod.setupRulesHelp(btn, panel);
    btn.click();
    expect(panel.classList.contains('is-open')).toBe(true);

    closeBtn.click();
    expect(panel.classList.contains('is-open')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  test('switches tabs and shows selected card effect from catalog', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="rules" class="rules-help-tab" type="button"></button>
        <button data-help-tab="controls" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="rules" id="rules-help-page-rules" class="rules-help-page"></section>
        <section data-help-page="controls" id="rules-help-page-controls" class="rules-help-page"></section>
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
        { id: 'c3', name: 'カード高', type: 'SPECIAL_A', cost: 7, desc: '効果3' },
        { id: 'c1', name: 'カード低', type: 'SPECIAL_A', cost: 1, desc: '効果1' },
        { id: 'c2', name: 'カード中', type: 'NORMAL_X', cost: 3, desc: '効果2' }
      ]
    };

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');

    mod.setupRulesHelp(btn, panel);
    btn.click();

    const cardButtons = Array.from(document.querySelectorAll('.rules-help-card-item'));
    expect(cardButtons).toHaveLength(3);
    expect(cardButtons[0].textContent).toBe('コスト1 カード低');
    expect(cardButtons[1].textContent).toBe('コスト3 カード中');
    expect(cardButtons[2].textContent).toBe('コスト7 カード高');
    expect(document.getElementById('rules-help-card-name').textContent).toBe('コスト1 カード低');

    const cardDescEl = document.getElementById('rules-help-card-desc');
    expect(cardDescEl.textContent).toContain('簡易説明');
    expect(cardDescEl.textContent).toContain('詳細効果');
    expect(cardDescEl.querySelectorAll('.rules-help-term-highlight').length).toBeGreaterThan(0);
    expect(cardDescEl.querySelector('.rules-help-card-visual-image')).toBeTruthy();

    cardButtons[1].click();
    expect(document.getElementById('rules-help-card-name').textContent).toBe('コスト3 カード中');
    expect(cardDescEl.querySelector('.rules-help-card-visual-image')).toBeFalsy();

    document.querySelector('[data-help-tab="effects"]').click();
    expect(document.getElementById('rules-help-page-effects').classList.contains('is-active')).toBe(true);
    expect(document.getElementById('rules-help-page-catalog').classList.contains('is-active')).toBe(false);

    document.querySelector('[data-help-tab="rules"]').click();
    expect(document.getElementById('rules-help-page-rules').classList.contains('is-active')).toBe(true);

    document.querySelector('[data-help-tab="controls"]').click();
    expect(document.getElementById('rules-help-page-controls').classList.contains('is-active')).toBe(true);
  });

  test('hides fully duplicated detail and keeps only non-duplicate detail sentences', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="rules" class="rules-help-tab" type="button"></button>
        <button data-help-tab="controls" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="rules" id="rules-help-page-rules" class="rules-help-page"></section>
        <section data-help-page="controls" id="rules-help-page-controls" class="rules-help-page"></section>
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

  test('effect glossary list includes 反転回避 entry', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*反転回避\s*<\/dt>/);
  });

});
