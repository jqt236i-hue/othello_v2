import * as path from 'path';
import { JSDOM } from 'jsdom';

const CATALOG = require('../cards/card-demo-videos.generated');

function stubMediaPlayback(win: any) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => undefined;
  win.HTMLMediaElement.prototype.load = () => undefined;
}

function installDom(html = '<!doctype html><html><body></body></html>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  stubMediaPlayback(dom.window);
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  return dom;
}

function clearDom() {
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).CARD_DEFS;
  delete (global as any).CardDemoVideo;
}

afterEach(() => {
  clearDom();
});

describe('card demo video catalog', () => {
  test('lists normal cards only and every entry has a video file', () => {
    const fs = require('fs');
    const ids: string[] = CATALOG.CARD_DEMO_VIDEO_IDS;
    expect(ids.length).toBeGreaterThan(0);
    for (const special of ['theory_incarnation_01', 'board_executor_01', 'observer_will_01']) {
      expect(ids).not.toContain(special);
    }
    for (const id of ids) {
      expect(fs.existsSync(path.resolve(__dirname, '../assets/videos/cards', `${id}.mp4`))).toBe(true);
    }
  });
});

describe('card demo video button and popup', () => {
  function loadModule() {
    jest.resetModules();
    return require('../cards/card-demo-video');
  }

  test('adds a play button that opens a centered muted looping popup without selecting the card', () => {
    const dom = installDom();
    const CardDemoVideo = loadModule();
    const cardId = CATALOG.CARD_DEMO_VIDEO_IDS[0];
    const cardEl = dom.window.document.createElement('div');
    cardEl.className = 'card-item visible';
    const onCardClick = jest.fn();
    cardEl.addEventListener('click', onCardClick);
    dom.window.document.body.appendChild(cardEl);

    const button = CardDemoVideo.syncCardDemoVideoButton(cardEl, cardId, { cardName: 'テストカード' });
    expect(button).not.toBeNull();
    expect(cardEl.querySelectorAll('.card-demo-video-btn')).toHaveLength(1);
    // re-sync keeps a single button
    CardDemoVideo.syncCardDemoVideoButton(cardEl, cardId, { cardName: 'テストカード' });
    expect(cardEl.querySelectorAll('.card-demo-video-btn')).toHaveLength(1);

    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onCardClick).not.toHaveBeenCalled();

    const overlay = dom.window.document.getElementById('card-demo-video-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('.card-demo-video-title').textContent).toBe('テストカード');
    const video = overlay.querySelector('video');
    expect(video.getAttribute('src')).toBe(`assets/videos/cards/${cardId}.mp4`);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);

    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dom.window.document.getElementById('card-demo-video-overlay')).toBeNull();
    dom.window.close();
  });

  test('popup closes on backdrop click but not on panel click', () => {
    const dom = installDom();
    const CardDemoVideo = loadModule();
    const cardId = CATALOG.CARD_DEMO_VIDEO_IDS[0];
    const overlay = CardDemoVideo.openCardDemoVideo(cardId, { cardName: 'X' });
    overlay.querySelector('.card-demo-video-panel').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.document.getElementById('card-demo-video-overlay')).not.toBeNull();
    overlay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(dom.window.document.getElementById('card-demo-video-overlay')).toBeNull();
    dom.window.close();
  });

  test('cards without a video and special cards get no button', () => {
    const dom = installDom();
    const CardDemoVideo = loadModule();
    for (const cardId of ['unknown_card', 'theory_incarnation_01', 'observer_will_01']) {
      const cardEl = dom.window.document.createElement('div');
      expect(CardDemoVideo.syncCardDemoVideoButton(cardEl, cardId)).toBeNull();
      expect(cardEl.querySelector('.card-demo-video-btn')).toBeNull();
      expect(CardDemoVideo.openCardDemoVideo(cardId)).toBeNull();
    }
    dom.window.close();
  });
});

describe('hand renderer shows the play button on face-up cards', () => {
  test('own face-up card gets the button and pressing it does not trigger card click', () => {
    const cardId = CATALOG.CARD_DEMO_VIDEO_IDS[0];
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <div id="deck-black"><div class="deck-count"></div></div>
        <div id="deck-white"><div class="deck-count"></div></div>
        <div id="hand-black"></div>
        <div id="hand-white"></div>
        <div id="charge-black"></div>
        <div id="charge-white"></div>
        <div id="discard-count"></div>
        <div id="active-black"><div class="effect-slot-content"></div></div>
        <div id="active-white"><div class="effect-slot-content"></div></div>
      </body></html>`,
      { runScripts: 'outside-only' }
    );
    const w: any = dom.window;
    stubMediaPlayback(w);
    w.BLACK = 1;
    w.WHITE = -1;
    w.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    w.cardState = {
      turnIndex: 1,
      charge: { black: 0, white: 0 },
      chargeDeltaEvents: [],
      hands: { black: [cardId], white: [cardId] },
      decks: { black: [], white: [] },
      discard: [],
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      activeEffectsByPlayer: { black: [], white: [] },
      selectedCardId: null,
      selectedCardOwnerKey: null
    };
    w.CARD_DEFS = [{ id: cardId, name: 'Demo Card', desc: 'd', cost: 1 }];
    w.onCardClick = jest.fn();
    w.updateCardDetailPanel = jest.fn();
    w.StoneVisuals = { showChargeDelta: jest.fn() };
    w.OwnerHelpers = require('../utils/owner-helpers');
    w.MATCH_MODE = 'cpu';
    jest.resetModules();
    const g: any = global;
    for (const k of ['BLACK', 'WHITE', 'gameState', 'cardState', 'CARD_DEFS', 'onCardClick', 'updateCardDetailPanel', 'StoneVisuals', 'OwnerHelpers', 'MATCH_MODE']) g[k] = w[k];
    g.window = w;
    g.document = w.document;
    try {
      const renderer = require(path.resolve(__dirname, '../cards/card-renderer.js'));
      w.renderCardUI = renderer.renderCardUI;
      w.createCardFaceElement = renderer.createCardFaceElement;
      w.renderCardUI();

      const own = w.document.querySelector('#hand-black .card-item.visible');
      expect(own).not.toBeNull();
      const button = own.querySelector('.card-demo-video-btn');
      expect(button).not.toBeNull();
      button.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(w.onCardClick).not.toHaveBeenCalled();
      expect(w.document.getElementById('card-demo-video-overlay')).not.toBeNull();

      // opponent hand in CPU mode is hidden: no button on card backs
      const oppButtons = w.document.querySelectorAll('#hand-white .card-demo-video-btn');
      expect(oppButtons).toHaveLength(0);
    } finally {
      for (const k of ['BLACK', 'WHITE', 'gameState', 'cardState', 'onCardClick', 'updateCardDetailPanel', 'StoneVisuals', 'OwnerHelpers', 'MATCH_MODE']) delete g[k];
      dom.window.close();
    }
  });
});

describe('hand card swipe gesture leaves the demo video button alone', () => {
  test('pointerdown on the play button does not capture the pointer on the card', () => {
    const dom = installDom(`<!doctype html><html><body><div id="hand-black"><div class="card-item visible clickable" data-card-id="c1" data-owner-key="black" data-hand-index="0"><button class="card-demo-video-btn"><span class="card-demo-video-icon"></span></button><span class="card-name">C1</span></div></div></body></html>`);
    jest.resetModules();
    const { createHandCardSwipeGestureAdapter } = require('../cards/hand-card-swipe-gesture');
    const createHandCardSwipeGesture = jest.fn(() => ({}));
    const adapter = createHandCardSwipeGestureAdapter({
      getDocumentRef: () => dom.window.document,
      getWindowRef: () => dom.window,
      actionModule: { createHandCardSwipeGesture },
      isAutoModeActive: () => false,
      normalizeOwnerKey: (k: any) => k
    });
    expect(adapter.bind()).toBe(true);
    const card = dom.window.document.querySelector('.card-item') as any;
    card.setPointerCapture = jest.fn();
    const PointerCtor = (dom.window as any).PointerEvent || dom.window.MouseEvent;
    const icon = dom.window.document.querySelector('.card-demo-video-icon');
    icon.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(createHandCardSwipeGesture).not.toHaveBeenCalled();
    expect(card.setPointerCapture).not.toHaveBeenCalled();
    // the card body itself still starts a swipe gesture
    dom.window.document.querySelector('.card-name').dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(createHandCardSwipeGesture).toHaveBeenCalledTimes(1);
    dom.window.close();
  });
});
