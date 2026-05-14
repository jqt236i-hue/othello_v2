// @ts-nocheck
import * as path from 'path';
import { JSDOM } from 'jsdom';

function installGlobalRendererContext(window) {
  for (const name of ['CARD_DEFS', '__networkTransientChargeDeltaEvents']) {
    let value = window[name];
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        return value;
      },
      set(nextValue) {
        value = nextValue;
        global[name] = nextValue;
      }
    });
    global[name] = value;
  }
  global.window = window;
  global.document = window.document;
  global.BLACK = window.BLACK;
  global.WHITE = window.WHITE;
  global.gameState = window.gameState;
  global.cardState = window.cardState;
  global.CARD_DEFS = window.CARD_DEFS;
  global.onCardClick = window.onCardClick;
  global.updateCardDetailPanel = window.updateCardDetailPanel;
  global.StoneVisuals = window.StoneVisuals;
  global.OwnerHelpers = window.OwnerHelpers;
  global.MATCH_MODE = window.MATCH_MODE;
  if (window.NetworkMatchClient) {
    global.NetworkMatchClient = window.NetworkMatchClient;
  } else {
    delete global.NetworkMatchClient;
  }
}

function clearGlobalRendererContext() {
  delete global.window;
  delete global.document;
  delete global.BLACK;
  delete global.WHITE;
  delete global.gameState;
  delete global.cardState;
  delete global.CARD_DEFS;
  delete global.__networkTransientChargeDeltaEvents;
  delete global.onCardClick;
  delete global.updateCardDetailPanel;
  delete global.StoneVisuals;
  delete global.OwnerHelpers;
  delete global.MATCH_MODE;
  delete global.NetworkMatchClient;
}

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createRendererContext(options = {}) {
  const {
    seatKey = 'black',
    includeNetworkClient = true,
    hands = { black: [], white: [] },
    matchMode = 'network'
  } = options;

  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="deck-black"><div class="deck-count"></div></div>
      <div id="deck-white"><div class="deck-count"></div></div>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <div id="charge-black"></div>
      <div id="charge-white"></div>
      <div id="charge-delta-black-increase"></div>
      <div id="charge-delta-black-decrease"></div>
      <div id="charge-delta-white-increase"></div>
      <div id="charge-delta-white-decrease"></div>
      <div id="discard-count"></div>
      <div id="active-black"><div class="effect-slot-content"></div></div>
      <div id="active-white"><div class="effect-slot-content"></div></div>
    </body></html>`,
    { runScripts: 'outside-only' }
  );

  const { window } = dom;
  window.BLACK = 1;
  window.WHITE = -1;
  window.gameState = {
    currentPlayer: 1,
    board: createBoard()
  };
  window.cardState = {
    turnIndex: 1,
    charge: { black: 0, white: 0 },
    chargeDeltaEvents: [],
    hands: {
      black: Array.isArray(hands.black) ? hands.black.slice() : [],
      white: Array.isArray(hands.white) ? hands.white.slice() : []
    },
    decks: { black: [], white: [] },
    discard: [],
    pendingEffectByPlayer: { black: null, white: null },
    hasUsedCardThisTurnByPlayer: { black: false, white: false },
    activeEffectsByPlayer: { black: [], white: [] }
  };
  window.CARD_DEFS = [];
  window.onCardClick = jest.fn();
  window.updateCardDetailPanel = jest.fn();
  window.StoneVisuals = {
    showChargeDelta: jest.fn()
  };
  window.OwnerHelpers = require('../utils/owner-helpers');
  window.MATCH_MODE = matchMode;
  if (includeNetworkClient) {
    window.NetworkMatchClient = {
      getSeatKey: () => seatKey
    };
  }

  jest.resetModules();
  installGlobalRendererContext(window);
  const rendererModule = require(path.resolve(__dirname, '../cards/card-renderer.js'));
  window.drainVisibleChargeDeltaPopups = rendererModule.drainVisibleChargeDeltaPopups;
  window.renderCardUI = rendererModule.renderCardUI;

  return dom;
}

afterEach(() => {
  clearGlobalRendererContext();
});

describe('network charge seat layout', () => {
  test('shows local player charge in bottom slot for white seat', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.charge.black = 4;
    window.cardState.charge.white = 11;
    window.renderCardUI();

    expect(window.document.getElementById('charge-black').textContent).toBe('布石: 11 / 99');
    expect(window.document.getElementById('charge-white').textContent).toBe('布石: 4 / 99');

    dom.window.close();
  });

  test('renders charge max segment separately so the cap can be visually dimmed', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.charge.black = 4;
    window.cardState.charge.white = 11;
    window.renderCardUI();

    expect(window.document.querySelector('#charge-black .charge-current')?.textContent).toBe('11');
    expect(window.document.querySelector('#charge-black .charge-max')?.textContent).toBe('99');

    dom.window.close();
  });

  test('tags deck slots with seat-mapped owner keys in network mode', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.renderCardUI();

    expect(window.document.getElementById('deck-black').dataset.ownerKey).toBe('white');
    expect(window.document.getElementById('deck-white').dataset.ownerKey).toBe('black');

    dom.window.close();
  });

  test('shows deck count and ratio for the owner currently mapped to each seat slot', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.decks.black = ['b1', 'b2', 'b3'];
    window.cardState.decks.white = ['w1'];
    window.cardState.initialDeckSizeByPlayer = { black: 10, white: 20 };
    window.renderCardUI();

    const bottomDeckEl = window.document.getElementById('deck-black');
    const topDeckEl = window.document.getElementById('deck-white');

    expect(bottomDeckEl.dataset.ownerKey).toBe('white');
    expect(bottomDeckEl.querySelector('.deck-count')?.textContent).toBe('1/20');
    expect(bottomDeckEl.style.getPropertyValue('--deck-ratio')).toBe('0.05');
    expect(topDeckEl.dataset.ownerKey).toBe('black');
    expect(topDeckEl.querySelector('.deck-count')?.textContent).toBe('3/10');
    expect(topDeckEl.style.getPropertyValue('--deck-ratio')).toBe('0.3');

    dom.window.close();
  });

  test('shows the time stop active badge near the top HUD for the controlling viewer', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 0, white: 2 };
    window.gameState.currentPlayer = -1;
    window.renderCardUI();

    const topBadgeEl = window.document.querySelector('#charge-white .time-stop-status-badge');
    expect(topBadgeEl).not.toBeNull();
    expect(topBadgeEl.textContent).toBe('時間停止発動中');
    expect(window.document.querySelector('#charge-black .time-stop-status-badge')).toBeNull();

    dom.window.close();
  });

  test('shows the time stop victim overlay above the local hand in network mode', () => {
    const dom = createRendererContext({
      seatKey: 'white',
      hands: {
        black: ['__hidden_hand__:black:0'],
        white: ['own_card']
      }
    });
    const { window } = dom;

    window.CARD_DEFS = [{ id: 'own_card', name: 'Own Card', desc: 'd', cost: 1 }];
    window.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    window.gameState.currentPlayer = 1;
    window.renderCardUI();

    const bottomOverlayEl = window.document.querySelector('#hand-black .time-stop-hand-overlay');
    expect(bottomOverlayEl).not.toBeNull();
    expect(bottomOverlayEl.textContent).toBe('時間停止発動中');
    expect(window.document.querySelector('#hand-white .time-stop-hand-overlay')).toBeNull();

    dom.window.close();
  });

  test('does not infer charge delta popup from raw totals in network mode without queue events', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.charge.black = 3;
    window.cardState.charge.white = 5;
    window.cardState.turnIndex = 1;
    window.renderCardUI();

    window.cardState.charge.white = 7;
    window.cardState.turnIndex = 2;
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).not.toHaveBeenCalled();

    dom.window.close();
  });

  test('still infers charge delta popup from raw totals outside network mode', () => {
    const dom = createRendererContext({ includeNetworkClient: false, matchMode: 'cpu' });
    const { window } = dom;

    window.cardState.charge.black = 3;
    window.cardState.charge.white = 5;
    window.cardState.turnIndex = 1;
    window.renderCardUI();

    window.cardState.charge.black = 5;
    window.cardState.turnIndex = 2;
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 2);

    dom.window.close();
  });

  test('resets raw fallback baseline when turn index rewinds outside network mode', () => {
    const dom = createRendererContext({ includeNetworkClient: false, matchMode: 'cpu' });
    const { window } = dom;

    window.cardState.charge.black = 6;
    window.cardState.turnIndex = 5;
    window.renderCardUI();
    window.StoneVisuals.showChargeDelta.mockClear();

    window.cardState.charge.black = 1;
    window.cardState.turnIndex = 2;
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).not.toHaveBeenCalled();

    window.cardState.charge.black = 4;
    window.cardState.turnIndex = 3;
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 3);

    dom.window.close();
  });

  test('aggregates multiple charge delta events in one render for local slot', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 3 },
      { seq: 2, player: 'white', delta: 1 }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 4);

    dom.window.close();
  });

  test('shows mixed-sign HUD deltas together when they arrive in one render', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: -5, reason: 'card_use_cost' },
      { seq: 2, player: 'white', delta: 8, reason: 'treasure_box' }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(2);
    expect(window.StoneVisuals.showChargeDelta.mock.calls).toEqual([
      ['black', -5],
      ['black', 8]
    ]);

    dom.window.close();
  });

  test('also routes board-anchored charge gains through the HUD popup', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 3, popupKind: 'board', anchorRow: 2, anchorCol: 4, sourceType: 'placement_flip_gain' }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 3);
    expect(window.cardState.chargeDeltaEvents).toEqual([]);

    dom.window.close();
  });

  test('can drain HUD charge delta popups before the full card UI render pass', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: -5, reason: 'card_use_cost' },
      { seq: 2, player: 'white', delta: 8, popupKind: 'board', anchorRow: 2, anchorCol: 4, sourceType: 'placement_flip_gain' }
    ];

    window.drainVisibleChargeDeltaPopups({ allowRawFallback: false });

    expect(window.StoneVisuals.showChargeDelta.mock.calls).toEqual([
      ['black', -5],
      ['black', 8]
    ]);
    expect(window.cardState.chargeDeltaEvents).toEqual([]);

    window.StoneVisuals.showChargeDelta.mockClear();
    window.renderCardUI();
    expect(window.StoneVisuals.showChargeDelta).not.toHaveBeenCalled();

    dom.window.close();
  });

  test('maps transient network charge delta popup to bottom slot for local seat owner', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.__networkTransientChargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 2 }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 2);
    expect(window.__networkTransientChargeDeltaEvents).toEqual([]);

    dom.window.close();
  });

  test('prefers authoritative charge delta events over transient network queue and clears transient leftovers', () => {
    const dom = createRendererContext({ seatKey: 'white' });
    const { window } = dom;

    window.cardState.chargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 3 }
    ];
    window.__networkTransientChargeDeltaEvents = [
      { seq: 1, player: 'white', delta: 2 }
    ];
    window.renderCardUI();

    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledTimes(1);
    expect(window.StoneVisuals.showChargeDelta).toHaveBeenCalledWith('black', 3);
    expect(window.cardState.chargeDeltaEvents).toEqual([]);
    expect(window.__networkTransientChargeDeltaEvents).toEqual([]);

    dom.window.close();
  });

  test('infers white seat from projected hidden black hand when seat globals are unavailable', () => {
    const dom = createRendererContext({
      includeNetworkClient: false,
      hands: {
        black: ['__hidden_hand__:black:0'],
        white: ['own_card']
      }
    });
    const { window } = dom;

    window.cardState.charge.black = 4;
    window.cardState.charge.white = 11;
    window.CARD_DEFS = [{ id: 'own_card', name: 'Own Card', desc: 'd', cost: 1 }];
    window.renderCardUI();

    expect(window.document.getElementById('deck-black').dataset.ownerKey).toBe('white');
    expect(window.document.getElementById('charge-black').textContent).toBe('布石: 11 / 99');
    expect(window.document.getElementById('charge-white').textContent).toBe('布石: 4 / 99');
    expect(window.document.querySelector('#hand-black .card-item.visible')).not.toBeNull();
    expect(window.document.querySelector('#hand-white .card-item.hidden')).not.toBeNull();

    dom.window.close();
  });
});
