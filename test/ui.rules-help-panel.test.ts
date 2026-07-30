import { JSDOM } from 'jsdom';
const fs = require('fs');
const path = require('path');
const { readDomCompatBoardCssSurface } = require('./helpers/css-test-helpers');

function readRulesHelpTemplateSource(): string {
  return fs.readFileSync(path.resolve(__dirname, '../ui/handlers/rules-help-template.ts'), 'utf8');
}

function readRulesHelpLayoutCssSurface(): string {
  return [
    fs.readFileSync(path.resolve(__dirname, '../styles-layout-info.css'), 'utf8'),
    fs.readFileSync(path.resolve(__dirname, '../styles-feature-rules-help-layout-info.css'), 'utf8')
  ].join('\n');
}

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
    try { delete (global as any).Image; } catch (e) { /* Intentionally empty: test cleanup guard */ }
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

  test('defers the large help catalog until the panel is opened', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" class="rules-help-page">
          <dl id="rules-help-effects-list"></dl>
        </section>
      </div>
    </body></html>`);
    window.CardCatalog = { cards: [] };
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');

    mod.setupRulesHelp(btn, panel);
    expect(document.getElementById('rules-help-effects-list').children).toHaveLength(0);

    btn.click();
    expect(document.getElementById('rules-help-effects-list').children.length).toBeGreaterThan(0);
  });

  test('lazy shell creates styles and inner DOM once across close and reopen', async () => {
    setDom(`<!doctype html><html><head>
      <base href="https://example.test/">
      <meta data-card-reversi-feature-style-slot="rules-help-layout-info"
        data-card-reversi-feature-style-href="styles-feature-rules-help-layout-info.css">
      <meta data-card-reversi-feature-style-slot="rules-help-cards"
        data-card-reversi-feature-style-href="styles-feature-rules-help-cards.css">
      <meta data-card-reversi-feature-style-slot="rules-help-responsive"
        data-card-reversi-feature-style-href="styles-feature-rules-help-responsive.css">
    </head><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-backdrop" aria-hidden="true"></div>
      <div id="rules-help-panel" aria-hidden="true"></div>
    </body></html>`);
    (window as any).DEBUG_MODE_ALLOWED = true;
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = () => Promise.resolve();
      set src(_value: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    }
    (global as any).Image = LoadedImage;
    const mod = require('../ui/handlers/rules-help.js');
    const lazySurface = require('../ui/assets/lazy-feature-surface.ts');
    const btn = document.getElementById('rulesHelpBtn') as HTMLButtonElement;
    const panel = document.getElementById('rules-help-panel') as HTMLElement;
    const controller = mod.setupRulesHelp(btn, panel);
    const styleLinks = () => Array.from(document.querySelectorAll(
      'link[data-card-reversi-feature-style^="rules-help"]'
    )) as HTMLLinkElement[];

    expect(panel.childElementCount).toBe(0);
    expect(styleLinks()).toHaveLength(0);

    const readyPromise = controller.ensureReady();
    expect(panel.querySelector('#rules-help-title-row')).not.toBeNull();
    expect(styleLinks()).toHaveLength(3);
    styleLinks().forEach((link) => link.dispatchEvent(new window.Event('load')));
    await readyPromise;
    controller.setOpen(true);
    await Promise.resolve();

    expect(panel.classList.contains('is-open')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const titleRow = panel.querySelector('#rules-help-title-row');
    const diagnosticsAfterOpen = lazySurface.getLazyFeatureSurfaceDiagnostics(
      mod.RULES_HELP_SURFACE_ID,
      document
    );
    expect(diagnosticsAfterOpen).toMatchObject({
      status: 'ready',
      attemptCount: 1,
      stylesheetEnsureCount: 3,
      domEnsureCount: 1,
      domCreatedCount: 1,
      readyCount: 1,
      failureCount: 0
    });

    (panel.querySelector('#rules-help-close-btn') as HTMLButtonElement).click();
    expect(panel.classList.contains('is-open')).toBe(false);
    btn.click();
    await Promise.resolve();

    expect(panel.classList.contains('is-open')).toBe(true);
    expect(panel.querySelector('#rules-help-title-row')).toBe(titleRow);
    expect(styleLinks()).toHaveLength(3);
    expect(lazySurface.getLazyFeatureSurfaceDiagnostics(
      mod.RULES_HELP_SURFACE_ID,
      document
    )).toEqual(diagnosticsAfterOpen);
  });

  test('lazy shell removes partial work after stylesheet failure and retries', async () => {
    setDom(`<!doctype html><html><head>
      <base href="https://example.test/">
      <meta data-card-reversi-feature-style-slot="rules-help-layout-info"
        data-card-reversi-feature-style-href="styles-feature-rules-help-layout-info.css">
      <meta data-card-reversi-feature-style-slot="rules-help-cards"
        data-card-reversi-feature-style-href="styles-feature-rules-help-cards.css">
      <meta data-card-reversi-feature-style-slot="rules-help-responsive"
        data-card-reversi-feature-style-href="styles-feature-rules-help-responsive.css">
    </head><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-backdrop" aria-hidden="true"></div>
      <div id="rules-help-panel" aria-hidden="true"></div>
    </body></html>`);
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = () => Promise.resolve();
      set src(_value: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    }
    (global as any).Image = LoadedImage;
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn') as HTMLButtonElement;
    const panel = document.getElementById('rules-help-panel') as HTMLElement;
    const controller = mod.setupRulesHelp(btn, panel);
    const styleLinks = () => Array.from(document.querySelectorAll(
      'link[data-card-reversi-feature-style^="rules-help"]'
    )) as HTMLLinkElement[];

    const failedPromise = controller.ensureReady();
    const firstAttemptLinks = styleLinks();
    expect(firstAttemptLinks).toHaveLength(3);
    firstAttemptLinks[0].dispatchEvent(new window.Event('error'));
    firstAttemptLinks.slice(1).forEach((link) => link.dispatchEvent(new window.Event('load')));
    await expect(failedPromise).rejects.toThrow();
    await Promise.resolve();

    expect(styleLinks()).toHaveLength(0);
    expect(panel.querySelector('#rules-help-title-row')).toBeNull();
    expect(panel.classList.contains('rules-help-surface-failure')).toBe(true);
    expect(panel.textContent).toContain('もう一度押すと再試行');

    (panel.querySelector('button') as HTMLButtonElement).click();
    expect(panel.childElementCount).toBe(0);
    const retryPromise = controller.ensureReady();
    const retryLinks = styleLinks();
    expect(retryLinks).toHaveLength(3);
    retryLinks.forEach((link) => link.dispatchEvent(new window.Event('load')));
    await retryPromise;
    controller.setOpen(true);
    await Promise.resolve();

    expect(panel.classList.contains('is-open')).toBe(true);
    expect(panel.querySelector('#rules-help-title-row')).not.toBeNull();
    expect(styleLinks()).toHaveLength(3);
  });

  test('backdrop click closes, returns focus, and does not reach board handler', async () => {
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
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(document.activeElement).toBe(btn);
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
        <button data-help-tab="protection-map" class="rules-help-tab" type="button"></button>
        <button data-help-tab="counters" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page"></section>
        <section data-help-page="protection-map" id="rules-help-page-protection-map" class="rules-help-page"></section>
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
    const highlightedTerms = Array.from(cardDescEl.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(highlightedTerms.length).toBeGreaterThan(0);
    expect(highlightedTerms.every((el) => el.className.includes('game-term-highlight--'))).toBe(true);
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

    document.querySelector('[data-help-tab="protection-map"]').click();
    expect(document.getElementById('rules-help-page-protection-map').classList.contains('is-active')).toBe(true);

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
          : '自石を1つ選び、完全保護を付与。穴マス以外の全ての効果を無効化する。',
        detailText: cardDef.id === 'afterimage_will_01'
          ? '次に置く石を残像石化する。\n回避に成功した時だけ対応する回数を消費する。'
          : '自石を1つ選び、完全保護を付与。穴マス以外の全ての効果を無効化する。',
        distinctDetailText: cardDef.id === 'afterimage_will_01'
          ? '次に置く石を残像石化する。\n回避に成功した時だけ対応する回数を消費する。'
          : '',
        effectTags: cardDef.id === 'afterimage_will_01'
          ? [
            { kind: 'usage-condition', label: '18手後使用可能' },
            { kind: 'special-stone', label: '特殊石' },
            { kind: 'flip-evasion', value: 3, label: '反転回避3回' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避3回' }
          ]
          : [
            { kind: 'full-protection', label: '完全保護' },
            { kind: 'duration-turns', value: 3, label: '3ターン持続' }
          ],
        numericTags: cardDef.id === 'afterimage_will_01'
          ? [
            { kind: 'flip-evasion', value: 3, label: '反転回避3回' },
            { kind: 'destroy-evasion', value: 3, label: '破壊回避3回' }
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
    expect(Array.from(cardDescEl.querySelectorAll('.rules-help-card-tag')).map((el) => el.textContent)).toEqual(['特殊石', '反転回避3回', '破壊回避3回']);
    expect(cardDescEl.textContent).not.toContain('18手後使用可能');
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
    expect(cardDescEl.textContent).toContain('穴マス以外の全ての効果を無効化する。');
  });

  test('filters card encyclopedia by search text and effect tag chips', () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab" type="button"></button>
        <button data-help-tab="protection-map" class="rules-help-tab" type="button"></button>
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
        <section data-help-page="protection-map" id="rules-help-page-protection-map" class="rules-help-page"></section>
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
              { kind: 'usage-condition', label: '18手後使用可能' },
              { kind: 'special-stone', label: '特殊石' },
              { kind: 'delayed-activation-turns', value: 5, label: '5ターン後に発動' },
              { kind: 'flip-evasion', value: 3, label: '反転回避3回' },
              { kind: 'destroy-evasion', value: 3, label: '破壊回避3回' }
            ]
          },
          meteor_01: {
            quickText: 'マス1つを永続の穴にする。',
            distinctDetailText: '穴マスは配置できず反転経路を遮断する。',
            effectTags: [
              { kind: 'hole-cell', label: '穴マス' }
            ]
          },
          guard_01: {
            quickText: '自石を1つ選び、完全保護を付与。穴マス以外の全ての効果を無効化する。',
            distinctDetailText: '',
            effectTags: [
              { kind: 'full-protection', label: '完全保護' },
              { kind: 'duration-turns', value: 3, label: '3ターン持続' }
            ]
          },
          blockade_01: {
            quickText: '空きマス1つを封鎖する。',
            distinctDetailText: '3ターン持続する封鎖マスを作る。',
            effectTags: [
              { kind: 'duration-turns', value: 3, label: '3ターン持続' }
            ]
          },
          silver_stone: {
            quickText: '次の反転で得る布石を3倍にする。',
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
        { id: 'meteor_01', name: '因果抹消', type: 'METEOR_WILL', cost: 10, desc: 'マスを穴にする', display_type_ja: '禁忌' },
        { id: 'afterimage_will_01', name: '避ける意志', type: 'AFTERIMAGE_WILL', cost: 8, desc: '残像石化する', display_type_ja: '回避' },
        { id: 'blockade_01', name: '封鎖の意志', type: 'BLOCKADE_WILL', cost: 7, desc: '封鎖マスを作る', display_type_ja: '妨害' },
        { id: 'silver_stone', name: '銀の意志', type: 'SILVER_STONE', cost: 2, desc: '次の反転で得る布石を3倍にする', display_type_ja: '採掘' }
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

    expect(cardNames()).toEqual(['守る意志', '銀の意志', '封鎖の意志', '避ける意志', '因果抹消']);
    expect(tagLabels()).toEqual(['特殊石', '穴マス', '完全保護', '反転回避', '破壊回避']);
    expect(tagLabels()).not.toContain('18手後使用可能');
    expect(tagLabels()).not.toContain('5ターン後に発動');
    expect(tagLabels()).not.toContain('3ターン持続');
    expect(filterStatus.textContent).toContain('5 / 5枚');

    searchInput.value = '完全保護';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(cardNames()).toEqual(['守る意志']);
    expect(selectedTitle()).toBe('守る意志');
    expect(filterStatus.textContent).toContain('1 / 5枚');

    clearButton.click();
    expect(cardNames()).toEqual(['守る意志', '銀の意志', '封鎖の意志', '避ける意志', '因果抹消']);
    expect(searchInput.value).toBe('');

    const specialStoneFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '特殊石') as HTMLButtonElement;
    specialStoneFilter.click();

    expect(specialStoneFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['避ける意志']);
    expect(selectedTitle()).toBe('避ける意志');

    clearButton.click();

    const holeCellFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '穴マス') as HTMLButtonElement;
    holeCellFilter.click();

    expect(holeCellFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['因果抹消']);
    expect(selectedTitle()).toBe('因果抹消');

    clearButton.click();

    const flipEvasionFilter = Array.from(document.querySelectorAll('.rules-help-card-tag-filter'))
      .find((el) => el.textContent === '反転回避') as HTMLButtonElement;
    flipEvasionFilter.click();

    expect(flipEvasionFilter.getAttribute('aria-pressed')).toBe('true');
    expect(cardNames()).toEqual(['避ける意志']);
    expect(selectedTitle()).toBe('避ける意志');
    expect(filterStatus.textContent).toContain('1 / 5枚');

    searchInput.value = '山札';
    searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(document.querySelectorAll('.rules-help-card-item')).toHaveLength(0);
    expect(document.getElementById('rules-help-card-list').textContent).toContain('条件に合うカードがありません');
    expect(document.getElementById('rules-help-card-name').textContent).toBe('検索結果なし');
  });

  test('effect glossary list includes 反転回避 and 破壊回避 entries', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).toMatch(/<dt>\s*反転回避\s*<\/dt>/);
    expect(template).toMatch(/<dt>\s*破壊回避\s*<\/dt>/);
    expect(template).toMatch(/<dt>\s*破壊／爆発\s*<\/dt>\s*<dd>石を破壊して盤面から消す効果。反転保護では防げないが、完全保護・不可侵には効かない。<\/dd>/);
  });

  test('effect glossary list includes 封鎖 and 凍結 and 時間停止 entries', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).toMatch(/<dt>\s*封鎖\s*<\/dt>/);
    expect(template).toMatch(/<dt>\s*凍結\s*<\/dt>/);
    expect(template).toMatch(/<dt>\s*時間停止\s*<\/dt>/);
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
    btn.click();

    const effectTerms = Array.from(document.querySelectorAll('#rules-help-effects-list dt')).map((el) => el.textContent);
    expect(effectTerms).toEqual(expect.arrayContaining(['特殊石', '穴マス', '絶対執行', '不可侵', '反転保護', '完全保護', '反転回避', '破壊回避']));

    const inviolableButton = Array.from(document.querySelectorAll('#rules-help-effects-list .rules-help-effect-term-button'))
      .find((el) => el.textContent === '不可侵') as HTMLButtonElement;
    inviolableButton.click();

    const popover = document.querySelector('.rules-help-tag-popover') as HTMLElement;
    expect(popover.getAttribute('aria-hidden')).toBe('false');
    expect(popover.querySelector('.rules-help-tag-popover-title').textContent).toBe('不可侵');
    expect(popover.querySelector('.rules-help-tag-popover-body').textContent).toContain('盤面干渉効果の対象から外す');

  });

  test('rules help card descriptions use shared longest-match term highlighting', () => {
    setDom(`<!doctype html><html><body>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
        <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
      </div>
    </body></html>`);
    window.CardCatalog = {
      cards: [{
        id: 'sample',
        name: '説明確認',
        type: 'SAMPLE',
        cost: 1,
        display_type_ja: '守護',
        desc: '反転保護を持つ特殊石。マス破壊は受ける。'
      }]
    };
    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.createElement('button');
    btn.id = 'rulesHelpBtn';
    btn.setAttribute('aria-expanded', 'false');
    document.body.insertBefore(btn, document.body.firstChild);
    const panel = document.getElementById('rules-help-panel') as HTMLElement;

    mod.setupRulesHelp(btn, panel);
    btn.click();

    const cardDescEl = document.getElementById('rules-help-card-desc') as HTMLElement;
    const terms = Array.from(cardDescEl.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(terms.map((el) => el.textContent)).toEqual(['反転保護', '特殊石', 'マス破壊']);
    expect(terms.map((el) => el.dataset.termCategory)).toEqual(['protection', 'stone', 'destroy']);
    expect(cardDescEl.querySelectorAll('[data-term-label="反転"]')).toHaveLength(0);
  });

  test('effect glossary explains taboo reverse behavior', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).toMatch(/<dt>\s*禁忌反転\s*<\/dt>\s*<dd>挟めなくても反転可能。実際に反転する枚数が最大の列1方向のみ選ぶ。<\/dd>/);
  });

  test('rules-help.js EFFECT_GLOSSARY_TERMS includes glossary highlight additions', () => {
    // Load the module and check the exported or internal glossary terms list.
    // The module uses EFFECT_GLOSSARY_TERMS to highlight card descriptions.
    // This test verifies newly documented terms are registered for highlight.
    const source = fs.readFileSync(path.resolve(__dirname, '../ui/handlers/rules-help.js'), 'utf8');
    expect(source).toContain('不可侵');
    expect(source).toContain('封鎖');
    expect(source).toContain('凍結');
    expect(source).toContain('時間停止');
  });

  test('index html omits update info help tab', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).not.toMatch(/data-help-tab="updates"/);
    expect(template).not.toMatch(/アップデート情報/);
    expect(template).not.toMatch(/id="rules-help-updates-list"/);
  });

  test('lazy template includes card encyclopedia search and tag filter controls', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).toMatch(/id="rules-help-card-search"/);
    expect(template).toMatch(/id="rules-help-card-tag-filters"/);
    expect(template).toMatch(/id="rules-help-card-filter-status"/);
    expect(template).toMatch(/id="rules-help-card-filter-clear"/);
  });

  test('lazy template includes slide-based rules guide controls', () => {
    const template = readRulesHelpTemplateSource();
    const classicHtml = fs.readFileSync(path.resolve(__dirname, '../index.classic.html'), 'utf8');
    expect(template).toMatch(/id="rules-help-guide-slide-img"/);
    expect(template).not.toMatch(/id="rules-help-guide-slide-img"[^>]+\ssrc=/s);
    expect(template).toMatch(/data-card-reversi-logical-src="assets\/images\/help\/player-guide\/card-reversi-player-guide-slide-01\.png"/);
    expect(template).toMatch(/id="rules-help-guide-slide-img"[^>]+width="1920"[^>]+height="1080"/s);
    expect(template).toMatch(/id="rules-help-guide-prev"/);
    expect(template).toMatch(/id="rules-help-guide-next"/);
    expect(template).toMatch(/id="rules-help-guide-page-status"/);
    expect(classicHtml).not.toMatch(/id="rules-help-guide-slide-img"/);
  });

  test('lazy template includes protection penetration map help tab and image', () => {
    const template = readRulesHelpTemplateSource();
    const classicHtml = fs.readFileSync(path.resolve(__dirname, '../index.classic.html'), 'utf8');
    expect(template).toMatch(/data-help-tab="protection-map">耐性貫通表<\/button>/);
    expect(template).toMatch(/id="rules-help-page-protection-map"/);
    expect(template).toMatch(/id="rules-help-protection-map-img"/);
    expect(template).not.toMatch(/id="rules-help-protection-map-img"[^>]+\ssrc=/s);
    expect(template).toMatch(/data-card-reversi-logical-src="assets\/images\/help\/protection-penetration\/protection-penetration-quick-reference\.png"/);
    expect(template).toMatch(/id="rules-help-protection-map-img"[^>]+width="1600"[^>]+height="1080"/s);
    expect(template).toMatch(/alt="耐性貫通の〇×早見表 1 \/ 2"/);
    expect(template).toMatch(/id="rules-help-protection-map-prev"/);
    expect(template).toMatch(/id="rules-help-protection-map-next"/);
    expect(template).toMatch(/id="rules-help-protection-map-page-status"/);
    expect(classicHtml).not.toMatch(/id="rules-help-protection-map-img"/);
  });

  test('protection map next and previous buttons page through explainer and quick reference images', async () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab" type="button"></button>
        <button data-help-tab="protection-map" class="rules-help-tab is-active" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="protection-map" id="rules-help-page-protection-map" class="rules-help-page is-active">
          <button id="rules-help-protection-map-prev" type="button">前へ</button>
          <span id="rules-help-protection-map-page-status"></span>
          <button id="rules-help-protection-map-next" type="button">次へ</button>
          <img id="rules-help-protection-map-img" src="assets/images/help/protection-penetration/protection-penetration-quick-reference.png" alt="耐性貫通の〇×早見表 1 / 2">
        </section>
      </div>
    </body></html>`);

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const img = document.getElementById('rules-help-protection-map-img') as HTMLImageElement;
    const prev = document.getElementById('rules-help-protection-map-prev') as HTMLButtonElement;
    const next = document.getElementById('rules-help-protection-map-next') as HTMLButtonElement;
    const status = document.getElementById('rules-help-protection-map-page-status') as HTMLElement;

    expect(img.getAttribute('src')).toBe('assets/images/help/protection-penetration/protection-penetration-quick-reference.png');
    expect(img.getAttribute('alt')).toBe('耐性貫通の〇×早見表 1 / 2');
    expect(status.textContent).toBe('1 / 2');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    await Promise.resolve();
    expect(img.getAttribute('src')).toBe('assets/images/help/protection-penetration/protection-penetration-explainer.png');
    expect(img.getAttribute('alt')).toBe('耐性と貫通の関係図 2 / 2');
    expect(status.textContent).toBe('2 / 2');
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    prev.click();
    await Promise.resolve();
    expect(img.getAttribute('src')).toBe('assets/images/help/protection-penetration/protection-penetration-quick-reference.png');
    expect(status.textContent).toBe('1 / 2');
    expect(prev.disabled).toBe(true);
  });

  test('rules guide next and previous buttons page through slide images', async () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="catalog" class="rules-help-tab" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab is-active" type="button"></button>
        <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page">
          <div id="rules-help-card-list"></div>
          <div id="rules-help-card-name"></div>
          <div id="rules-help-card-desc"></div>
        </section>
        <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page is-active">
          <button id="rules-help-guide-prev" type="button">前へ</button>
          <span id="rules-help-guide-page-status"></span>
          <button id="rules-help-guide-next" type="button">次へ</button>
          <img id="rules-help-guide-slide-img" src="assets/images/help/player-guide/card-reversi-player-guide-slide-01.png" alt="カードリバーシ説明スライド 1 / 8">
        </section>
      </div>
    </body></html>`);

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const img = document.getElementById('rules-help-guide-slide-img') as HTMLImageElement;
    const prev = document.getElementById('rules-help-guide-prev') as HTMLButtonElement;
    const next = document.getElementById('rules-help-guide-next') as HTMLButtonElement;
    const status = document.getElementById('rules-help-guide-page-status') as HTMLElement;

    expect(img.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-01.png');
    expect(img.getAttribute('alt')).toBe('カードリバーシ説明スライド 1 / 8');
    expect(status.textContent).toBe('1 / 8');
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.click();
    await Promise.resolve();
    expect(img.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-02.png');
    expect(img.getAttribute('alt')).toBe('カードリバーシ説明スライド 2 / 8');
    expect(status.textContent).toBe('2 / 8');
    expect(prev.disabled).toBe(false);

    prev.click();
    await Promise.resolve();
    expect(img.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-01.png');
    expect(status.textContent).toBe('1 / 8');
    expect(prev.disabled).toBe(true);
  });

  test('rules guide keeps the current slide visible until the next image is loaded', async () => {
    const createdImages: Array<any> = [];
    const originalImage = (global as any).Image;
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }
    (global as any).Image = DeferredImage as any;
    try {
      setDom(`<!doctype html><html><body>
        <button id="rulesHelpBtn" aria-expanded="false"></button>
        <div id="rules-help-panel" aria-hidden="true">
          <button id="rules-help-close-btn" type="button"></button>
          <button data-help-tab="catalog" class="rules-help-tab" type="button"></button>
          <button data-help-tab="guide" class="rules-help-tab is-active" type="button"></button>
          <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page">
            <div id="rules-help-card-list"></div>
            <div id="rules-help-card-name"></div>
            <div id="rules-help-card-desc"></div>
          </section>
          <section data-help-page="guide" id="rules-help-page-guide" class="rules-help-page is-active">
            <button id="rules-help-guide-prev" type="button">前へ</button>
            <span id="rules-help-guide-page-status"></span>
            <button id="rules-help-guide-next" type="button">次へ</button>
            <img id="rules-help-guide-slide-img" src="assets/images/help/player-guide/card-reversi-player-guide-slide-01.png" alt="カードリバーシ説明スライド 1 / 8">
          </section>
        </div>
      </body></html>`);

      const mod = require('../ui/handlers/rules-help.js');
      const btn = document.getElementById('rulesHelpBtn');
      const panel = document.getElementById('rules-help-panel');
      mod.setupRulesHelp(btn, panel);
      btn.click();

      const img = document.getElementById('rules-help-guide-slide-img') as HTMLImageElement;
      const next = document.getElementById('rules-help-guide-next') as HTMLButtonElement;
      const status = document.getElementById('rules-help-guide-page-status') as HTMLElement;

      next.click();
      expect(img.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-01.png');
      expect(status.textContent).toBe('1 / 8');

      const pendingSlide = createdImages.find((one) => one.src.endsWith('card-reversi-player-guide-slide-02.png'));
      expect(pendingSlide).toBeTruthy();
      pendingSlide.onload();
      await Promise.resolve();

      expect(img.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-02.png');
      expect(status.textContent).toBe('2 / 8');
    } finally {
      if (originalImage) {
        (global as any).Image = originalImage;
      } else {
        try { delete (global as any).Image; } catch (e) { /* Intentionally empty: test cleanup guard */ }
      }
    }
  });

  test('rules guide ignores a stale preload after returning to the current slide', async () => {
    const createdImages: Array<any> = [];
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }
    (global as any).Image = DeferredImage;
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button data-help-tab="guide" class="rules-help-tab is-active" type="button"></button>
        <section data-help-page="guide" class="rules-help-page is-active">
          <button id="rules-help-guide-prev" type="button">前へ</button>
          <span id="rules-help-guide-page-status">1 / 8</span>
          <button id="rules-help-guide-next" type="button">次へ</button>
          <img id="rules-help-guide-slide-img"
            src="assets/images/help/player-guide/card-reversi-player-guide-slide-01.png"
            alt="カードリバーシ説明スライド 1 / 8">
        </section>
      </div>
    </body></html>`);

    const mod = require('../ui/handlers/rules-help.js');
    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    const img = document.getElementById('rules-help-guide-slide-img') as HTMLImageElement;
    (document.getElementById('rules-help-guide-next') as HTMLButtonElement).click();
    const pendingSlide = createdImages.find((one) => (
      one.src.endsWith('card-reversi-player-guide-slide-02.png')
    ));
    expect(pendingSlide).toBeTruthy();

    document.dispatchEvent(new window.KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true
    }));
    pendingSlide.onload();
    await Promise.resolve();

    expect(img.getAttribute('src')).toBe(
      'assets/images/help/player-guide/card-reversi-player-guide-slide-01.png'
    );
    expect(document.getElementById('rules-help-guide-page-status').textContent).toBe('1 / 8');
  });

  test('shares logical image preparation per document and retries a failed URL', async () => {
    const createdImages: Array<any> = [];
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }

    const mod = require('../ui/handlers/rules-help.js');
    const first = mod.prepareHelpImage(document, 'assets/images/help/test.png', {
      ImageCtor: DeferredImage
    });
    const joined = mod.prepareHelpImage(document, 'assets/images/help/test.png', {
      ImageCtor: DeferredImage
    });
    expect(joined).toBe(first);
    expect(createdImages).toHaveLength(1);

    createdImages[0].onload();
    await expect(first).resolves.toEqual({
      src: 'assets/images/help/test.png',
      status: 'loaded'
    });
    expect(mod.prepareHelpImage(document, 'assets/images/help/test.png', {
      ImageCtor: DeferredImage
    })).toBe(first);
    expect(createdImages).toHaveLength(1);

    const failed = mod.prepareHelpImage(document, 'assets/images/help/retry.png', {
      ImageCtor: DeferredImage
    });
    expect(createdImages).toHaveLength(2);
    createdImages[1].onerror();
    await expect(failed).resolves.toEqual({
      src: 'assets/images/help/retry.png',
      status: 'failed'
    });
    await Promise.resolve();

    const retry = mod.prepareHelpImage(document, 'assets/images/help/retry.png', {
      ImageCtor: DeferredImage
    });
    expect(retry).not.toBe(failed);
    expect(createdImages).toHaveLength(3);
    createdImages[2].onload();
    await expect(retry).resolves.toEqual({
      src: 'assets/images/help/retry.png',
      status: 'loaded'
    });

    class ThrowingImage {
      constructor() {
        throw new Error('constructor failed');
      }
    }
    await expect(mod.prepareHelpImage(document, 'assets/images/help/throws.png', {
      ImageCtor: ThrowingImage
    })).resolves.toEqual({
      src: 'assets/images/help/throws.png',
      status: 'failed'
    });
    await expect(mod.prepareHelpImage(document, 'assets/images/help/fetch-throws.png', {
      ImageCtor: DeferredImage,
      fetchFn: () => {
        throw new Error('fetch failed');
      },
      createObjectURLFn: () => 'blob:unused'
    })).resolves.toEqual({
      src: 'assets/images/help/fetch-throws.png',
      status: 'failed'
    });
  });

  test('shares one fetched Blob URL between decode preparation and later display', async () => {
    const createdImages: Array<any> = [];
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }
    const fetchFn = jest.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['help-image'], { type: 'image/png' })
    }));
    const createObjectURLFn = jest.fn(() => 'blob:rules-help-image');
    const mod = require('../ui/handlers/rules-help.js');

    const first = mod.prepareHelpImage(document, 'assets/images/help/blob.png', {
      ImageCtor: DeferredImage,
      fetchFn,
      createObjectURLFn
    });
    const joined = mod.prepareHelpImage(document, 'assets/images/help/blob.png', {
      ImageCtor: DeferredImage,
      fetchFn,
      createObjectURLFn
    });
    expect(joined).toBe(first);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(createObjectURLFn).toHaveBeenCalledTimes(1);
    expect(createdImages).toHaveLength(1);
    expect(createdImages[0].src).toBe('blob:rules-help-image');
    createdImages[0].onload();
    await expect(first).resolves.toEqual({
      src: 'assets/images/help/blob.png',
      status: 'loaded',
      displaySrc: 'blob:rules-help-image'
    });
  });

  test('idle prefetch rechecks board settlement before preparing initial images', async () => {
    const createdImages: Array<any> = [];
    const idleCallbacks: Array<() => void> = [];
    let mode = 'playback';
    let settlementPending = true;
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }
    const controller = {
      waitForIdle: jest.fn(async () => undefined),
      getMode: jest.fn(() => mode),
      isIdleSettlementPending: jest.fn(() => settlementPending)
    };
    const mod = require('../ui/handlers/rules-help.js');
    const handle = mod.scheduleInitialHelpImageIdlePrefetch(controller, {
      documentRef: document,
      ImageCtor: DeferredImage,
      requestIdleCallback: (callback) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      },
      cancelIdleCallback: jest.fn()
    });

    await Promise.resolve();
    expect(controller.waitForIdle).toHaveBeenCalledTimes(1);
    expect(idleCallbacks).toHaveLength(1);
    expect(createdImages).toHaveLength(0);

    (idleCallbacks.shift() as () => void)();
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.waitForIdle).toHaveBeenCalledTimes(2);
    expect(idleCallbacks).toHaveLength(1);
    expect(createdImages).toHaveLength(0);

    mode = 'idle';
    settlementPending = false;
    (idleCallbacks.shift() as () => void)();
    await Promise.resolve();
    expect(createdImages).toHaveLength(2);
    createdImages.forEach((image) => image.onload());
    await handle.promise;
  });

  test('opening help joins an in-flight idle preparation and binds reserved image frames', async () => {
    setDom(`<!doctype html><html><body>
      <button id="rulesHelpBtn" aria-expanded="false"></button>
      <div id="rules-help-panel" aria-hidden="true">
        <button id="rules-help-close-btn" type="button"></button>
        <button data-help-tab="guide" class="rules-help-tab is-active" type="button"></button>
        <section data-help-page="guide" class="rules-help-page is-active">
          <div id="rules-help-guide-slide-frame">
            <img id="rules-help-guide-slide-img"
              data-card-reversi-logical-src="assets/images/help/player-guide/card-reversi-player-guide-slide-01.png"
              width="1920" height="1080" alt="カードリバーシ説明スライド 1 / 8">
          </div>
          <span id="rules-help-guide-page-status">1 / 8</span>
        </section>
        <section data-help-page="protection-map" class="rules-help-page">
          <div id="rules-help-protection-map-frame">
            <img id="rules-help-protection-map-img"
              data-card-reversi-logical-src="assets/images/help/protection-penetration/protection-penetration-quick-reference.png"
              width="1600" height="1080" alt="耐性貫通の〇×早見表 1 / 2">
          </div>
          <span id="rules-help-protection-map-page-status">1 / 2</span>
        </section>
      </div>
    </body></html>`);

    const createdImages: Array<any> = [];
    const idleCallbacks: Array<() => void> = [];
    class DeferredImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      src = '';

      constructor() {
        createdImages.push(this);
      }
    }
    (global as any).Image = DeferredImage;
    const controller = {
      waitForIdle: jest.fn(async () => undefined),
      getMode: jest.fn(() => 'idle'),
      isIdleSettlementPending: jest.fn(() => false)
    };
    const mod = require('../ui/handlers/rules-help.js');
    const handle = mod.scheduleInitialHelpImageIdlePrefetch(controller, {
      documentRef: document,
      requestIdleCallback: (callback) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      },
      cancelIdleCallback: jest.fn()
    });
    await Promise.resolve();
    (idleCallbacks.shift() as () => void)();
    await Promise.resolve();
    expect(createdImages).toHaveLength(2);

    const btn = document.getElementById('rulesHelpBtn');
    const panel = document.getElementById('rules-help-panel');
    mod.setupRulesHelp(btn, panel);
    btn.click();

    expect(createdImages).toHaveLength(2);
    expect(panel.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('rules-help-guide-slide-frame').getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById('rules-help-protection-map-frame').getAttribute('aria-busy')).toBe('true');

    createdImages.forEach((image) => image.onload());
    await handle.promise;
    await Promise.resolve();

    const guideImage = document.getElementById('rules-help-guide-slide-img') as HTMLImageElement;
    const protectionImage = document.getElementById('rules-help-protection-map-img') as HTMLImageElement;
    expect(guideImage.getAttribute('src')).toBe('assets/images/help/player-guide/card-reversi-player-guide-slide-01.png');
    expect(protectionImage.getAttribute('src')).toBe('assets/images/help/protection-penetration/protection-penetration-quick-reference.png');
    expect(document.getElementById('rules-help-guide-slide-frame').hasAttribute('data-help-image-placeholder')).toBe(false);
    expect(document.getElementById('rules-help-protection-map-frame').hasAttribute('data-help-image-placeholder')).toBe(false);

    guideImage.dispatchEvent(new Event('load'));
    protectionImage.dispatchEvent(new Event('load'));
    expect(document.getElementById('rules-help-guide-slide-frame').getAttribute('aria-busy')).toBe('false');
    expect(document.getElementById('rules-help-protection-map-frame').getAttribute('aria-busy')).toBe('false');
  });

  test('index shell and lazy css include rules help backdrop layer', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.classic.html'), 'utf8');
    const css = readRulesHelpLayoutCssSurface();

    expect(html).toMatch(/id="rules-help-backdrop"/);
    expect(html).toMatch(/id="rules-help-panel"[^>]*><\/div>/);
    expect(html).not.toMatch(/id="rules-help-title-row"/);
    expect(css).toMatch(/#rules-help-backdrop\s*\{/);
    expect(css).toMatch(/#rules-help-backdrop\.is-open\s*\{/);
    expect(css).toMatch(/#rules-help-panel\.is-open\s*\{/);
  });

  test('lazy template includes stone marker help tab and key legend texts', () => {
    const template = readRulesHelpTemplateSource();
    const boardCss = readDomCompatBoardCssSurface();
    const layoutCss = readRulesHelpLayoutCssSurface();
    expect(template).toMatch(/data-help-tab="guide">ルールと操作<\/button>/);
    expect(template).toMatch(/data-help-tab="protection-map">耐性貫通表<\/button>/);
    expect(template).toMatch(/data-help-tab="counters">石マーカー<\/button>/);
    expect(template).not.toMatch(/data-help-tab="counters">数字UI<\/button>/);
    expect(template).toMatch(/id="rules-help-guide-slide-img"/);
    expect(template).toMatch(/完全保護の残りターン/);
    expect(template).toMatch(/特殊石本体の持続ターン/);
    expect(template).toMatch(/中央左のピンクハートバッジ/);
    expect(template).toMatch(/復活可能回数/);
    expect(template).toMatch(/下中央の赤い三角形数字/);
    expect(template).toMatch(/カウントダウン専用の残り回数/);
    expect(template).toMatch(/中央右の灰色バッジ/);
    expect(template).toMatch(/反転保護の目印/);
    expect(template).toMatch(/stone-flip-protection-badge/);
    expect(template).toMatch(/stone-regen-badge/);
    expect(template).toMatch(/右上の数字/);
    expect(template).not.toMatch(/右側の縦寄り数字/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.guard-timer\s*\{[\s\S]*?top:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.countdown-timer\s*\{[\s\S]*?bottom:\s*calc\(-5px \* var\(--layout-stage-scale\)\);/);
    expect(boardCss).toMatch(/\.cell\.has-disc\.has-regen-badge\s*\{[\s\S]*?z-index:\s*calc\(var\(--board-layer-expanded-cell\) \+ 12\);/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-regen-badge\s*\{[\s\S]*?left:\s*calc\(-7px \* var\(--layout-stage-scale\)\);[\s\S]*?right:\s*auto;[\s\S]*?top:\s*50%;/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-regen-badge::before\s*\{[\s\S]*?content:\s*'♥';/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-regen-badge-value\s*\{[\s\S]*?z-index:\s*1;/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-flip-protection-badge\s*\{[\s\S]*?left:\s*auto;[\s\S]*?right:\s*calc\(-2px \* var\(--layout-stage-scale\)\);/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-timer\.flip-evade-timer,[\s\S]*?right:\s*calc\(-3px \* var\(--layout-stage-scale\)\);[\s\S]*?top:\s*calc\(-3px \* var\(--layout-stage-scale\)\);/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.stone-timer\.destroy-evade-timer,[\s\S]*?left:\s*calc\(-3px \* var\(--layout-stage-scale\)\);[\s\S]*?bottom:\s*calc\(-3px \* var\(--layout-stage-scale\)\);/);
    expect(layoutCss).not.toMatch(/\.rules-help-counter-demo \.stone-timer\.flip-evade-timer,[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(-50%\);/);
    for (const selector of [
      'guard-timer',
      'special-timer',
      'countdown-timer',
      'stone-flip-protection-badge',
      'stone-regen-badge',
      'flip-evade-timer',
      'destroy-evade-timer'
    ]) {
      expect(layoutCss).toContain(`.rules-help-counter-demo .${selector}`);
    }
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.disc\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?overflow:\s*visible;/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.disc__face\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?border-radius:\s*50%;/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.disc__base-image\s*\{[\s\S]*?background-image:\s*var\(--disc-base-image, var\(--stone-image, none\)\);/);
    expect(layoutCss).toMatch(/\.rules-help-counter-demo \.disc__hud\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*40;/);
    expect(template).not.toMatch(/下中央のひし形数字/);
    expect(template).toMatch(/破壊回避の残り回数/);
  });

  test('special stone duration timer classes share the green duration palette', () => {
    const boardCss = readDomCompatBoardCssSurface();
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
    const boardCss = readDomCompatBoardCssSurface();
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
      expect(declarations).toMatch(/bottom:\s*calc\(1px \* var\(--layout-stage-scale\)\);/);
    }
  });

  test('lazy guide uses slide deck instead of static rule copy', () => {
    const template = readRulesHelpTemplateSource();
    expect(template).toMatch(/id="rules-help-guide-slide-frame"/);
    expect(template).toMatch(/aria-label="カードリバーシ説明スライド"/);
    expect(template).toMatch(/alt="カードリバーシ説明スライド 1 \/ 8"/);
    expect(template).toMatch(/前へ/);
    expect(template).toMatch(/次へ/);
    expect(template).not.toMatch(/id="rules-help-rules-list"/);
    expect(template).not.toMatch(/id="rules-help-controls-list"/);
    expect(template).not.toMatch(/右下パネルで「CPU \/ ネット対戦」、音量、BGMを調整できます。/);
    expect(template).not.toMatch(/長押しすると/);
  });

});
