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
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <button data-help-tab="updates" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
        <section data-help-page="updates" id="rules-help-page-updates" class="rules-help-page"><div id="rules-help-updates-list"></div></section>
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

    document.querySelector('[data-help-tab="updates"]').click();
    expect(document.getElementById('rules-help-page-updates').classList.contains('is-active')).toBe(true);
    const updatesText = document.getElementById('rules-help-updates-list').textContent;
    expect(updatesText).toContain('v1.0');
    expect(updatesText).toContain('時間停石を実装');
    expect(updatesText).toContain('ネット対戦関連の問題を修正');
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
        <button data-help-tab="updates" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
        <section data-help-page="updates" id="rules-help-page-updates" class="rules-help-page"><div id="rules-help-updates-list"></div></section>
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
        <button data-help-tab="updates" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="counters" id="rules-help-page-counters" class="rules-help-page"></section>
        <section data-help-page="updates" id="rules-help-page-updates" class="rules-help-page"><div id="rules-help-updates-list"></div></section>
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
            { kind: 'flip-evasion', value: 3, label: '反転回避3回' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避3回' }
          ]
          : [
            { kind: 'full-protection', label: '完全保護' },
            { kind: 'duration-turns', value: 3, label: '3T持続' }
          ],
        numericTags: cardDef.id === 'afterimage_will_01'
          ? [
            { kind: 'flip-evasion', value: 3, label: '反転回避3回' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避3回' }
          ]
          : [
            { kind: 'duration-turns', value: 3, label: '3T持続' }
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
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).map((el) => el.textContent)).toEqual(['反転回避3回', '破壊回避3回']);

    const cardButtons = Array.from(document.querySelectorAll('.rules-help-card-item'));
    cardButtons[1].click();

    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-section-title')).map((el) => el.textContent)).toContain('効果タグ');
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).map((el) => el.textContent)).toEqual(['完全保護', '3T持続']);
    expect(cardDescEl.textContent).toContain('完全保護中は敵対的・強制的な石効果を受けない。');
  });

  test('effect glossary list includes 反転回避 and 破壊回避 entries', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*反転回避\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*破壊回避\s*<\/dt>/);
  });

  test('effect glossary list includes 封鎖 and 凍結 and 時間停止 entries', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<dt>\s*封鎖\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*凍結\s*<\/dt>/);
    expect(html).toMatch(/<dt>\s*時間停止\s*<\/dt>/);
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
  });

  test('index html includes update info help tab', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/data-help-tab="updates">アップデート情報<\/button>/);
    expect(html).toMatch(/id="rules-help-updates-list"/);
  });

  test('index html includes counter ui help tab and key legend texts', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/data-help-tab="guide">ルールと操作<\/button>/);
    expect(html).toMatch(/data-help-tab="counters">数字UI<\/button>/);
    expect(html).toMatch(/盤面の緑の強調マスが置ける場所です。マスを押すと石を置きます。/);
    expect(html).toMatch(/完全保護の残りターン/);
    expect(html).toMatch(/特殊石本体の持続ターン/);
    expect(html).toMatch(/カウントダウン専用の残り回数/);
    expect(html).toMatch(/継承多動の残りターン/);
    expect(html).toMatch(/破壊回避の残り回数/);
  });

});
