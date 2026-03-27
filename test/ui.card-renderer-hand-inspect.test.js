const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createRendererContext(options = {}) {
  const {
    matchMode = 'cpu',
    seatKey = 'black',
    includeNetworkClient = (matchMode === 'network'),
    networkClientIsActive = false,
    currentPlayer = 1,
    hands = { black: [], white: [] }
  } = options;

  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="deck-black"><div class="deck-count"></div></div>
      <div id="deck-white"><div class="deck-count"></div></div>
      <div id="hand-black"></div>
      <div id="hand-white"></div>
      <div id="charge-black"></div>
      <div id="charge-white"></div>
      <div id="charge-delta-black"></div>
      <div id="charge-delta-white"></div>
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
    currentPlayer,
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
    hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
    activeEffectsByPlayer: { black: [], white: [] },
    selectedCardId: null,
    selectedCardOwnerKey: null
  };
  window.CARD_DEFS = [
    { id: 'own_card', name: 'Own Card', desc: 'd', cost: 1 },
    { id: 'opp_card', name: 'Opp Card', desc: 'd', cost: 1 }
  ];
  window.onCardClick = jest.fn();
  window.updateCardDetailPanel = jest.fn();
  window.StoneVisuals = {
    showChargeDelta: jest.fn()
  };
  window.OwnerHelpers = require('../utils/owner-helpers');
  window.MATCH_MODE = matchMode;
  if (matchMode === 'network' && includeNetworkClient) {
    window.NetworkMatchClient = {
      getSeatKey: () => seatKey,
      isActive: () => networkClientIsActive
    };
  }

  const rendererCode = fs.readFileSync(path.resolve(__dirname, '../cards/card-renderer.js'), 'utf8');
  window.eval(rendererCode);

  return dom;
}

describe('card renderer hand inspection', () => {
  test('cpu mode keeps black hand clickable during white turn for effect inspection', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: -1,
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(ownCardEl.classList.contains('usable')).toBe(false);

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black');

    dom.window.close();
  });

  test('stale visual playback lock does not remove hand clickability', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: [] }
    });
    const { window } = dom;

    window.VisualPlaybackActive = true;
    window.isCardAnimating = true;
    window.AnimationEngine = { isPlaying: false };

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black');

    dom.window.close();
  });

  test('cpu mode shows only locally revealed opponent hand copies face-up', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card', 'opp_card'] }
    });
    const { window } = dom;

    window.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [101, 102]
    };
    window.cardState._revealedHandCopyIdsByViewer = {
      black: [101],
      white: []
    };

    window.renderCardUI();

    expect(window.document.querySelectorAll('#hand-white .card-item.visible')).toHaveLength(1);
    expect(window.document.querySelectorAll('#hand-white .card-item.hidden')).toHaveLength(1);

    dom.window.close();
  });

  test('cpu mode shows all opponent hand cards face-up after reveal hand marks every copy', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card', 'own_card', 'opp_card'] }
    });
    const { window } = dom;

    window.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [201, 202, 203]
    };
    window.cardState._revealedHandCopyIdsByViewer = {
      black: [201, 202, 203],
      white: []
    };

    window.renderCardUI();

    expect(window.document.querySelectorAll('#hand-white .card-item.visible')).toHaveLength(3);
    expect(window.document.querySelectorAll('#hand-white .card-item.hidden')).toHaveLength(0);

    dom.window.close();
  });

  test('network mode keeps local hand clickable during opponent turn without making it usable', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'white',
      currentPlayer: 1,
      hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
    });
    const { window } = dom;

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    const oppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(ownCardEl.classList.contains('usable')).toBe(false);
    expect(oppCardEl).not.toBeNull();
    expect(oppCardEl.classList.contains('clickable')).toBe(false);

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white');

    dom.window.close();
  });

  test('network mode shows revealed opponent cards face-up while keeping hidden tokens concealed', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card', '__hidden_hand__:white:1'] }
    });
    const { window } = dom;

    window.renderCardUI();

    const revealedOppCardEl = window.document.querySelector('#hand-white .card-item.visible');
    const hiddenOppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
    expect(revealedOppCardEl).not.toBeNull();
    expect(revealedOppCardEl.classList.contains('clickable')).toBe(true);
    expect(hiddenOppCardEl).not.toBeNull();

    revealedOppCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white');

    dom.window.close();
  });

  test('debug HvH keeps both visible hands clickable while only current turn hand stays usable', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.DEBUG_UNLIMITED_USAGE = true;
    window.renderCardUI();

    const blackCardEl = window.document.querySelector('#hand-black .card-item.visible');
    const whiteCardEl = window.document.querySelector('#hand-white .card-item.visible');
    expect(blackCardEl).not.toBeNull();
    expect(whiteCardEl).not.toBeNull();
    expect(blackCardEl.classList.contains('clickable')).toBe(true);
    expect(blackCardEl.classList.contains('usable')).toBe(true);
    expect(whiteCardEl.classList.contains('clickable')).toBe(true);
    expect(whiteCardEl.classList.contains('usable')).toBe(false);

    whiteCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white');

    dom.window.close();
  });

  test('network mode infers white local hand from projected hidden black hand when seat client is unavailable', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      includeNetworkClient: false,
      currentPlayer: 1,
      hands: {
        black: ['__hidden_hand__:black:0'],
        white: ['own_card']
      }
    });
    const { window } = dom;

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    const oppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
    expect(window.document.getElementById('hand-black').dataset.ownerKey).toBe('white');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(oppCardEl).not.toBeNull();

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white');

    dom.window.close();
  });

  test('network mode hides leaked hidden token instead of rendering ? in the local hand', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      networkClientIsActive: true,
      currentPlayer: 1,
      hands: {
        black: ['__hidden_hand__:black:0'],
        white: ['opp_card']
      }
    });
    const { window } = dom;

    window.renderCardUI();

    expect(window.document.getElementById('hand-black').dataset.ownerKey).toBe('black');
    expect(window.document.querySelector('#hand-black .card-item.visible')).toBeNull();
    expect(window.document.querySelector('#hand-black .card-item.hidden')).not.toBeNull();
    expect(
      Array.from(window.document.querySelectorAll('#hand-black .card-name')).some((el) => el.textContent === '?')
    ).toBe(false);

    dom.window.close();
  });
});
