import * as fs from 'fs';
const path = require('path');
import { JSDOM } from 'jsdom';

describe('hand skin handler', () => {
  const ALT_GACHA_HAND_SKIN_ID = 'gacha__n__陽気な手';
  const ALT_GACHA_HAND_SKIN_PATH = 'assets/images/Gacha/N/陽気な手.png';

  function setDom() {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <button id="handSkinBtn" aria-expanded="false"></button>
      <div id="handSkinPanel" aria-hidden="true">
        <button id="handSkinCloseBtn" type="button"></button>
        <div id="appearancePanelTabs">
          <button id="appearanceTabHand" type="button"></button>
          <button id="appearanceTabBackground" type="button"></button>
          <button id="appearanceTabBoard" type="button"></button>
          <button id="appearanceTabBoardFrame" type="button"></button>
          <button id="appearanceTabFont" type="button"></button>
          <button id="appearanceTabStone" type="button"></button>
          <button id="appearanceTabPreset" type="button"></button>
        </div>
        <div id="handSkinSection">
          <div id="handSkinOptions"></div>
        </div>
        <div id="backgroundSkinSection" hidden>
          <div id="backgroundSkinOptions"></div>
        </div>
        <div id="boardSkinSection" hidden>
          <div id="boardSkinOptions"></div>
        </div>
        <div id="boardFrameSkinSection" hidden>
          <div id="boardFrameSkinOptions"></div>
        </div>
        <div id="fontSkinSection" hidden>
          <div id="fontSkinOptions"></div>
        </div>
        <div id="stoneSkinSection" hidden>
          <div id="stoneSkinOptions"></div>
        </div>
        <div id="appearancePresetSection" hidden>
          <input id="appearancePresetNameInput" />
          <button id="appearancePresetSaveBtn" type="button"></button>
          <button id="appearancePresetCodeLoadBtn" type="button"></button>
          <div id="appearancePresetCodeStatus"></div>
          <div id="appearancePresetList"></div>
        </div>
      </div>
      <img id="handImage" src="assets/images/hand-skin/勇者の手.png" alt="" />
    </body></html>`, { url: 'https://example.test/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.KeyboardEvent = dom.window.KeyboardEvent;
  }

  function dispatchPointer(target) {
    const event = new Event('pointerdown', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
  }

  async function flushMicrotasks(times = 4) {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve();
    }
  }

  function appendCpuLevelSelect(id, value) {
    const select = document.createElement('select');
    select.id = id;
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(value);
    select.appendChild(option);
    select.value = String(value);
    document.body.appendChild(select);
    return select;
  }

  function unlockAltGachaHandSkin() {
    const storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.unlockHandSkinIds(window, [ALT_GACHA_HAND_SKIN_ID]);
    return storageModule;
  }

  function setIphoneUserAgent() {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });
  }

  beforeEach(() => {
    jest.resetModules();
    jest.dontMock('../ui/hand-skin/controller.js');
    jest.dontMock('../ui/hand-skin/runtime.js');
    setDom();
  });

  afterEach(() => {
    jest.dontMock('../ui/hand-skin/controller.js');
    jest.dontMock('../ui/hand-skin/runtime.js');
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.Event; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.KeyboardEvent; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.__non_webpack_require__; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.HandSkinCatalogModule; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.HandSkinRuntimeModule; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.HandSkinSelectionModule; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.HandSkinControllerModule; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  test('lazy-loads appearance modules when the hand skin button is clicked before optional registry load', async () => {
    let optionalLoaded = false;
    const controllerApi = {
      openPanel: jest.fn(),
      closePanel: jest.fn(),
      refreshOptions: jest.fn(),
      copyCurrentAppearanceCode: jest.fn(() => 'appearance:v1:test'),
      loadAppearancePresetCode: jest.fn(() => Promise.resolve('loaded')),
      getHandAnimationPreferences: jest.fn(() => ({ draw: true, place: true }))
    };
    const controllerModule = {
      setupHandSkinControls: jest.fn(() => controllerApi)
    };
    jest.doMock('../ui/hand-skin/controller.js', () => {
      if (!optionalLoaded) {
        throw new Error('optional hand skin controller is not registered yet');
      }
      return controllerModule;
    });
    const loadLazyRuntimeGroup = jest.fn(async (group) => {
      expect(group).toBe('cosmetic');
      optionalLoaded = true;
      return true;
    });
    const mod = require('../ui/handlers/hand-skin.js');

    const api = mod.setupHandSkinControls({ root: window, loadLazyRuntimeGroup });
    expect(api).toBeTruthy();

    document.getElementById('handSkinBtn').click();
    expect(document.getElementById('handSkinBtn').getAttribute('aria-busy')).toBe('true');
    await flushMicrotasks(8);

    expect(loadLazyRuntimeGroup).toHaveBeenCalledTimes(1);
    expect(controllerModule.setupHandSkinControls).toHaveBeenCalledWith(expect.objectContaining({
      root: window,
      document,
      lazyRuntimeGroupLoaded: true
    }));
    expect(controllerApi.openPanel).toHaveBeenCalledTimes(1);
    expect(api.copyCurrentAppearanceCode()).toBe('appearance:v1:test');
    expect(await api.loadAppearancePresetCode()).toBe('loaded');
    expect(api.getHandAnimationPreferences()).toEqual({ draw: true, place: true });
    expect(document.getElementById('handSkinBtn').getAttribute('aria-busy')).toBeNull();
    expect(document.getElementById('handSkinBtn').getAttribute('data-lazy-load-state')).toBe('loaded');
  });

  test('re-resolves hand skin runtime helpers after optional modules become available', () => {
    let optionalLoaded = false;
    const runtimeModule = {
      applyHandSkin: jest.fn(() => 'applied'),
      resolveHandAnimationContext: jest.fn(() => ({ ownerKey: 'black' })),
      resolveHandVisualOptions: jest.fn(() => ({ handSkinId: 'default' })),
      syncDisplayedHandSkin: jest.fn(() => 'synced')
    };
    jest.doMock('../ui/hand-skin/runtime.js', () => {
      if (!optionalLoaded) {
        throw new Error('optional hand skin runtime is not registered yet');
      }
      return runtimeModule;
    });
    const mod = require('../ui/handlers/hand-skin.js');
    const handImage = document.getElementById('handImage');

    expect(mod.syncDisplayedHandSkin(window, 'default', handImage)).toBeNull();
    optionalLoaded = true;

    expect(mod.syncDisplayedHandSkin(window, 'default', handImage)).toBe('synced');
    expect(runtimeModule.syncDisplayedHandSkin).toHaveBeenCalledWith(window, 'default', handImage, undefined);
    expect(mod.applyHandSkin(handImage, 'default', window)).toBe('applied');
  });

  test('applies stored unlocked gacha hand skin and updates selected option state', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);

    const handImage = document.getElementById('handImage');
    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    const options = Array.from(document.querySelectorAll('.hand-skin-option'));
    expect(options).toHaveLength(2);
    const selected = options.find((button) => button.getAttribute('data-hand-skin-id') === ALT_GACHA_HAND_SKIN_ID);
    expect(selected.classList.contains('is-selected')).toBe(true);
    expect(selected.getAttribute('aria-checked')).toBe('true');
  });

  test('skips unchanged hand image attributes when displayed skin is already current', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    const handImage = document.getElementById('handImage');
    const originalSetAttribute = handImage.setAttribute.bind(handImage);
    const attributeWrites = [];
    handImage.setAttribute = function (name, value) {
      attributeWrites.push([name, value]);
      return originalSetAttribute(name, value);
    };

    api.syncDisplayedSkin();

    expect(attributeWrites).toEqual([]);
    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('legacy renamed hand skin ids resolve to the canonical renamed skin', () => {
    const storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.unlockHandSkinIds(window, ['gacha__n__hand-swap']);
    window.localStorage.setItem('othello.handSkin', 'gacha__n__hand-swap');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.getElementById('handImage').getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('opens and closes panel, and clicking an option persists the selection', () => {
    unlockAltGachaHandSkin();
    const mod = require('../ui/handlers/hand-skin.js');
    mod.setupHandSkinControls({ root: window });

    const button = document.getElementById('handSkinBtn');
    const panel = document.getElementById('handSkinPanel');
    const handImage = document.getElementById('handImage');

    button.click();
    expect(panel.classList.contains('is-open')).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('true');

    const swapOption = document.querySelector(`[data-hand-skin-id="${ALT_GACHA_HAND_SKIN_ID}"]`);
    swapOption.click();
    expect(window.localStorage.getItem('othello.handSkin')).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);

    dispatchPointer(document.body);
    expect(panel.classList.contains('is-open')).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  test('renders hand animation toggles and persists draw/place choices', () => {
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    const drawToggle = document.getElementById('handAnimationDrawToggle');
    const placeToggle = document.getElementById('handAnimationPlaceToggle');
    expect(drawToggle).toBeTruthy();
    expect(placeToggle).toBeTruthy();
    expect(drawToggle.checked).toBe(true);
    expect(placeToggle.checked).toBe(true);

    drawToggle.click();
    placeToggle.click();

    expect(window.localStorage.getItem('othello.handAnimation.draw')).toBe('off');
    expect(window.localStorage.getItem('othello.handAnimation.place')).toBe('off');
    expect(window.DISABLE_DRAW_HAND_ANIMATION).toBe(true);
    expect(window.DISABLE_PLACE_HAND_ANIMATION).toBe(true);
    expect(api.getHandAnimationPreferences()).toEqual({ draw: false, place: false });
  });

  test('defaults hand animation toggles off on iPhone when no preference is stored', () => {
    setIphoneUserAgent();
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    expect(document.getElementById('handAnimationDrawToggle').checked).toBe(false);
    expect(document.getElementById('handAnimationPlaceToggle').checked).toBe(false);
    expect(window.localStorage.getItem('othello.handAnimation.draw')).toBeNull();
    expect(window.localStorage.getItem('othello.handAnimation.place')).toBeNull();
    expect(window.DISABLE_DRAW_HAND_ANIMATION).toBe(true);
    expect(window.DISABLE_PLACE_HAND_ANIMATION).toBe(true);
    expect(api.getHandAnimationPreferences()).toEqual({ draw: false, place: false });
  });

  test('keeps stored hand animation choices on iPhone', () => {
    setIphoneUserAgent();
    window.localStorage.setItem('othello.handAnimation.draw', 'on');
    window.localStorage.setItem('othello.handAnimation.place', 'on');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    expect(document.getElementById('handAnimationDrawToggle').checked).toBe(true);
    expect(document.getElementById('handAnimationPlaceToggle').checked).toBe(true);
    expect(window.DISABLE_DRAW_HAND_ANIMATION).toBe(false);
    expect(window.DISABLE_PLACE_HAND_ANIMATION).toBe(false);
    expect(api.getHandAnimationPreferences()).toEqual({ draw: true, place: true });
  });

  test('normalizes legacy falsey hand animation preference values', () => {
    window.localStorage.setItem('othello.handAnimation.draw', 'false');
    window.localStorage.setItem('othello.handAnimation.place', '0');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    expect(document.getElementById('handAnimationDrawToggle').checked).toBe(false);
    expect(document.getElementById('handAnimationPlaceToggle').checked).toBe(false);
    expect(window.DISABLE_DRAW_HAND_ANIMATION).toBe(true);
    expect(window.DISABLE_PLACE_HAND_ANIMATION).toBe(true);
    expect(api.getHandAnimationPreferences()).toEqual({ draw: false, place: false });
  });

  test('font tab persists selected font without affecting the selected hand skin', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    document.getElementById('appearanceTabFont').click();
    document.querySelector('[data-font-skin-id="dot-gothic"]').click();

    expect(window.localStorage.getItem('othello.fontSkin')).toBe('dot-gothic');
    expect(document.body.getAttribute('data-font-skin-id')).toBe('dot-gothic');
    expect(document.documentElement.getAttribute('data-font-skin-id')).toBe('dot-gothic');
    expect(document.body.style.getPropertyValue('--selected-app-font-family')).toContain('DotGothic16');
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('stone tab persists selected normal stone skin without affecting the selected hand skin', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    document.getElementById('appearanceTabStone').click();
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('o-stone');
    document.querySelector('[data-stone-skin-id="o-stone"]').click();
    document.querySelector('[data-stone-skin-id="jade-rim"]').click();

    expect(window.localStorage.getItem('othello.stoneSkin')).toBe('jade-rim');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('jade-rim');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-black-image')).toBe('url("assets/images/stone-skin/jade-rim/black.png")');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-white-image')).toBe('url("assets/images/stone-skin/jade-rim/white.png")');
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('board tab persists selected board surface without affecting the selected hand skin', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const board = document.createElement('div');
    board.id = 'board';
    document.body.appendChild(board);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    document.getElementById('appearanceTabBoard').click();
    document.querySelector('#boardSkinOptions [data-board-skin-id="emerald-stone"]').click();

    expect(window.localStorage.getItem('othello.boardSkin')).toBe('emerald-stone');
    expect(window.localStorage.getItem('reversi.boardSkin')).toBe('emerald-stone');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('emerald-stone');
    expect(board.getAttribute('data-board-skin-id')).toBe('emerald-stone');
    expect(board.style.getPropertyValue('--board-surface-texture-image')).toBe('url("assets/images/board/board-surface-emerald-v1.png")');
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('preset tab saves current appearance, copies its code, reapplies it, and deletes it', async () => {
    unlockAltGachaHandSkin();
    const clipboardWrites = [];
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: jest.fn(async (text) => {
          clipboardWrites.push(text);
        })
      },
      configurable: true
    });
    document.execCommand = jest.fn(() => false);
    const board = document.createElement('div');
    board.id = 'board';
    document.body.appendChild(board);
    const boardFrame = document.createElement('div');
    boardFrame.id = 'board-frame';
    document.body.appendChild(boardFrame);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    api.selectSkin(ALT_GACHA_HAND_SKIN_ID);
    document.getElementById('appearanceTabBoard').click();
    document.querySelector('#boardSkinOptions [data-board-skin-id="emerald-stone"]').click();
    document.getElementById('appearanceTabBoardFrame').click();
    document.querySelector('#boardFrameSkinOptions [data-board-frame-skin-id="compact-brass-clean-corners"]').click();
    document.getElementById('appearanceTabFont').click();
    document.querySelector('[data-font-skin-id="dot-gothic"]').click();
    document.getElementById('appearanceTabStone').click();
    document.querySelector('[data-stone-skin-id="o-stone"]').click();

    document.getElementById('appearanceTabPreset').click();
    document.getElementById('appearancePresetSaveBtn').click();

    const savedPresetName = document.querySelector('.appearance-preset-name');
    const savedPresetUse = document.querySelector('.appearance-preset-use');
    expect(savedPresetName).not.toBeNull();
    expect(savedPresetUse).not.toBeNull();
    expect(savedPresetName && savedPresetName.textContent).toContain('プリセット1');
    expect(savedPresetUse && savedPresetUse.textContent).toBe('使用');
    expect(window.localStorage.getItem('reversi.appearancePresets')).toContain('emerald-stone');
    document.querySelector('.appearance-preset-code-copy').click();
    await Promise.resolve();
    expect(clipboardWrites[0]).toMatch(/^appearance:v1:/);

    api.selectSkin('default');
    document.getElementById('appearanceTabBoard').click();
    document.querySelector('#boardSkinOptions [data-board-skin-id="woven-felt"]').click();
    document.getElementById('appearanceTabBoardFrame').click();
    document.querySelector('#boardFrameSkinOptions [data-board-frame-skin-id="black-gold-lacquer"]').click();
    document.getElementById('appearanceTabFont').click();
    document.querySelector('[data-font-skin-id="shippori-mincho"]').click();
    document.getElementById('appearanceTabStone').click();
    document.querySelector('[data-stone-skin-id="jade-rim"]').click();

    document.getElementById('appearanceTabPreset').click();
    document.querySelector('.appearance-preset-name').click();
    expect(api.getSelectedSkinId()).toBe('default');
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('woven-felt');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('black-gold-lacquer');
    expect(document.body.getAttribute('data-font-skin-id')).toBe('shippori-mincho');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('jade-rim');

    document.querySelector('.appearance-preset-use').click();

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('emerald-stone');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('compact-brass-clean-corners');
    expect(document.body.getAttribute('data-font-skin-id')).toBe('dot-gothic');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('o-stone');

    document.querySelector('.appearance-preset-delete').click();
    expect(document.querySelector('.appearance-preset-name')).toBeNull();
    expect(document.querySelector('.appearance-preset-use')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('reversi.appearancePresets')).presets).toEqual([]);
  });

  test('preset tab loads appearance codes from clipboard without a visible code field', async () => {
    unlockAltGachaHandSkin();
    let clipboardText = '';
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: jest.fn(async (text) => { clipboardText = text; }),
        readText: jest.fn(async () => clipboardText)
      },
      configurable: true
    });
    const board = document.createElement('div');
    board.id = 'board';
    document.body.appendChild(board);
    const boardFrame = document.createElement('div');
    boardFrame.id = 'board-frame';
    document.body.appendChild(boardFrame);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    api.selectSkin(ALT_GACHA_HAND_SKIN_ID);
    document.getElementById('appearanceTabBoard').click();
    document.querySelector('#boardSkinOptions [data-board-skin-id="emerald-stone"]').click();
    document.getElementById('appearanceTabBoardFrame').click();
    document.querySelector('#boardFrameSkinOptions [data-board-frame-skin-id="compact-brass-clean-corners"]').click();
    document.getElementById('appearanceTabFont').click();
    document.querySelector('[data-font-skin-id="dot-gothic"]').click();
    document.getElementById('appearanceTabStone').click();
    document.querySelector('[data-stone-skin-id="o-stone"]').click();

    document.getElementById('appearanceTabPreset').click();
    document.getElementById('appearancePresetSaveBtn').click();
    document.querySelector('.appearance-preset-code-copy').click();
    await Promise.resolve();

    expect(document.getElementById('appearancePresetCodeInput')).toBeNull();
    expect(clipboardText).toMatch(/^appearance:v1:/);

    api.selectSkin('default');
    document.getElementById('appearanceTabBoard').click();
    document.querySelector('#boardSkinOptions [data-board-skin-id="woven-felt"]').click();
    document.getElementById('appearanceTabBoardFrame').click();
    document.querySelector('#boardFrameSkinOptions [data-board-frame-skin-id="black-gold-lacquer"]').click();
    document.getElementById('appearanceTabFont').click();
    document.querySelector('[data-font-skin-id="shippori-mincho"]').click();
    document.getElementById('appearanceTabStone').click();
    document.querySelector('[data-stone-skin-id="jade-rim"]').click();

    document.getElementById('appearanceTabPreset').click();
    await document.getElementById('appearancePresetCodeLoadBtn').click();
    await Promise.resolve();

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.documentElement.getAttribute('data-board-skin-id')).toBe('emerald-stone');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id')).toBe('compact-brass-clean-corners');
    expect(document.body.getAttribute('data-font-skin-id')).toBe('dot-gothic');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('o-stone');
    expect(document.getElementById('appearancePresetCodeStatus').textContent).toContain('読み込みました');
  });

  test('preset row code copy falls back when async clipboard copy is blocked', async () => {
    unlockAltGachaHandSkin();
    const legacyCopies = [];
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: jest.fn(async () => {
          throw new Error('clipboard blocked');
        })
      },
      configurable: true
    });
    document.execCommand = jest.fn((command) => {
      if (command === 'copy' && document.activeElement) {
        legacyCopies.push(document.activeElement.value);
        return true;
      }
      return false;
    });
    const mod = require('../ui/handlers/hand-skin.js');
    mod.setupHandSkinControls({ root: window });

    document.getElementById('handSkinBtn').click();
    document.getElementById('appearanceTabPreset').click();
    document.getElementById('appearancePresetSaveBtn').click();
    document.querySelector('.appearance-preset-code-copy').click();
    await Promise.resolve();

    expect(window.navigator.clipboard.writeText).toHaveBeenCalled();
    expect(legacyCopies).toHaveLength(1);
    expect(legacyCopies[0]).toMatch(/^appearance:v1:/);
    expect(document.getElementById('appearancePresetCodeStatus').textContent).toContain('コピーしました');
    expect(document.querySelector('textarea[aria-hidden="true"]')).toBeNull();
  });

  test('unowned gacha skin in storage falls back to default', () => {
    window.localStorage.setItem('othello.handSkin', 'gacha__n__小鬼の手');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe('default');
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe('default');
  });

  test('owned gacha skins appear in the skin selector and can be applied', () => {
    const storageModule = require('../ui/storage/gacha-progress.js');
    storageModule.unlockHandSkinIds(window, ['gacha__n__小鬼の手']);
    window.localStorage.setItem('othello.handSkin', 'gacha__n__小鬼の手');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    const options = Array.from(document.querySelectorAll('.hand-skin-option'));
    const gachaOption = options.find((button) => button.getAttribute('data-hand-skin-id') === 'gacha__n__小鬼の手');

    expect(options).toHaveLength(2);
    expect(gachaOption).toBeTruthy();
    expect(gachaOption.textContent).toContain('小鬼の手');
    expect(api.getSelectedSkinId()).toBe('gacha__n__小鬼の手');
    expect(document.getElementById('handImage').getAttribute('src')).toBe('assets/images/Gacha/N/小鬼の手.png');
  });

  test('asset manifest update refreshes selector and display for newly added gacha hand skins', () => {
    const bootstrap = require('../ui/bootstrap.js');
    const storageModule = require('../ui/storage/gacha-progress.js');
    const manifestOnlySkinId = 'gacha__ur__天空の手';
    const manifestOnlySkinPath = 'assets/images/Gacha/UR/天空の手.png';
    storageModule.unlockHandSkinIds(window, [manifestOnlySkinId]);
    window.localStorage.setItem('othello.handSkin', manifestOnlySkinId);
    bootstrap.setLoadedAssetManifest(null, { root: window, dispatch: false });
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    expect(api.getSelectedSkinId()).toBe('default');
    expect(document.querySelector(`[data-hand-skin-id="${manifestOnlySkinId}"]`)).toBeNull();

    bootstrap.setLoadedAssetManifest({
      generatedAt: '2026-04-12T00:00:00.000Z',
      files: [
        { path: manifestOnlySkinPath }
      ]
    }, { root: window, dispatch: true });

    expect(api.getSelectedSkinId()).toBe(manifestOnlySkinId);
    expect(document.querySelector(`[data-hand-skin-id="${manifestOnlySkinId}"]`)).toBeTruthy();
    expect(document.getElementById('handImage').getAttribute('src')).toBe(manifestOnlySkinPath);
  });

  test('CPU preview uses fixed hand image by white CPU level and explicit black owner restores selected skin', () => {
    window.gameState = { currentPlayer: 1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    window.cpuSmartness = { white: 6 };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    const handImage = document.getElementById('handImage');

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv6-9.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv6-9');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    mod.syncDisplayedHandSkin(window, api.getSelectedSkinId(), handImage, { ownerKey: 'black' });

    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    api.syncDisplayedSkin();
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv6-9.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv6-9');
  });

  test('CPU preview resolves from CPU LEVEL selects when cpuSmartness is not mirrored on window', () => {
    window.MATCH_MODE = 'cpu';
    window.gameState = { currentPlayer: 1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    appendCpuLevelSelect('smartBlack', 1);
    appendCpuLevelSelect('smartWhite', 4);
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    const handImage = document.getElementById('handImage');
    const visual = mod.resolveHandVisualOptions(window, 'white');
    const handContext = mod.resolveHandAnimationContext(window, null, { ownerKey: 'white' });

    expect(window.cpuSmartness).toBeUndefined();
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(visual).toMatchObject({ ownerKey: 'white', cpu: true, cpuLevel: 4 });
    expect(handContext).toMatchObject({
      ownerKey: 'white',
      cpu: true,
      cpuLevel: 4,
      selectedSkinId: ALT_GACHA_HAND_SKIN_ID,
      renderedSkinId: 'cpu-lv4',
      renderedImagePath: 'assets/images/hand-skin/lv4.png'
    });
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv4');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('CPU preview resolves named CPU profiles from selects into the Lv6-9 fixed hand image', () => {
    window.MATCH_MODE = 'cpu';
    window.gameState = { currentPlayer: 1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    appendCpuLevelSelect('smartBlack', 1);
    appendCpuLevelSelect('smartWhite', '9-ending-ash');
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    const handImage = document.getElementById('handImage');
    const visual = mod.resolveHandVisualOptions(window, 'white');
    const handContext = mod.resolveHandAnimationContext(window, null, { ownerKey: 'white' });

    expect(window.cpuSmartness).toBeUndefined();
    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(visual).toMatchObject({ ownerKey: 'white', cpu: true, cpuLevel: 9 });
    expect(handContext).toMatchObject({
      ownerKey: 'white',
      cpu: true,
      cpuLevel: 9,
      selectedSkinId: ALT_GACHA_HAND_SKIN_ID,
      renderedSkinId: 'cpu-lv6-9',
      renderedImagePath: 'assets/images/hand-skin/lv6-9.png'
    });
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv6-9.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv6-9');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('debug human-vs-human keeps selected hand skin even on white turn', () => {
    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.gameState = { currentPlayer: -1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    window.cpuSmartness = { white: 4 };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    mod.setupHandSkinControls({ root: window });

    const handImage = document.getElementById('handImage');
    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('top-slot opponent resolves as CPU hand even when the opponent owner is black', () => {
    document.getElementById('hand-black').dataset.ownerKey = 'white';
    document.getElementById('hand-white').dataset.ownerKey = 'black';
    window.cpuSmartness = { black: 3, white: 1 };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    const visual = mod.resolveHandVisualOptions(window, 'black');
    expect(visual).toMatchObject({ ownerKey: 'black', cpu: true, cpuLevel: 3 });

    mod.syncDisplayedHandSkin(window, ALT_GACHA_HAND_SKIN_ID, document.getElementById('handImage'), {
      ownerKey: 'black',
      forceCpu: visual.cpu,
      cpuLevel: visual.cpuLevel
    });

    const handImage = document.getElementById('handImage');
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv3-5.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv3-5');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('local CPU mode ignores stale white seat keys and keeps opponent hand fixed', () => {
    window.LOCAL_PLAYER_KEY = 'white';
    window.BOARD_VIEWER_KEY = 'white';
    window.__LOCAL_PLAYER_KEY = 'white';
    window.gameState = { currentPlayer: -1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    window.cpuSmartness = { white: 4 };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    mod.setupHandSkinControls({ root: window });

    const handImage = document.getElementById('handImage');
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv4');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('network mode keeps local seat skin by default and resolves remote seatHandSkins for opponent actions', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'white';
    window.BOARD_VIEWER_KEY = 'white';
    window.__LOCAL_PLAYER_KEY = 'white';
    window.NetworkMatchClient = {
      getSeatHandSkins: () => ({ black: 'gacha__n__小鬼の手', white: '' })
    };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/handlers/hand-skin.js');
    mod.setupHandSkinControls({ root: window });

    const handImage = document.getElementById('handImage');
    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    const remoteContext = mod.resolveHandAnimationContext(window, null, { ownerKey: 'black' });
    expect(remoteContext).toMatchObject({
      ownerKey: 'black',
      cpu: false,
      selectedSkinId: 'gacha__n__小鬼の手',
      renderedSkinId: 'gacha__n__小鬼の手',
      renderedImagePath: 'assets/images/Gacha/N/小鬼の手.png'
    });
  });

  test('network mode publishes selected hand skin changes through NetworkMatchClient', () => {
    const updateHandSkin = jest.fn().mockResolvedValue({ ok: true });
    window.MATCH_MODE = 'network';
    window.NetworkMatchClient = {
      getSeatHandSkins: () => ({ black: '', white: '' }),
      updateHandSkin
    };
    unlockAltGachaHandSkin();
    const mod = require('../ui/handlers/hand-skin.js');
    const api = mod.setupHandSkinControls({ root: window });
    api.selectSkin(ALT_GACHA_HAND_SKIN_ID);

    expect(updateHandSkin).toHaveBeenCalledWith(ALT_GACHA_HAND_SKIN_ID);
  });

  test('index html includes hand skin button and panel markup', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/id="handSkinBtn"/);
    expect(html).toMatch(/id="handSkinPanel"/);
    expect(html).toMatch(/id="handSkinOptions"/);
    expect(html).toMatch(/id="appearanceTabFont"/);
    expect(html).toMatch(/id="fontSkinOptions"/);
    expect(html).toMatch(/id="appearanceTabStone"/);
    expect(html).toMatch(/id="stoneSkinOptions"/);
    expect(html).toMatch(/id="appearanceTabBoard"/);
    expect(html).toMatch(/id="boardSkinOptions"/);
    expect(html).toMatch(/id="appearanceTabPreset"/);
    expect(html).toMatch(/id="appearancePresetSection"/);
    expect(html).not.toMatch(/id="appearancePresetCodeInput"/);
    expect(html).not.toMatch(/id="appearancePresetCodeCopyBtn"/);
    expect(html).toMatch(/id="appearancePresetCodeLoadBtn"/);
  });
});
