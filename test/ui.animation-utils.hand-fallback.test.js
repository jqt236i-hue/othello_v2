const { JSDOM } = require('jsdom');
const path = require('path');

describe('animation-utils hand fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="board">
          <div class="cell" data-row="0" data-col="0"></div>
        </div>
        <div id="deck-black"></div>
        <div id="deck-white"></div>
        <div id="hand-black"></div>
        <div id="hand-white"></div>
        <div id="handLayer" style="display:none;"></div>
        <div id="handWrapper"></div>
        <div id="heldStone"></div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.boardEl = document.getElementById('board');
    global.SoundEngine = { init: jest.fn(), playStoneClack: jest.fn() };
    global.renderCardUI = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;
    if (Object.prototype.hasOwnProperty.call(global, 'TimerRegistry')) {
      delete global.TimerRegistry;
    }
  });

  afterEach(() => {
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

  test('playDrawCardHandAnimation resolves without Element.animate', async () => {
    const wrapper = document.getElementById('handWrapper');
    wrapper.animate = undefined;
    const mod = require('../ui/animation-utils');

    await expect(mod.playDrawCardHandAnimation({ player: 'black', count: 1 })).resolves.toBeUndefined();
    expect(document.getElementById('handLayer').style.display).toBe('none');
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

    expect(wrapper.style.transform).toContain('translate(240px, 300px)');
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
});
