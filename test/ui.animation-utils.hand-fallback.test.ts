import { JSDOM } from 'jsdom';
import * as path from 'path';
const animationSharedPath = path.resolve(__dirname, '..', 'ui', 'animation-shared.js');
const boardRendererPath = path.resolve(__dirname, '..', 'ui', 'board-renderer.ts');
const ALT_GACHA_HAND_SKIN_ID = 'gacha__n__hand-swap';
let getBoardCellClientRectMock: jest.Mock;

function resolveFixtureBoardCellRect(row, col) {
  const selector = `.cell[data-row="${row}"][data-col="${col}"]`;
  const cell = document.querySelector(selector);
  const measured = cell && typeof cell.getBoundingClientRect === 'function'
    ? cell.getBoundingClientRect()
    : null;
  if (measured && measured.width > 0 && measured.height > 0) return measured;
  const size = 64;
  const left = Number(col) * size;
  const top = Number(row) * size;
  return { left, top, width: size, height: size, right: left + size, bottom: top + size };
}

function createScopedTimerMock() {
  const scopeMap = new Map();

  const forgetTimer = (id) => {
    for (const ids of scopeMap.values()) {
      ids.delete(id);
    }
  };

  return {
    setTimeout(fn, ms, scope) {
      const id = setTimeout(() => {
        forgetTimer(id);
        fn();
      }, ms);
      if (scope) {
        if (!scopeMap.has(scope)) scopeMap.set(scope, new Set());
        scopeMap.get(scope).add(id);
      }
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      forgetTimer(id);
    },
    clearAll() {},
    pendingCount() {
      return 0;
    },
    newScope() {
      return Symbol('scope');
    },
    clearScope(scope) {
      const ids = scopeMap.get(scope);
      if (!ids) return;
      for (const id of ids) {
        clearTimeout(id);
      }
      scopeMap.delete(scope);
    }
  };
}

function appendCpuLevelSelect(docRef, id, value) {
  const select = docRef.createElement('select');
  select.id = id;
  const option = docRef.createElement('option');
  option.value = String(value);
  option.textContent = String(value);
  select.appendChild(option);
  select.value = String(value);
  docRef.body.appendChild(select);
  return select;
}

function unlockAltGachaHandSkin(rootRef) {
  const storageModule = require('../ui/storage/gacha-progress.js');
  storageModule.unlockHandSkinIds(rootRef, [ALT_GACHA_HAND_SKIN_ID]);
}

function installCardBackgroundPreloadFixture(imageSrcs, pathByCardId = {}) {
  class MockImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    set src(value) {
      imageSrcs.push(value);
      setTimeout(() => {
        if (typeof this.onload === 'function') this.onload();
      }, 0);
    }
  }

  global.Image = MockImage;
  window.Image = MockImage;
  global.createCardFaceElement = jest.fn((cardId) => {
    const cardEl = document.createElement('div');
    const imagePath = pathByCardId[cardId] || `assets/images/card/${cardId}.png`;
    cardEl.dataset.cardBackgroundImage = imagePath;
    return cardEl;
  });
  window.createCardFaceElement = global.createCardFaceElement;
}

function setIphoneUserAgent() {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true
  });
}

describe('animation-utils hand fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.dontMock(animationSharedPath);
    jest.doMock(animationSharedPath, () => ({
      ...jest.requireActual(animationSharedPath),
      isNoAnim: () => false
    }));
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="board">
          <div class="cell" data-row="0" data-col="0"></div>
        </div>
        <div id="deck-black"></div>
        <div id="deck-white"></div>
        <div id="charge-black"></div>
        <div id="charge-white"></div>
        <div id="hand-black"></div>
        <div id="hand-white"></div>
        <div id="handLayer" style="display:none;"></div>
        <div id="handWrapper"></div>
        <div id="heldStone"></div>
        <img id="handImage" />
      </body></html>
    `, { url: 'https://example.test/' });
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.boardEl = document.getElementById('board');
    global.SoundEngine = { init: jest.fn(), playStoneClack: jest.fn(), playEffectByKey: jest.fn() };
    global.renderCardUI = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;
    getBoardCellClientRectMock = jest.fn((row, col) => resolveFixtureBoardCellRect(row, col));
    jest.doMock(boardRendererPath, () => ({
      getBoardCellClientRect: getBoardCellClientRectMock,
      getBoardVisualControllerReady: jest.fn(async () => undefined),
      claimBoardVisualWriter: jest.fn(() => ({ id: 1, frameToken: 'local:test', mode: 'local' })),
      playBoardVisualPhase: jest.fn(async () => undefined),
      settleBoardVisualWriter: jest.fn(async () => true)
    }));
    if (Object.prototype.hasOwnProperty.call(global, 'TimerRegistry')) {
      delete global.TimerRegistry;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
    delete global.window;
    delete global.document;
    delete global.boardEl;
    delete global.cardState;
    delete global.SharedConstants;
    delete global.Image;
    delete global.createCardFaceElement;
    delete global.resolveCardBackgroundArtPath;
    delete global.applyStoneVisualEffect;
    jest.dontMock(animationSharedPath);
    jest.dontMock(boardRendererPath);
  });

  test('playHandAnimation completes even when Element.animate is unavailable', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout')), 2200);
      mod.playHandAnimation(global.BLACK, 0, 0, () => {
        clearTimeout(to);
        resolve();
      });
    });

    expect(global.SoundEngine.playStoneClack).toHaveBeenCalledTimes(1);
  });

  test('playHandAnimation keeps the selected hand image stable while using a CPU actor image', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    unlockAltGachaHandSkin(window);
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    window.cpuSmartness = { black: 3, white: 1 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.syncDisplayedHandSkin = handSkin.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const selectedImage = document.getElementById('handImage');
    selectedImage.setAttribute('src', 'assets/images/hand-skin/selected-local.png');
    selectedImage.setAttribute('data-hand-skin-id', ALT_GACHA_HAND_SKIN_ID);
    const mod = require('../ui/animation-utils.js');
    let resolveContact;
    const contactPromise = new Promise((resolve, reject) => {
      resolveContact = resolve;
      const to = setTimeout(() => reject(new Error('timeout')), 2200);
      resolveContact = () => {
        clearTimeout(to);
        resolve();
      };
    });
    const animationPromise = mod.playHandAnimation(global.BLACK, 0, 0, resolveContact, {
      cpu: true,
      cpuLevel: 3,
      ownerKey: 'black'
    });

    await Promise.resolve();
    const actorImage = wrapper.querySelector('.hand-animation-actor-image');
    expect(selectedImage.getAttribute('src')).toBe('assets/images/hand-skin/selected-local.png');
    expect(selectedImage.getAttribute('data-hand-skin-id')).toBe(ALT_GACHA_HAND_SKIN_ID);
    expect(actorImage?.getAttribute('src')).toBe('assets/images/hand-skin/lv3-5.png');
    expect(actorImage?.getAttribute('data-hand-skin-id')).toBe('cpu-lv3-5');
    expect(actorImage?.getAttribute('data-hand-animation-active')).toBe('true');

    await expect(contactPromise).resolves.toBeUndefined();
    await expect(animationPromise).resolves.toBeUndefined();
    expect(selectedImage.style.visibility).toBe('');
    expect(actorImage?.getAttribute('data-hand-animation-active')).toBe('false');
  });

  test('playHandAnimation reuses the selected image when the same skin has a bundled URL', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    const handSkin = require('../ui/handlers/hand-skin.js');
    const resolvedContext = handSkin.resolveHandAnimationContext(window, null, { ownerKey: 'black' });
    const selectedImage = document.getElementById('handImage');
    selectedImage.setAttribute('src', './vite-dist/assets/hand-swap-hashed.png');
    selectedImage.setAttribute('data-hand-skin-id', resolvedContext.renderedSkinId);
    const mod = require('../ui/animation-utils.js');

    await mod.playHandAnimation(global.BLACK, 0, 0, jest.fn());

    expect(selectedImage.getAttribute('src')).toBe('./vite-dist/assets/hand-swap-hashed.png');
    expect(wrapper.querySelector('.hand-animation-actor-image')).toBeNull();
  });

  test('playHandAnimation reuses the cached actor image for repeated CPU placement', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    window.cpuSmartness = { black: 3, white: 1 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const mod = require('../ui/animation-utils.js');

    await mod.playHandAnimation(global.BLACK, 0, 0, jest.fn(), {
      cpu: true,
      cpuLevel: 3,
      ownerKey: 'black'
    });
    const firstActorImage = wrapper.querySelector('.hand-animation-actor-image');

    await mod.playHandAnimation(global.BLACK, 0, 0, jest.fn(), {
      cpu: true,
      cpuLevel: 3,
      ownerKey: 'black'
    });

    expect(wrapper.querySelectorAll('.hand-animation-actor-image')).toHaveLength(1);
    expect(wrapper.querySelector('.hand-animation-actor-image')).toBe(firstActorImage);
  });

  test('playDrawCardHandAnimation resolves without Element.animate', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDrawCardHandAnimation({ player: 'black', count: 1 })).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('block');
    expect(wrapper.style.display).toBe('block');
    expect(wrapper.style.opacity).toBe('0');
  });

  test('playDrawCardHandAnimation skips the hand layer when draw hand animation is disabled', async () => {
    window.localStorage.setItem('othello.handAnimation.draw', 'off');
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn();
    const mod = require('../ui/animation-utils.js');

    await expect(mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_a', count: 1 })).resolves.toBeUndefined();

    expect(wrapper.animate).not.toHaveBeenCalled();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playDrawCardHandAnimation skips the hand layer by default on iPhone', async () => {
    setIphoneUserAgent();
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn();
    const mod = require('../ui/animation-utils.js');

    await expect(mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_a', count: 1 })).resolves.toBeUndefined();

    expect(window.localStorage.getItem('othello.handAnimation.draw')).toBeNull();
    expect(wrapper.animate).not.toHaveBeenCalled();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playCaptureToHandAnimation builds its overlay stone from payload without reading board cell DOM', async () => {
    const hand = document.getElementById('hand-black');
    const targetCard = document.createElement('div');
    targetCard.className = 'card-item';
    targetCard.dataset.ownerKey = 'black';
    targetCard.dataset.handIndex = '0';
    targetCard.getBoundingClientRect = () => ({
      left: 420,
      top: 520,
      width: 90,
      height: 120,
      right: 510,
      bottom: 640
    });
    hand.appendChild(targetCard);
    const sourceDisc = document.createElement('div');
    sourceDisc.className = 'disc white source-only-class';
    sourceDisc.cloneNode = jest.fn(() => {
      throw new Error('capture overlay must not clone the board disc');
    });
    document.querySelector('.cell').appendChild(sourceDisc);
    const boardQuery = jest.spyOn(global.boardEl, 'querySelector').mockImplementation(() => {
      throw new Error('capture overlay must not query board cells');
    });
    getBoardCellClientRectMock.mockImplementation(() => ({
      left: 100,
      top: 200,
      width: 80,
      height: 80,
      right: 180,
      bottom: 280
    }));
    global.boardEl.style.setProperty('--board-disc-size-px', '72px');
    global.boardEl.style.setProperty('--board-disc-inset-px', '4px');
    const animatedElements = [];
    window.Element.prototype.animate = jest.fn(function () {
      animatedElements.push(this);
      return {
        addEventListener: jest.fn(),
        finished: Promise.resolve()
      };
    });
    global.applyStoneVisualEffect = jest.fn();

    const animationUtils = require('../ui/animation-utils.js');
    await animationUtils.playCaptureToHandAnimation({
      player: 'black',
      cardId: 'dragon_01',
      sourceRow: 0,
      sourceCol: 0,
      sourceOwner: 'white',
      sourceSpecialType: 'DRAGON',
      insertIndex: 0
    });

    expect(boardQuery).not.toHaveBeenCalled();
    expect(sourceDisc.cloneNode).not.toHaveBeenCalled();
    expect(global.applyStoneVisualEffect).toHaveBeenCalledWith(
      expect.objectContaining({ className: expect.stringContaining('disc white') }),
      'DRAGON',
      { owner: 'white' }
    );
    expect(animatedElements[0]).toEqual(expect.objectContaining({
      className: expect.stringContaining('disc white')
    }));
  });

  test('playHandAnimation skips hand movement but keeps placement completion when place hand animation is disabled', async () => {
    window.localStorage.setItem('othello.handAnimation.place', 'off');
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn();
    const mod = require('../ui/animation-utils.js');
    const onComplete = jest.fn();

    await expect(mod.playHandAnimation(global.BLACK, 0, 0, onComplete)).resolves.toBeUndefined();

    expect(wrapper.animate).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playStoneClack).toHaveBeenCalledTimes(1);
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playHandAnimation resolves expansion-layer cells for placement sound', async () => {
    document.body.innerHTML = `
      <div id="board-stack">
        <div id="board-frame">
          <div id="board"></div>
        </div>
        <div id="board-expansion-layer">
          <div class="cell cell-expanded cell-expanded-top" data-row="-1" data-col="0"></div>
        </div>
      </div>
      <div id="deck-black"></div>
      <div id="deck-white"></div>
      <div id="charge-black"></div>
      <div id="charge-white"></div>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <div id="handLayer" style="display:none;"></div>
      <div id="handWrapper"></div>
      <div id="heldStone"></div>
      <img id="handImage" />
    `;
    global.boardEl = document.getElementById('board');
    window.localStorage.setItem('othello.handAnimation.place', 'off');
    const mod = require('../ui/animation-utils.js');
    const onComplete = jest.fn();

    await expect(mod.playHandAnimation(global.BLACK, -1, 0, onComplete)).resolves.toBeUndefined();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playStoneClack).toHaveBeenCalledTimes(1);
  });

  test('playDrawCardHandAnimation preloads the drawn card background before hand reveal', async () => {
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      deck_a: 'assets/images/card/01_宝箱.png'
    });
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');

    const promise = mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_a', count: 1 });
    await Promise.resolve();

    expect(imageSrcs).toContain('assets/images/card/01_宝箱.png');
    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation finalizes no-wait preload without scheduling card art timeout', async () => {
    jest.useFakeTimers();

    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    window.resolveCardBackgroundArtPath = jest.fn(() => '');
    global.resolveCardBackgroundArtPath = window.resolveCardBackgroundArtPath;
    window.__drawHandAnimActive = true;

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', cardId: 'missing_card', count: 1 });

    try {
      await Promise.resolve();
      expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 900);
      await expect(promise).resolves.toBeUndefined();

      expect(global.renderCardUI).toHaveBeenCalled();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  test('playDrawCardHandAnimation still waits through card art timeout when preload needs waiting', async () => {
    jest.useFakeTimers();

    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      deck_wait: 'assets/images/card/wait-card.png'
    });
    window.__drawHandAnimActive = true;
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_wait', count: 1 });

    try {
      await Promise.resolve();

      expect(imageSrcs).toContain('assets/images/card/wait-card.png');
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 900);

      await jest.advanceTimersByTimeAsync(901);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  test('playCardUseHandAnimation preloads the moving card background', async () => {
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      card_1: 'assets/images/card/02_自由の意志.png'
    });
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');

    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_1', cost: 5, name: 'Test' });
    await Promise.resolve();

    expect(imageSrcs).toContain('assets/images/card/02_自由の意志.png');
    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation resolves preload art without building an extra card face when path resolver exists', async () => {
    jest.useFakeTimers();
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      card_1: 'assets/images/card/from-card-face.png'
    });
    const resolveCardBackgroundArtPath = jest.fn(() => 'assets/images/card/from-resolver.png');
    global.resolveCardBackgroundArtPath = resolveCardBackgroundArtPath;
    window.resolveCardBackgroundArtPath = resolveCardBackgroundArtPath;

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;
    document.getElementById('hand-black').getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    document.getElementById('charge-black').getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_1', cost: 5, name: 'Test' });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(4000);
    await Promise.resolve();

    expect(resolveCardBackgroundArtPath).toHaveBeenCalledWith('card_1', expect.objectContaining({ ownerKey: 'black' }));
    expect(imageSrcs).toContain('assets/images/card/from-resolver.png');
    expect(global.createCardFaceElement).toHaveBeenCalledTimes(1);
    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation falls back to card face preload when path resolver returns no art', async () => {
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      card_1: 'assets/images/card/from-card-face.png'
    });
    const resolveCardBackgroundArtPath = jest.fn(() => '');
    global.resolveCardBackgroundArtPath = resolveCardBackgroundArtPath;
    window.resolveCardBackgroundArtPath = resolveCardBackgroundArtPath;
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');

    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_1', cost: 5, name: 'Test' });
    await Promise.resolve();

    expect(resolveCardBackgroundArtPath).toHaveBeenCalledWith('card_1', expect.objectContaining({ ownerKey: 'black' }));
    expect(global.createCardFaceElement).toHaveBeenCalled();
    expect(imageSrcs).toContain('assets/images/card/from-card-face.png');
    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation preloads the visual descriptor card background when payload cardId is hidden', async () => {
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      real_card_1: 'assets/images/card/03_探索.png'
    });
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');

    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: '__hidden_hand__:black:0',
      cost: 5,
      name: 'Hidden',
      visualDescriptor: {
        cardId: 'real_card_1',
        cost: 5,
        name: 'Real'
      }
    });
    await Promise.resolve();

    expect(imageSrcs).toContain('assets/images/card/03_探索.png');
    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation releases loaded preload image references from the cache', async () => {
    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      card_2: 'assets/images/card/04_成長.png'
    });
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils.js');

    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_2', cost: 5, name: 'Test' });
    await expect(promise).resolves.toBeUndefined();

    const cacheEntry = window.__cardFaceArtPreloadCache && window.__cardFaceArtPreloadCache['assets/images/card/04_成長.png'];
    expect(cacheEntry).toEqual(expect.objectContaining({ promise: expect.any(Promise) }));
    expect(cacheEntry.image).toBeNull();
  });

  test('playDrawCardHandAnimation uses a CPU actor image without replacing the selected hand image', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    unlockAltGachaHandSkin(window);
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    window.cpuSmartness = { black: 1, white: 4 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.syncDisplayedHandSkin = handSkin.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const selectedImage = document.getElementById('handImage');
    selectedImage.setAttribute('src', 'assets/images/hand-skin/selected-local.png');
    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1, cpu: true, cpuLevel: 4 });
    await Promise.resolve();

    const actorImage = wrapper.querySelector('.hand-animation-actor-image');
    expect(selectedImage.getAttribute('src')).toBe('assets/images/hand-skin/selected-local.png');
    expect(actorImage?.getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(actorImage?.getAttribute('data-hand-skin-id')).toBe('cpu-lv4');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation restores the hand images when required layout DOM is missing', async () => {
    window.cpuSmartness = { black: 1, white: 4 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const selectedImage = document.getElementById('handImage');
    selectedImage.setAttribute('src', 'assets/images/hand-skin/selected-local.png');
    selectedImage.setAttribute('data-hand-skin-id', ALT_GACHA_HAND_SKIN_ID);
    document.getElementById('handLayer').remove();
    const mod = require('../ui/animation-utils.js');

    await expect(mod.playDrawCardHandAnimation({ player: 'white', count: 1, cpu: true, cpuLevel: 4 })).resolves.toBeUndefined();

    const actorImage = document.querySelector('.hand-animation-actor-image');
    expect(selectedImage.style.visibility).toBe('');
    expect(actorImage?.getAttribute('data-hand-animation-active')).toBe('false');
    expect(actorImage?.style.visibility).toBe('hidden');
  });

  test('playDrawCardHandAnimation resolves CPU hand from CPU LEVEL selects when window cpuSmartness is unavailable', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    window.MATCH_MODE = 'cpu';
    unlockAltGachaHandSkin(window);
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    appendCpuLevelSelect(document, 'smartBlack', 1);
    appendCpuLevelSelect(document, 'smartWhite', 4);
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.syncDisplayedHandSkin = handSkin.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const mod = require('../ui/animation-utils.js');
    expect(window.cpuSmartness).toBeUndefined();

    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1 });
    await Promise.resolve();

    const actorImage = wrapper.querySelector('.hand-animation-actor-image');
    expect(actorImage?.getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(actorImage?.getAttribute('data-hand-skin-id')).toBe('cpu-lv4');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation uses bottom-seat orientation when white is on bottom slot', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const handBottom = document.getElementById('hand-black');
    const handTop = document.getElementById('hand-white');
    handBottom.dataset.ownerKey = 'white';
    handTop.dataset.ownerKey = 'black';

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1 });
    await Promise.resolve();
    const held = wrapper.querySelector('.held-draw-card');
    expect(held).toBeTruthy();
    expect(held.classList.contains('face-up')).toBe(true);
    expect(held.classList.contains('face-down')).toBe(false);
    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation picks owner deck slot when seat is swapped', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const deckBottom = document.getElementById('deck-black');
    const deckTop = document.getElementById('deck-white');
    const handBottom = document.getElementById('hand-black');
    const handTop = document.getElementById('hand-white');

    handBottom.dataset.ownerKey = 'white';
    handTop.dataset.ownerKey = 'black';
    deckBottom.dataset.ownerKey = 'white';
    deckTop.dataset.ownerKey = 'black';

    deckBottom.getBoundingClientRect = () => ({ left: 240, top: 420, width: 120, height: 160, right: 360, bottom: 580 });
    deckTop.getBoundingClientRect = () => ({ left: 40, top: 80, width: 120, height: 160, right: 160, bottom: 240 });
    handBottom.getBoundingClientRect = () => ({ left: 180, top: 500, width: 180, height: 120, right: 360, bottom: 620 });
    handTop.getBoundingClientRect = () => ({ left: 120, top: 60, width: 180, height: 120, right: 300, bottom: 180 });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1 });
    await Promise.resolve();

    expect(wrapper.style.transform).toContain('translate(210px, 300px)');
    expect(wrapper.style.transform).not.toContain('translate(40px, -40px)');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playHandAnimation uses 5%-slower placement motion durations than the current baseline', async () => {
    jest.useFakeTimers();

    const cancelMock = jest.fn();
    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    const wrapper = document.getElementById('handWrapper');
    wrapper.getAnimations = jest.fn(() => [{ cancel: cancelMock }]);
    board.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480
    });
    cell.getBoundingClientRect = () => ({
      left: 180,
      top: 180,
      width: 60,
      height: 60,
      right: 240,
      bottom: 240
    });

    const mod = require('../ui/animation-utils.js');
    const onComplete = jest.fn();
    const promise = mod.playHandAnimation(global.BLACK, 0, 0, onComplete);

    await Promise.resolve();
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
    expect(onComplete).toHaveBeenCalledTimes(1);

    const transformDurations = animateMock.mock.calls
      .filter((call) => Array.isArray(call[0]) && call[0].every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')))
      .map((call) => call[1].duration);
    const transformEasings = animateMock.mock.calls
      .filter((call) => Array.isArray(call[0]) && call[0].every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')))
      .map((call) => call[1].easing);

    expect(transformDurations).toEqual([208, 78, 156]);
    expect(transformEasings).toEqual([
      'cubic-bezier(0.3, 0.2, 0.7, 0.8)',
      'ease-in-out',
      'cubic-bezier(0.3, 0.2, 0.7, 0.8)'
    ]);
    expect(document.getElementById('handLayer').style.display).toBe('block');
    expect(wrapper.style.display).toBe('block');
    expect(wrapper.style.opacity).toBe('0');
    expect(cancelMock).toHaveBeenCalledTimes(2);
  });

  test.each([
    {
      label: 'bottom owner',
      player: 1,
      handId: 'hand-black',
      cardRect: { left: 300, top: 520, width: 100, height: 120, right: 400, bottom: 640 },
      expectedApproach: [
        { transform: 'translate(260px, 472px) rotate(0deg) scale(0.8)', opacity: 0 },
        { transform: 'translate(120px, 155px) rotate(0deg) scale(0.8)', opacity: 1 }
      ],
      expectedRetreat: [
        { transform: 'translate(120px, 155px) rotate(0deg) scale(0.8)', opacity: 1 },
        { transform: 'translate(183px, 297.65px) rotate(0deg) scale(0.8)', opacity: 0, offset: 0.45 },
        { transform: 'translate(260px, 472px) rotate(0deg) scale(0.8)', opacity: 0 }
      ]
    },
    {
      label: 'top owner',
      player: -1,
      handId: 'hand-white',
      cardRect: { left: 60, top: 80, width: 80, height: 100, right: 140, bottom: 180 },
      expectedApproach: [
        { transform: 'translate(10px, -113px) rotate(180deg) scale(0.7)', opacity: 0 },
        { transform: 'translate(120px, -80px) rotate(180deg) scale(0.7)', opacity: 1 }
      ],
      expectedRetreat: [
        { transform: 'translate(120px, -80px) rotate(180deg) scale(0.7)', opacity: 1 },
        { transform: 'translate(70.5px, -94.85px) rotate(180deg) scale(0.7)', opacity: 0, offset: 0.45 },
        { transform: 'translate(10px, -113px) rotate(180deg) scale(0.7)', opacity: 0 }
      ]
    }
  ])('playHandAnimation starts near $label cards and fades in and out', async ({
    player,
    handId,
    cardRect,
    expectedApproach,
    expectedRetreat
  }) => {
    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    const wrapper = document.getElementById('handWrapper');
    const hand = document.getElementById(handId);
    const card = document.createElement('div');
    card.className = 'card-item';
    card.getBoundingClientRect = () => cardRect;
    hand.appendChild(card);
    board.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480
    });
    cell.getBoundingClientRect = () => ({
      left: 180,
      top: 180,
      width: 60,
      height: 60,
      right: 240,
      bottom: 240
    });
    const animateMock = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    wrapper.animate = animateMock;

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playHandAnimation(player, 0, 0, jest.fn())).resolves.toBeUndefined();

    const approachCall = animateMock.mock.calls.find((call) => call[1].duration === 208);
    const retreatCall = animateMock.mock.calls.find((call) => call[1].duration === 156);
    expect(approachCall?.[0]).toEqual(expectedApproach);
    expect(retreatCall?.[0]).toEqual(expectedRetreat);
    expect(retreatCall?.[1]).toMatchObject({ duration: 156, opacityDuration: 70 });
    expect(wrapper.style.opacity).toBe('0');
  });

  test('playHandAnimation clips partially scrolled cards to the visible hand container', async () => {
    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    const wrapper = document.getElementById('handWrapper');
    const hand = document.getElementById('hand-black');
    const card = document.createElement('div');
    card.className = 'card-item';
    hand.getBoundingClientRect = () => ({
      left: 200,
      top: 500,
      width: 200,
      height: 140,
      right: 400,
      bottom: 640
    });
    card.getBoundingClientRect = () => ({
      left: 360,
      top: 520,
      width: 100,
      height: 100,
      right: 460,
      bottom: 620
    });
    hand.appendChild(card);
    board.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480
    });
    cell.getBoundingClientRect = () => ({
      left: 180,
      top: 180,
      width: 60,
      height: 60,
      right: 240,
      bottom: 240
    });
    const animateMock = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    wrapper.animate = animateMock;

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playHandAnimation(global.BLACK, 0, 0, jest.fn())).resolves.toBeUndefined();

    const approachCall = animateMock.mock.calls.find((call) => call[1].duration === 208);
    expect(approachCall?.[0]?.[0]).toEqual({
      transform: 'translate(290px, 462px) rotate(0deg) scale(0.8)',
      opacity: 0
    });
  });

  test('playHandAnimation falls back to the hand container center when no cards are visible', async () => {
    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    const wrapper = document.getElementById('handWrapper');
    const hand = document.getElementById('hand-black');
    hand.getBoundingClientRect = () => ({
      left: 200,
      top: 500,
      width: 300,
      height: 130,
      right: 500,
      bottom: 630
    });
    board.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480
    });
    cell.getBoundingClientRect = () => ({
      left: 180,
      top: 180,
      width: 60,
      height: 60,
      right: 240,
      bottom: 240
    });
    const animateMock = jest.fn(() => ({
      addEventListener: jest.fn(),
      finished: Promise.resolve()
    }));
    wrapper.animate = animateMock;

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playHandAnimation(global.BLACK, 0, 0, jest.fn())).resolves.toBeUndefined();

    const approachCall = animateMock.mock.calls.find((call) => call[1].duration === 208);
    expect(approachCall?.[0]?.[0]).toEqual({
      transform: 'translate(260px, 457px) rotate(0deg) scale(0.8)',
      opacity: 0
    });
  });

  test('playDrawCardHandAnimation uses 10%-slower draw motion durations than the current baseline', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const deck = document.getElementById('deck-black');
    const hand = document.getElementById('hand-black');
    deck.getBoundingClientRect = () => ({
      left: 300,
      top: 520,
      width: 120,
      height: 160,
      right: 420,
      bottom: 680
    });
    hand.getBoundingClientRect = () => ({
      left: 180,
      top: 560,
      width: 180,
      height: 120,
      right: 360,
      bottom: 680
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });

    await Promise.resolve();
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();

    const transformDurations = animateMock.mock.calls
      .filter((call) => Array.isArray(call[0]) && call[0].every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')))
      .map((call) => call[1].duration);
    const transformEasings = animateMock.mock.calls
      .filter((call) => Array.isArray(call[0]) && call[0].every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')))
      .map((call) => call[1].easing);

    expect(transformDurations).toEqual([109, 280, 171]);
    expect(transformEasings).toEqual([
      'ease-out',
      'cubic-bezier(0.3, 0.2, 0.7, 0.8)',
      'cubic-bezier(0.3, 0.2, 0.7, 0.8)'
    ]);
  });

  test('playDrawCardHandAnimation does not start a later phase after reset cancels the active phase', async () => {
    jest.useFakeTimers();

    const wrapper = document.getElementById('handWrapper');
    let activeAnimation = null;
    const animateMock = jest.fn(() => {
      let rejectFinished;
      const finished = new Promise((resolve, reject) => {
        rejectFinished = reject;
      });
      activeAnimation = {
        addEventListener: () => {},
        finished,
        cancel: jest.fn(() => {
          activeAnimation = null;
          rejectFinished(new Error('reset'));
        })
      };
      return activeAnimation;
    });
    wrapper.animate = animateMock;
    wrapper.getAnimations = jest.fn(() => activeAnimation ? [activeAnimation] : []);

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });
    await Promise.resolve();
    await Promise.resolve();

    expect(animateMock).toHaveBeenCalledTimes(1);
    wrapper.style.opacity = '0';
    activeAnimation.cancel();

    await expect(promise).resolves.toBeUndefined();
    expect(animateMock).toHaveBeenCalledTimes(1);
    expect(wrapper.style.opacity).toBe('0');
    jest.clearAllTimers();
  });

  test('playClearHandAnimation initializes staged reveal state with zero visible cards', async () => {
    const hand = document.getElementById('hand-black');
    hand.innerHTML = '<div class="card-item visible"></div><div class="card-item visible"></div>';
    const mod = require('../ui/animation-utils.js');
    await expect(mod.playClearHandAnimation({ player: 'black', count: 2, reason: 'rebuild_will' })).resolves.toBeUndefined();
    expect(window.__handSequentialRevealState).toMatchObject({ playerKey: 'black', visibleCount: 0, reason: 'rebuild_will' });
  });

  test('playClearHandAnimation uses DESTROY_FADE_MS and removes only targeted count', async () => {
    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => ({
        setTimeout: (fn) => {
          fn();
          return 0;
        },
        clearTimeout: () => {},
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
      })
    }));

    global.SharedConstants = { DESTROY_FADE_MS: 620 };
    const hand = document.getElementById('hand-black');
    hand.innerHTML = [
      '<div class="card-item visible" data-card-id="keep"></div>',
      '<div class="card-item visible" data-card-id="remove"></div>'
    ].join('');
    const cards = Array.from(hand.querySelectorAll('.card-item'));
    const keepAnimate = jest.fn(() => ({ addEventListener: () => {}, finished: Promise.resolve() }));
    const removeAnimate = jest.fn(() => ({ addEventListener: () => {}, finished: Promise.resolve() }));
    cards[0].animate = keepAnimate;
    cards[1].animate = removeAnimate;

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playClearHandAnimation({
      player: 'black',
      count: 1,
      reason: 'destroy_hand_card',
      cardId: 'remove'
    })).resolves.toBeUndefined();

    expect(keepAnimate).toHaveBeenCalledTimes(0);
    expect(removeAnimate).toHaveBeenCalledTimes(1);
    expect(removeAnimate.mock.calls[0][1]).toMatchObject({ duration: 620 });
  });

  test('playDrawCardHandAnimation advances staged reveal count and clears state at full hand', async () => {
    global.cardState = {
      hands: {
        black: ['deck_a', 'deck_b'],
        white: []
      }
    };
    window.__handSequentialRevealState = { playerKey: 'black', visibleCount: 0, reason: 'rebuild_will' };

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_a', count: 1 })).resolves.toBeUndefined();
    expect(window.__handSequentialRevealState).toMatchObject({ playerKey: 'black', visibleCount: 1, reason: 'rebuild_will' });

    window.__lastDrawAnimAt = 0;
    await expect(mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_b', count: 1 })).resolves.toBeUndefined();
    expect(window.__handSequentialRevealState).toBeNull();
  });

  test('playDrawCardHandAnimation normalizes string player key "1" as black', async () => {
    global.cardState = {
      hands: {
        black: ['deck_a'],
        white: []
      }
    };
    window.__handSequentialRevealState = { playerKey: 'black', visibleCount: 0, reason: 'rebuild_will' };

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDrawCardHandAnimation({ player: '1', cardId: 'deck_a', count: 1 })).resolves.toBeUndefined();
    expect(window.__handSequentialRevealState).toBeNull();
  });

  test('playDrawCardHandAnimation waits until place-hand retreat releases the shared hand layer', async () => {
    jest.useFakeTimers();
    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    const deck = document.getElementById('deck-black');
    const hand = document.getElementById('hand-black');
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 480, right: 480, bottom: 480 });
    cell.getBoundingClientRect = () => ({ left: 180, top: 180, width: 60, height: 60, right: 240, bottom: 240 });
    deck.getBoundingClientRect = () => ({ left: 300, top: 520, width: 120, height: 160, right: 420, bottom: 680 });
    hand.getBoundingClientRect = () => ({ left: 180, top: 560, width: 180, height: 120, right: 360, bottom: 680 });

    const mod = require('../ui/animation-utils.js');
    let drawPromise = Promise.resolve();

    mod.playHandAnimation(global.BLACK, 0, 0, () => {
      drawPromise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });
    });

    await jest.advanceTimersByTimeAsync(240);
    expect(document.querySelector('.held-draw-card')).toBeNull();

    let queuedDrawCard = null;
    for (let i = 0; i < 12; i++) {
      await jest.advanceTimersByTimeAsync(40);
      await Promise.resolve();
      queuedDrawCard = document.querySelector('.held-draw-card');
      if (queuedDrawCard) break;
    }
    expect(queuedDrawCard).toBeTruthy();

    await jest.runAllTimersAsync();
    await expect(drawPromise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('block');
    expect(wrapper.style.display).toBe('block');
    expect(wrapper.style.opacity).toBe('0');
  });

  test('playDirectHandAddAnimation uses 1 second fade for generated throw-chain hand adds', async () => {
    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep"></div>';
    });

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDirectHandAddAnimation({
      player: 'black',
      cardId: 'triple_01',
      count: 1,
      reason: 'generated_throw_chain'
    })).resolves.toBeUndefined();

    const latestCard = document.querySelector('#hand-black .card-item:last-child');
    expect(latestCard).toBeTruthy();
    expect(latestCard.classList.contains('card-fade-prep')).toBe(false);
    expect(latestCard.classList.contains('card-fade-in')).toBe(true);
    expect(latestCard.style.getPropertyValue('--card-fade-in-duration')).toBe('1s');
  });

  test('playDirectHandAddAnimation clears fade classes after animation end', async () => {
    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep"></div>';
    });

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDirectHandAddAnimation({
      player: 'black',
      cardId: 'triple_01',
      count: 1,
      reason: 'generated_throw_chain'
    })).resolves.toBeUndefined();

    const latestCard = document.querySelector('#hand-black .card-item:last-child');
    expect(latestCard).toBeTruthy();
    expect(latestCard.classList.contains('card-fade-in')).toBe(true);
    expect(latestCard.style.getPropertyValue('--card-fade-in-duration')).toBe('1s');

    latestCard.dispatchEvent(new window.Event('animationend'));

    expect(latestCard.classList.contains('card-fade-prep')).toBe(false);
    expect(latestCard.classList.contains('card-fade-in')).toBe(false);
    expect(latestCard.style.getPropertyValue('--card-fade-in-duration')).toBe('');
  });

  test('settleOwnerHandFadeIn clears queued fade state on the owner-matched hand when seats are swapped', () => {
    const handBottom = document.getElementById('hand-black');
    const handTop = document.getElementById('hand-white');
    handBottom.dataset.ownerKey = 'white';
    handTop.dataset.ownerKey = 'black';
    handTop.innerHTML = '<div class="card-item card-fade-in" data-card-id="queued" style="--card-fade-in-duration: 1s;"></div>';
    window.__handFadeInState = { playerKey: 'black', count: 1, token: 'fade-token' };
    window.__handFadeInHint = { playerKey: 'black', count: 1, token: 'fade-token' };

    const mod = require('../ui/animation-utils.js');
    expect(mod.getQueuedHandFadeInState()).toMatchObject({ playerKey: 'black', count: 1, token: 'fade-token' });

    mod.settleOwnerHandFadeIn('black');

    const queuedCard = handTop.querySelector('.card-item');
    expect(queuedCard.classList.contains('card-fade-prep')).toBe(false);
    expect(queuedCard.classList.contains('card-fade-in')).toBe(false);
    expect(queuedCard.style.getPropertyValue('--card-fade-in-duration')).toBe('');
    expect(window.__handFadeInState).toBeNull();
    expect(window.__handFadeInHint).toBeNull();
  });

  test('playDirectHandAddAnimation keeps default fade duration for non throw-chain hand adds', async () => {
    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep" style="--card-fade-in-duration: 1s;"></div>';
    });

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDirectHandAddAnimation({
      player: 'black',
      cardId: 'other_card',
      count: 1,
      reason: 'other_reason'
    })).resolves.toBeUndefined();

    const latestCard = document.querySelector('#hand-black .card-item:last-child');
    expect(latestCard).toBeTruthy();
    expect(latestCard.classList.contains('card-fade-in')).toBe(true);
    expect(latestCard.style.getPropertyValue('--card-fade-in-duration')).toBe('');
  });

  test('playDirectHandAddAnimation keeps fade hint until next frame so sync rerender still fades generated throw-chain cards', async () => {
    const frameQueue = [];
    global.requestAnimationFrame = jest.fn((callback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    global.window.requestAnimationFrame = global.requestAnimationFrame;

    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep" data-render="initial"></div>';
    });

    const mod = require('../ui/animation-utils.js');
    await expect(mod.playDirectHandAddAnimation({
      player: 'black',
      cardId: 'triple_01',
      count: 1,
      reason: 'generated_throw_chain'
    })).resolves.toBeUndefined();

    expect(frameQueue).toHaveLength(1);
    expect(window.__handFadeInHint).toMatchObject({ playerKey: 'black', count: 1 });
    expect(window.__handFadeInState).toMatchObject({ playerKey: 'black', count: 1 });

    document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep" data-render="sync"></div>';
    frameQueue[0]();

    const latestCard = document.querySelector('#hand-black .card-item:last-child');
    expect(latestCard).toBeTruthy();
    expect(latestCard.dataset.render).toBe('sync');
    expect(latestCard.classList.contains('card-fade-prep')).toBe(false);
    expect(latestCard.classList.contains('card-fade-in')).toBe(true);
    expect(latestCard.style.getPropertyValue('--card-fade-in-duration')).toBe('1s');
    expect(window.__handFadeInHint).toBeNull();
    expect(window.__handFadeInState).toBeNull();
  });

  test('playDrawCardHandAnimation resolves after playback scope timers are cleared', async () => {
    jest.useFakeTimers();
    const timerApi = createScopedTimerMock();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => timerApi
    }));

    window._currentPlaybackScope = 'draw-scope';
    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });
    timerApi.clearScope('draw-scope');
    await jest.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('block');
    expect(document.getElementById('handWrapper').style.opacity).toBe('0');
  });

  test('playHandAnimation resolves and hides after playback scope timers are cleared', async () => {
    jest.useFakeTimers();
    const timerApi = createScopedTimerMock();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => timerApi
    }));

    const wrapper = document.getElementById('handWrapper');
    const board = document.getElementById('board');
    const cell = board.querySelector('.cell[data-row="0"][data-col="0"]');
    board.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 480,
      right: 480,
      bottom: 480
    });
    cell.getBoundingClientRect = () => ({
      left: 180,
      top: 180,
      width: 60,
      height: 60,
      right: 240,
      bottom: 240
    });

    let activeAnimation = null;
    const cancelAnimation = jest.fn();
    wrapper.animate = jest.fn(() => {
      activeAnimation = {
        addEventListener: () => {},
        finished: new Promise(() => {}),
        cancel: cancelAnimation
      };
      return activeAnimation;
    });
    wrapper.getAnimations = jest.fn(() => activeAnimation ? [activeAnimation] : []);

    window._currentPlaybackScope = 'place-scope';
    const mod = require('../ui/animation-utils.js');
    const onComplete = jest.fn();
    const promise = mod.playHandAnimation(global.WHITE, 0, 0, onComplete);
    let settled = false;
    void promise.then(() => { settled = true; });

    await Promise.resolve();
    expect(wrapper.style.opacity).toBe('1');
    timerApi.clearScope('place-scope');
    await jest.advanceTimersByTimeAsync(2000);

    expect(settled).toBe(true);
    await expect(promise).resolves.toBeUndefined();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(wrapper.style.opacity).toBe('0');
    expect(document.getElementById('heldStone').style.display).toBe('none');
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('playCardUseHandAnimation resolves after playback scope timers are cleared', async () => {
    jest.useFakeTimers();
    const timerApi = createScopedTimerMock();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => timerApi
    }));

    window._currentPlaybackScope = 'card-use-scope';
    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_1', cost: 5, name: 'Test' });
    timerApi.clearScope('card-use-scope');
    await jest.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('block');
  });

  test('playCardUseHandAnimation lifts vertically before traveling to the charge UI', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    const sourceCardEl = document.createElement('div');
    sourceCardEl.className = 'card-item visible selected usable';
    sourceCardEl.getBoundingClientRect = () => ({
      left: 220,
      top: 500,
      width: 90,
      height: 120,
      right: 310,
      bottom: 620
    });

    handEl.appendChild(sourceCardEl);
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'card_1',
      cost: 5,
      name: 'Test',
      sourceCardEl
    });

    await Promise.resolve();
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();

    const transformCalls = animateMock.mock.calls
      .map((call) => call[0])
      .filter((frames) => Array.isArray(frames) && frames.every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')));

    expect(transformCalls[0]).toEqual([
      { transform: 'translate(0px, 0px)' },
      { transform: 'translate(0px, -14px)' }
    ]);
    expect(transformCalls[1]).toEqual([
      { transform: 'translate(0px, -14px)' },
      { transform: 'translate(215px, -220px)' }
    ]);
  });

  test('playCardUseHandAnimation uses sourceCardRect snapshot when source element is already detached', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const sourceCardEl = document.createElement('div');
    sourceCardEl.className = 'card-item visible';
    sourceCardEl.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'card_1',
      cost: 5,
      name: 'Test',
      sourceCardEl,
      sourceCardRect: {
        left: 220,
        top: 500,
        width: 90,
        height: 120,
        right: 310,
        bottom: 620
      }
    });

    await Promise.resolve();
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();

    const transformCalls = animateMock.mock.calls
      .map((call) => call[0])
      .filter((frames) => Array.isArray(frames) && frames.every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')));

    expect(transformCalls[1]).toEqual([
      { transform: 'translate(0px, -14px)' },
      { transform: 'translate(215px, -220px)' }
    ]);
  });

  test('playCardUseHandAnimation skips hand layout read when sourceCardRect is available', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = jest.fn(() => {
      throw new Error('hand rect should not be read when sourceCardRect is available');
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'card_1',
      cost: 5,
      name: 'Test',
      sourceCardRect: {
        left: 220,
        top: 500,
        width: 90,
        height: 120,
        right: 310,
        bottom: 620
      }
    });

    await Promise.resolve();
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
    expect(handEl.getBoundingClientRect).not.toHaveBeenCalled();
    const transformCalls = animateMock.mock.calls
      .map((call) => call[0])
      .filter((frames) => Array.isArray(frames) && frames.every((frame) => Object.prototype.hasOwnProperty.call(frame, 'transform')));
    expect(transformCalls[1]).toEqual([
      { transform: 'translate(0px, -14px)' },
      { transform: 'translate(215px, -220px)' }
    ]);
  });

  test('playCardUseHandAnimation fallback builds a styled card face when source element is unavailable', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'card_1', name: 'Blue Test', cost: 11 }))
    };

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'card_1',
      cost: 11,
      name: 'Blue Test'
    });

    await Promise.resolve();

    const movingCard = document.querySelector('#handLayer .card-item');
    expect(movingCard).toBeTruthy();
    expect(movingCard.classList.contains('cost-tier-blue')).toBe(true);
    expect(movingCard.dataset.cardId).toBe('card_1');
    const badge = movingCard.querySelector('.card-cost-badge');
    expect(badge).toBeTruthy();
    expect(badge.classList.contains('cost-tier-blue')).toBe(true);
    expect(badge.textContent).toBe('11cost');
    expect(badge.parentElement).toBe(movingCard);
    expect(movingCard.querySelector('.card-badge-row')).toBeNull();
    expect(movingCard.querySelector('.card-type-badge')).toBeNull();
    expect(movingCard.querySelector('.card-badge-row .card-cost-badge')).toBeNull();

    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation fallback uses visualDescriptor when card catalog lookup is unavailable', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;
    global.CardLogic = {
      getCardDef: jest.fn(() => null)
    };

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      visualDescriptor: {
        name: 'Descriptor Card',
        cost: 21,
        costTier: 'gold'
      }
    });

    await Promise.resolve();

    const movingCard = document.querySelector('#handLayer .card-item');
    expect(movingCard).toBeTruthy();
    expect(movingCard.classList.contains('cost-tier-gold')).toBe(true);
    expect(movingCard.dataset.cardId).toBeUndefined();
    expect(movingCard.querySelector('.card-name').textContent).toBe('Descriptor Card');
    const costBadge = movingCard.querySelector('.card-cost-badge');
    expect(costBadge.textContent).toBe('21cost');
    expect(costBadge.parentElement).toBe(movingCard);
    expect(movingCard.querySelector('.card-badge-row')).toBeNull();
    expect(movingCard.querySelector('.card-type-badge')).toBeNull();
    expect(movingCard.querySelector('.card-badge-row .card-cost-badge')).toBeNull();

    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation builds a lightweight ghost when source element carries hand-state classes', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;
    global.CardLogic = {
      getCardDef: jest.fn(() => ({ id: 'rainbow_stone', name: '虹の意志', cost: 21, display_type_ja: '特殊' }))
    };

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const sourceCardEl = document.createElement('div');
    sourceCardEl.className = 'card-item visible clickable usable selected cost-tier-gold';
    sourceCardEl.dataset.cardId = 'rainbow_stone';
    sourceCardEl.dataset.cardType = 'special';
    sourceCardEl.innerHTML = `
      <span class="card-name">虹の意志</span>
      <div class="card-cost-badge cost-tier-gold"><span class="cost-value">21</span><span class="cost-label">cost</span></div>
      <div class="card-badge-row"><div class="card-type-badge">✦ 特殊</div></div>
    `;
    sourceCardEl.getBoundingClientRect = () => ({
      left: 240,
      top: 500,
      width: 90,
      height: 120,
      right: 330,
      bottom: 620
    });
    handEl.appendChild(sourceCardEl);

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'rainbow_stone',
      sourceCardEl,
      sourceCardRect: {
        left: 240,
        top: 500,
        width: 90,
        height: 120,
        right: 330,
        bottom: 620
      }
    });

    await Promise.resolve();

    const movingCard = document.querySelector('#handLayer .card-item');
    expect(movingCard).toBeTruthy();
    expect(movingCard.classList.contains('card-use-ghost')).toBe(true);
    expect(movingCard.classList.contains('cost-tier-gold')).toBe(true);
    expect(movingCard.classList.contains('clickable')).toBe(false);
    expect(movingCard.classList.contains('usable')).toBe(false);
    expect(movingCard.classList.contains('selected')).toBe(false);
    expect(movingCard.querySelector('.card-badge-row')).toBeNull();
    expect(movingCard.querySelector('.card-type-badge')).toBeNull();
    expect(movingCard.querySelector('.card-cost-badge')).toBeTruthy();

    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
  });

  test('playCardUseHandAnimation plays disappearSoundKey when the moving card is cleaned up', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-black');
    const chargeEl = document.getElementById('charge-black');
    handEl.getBoundingClientRect = () => ({
      left: 180,
      top: 480,
      width: 260,
      height: 140,
      right: 440,
      bottom: 620
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 430,
      top: 410,
      width: 100,
      height: 40,
      right: 530,
      bottom: 450
    });

    const mod = require('../ui/animation-utils.js');
    const onDisappear = jest.fn(() => Promise.resolve());
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'loss_will_01',
      cost: 15,
      name: '意志の喪失',
      disappearSoundKey: 'loss_will_reset',
      onDisappear
    });

    await Promise.resolve();
    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('loss_will_reset');
    expect(onDisappear).toHaveBeenCalledTimes(1);
  });

  test('playCardUseHandAnimation absorbs sacrifice-nullified cards into the sacrifice stone', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-white');
    const chargeEl = document.getElementById('charge-white');
    handEl.getBoundingClientRect = () => ({
      left: 720,
      top: 120,
      width: 260,
      height: 140,
      right: 980,
      bottom: 260
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 980,
      top: 150,
      width: 100,
      height: 40,
      right: 1080,
      bottom: 190
    });
    const sacrificeCell = document.querySelector('.cell[data-row="0"][data-col="0"]');
    sacrificeCell.getBoundingClientRect = jest.fn(() => {
      throw new Error('animation-utils must not read board cell DOM geometry');
    });
    getBoardCellClientRectMock.mockImplementation(() => ({
      left: 260,
      top: 300,
      width: 64,
      height: 64,
      right: 324,
      bottom: 364
    }));

    const mod = require('../ui/animation-utils.js');
    let resolveBoardEffect!: () => void;
    const boardEffectSettlement = new Promise<void>((resolve) => {
      resolveBoardEffect = resolve;
    });
    const playBoardEffect = jest.fn(() => boardEffectSettlement);
    const onDisappear = jest.fn(() => Promise.resolve());
    const promise = mod.playCardUseHandAnimation({
      player: 'white',
      owner: 'white',
      cardId: 'destroy_01',
      cost: 8,
      name: '破壊の意志',
      nullifiedBySacrificeWill: true,
      cardUseVanishEffect: 'sacrifice_seal_burn',
      sacrificeWill: { row: 0, col: 0, owner: 'black', special: 'SACRIFICE' },
      playBoardEffect,
      onDisappear
    });
    let outerSettled = false;
    void promise.then(
      () => { outerSettled = true; },
      () => { outerSettled = true; }
    );

    await Promise.resolve();
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    jest.advanceTimersByTime(900);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    const keyframesText = JSON.stringify(animateMock.mock.calls.map((call) => call[0]));
    const absorbCalls = animateMock.mock.calls.filter((call) => {
      const options = call[1] || {};
      return options && options.duration === 2600;
    });
    expect(keyframesText).toContain('scale(0.08)');
    expect(keyframesText).toContain('translate(-558px, 142px) scale(0.08)');
    expect(absorbCalls).toHaveLength(1);
    expect(getBoardCellClientRectMock).toHaveBeenCalledWith(0, 0);
    expect(playBoardEffect).toHaveBeenCalledWith({
      type: 'legacy_sacrifice_absorb_pulse',
      row: 0,
      col: 0,
      durationMs: 2600
    });

    // The old 3200/3600ms fallbacks used to resolve the hand animation while
    // this board-owned pulse was still active, allowing the committed Pixi
    // frame to invalidate its projection scope.
    jest.advanceTimersByTime(5000);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    expect(outerSettled).toBe(false);
    expect(onDisappear).not.toHaveBeenCalled();

    resolveBoardEffect();
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    await expect(promise).resolves.toBeUndefined();
    expect(onDisappear).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['typed error', () => new Error('sacrifice Pixi pulse failed')],
    ['undefined reason', () => undefined]
  ])('playCardUseHandAnimation propagates a rejected sacrifice board pulse (%s)', async (_label, createReason) => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-white');
    const chargeEl = document.getElementById('charge-white');
    handEl.getBoundingClientRect = () => ({
      left: 720,
      top: 120,
      width: 260,
      height: 140,
      right: 980,
      bottom: 260
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 980,
      top: 150,
      width: 100,
      height: 40,
      right: 1080,
      bottom: 190
    });
    getBoardCellClientRectMock.mockImplementation(() => ({
      left: 260,
      top: 300,
      width: 64,
      height: 64,
      right: 324,
      bottom: 364
    }));

    let rejectBoardEffect!: (reason?: any) => void;
    const boardEffectSettlement = new Promise<void>((_resolve, reject) => {
      rejectBoardEffect = reject;
    });
    const boardError = createReason();
    const onDisappear = jest.fn(() => Promise.resolve());
    const handImage = document.getElementById('handImage') as HTMLElement;
    const heldStone = document.getElementById('heldStone') as HTMLElement;
    handImage.style.visibility = 'visible';
    heldStone.style.display = 'block';
    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'white',
      owner: 'white',
      cardId: 'destroy_01',
      cost: 8,
      name: '破壊の意志',
      nullifiedBySacrificeWill: true,
      cardUseVanishEffect: 'sacrifice_seal_burn',
      sacrificeWill: { row: 0, col: 0, owner: 'black', special: 'SACRIFICE' },
      playBoardEffect: jest.fn(() => boardEffectSettlement),
      onDisappear
    });
    const rejected = expect(promise).rejects.toBe(boardError);

    await Promise.resolve();
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    jest.advanceTimersByTime(900);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    expect(handImage.style.visibility).toBe('hidden');
    expect(heldStone.style.display).toBe('none');
    expect(document.querySelectorAll('.card-use-ghost')).toHaveLength(1);
    jest.advanceTimersByTime(6000);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
    expect(onDisappear).not.toHaveBeenCalled();
    expect(handImage.style.visibility).toBe('hidden');
    expect(heldStone.style.display).toBe('none');
    rejectBoardEffect(boardError);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }

    await rejected;
    expect(onDisappear).not.toHaveBeenCalled();
    expect(handImage.style.visibility).toBe('visible');
    expect(heldStone.style.display).toBe('block');
    expect(document.querySelectorAll('.card-use-ghost')).toHaveLength(0);
    expect(window.isCardAnimating).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('playCardUseHandAnimation passes ownerKey into createCardFaceElement for moving cards', async () => {
    jest.useFakeTimers();

    const animateMock = jest.fn(() => ({
      addEventListener: () => {},
      finished: Promise.resolve()
    }));
    window.Element.prototype.animate = animateMock;

    const handEl = document.getElementById('hand-white');
    const chargeEl = document.getElementById('charge-white');
    handEl.getBoundingClientRect = () => ({
      left: 720,
      top: 120,
      width: 260,
      height: 140,
      right: 980,
      bottom: 260
    });
    chargeEl.getBoundingClientRect = () => ({
      left: 980,
      top: 150,
      width: 100,
      height: 40,
      right: 1080,
      bottom: 190
    });

    window.createCardFaceElement = jest.fn((_cardId, options) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card-item visible';
      cardEl.dataset.receivedOwnerKey = options && options.ownerKey ? options.ownerKey : '';
      const nameEl = document.createElement('span');
      nameEl.className = 'card-name';
      nameEl.textContent = 'Stub Card';
      cardEl.appendChild(nameEl);
      return cardEl;
    });

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playCardUseHandAnimation({
      player: 'white',
      owner: 'white',
      cardId: 'udr_01',
      name: '究極反転龍',
      cost: 30
    });

    await Promise.resolve();

    expect(window.createCardFaceElement).toHaveBeenCalledWith('udr_01', expect.objectContaining({ ownerKey: 'white' }));
    const movingCard = document.querySelector('#handLayer .card-item');
    expect(movingCard).toBeTruthy();
    expect(movingCard.dataset.receivedOwnerKey).toBe('white');

    jest.advanceTimersByTime(4000);
    await Promise.resolve();

    await expect(promise).resolves.toBeUndefined();
  });
});
