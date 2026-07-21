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
  (global as any).gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1
  };
  (global as any).cardState = {
    hands: { black: ['ghost_01', 'trap_01'], white: ['trap_01'] },
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

describe('card renderer hand signature', () => {
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
  });

  test('identical hand input keeps existing card elements while non-hand side effects still update', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();

    const firstBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(firstBlackCard).toBeTruthy();

    (global as any).cardState.discard.push('ghost_01');
    renderer.renderCardUI();

    const secondBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(secondBlackCard).toBe(firstBlackCard);
    expect(document.getElementById('discard-count')!.textContent).toBe('1');
    expect((global as any).updateCardDetailPanel).toHaveBeenCalledTimes(2);
  });

  test('changed selection state updates existing card classes without replacing reusable elements', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();
    const firstBlackCard = document.querySelector('#hand-black .hand-track .card-item');

    (global as any).cardState.selectedCardId = 'ghost_01';
    (global as any).cardState.selectedCardOwnerKey = 'black';
    (global as any).cardState.selectedCardHandIndex = 0;
    renderer.renderCardUI();

    const selectedBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(selectedBlackCard).toBe(firstBlackCard);
    expect(selectedBlackCard!.classList.contains('selected')).toBe(true);
  });

  test('identical full card UI input produces no DOM mutations', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();
    const observer = new dom.window.MutationObserver(() => undefined);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });

    renderer.renderCardUI();

    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
