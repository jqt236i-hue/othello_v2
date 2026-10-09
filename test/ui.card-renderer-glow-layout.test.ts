import { JSDOM } from 'jsdom';

function installDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="deck-black"><span class="deck-count"></span></div>
    <div id="deck-white"><span class="deck-count"></span></div>
    <div id="hand-black"></div>
    <div id="hand-white"></div>
    <div id="charge-black"></div>
    <div id="charge-white"></div>
    <div id="discard-count"></div>
    <div id="active-black"><span class="effect-slot-content"></span></div>
    <div id="active-white"><span class="effect-slot-content"></span></div>
    <div id="card-detail-panel"></div>
  </body></html>`);
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
  return dom;
}

function installState() {
  (global as any).BLACK = 1;
  (global as any).WHITE = -1;
  (global as any).EMPTY = 0;
  (global as any).CHARGE_MAX = 99;
  (global as any).CARD_DEFS = [
    { id: 'ghost_01', name: 'Ghost', desc: 'd', cost: 1 },
    { id: 'trap_01', name: 'Trap', desc: 'd', cost: 1 }
  ];
  // 開始配置（置ける場所がある盤面）。置けない盤面では「次に置く石」系カードは使えない（01-rulebook.md §9）。
  const openingBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
  openingBoard[3][3] = -1; openingBoard[3][4] = 1; openingBoard[4][3] = 1; openingBoard[4][4] = -1;
  (global as any).gameState = {
    board: openingBoard,
    currentPlayer: 1
  };
  (global as any).cardState = {
    hands: { black: ['ghost_01', 'trap_01'], white: [] },
    decks: { black: [], white: [] },
    deck: [],
    initialDeckSizeByPlayer: { black: 30, white: 30 },
    charge: { black: 99, white: 99 },
    discard: [],
    activeEffectsByPlayer: { black: [], white: [] },
    pendingEffectByPlayer: { black: null, white: null },
    selectedCardId: null,
    selectedCardOwnerKey: null,
    selectedCardHandIndex: null,
    usedCardThisTurnByPlayer: { black: false, white: false },
    hasUsedCardThisTurnByPlayer: { black: false, white: false }
  };
  (global as any).getCurrentMatchMode = () => 'local';
  (global as any).window.CARD_DEFS = (global as any).CARD_DEFS;
  (global as any).window.gameState = (global as any).gameState;
  (global as any).window.cardState = (global as any).cardState;
  (global as any).window.getCurrentMatchMode = (global as any).getCurrentMatchMode;
  (global as any).onCardClick = jest.fn();
  (global as any).updateCardDetailPanel = jest.fn();
}

describe('card renderer hand glow layout cache', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = installDom();
    installState();
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).CHARGE_MAX;
    delete (global as any).CARD_DEFS;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).getCurrentMatchMode;
    delete (global as any).onCardClick;
    delete (global as any).updateCardDetailPanel;
    delete (global as any).ResizeObserver;
  });

  test('identical hand input reuses glow layout until layout environment changes', () => {
    const renderer = require('../cards/card-renderer.js');
    const rectSpy = jest.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const index = Number(element.dataset.handIndex || 0);
      return {
        left: index * 10,
        top: index * 5,
        width: 80,
        height: 120,
        right: index * 10 + 80,
        bottom: index * 5 + 120,
        x: index * 10,
        y: index * 5,
        toJSON: () => ({})
      } as DOMRect;
    });

    renderer.renderCardUI();
    const afterFirst = rectSpy.mock.calls.length;
    renderer.renderCardUI();
    expect(rectSpy.mock.calls.length).toBe(afterFirst);

    const handTrack = document.querySelector('#hand-black .hand-track') as HTMLElement;
    handTrack.scrollLeft = 12;
    renderer.renderCardUI();
    const afterScroll = rectSpy.mock.calls.length;
    expect(afterScroll).toBeGreaterThan(afterFirst);

    dom.window.dispatchEvent(new dom.window.Event('resize'));
    renderer.renderCardUI();
    expect(rectSpy.mock.calls.length).toBeGreaterThan(afterScroll);
  });

  test('reads hand track scroll offsets once per render pass instead of at glow sync time', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();
    const tracks = Array.from(document.querySelectorAll('.hand-track')) as HTMLElement[];
    expect(tracks.length).toBeGreaterThan(0);
    let scrollLeftReads = 0;
    const originalDescriptor = Object.getOwnPropertyDescriptor(dom.window.Element.prototype, 'scrollLeft');
    Object.defineProperty(dom.window.Element.prototype, 'scrollLeft', {
      configurable: true,
      get() {
        scrollLeftReads += 1;
        return 0;
      },
      set() { /* jsdom has no layout */ }
    });
    try {
      renderer.renderCardUI();
      expect(scrollLeftReads).toBe(tracks.length);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(dom.window.Element.prototype, 'scrollLeft', originalDescriptor);
      } else {
        delete (dom.window.Element.prototype as any).scrollLeft;
      }
    }
  });

  test('identical hand input returns before reading cached layout dimensions', () => {
    let clientWidthReads = 0;
    const originalDescriptor = Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        clientWidthReads += 1;
        return 100;
      }
    });

    try {
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      const readsAfterFirstRender = clientWidthReads;

      renderer.renderCardUI();

      expect(clientWidthReads).toBe(readsAfterFirstRender);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', originalDescriptor);
      } else {
        delete (dom.window.HTMLElement.prototype as any).clientWidth;
      }
    }
  });

  test('invalidates cached glow geometry when the hand container resizes without a window resize', () => {
    const resizeCallbacks: Array<() => void> = [];
    class MockResizeObserver {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    }
    (global as any).ResizeObserver = MockResizeObserver;
    const renderer = require('../cards/card-renderer.js');
    const rectSpy = jest.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const index = Number(element.dataset.handIndex || 0);
      return {
        left: index * 10,
        top: index * 5,
        width: 80,
        height: 120,
        right: index * 10 + 80,
        bottom: index * 5 + 120,
        x: index * 10,
        y: index * 5,
        toJSON: () => ({})
      } as DOMRect;
    });

    renderer.renderCardUI();
    const afterFirst = rectSpy.mock.calls.length;
    expect(resizeCallbacks.length).toBeGreaterThan(0);

    resizeCallbacks[0]();
    renderer.renderCardUI();

    expect(rectSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  test('rebuilds glow layout when cached glow nodes are missing', () => {
    const renderer = require('../cards/card-renderer.js');
    const rectSpy = jest.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const index = Number(element.dataset.handIndex || 0);
      return {
        left: index * 10,
        top: index * 5,
        width: 80,
        height: 120,
        right: index * 10 + 80,
        bottom: index * 5 + 120,
        x: index * 10,
        y: index * 5,
        toJSON: () => ({})
      } as DOMRect;
    });

    renderer.renderCardUI();
    const glowLayer = document.querySelector('#hand-black .hand-availability-glow-layer') as HTMLElement;
    expect(glowLayer.children.length).toBeGreaterThan(0);
    const afterFirst = rectSpy.mock.calls.length;

    glowLayer.innerHTML = '';
    renderer.renderCardUI();

    expect(glowLayer.children.length).toBeGreaterThan(0);
    expect(rectSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  // 01-rulebook.md §8.4: 終局後は手札を「使える」と見せない。
  test('does not show usable glow or usable state after the game has ended', () => {
    const renderer = require('../cards/card-renderer.js');
    jest.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const index = Number(element.dataset.handIndex || 0);
      return {
        left: index * 10, top: 0, width: 80, height: 120, right: index * 10 + 80, bottom: 120, x: index * 10, y: 0,
        toJSON: () => ({})
      } as DOMRect;
    });

    renderer.renderCardUI();
    const glowCount = () => document.querySelectorAll('#hand-black .hand-availability-glow-layer > *').length;
    expect(glowCount()).toBeGreaterThan(0);
    expect(document.querySelectorAll('#hand-black .usable').length).toBeGreaterThan(0);

    (global as any).gameState.consecutivePasses = 2;
    renderer.renderCardUI();

    expect(glowCount()).toBe(0);
    expect(document.querySelectorAll('#hand-black .usable').length).toBe(0);
    // 終局後は自分の手札を全部暗くする。
    expect(document.querySelectorAll('#hand-black .card-item.visible').length).toBe(2);
    expect(document.querySelectorAll('#hand-black .card-item.visible.hand-card-dimmed').length).toBe(2);
  });

  // 01-rulebook.md §8.4: パスできる場面（自分の手番で置けるマスが無い）だけ、今使えない手札を暗くする。
  describe('dims cards that cannot be used when the player can only pass or use a card', () => {
    const dimmedIds = () => Array.from(document.querySelectorAll('#hand-black .card-item.visible.hand-card-dimmed'))
      .map((el) => (el as HTMLElement).dataset.cardId);
    const usableIds = () => Array.from(document.querySelectorAll('#hand-black .card-item.visible.usable'))
      .map((el) => (el as HTMLElement).dataset.cardId);
    // 黒石しか無い盤面。黒は挟める白石が無く、置けるマスが無い。
    function useBoardWithoutBlackPlacement() {
      const board = Array.from({ length: 8 }, () => Array(8).fill(0));
      board[3][3] = 1; board[3][4] = 1; board[4][3] = 1; board[4][4] = 1;
      (global as any).gameState.board = board;
    }

    test('does not dim any card while the player has a place to put a stone', () => {
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      expect(dimmedIds()).toEqual([]);
    });

    test('dims only the cards that cannot be used in a pass situation', () => {
      useBoardWithoutBlackPlacement();
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      // ゴーストの意志は次に置く石にしか効かないので、置けるマスが無いと使えない（01-rulebook.md §9）。
      expect(dimmedIds()).toContain('ghost_01');
      expect(usableIds()).not.toContain('ghost_01');
      // 使えるカードは暗くしない。
      for (const id of usableIds()) expect(dimmedIds()).not.toContain(id);
      expect(dimmedIds().length + usableIds().length).toBe(2);
    });

    test('dims cards the player cannot afford in a pass situation', () => {
      useBoardWithoutBlackPlacement();
      (global as any).cardState.charge.black = 0;
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      expect(dimmedIds().sort()).toEqual(['ghost_01', 'trap_01']);
    });

    test('does not dim the hand on the opponent turn', () => {
      useBoardWithoutBlackPlacement();
      (global as any).gameState.currentPlayer = -1;
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      expect(dimmedIds()).toEqual([]);
    });

    test('does not dim the hand while a card is choosing its target', () => {
      useBoardWithoutBlackPlacement();
      (global as any).cardState.pendingEffectByPlayer.black = { type: 'TRAP_WILL', stage: 'selectTarget' };
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      expect(dimmedIds()).toEqual([]);
    });

    test('removes the dimming once the player can place again', () => {
      useBoardWithoutBlackPlacement();
      const renderer = require('../cards/card-renderer.js');
      renderer.renderCardUI();
      expect(dimmedIds().length).toBeGreaterThan(0);
      const board = Array.from({ length: 8 }, () => Array(8).fill(0));
      board[3][3] = -1; board[3][4] = 1; board[4][3] = 1; board[4][4] = -1;
      (global as any).gameState.board = board;
      renderer.renderCardUI();
      expect(dimmedIds()).toEqual([]);
    });
  });
});
