import * as fs from 'fs';
import * as path from 'path';
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
        <div id="handSkinOptions"></div>
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
    import * as storageModule from '../ui/storage/gacha-progress.js';
    storageModule.unlockHandSkinIds(window, [ALT_GACHA_HAND_SKIN_ID]);
    return storageModule;
  }

  beforeEach(() => {
    jest.resetModules();
    setDom();
  });

  afterEach(() => {
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.Event; } catch (e) {}
    try { delete global.KeyboardEvent; } catch (e) {}
  });

  test('applies stored unlocked gacha hand skin and updates selected option state', () => {
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    import * as mod from '../ui/handlers/hand-skin.js';

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

  test('legacy renamed hand skin ids resolve to the canonical renamed skin', () => {
    import * as storageModule from '../ui/storage/gacha-progress.js';
    storageModule.unlockHandSkinIds(window, ['gacha__n__hand-swap']);
    window.localStorage.setItem('othello.handSkin', 'gacha__n__hand-swap');
    import * as mod from '../ui/handlers/hand-skin.js';

    const api = mod.setupHandSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(document.getElementById('handImage').getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
  });

  test('opens and closes panel, and clicking an option persists the selection', () => {
    unlockAltGachaHandSkin();
    import * as mod from '../ui/handlers/hand-skin.js';
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

  test('unowned gacha skin in storage falls back to default', () => {
    window.localStorage.setItem('othello.handSkin', 'gacha__n__小鬼の手');
    import * as mod from '../ui/handlers/hand-skin.js';

    const api = mod.setupHandSkinControls({ root: window });

    expect(api.getSelectedSkinId()).toBe('default');
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe('default');
  });

  test('owned gacha skins appear in the skin selector and can be applied', () => {
    import * as storageModule from '../ui/storage/gacha-progress.js';
    storageModule.unlockHandSkinIds(window, ['gacha__n__小鬼の手']);
    window.localStorage.setItem('othello.handSkin', 'gacha__n__小鬼の手');
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as bootstrap from '../ui/bootstrap.js';
    import * as storageModule from '../ui/storage/gacha-progress.js';
    const manifestOnlySkinId = 'gacha__ur__天空の手';
    const manifestOnlySkinPath = 'assets/images/Gacha/UR/天空の手.png';
    storageModule.unlockHandSkinIds(window, [manifestOnlySkinId]);
    window.localStorage.setItem('othello.handSkin', manifestOnlySkinId);
    bootstrap.setLoadedAssetManifest(null, { root: window, dispatch: false });
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as mod from '../ui/handlers/hand-skin.js';

    const api = mod.setupHandSkinControls({ root: window });
    const handImage = document.getElementById('handImage');

    expect(api.getSelectedSkinId()).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv6.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv6');
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    mod.syncDisplayedHandSkin(window, api.getSelectedSkinId(), handImage, { ownerKey: 'black' });

    expect(handImage.getAttribute('src')).toBe(ALT_GACHA_HAND_SKIN_PATH);
    expect(handImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(handImage.getAttribute('data-hand-selected-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);

    api.syncDisplayedSkin();
    expect(handImage.getAttribute('src')).toBe('assets/images/hand-skin/lv6.png');
    expect(handImage.getAttribute('data-hand-skin-id')).toBe('cpu-lv6');
  });

  test('CPU preview resolves from CPU LEVEL selects when cpuSmartness is not mirrored on window', () => {
    window.MATCH_MODE = 'cpu';
    window.gameState = { currentPlayer: 1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    appendCpuLevelSelect('smartBlack', 1);
    appendCpuLevelSelect('smartWhite', 4);
    import * as mod from '../ui/handlers/hand-skin.js';

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

  test('debug human-vs-human keeps selected hand skin even on white turn', () => {
    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.gameState = { currentPlayer: -1 };
    window.cardState = { fateWillControllerByTurnOwner: {} };
    window.cpuSmartness = { white: 4 };
    unlockAltGachaHandSkin();
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as mod from '../ui/handlers/hand-skin.js';

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
    import * as mod from '../ui/handlers/hand-skin.js';

    const api = mod.setupHandSkinControls({ root: window });
    api.selectSkin(ALT_GACHA_HAND_SKIN_ID);

    expect(updateHandSkin).toHaveBeenCalledWith(ALT_GACHA_HAND_SKIN_ID);
  });

  test('index html includes hand skin button and panel markup', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/id="handSkinBtn"/);
    expect(html).toMatch(/id="handSkinPanel"/);
    expect(html).toMatch(/id="handSkinOptions"/);
  });
});
