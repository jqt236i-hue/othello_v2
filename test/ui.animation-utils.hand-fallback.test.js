const { JSDOM } = require('jsdom');
const path = require('path');
const animationSharedPath = path.resolve(__dirname, '..', 'ui', 'animation-shared.js');
const ALT_GACHA_HAND_SKIN_ID = 'gacha__n__hand-swap';

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

describe('animation-utils hand fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.dontMock(animationSharedPath);
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
  });

  test('playHandAnimation completes even when Element.animate is unavailable', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils');

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout')), 2200);
      mod.playHandAnimation(global.BLACK, 0, 0, () => {
        clearTimeout(to);
        resolve();
      });
    });

    expect(global.SoundEngine.playStoneClack).toHaveBeenCalledTimes(1);
  });

  test('playHandAnimation can force CPU-only hand image for the acting owner', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    unlockAltGachaHandSkin(window);
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    window.cpuSmartness = { black: 3, white: 1 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.syncDisplayedHandSkin = handSkin.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const mod = require('../ui/animation-utils');

    const promise = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout')), 2200);
      mod.playHandAnimation(global.BLACK, 0, 0, () => {
        clearTimeout(to);
        resolve();
      }, { cpu: true, cpuLevel: 3, ownerKey: 'black' });
    });

    await Promise.resolve();
    expect(document.getElementById('handImage').getAttribute('src')).toBe('assets/images/hand-skin/lv3-5.png');
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe('cpu-lv3-5');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation resolves without Element.animate', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils');

    await expect(mod.playDrawCardHandAnimation({ player: 'black', count: 1 })).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playDrawCardHandAnimation can force CPU-only hand image for the acting owner', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    unlockAltGachaHandSkin(window);
    window.localStorage.setItem('othello.handSkin', ALT_GACHA_HAND_SKIN_ID);
    window.cpuSmartness = { black: 1, white: 4 };
    const handSkin = require('../ui/handlers/hand-skin.js');
    window.syncDisplayedHandSkin = handSkin.syncDisplayedHandSkin;
    window.resolveHandAnimationContext = handSkin.resolveHandAnimationContext;
    const mod = require('../ui/animation-utils');

    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1, cpu: true, cpuLevel: 4 });
    await Promise.resolve();

    expect(document.getElementById('handImage').getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe('cpu-lv4');

    await expect(promise).resolves.toBeUndefined();
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
    const mod = require('../ui/animation-utils');

    expect(window.cpuSmartness).toBeUndefined();

    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1 });
    await Promise.resolve();

    expect(document.getElementById('handImage').getAttribute('src')).toBe('assets/images/hand-skin/lv4.png');
    expect(document.getElementById('handImage').getAttribute('data-hand-skin-id')).toBe('cpu-lv4');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playDrawCardHandAnimation uses bottom-seat orientation when white is on bottom slot', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const handBottom = document.getElementById('hand-black');
    const handTop = document.getElementById('hand-white');
    handBottom.dataset.ownerKey = 'white';
    handTop.dataset.ownerKey = 'black';

    const mod = require('../ui/animation-utils');
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

    const mod = require('../ui/animation-utils');
    const promise = mod.playDrawCardHandAnimation({ player: 'white', count: 1 });
    await Promise.resolve();

    expect(wrapper.style.transform).toContain('translate(210px, 300px)');
    expect(wrapper.style.transform).not.toContain('translate(40px, -40px)');

    await expect(promise).resolves.toBeUndefined();
  });

  test('playClearHandAnimation initializes staged reveal state with zero visible cards', async () => {
    const hand = document.getElementById('hand-black');
    hand.innerHTML = '<div class="card-item visible"></div><div class="card-item visible"></div>';
    const mod = require('../ui/animation-utils');

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

    const mod = require('../ui/animation-utils');

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

    const mod = require('../ui/animation-utils');

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

    const mod = require('../ui/animation-utils');

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

    const mod = require('../ui/animation-utils');
    let drawPromise = Promise.resolve();

    mod.playHandAnimation(global.BLACK, 0, 0, () => {
      drawPromise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });
    });

    await jest.advanceTimersByTimeAsync(550);
    expect(document.querySelector('.held-draw-card')).toBeNull();

    await jest.advanceTimersByTimeAsync(1000);
    let queuedDrawCard = null;
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      queuedDrawCard = document.querySelector('.held-draw-card');
      if (queuedDrawCard) break;
    }
    expect(queuedDrawCard).toBeTruthy();

    await jest.runAllTimersAsync();
    await expect(drawPromise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playDirectHandAddAnimation uses 1 second fade for generated throw-chain hand adds', async () => {
    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep"></div>';
    });

    const mod = require('../ui/animation-utils');

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

  test('playDirectHandAddAnimation keeps default fade duration for non throw-chain hand adds', async () => {
    global.renderCardUI.mockImplementation(() => {
      document.getElementById('hand-black').innerHTML = '<div class="card-item card-fade-prep" style="--card-fade-in-duration: 1s;"></div>';
    });

    const mod = require('../ui/animation-utils');

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

    const mod = require('../ui/animation-utils');

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
    const mod = require('../ui/animation-utils');

    const promise = mod.playDrawCardHandAnimation({ player: 'black', count: 1 });
    timerApi.clearScope('draw-scope');
    await jest.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
  });

  test('playCardUseHandAnimation resolves after playback scope timers are cleared', async () => {
    jest.useFakeTimers();
    const timerApi = createScopedTimerMock();

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => timerApi
    }));

    window._currentPlaybackScope = 'card-use-scope';
    const mod = require('../ui/animation-utils');

    const promise = mod.playCardUseHandAnimation({ player: 'black', owner: 'black', cardId: 'card_1', cost: 5, name: 'Test' });
    timerApi.clearScope('card-use-scope');
    await jest.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
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

    const mod = require('../ui/animation-utils');
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

    const mod = require('../ui/animation-utils');
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

    const mod = require('../ui/animation-utils');
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

    const mod = require('../ui/animation-utils');
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
    expect(movingCard.querySelector('.card-badge-row .card-cost-badge')).toBeNull();

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

    const mod = require('../ui/animation-utils');
    const onDisappear = jest.fn(() => Promise.resolve());
    const promise = mod.playCardUseHandAnimation({
      player: 'black',
      owner: 'black',
      cardId: 'loss_will_01',
      cost: 11,
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

    const mod = require('../ui/animation-utils');
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
