import * as path from 'path';
import { JSDOM } from 'jsdom';

function installGlobalRendererContext(window) {
  for (const name of ['CARD_DEFS', 'GameVisualEffectsMap']) {
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
  delete global.GameVisualEffectsMap;
  delete global.onCardClick;
  delete global.updateCardDetailPanel;
  delete global.StoneVisuals;
  delete global.OwnerHelpers;
  delete global.MATCH_MODE;
  delete global.NetworkMatchClient;
}

function createBoard(rows = 8, cols = 8) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createRendererContext(options = {}) {
  const {
    matchMode = 'cpu',
    seatKey = 'black',
    includeNetworkClient = (matchMode === 'network'),
    networkClientIsActive = false,
    currentPlayer = 1,
    hands = { black: [], white: [] },
    boardRows = 8,
    boardCols = 8
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
    currentPlayer,
    board: createBoard(boardRows, boardCols)
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

  jest.resetModules();
  installGlobalRendererContext(window);
  const rendererModule = require(path.resolve(__dirname, '../cards/card-renderer.js'));
  window.drainVisibleChargeDeltaPopups = rendererModule.drainVisibleChargeDeltaPopups;
  window.renderCardUI = rendererModule.renderCardUI;
  window.createCardFaceElement = rendererModule.createCardFaceElement;

  return dom;
}

afterEach(() => {
  clearGlobalRendererContext();
});

describe('card renderer hand inspection', () => {
  test('custom boards still update the charge HUD', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      boardRows: 7,
      boardCols: 7
    });
    const { window } = dom;

    window.cardState.charge.black = 3;
    window.cardState.charge.white = 1;
    window.renderCardUI();

    expect(window.document.getElementById('charge-black').textContent).toBe('布石: 3 / 99');
    expect(window.document.getElementById('charge-white').textContent).toBe('布石: 1 / 99');

    dom.window.close();
  });

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

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black', 0);

    dom.window.close();
  });

  test('board executor hand card is not visually usable without an own special stone', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['board_executor_01'], white: [] }
    });
    const { window } = dom;

    window.cardState.charge.black = 10;
    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(ownCardEl.classList.contains('affordable')).toBe(true);
    expect(ownCardEl.classList.contains('usable')).toBe(false);
    const glowLayerEl = window.document.querySelector('#hand-black .hand-availability-glow-layer');
    const handTrackEl = window.document.querySelector('#hand-black .hand-track');
    expect(glowLayerEl).not.toBeNull();
    expect(glowLayerEl?.nextElementSibling).toBe(handTrackEl);
    expect(glowLayerEl?.children).toHaveLength(0);
    expect(ownCardEl.querySelector('.hand-availability-glow')).toBeNull();

    dom.window.close();
  });

  test('cpu mode renders TIME_STOP_GOD in own hand as selectable and usable when its cost condition is met', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['time_stop_god_01'], white: [] }
    });
    const { window } = dom;

    window.CARD_DEFS = [
      {
        id: 'time_stop_god_01',
        name: '時間停石',
        desc: 'd',
        cost: 0,
        type: 'TIME_STOP_GOD',
        display_type_ja: '禁忌'
      }
    ];
    window.gameState.board[0][0] = window.BLACK;
    window.gameState.board[0][1] = window.BLACK;
    window.gameState.board[0][2] = window.BLACK;
    window.cardState.charge.black = 0;

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible[data-card-id="time_stop_god_01"]');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.textContent).toContain('時間停石');
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(ownCardEl.classList.contains('usable')).toBe(true);

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('time_stop_god_01', 'black', 0);

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

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'black', 0);

    dom.window.close();
  });

  test('visible hand cards keep cost at the card root while type stays only in card metadata', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: [] }
    });
    const { window } = dom;

    window.CARD_DEFS = [
      { id: 'own_card', name: 'Own Card', desc: 'd', cost: 11, display_type_ja: '採掘' }
    ];

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();

    const rootChildren = Array.from(ownCardEl.children);
    const costBadge = rootChildren.find((el) => el.classList.contains('card-cost-badge'));

    expect(costBadge).toBeTruthy();
    expect(costBadge.textContent).toBe('11cost');
    expect(ownCardEl.dataset.cardType).toBe('mining');
    expect(ownCardEl.querySelector('.card-badge-row')).toBeNull();
    expect(ownCardEl.querySelector('.card-type-badge')).toBeNull();

    dom.window.close();
  });

  test('living will hand cards keep the guard type in metadata without rendering a visible type badge', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['living_will_01'], white: [] }
    });
    const { window } = dom;

    window.CARD_DEFS = [
      {
        id: 'living_will_01',
        name: '生きる意志',
        desc: 'd',
        cost: 20,
        type: 'LIVING_WILL',
        display_type_ja: '守護'
      }
    ];

    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.dataset.cardType).toBe('guard');

    dom.window.close();
  });

  test('createCardFaceElement composites owner-specific special art for special-stone cards', () => {
    const dom = createRendererContext();
    const { window } = dom;
    window.GameVisualEffectsMap = require('../game/visual-effects-map');

    window.CARD_DEFS = [
      {
        id: 'dragon_card',
        name: '究極反転龍',
        desc: 'd',
        cost: 30,
        type: 'ULTIMATE_REVERSE_DRAGON',
        display_type_ja: '特殊'
      }
    ];

    const blackCardEl = window.createCardFaceElement('dragon_card', { ownerKey: 'black' });
    const whiteCardEl = window.createCardFaceElement('dragon_card', { ownerKey: 'white' });

    expect(blackCardEl.classList.contains('has-special-art')).toBe(true);
    expect(whiteCardEl.classList.contains('has-special-art')).toBe(true);
    expect(blackCardEl.querySelector('.card-special-art')).toBeTruthy();
    expect(whiteCardEl.querySelector('.card-special-art')).toBeTruthy();
    expect(blackCardEl.style.getPropertyValue('--card-special-art-image')).toContain('ultimate_reverse_dragon-black.png');
    expect(whiteCardEl.style.getPropertyValue('--card-special-art-image')).toContain('ultimate_reverse_dragon-white.png');
    expect(blackCardEl.classList.contains('has-card-background')).toBe(true);
    expect(blackCardEl.querySelector('.card-background-art')).toBeTruthy();
    expect(blackCardEl.style.getPropertyValue('--card-background-art-image')).toContain('assets/images/card/01_究極反転龍.png');

    dom.window.close();
  });

  test('createCardFaceElement applies catalog-order card background art to normal cards', () => {
    const dom = createRendererContext();
    const { window } = dom;

    window.CARD_DEFS = [
      {
        id: 'chest_01',
        name: '宝箱',
        desc: 'd',
        cost: 0,
        type: 'TREASURE_BOX',
        display_type_ja: '採掘'
      },
      {
        id: 'free_01',
        name: '自由の意志',
        desc: 'd',
        cost: 14,
        type: 'FREE_PLACEMENT',
        display_type_ja: '禁忌'
      }
    ];

    const cardEl = window.createCardFaceElement('free_01', { ownerKey: 'black' });

    expect(cardEl.classList.contains('has-card-background')).toBe(true);
    expect(cardEl.querySelector('.card-background-art')).toBeTruthy();
    expect(cardEl.style.getPropertyValue('--card-background-art-image')).toContain('assets/images/card/02_自由の意志.png');
    expect(cardEl.querySelector('.card-special-art')).toBeNull();

    dom.window.close();
  });

  test('createCardFaceElement keeps availability glow out of card content', () => {
    const dom = createRendererContext();
    const { window } = dom;

    window.CARD_DEFS = [
      {
        id: 'free_01',
        name: '自由の意志',
        desc: 'd',
        cost: 14,
        type: 'FREE_PLACEMENT',
        display_type_ja: '禁忌'
      }
    ];

    const cardEl = window.createCardFaceElement('free_01', { ownerKey: 'black' });
    const glowEl = cardEl.querySelector('.card-state-glow');
    const nameEl = cardEl.querySelector('.card-name');

    expect(glowEl).toBeNull();
    expect(nameEl).toBeTruthy();

    dom.window.close();
  });

  test('createCardFaceElement resolves meteor god to the 91 card background art', () => {
    const dom = createRendererContext();
    const { window } = dom;
    window.GameVisualEffectsMap = require('../game/visual-effects-map');

    const catalog = require('../cards/catalog.json');
    window.CARD_DEFS = Array.isArray(catalog) ? catalog : catalog.cards;

    const cardEl = window.createCardFaceElement('meteor_god_01', { ownerKey: 'black' });

    expect(cardEl.classList.contains('has-card-background')).toBe(true);
    expect(cardEl.querySelector('.card-background-art')).toBeTruthy();
    expect(cardEl.style.getPropertyValue('--card-background-art-image')).toContain('assets/images/card/91_因果抹消神.png');

    dom.window.close();
  });

  test('special cards render as sealed stone cards without cost or type badges', () => {
    const dom = createRendererContext();
    const { window } = dom;
    window.GameVisualEffectsMap = require('../game/visual-effects-map');

    window.CARD_DEFS = [
      {
        id: 'observer_will_01',
        name: '盤理の観測者',
        desc: 'd',
        cost: 0,
        type: 'OBSERVER_WILL',
        display_type_ja: '観測'
      }
    ];

    const cardEl = window.createCardFaceElement('observer_will_01', { ownerKey: 'black' });

    expect(cardEl.classList.contains('special-card-face')).toBe(true);
    expect(cardEl.classList.contains('has-special-art')).toBe(true);
    expect(cardEl.dataset.specialCardId).toBe('observer_will_01');
    expect(cardEl.dataset.cardVisualEffect).toBe('specialCardCharacter');
    expect(cardEl.querySelector('.card-special-art')).toBeTruthy();
    expect(cardEl.style.getPropertyValue('--card-special-art-image')).toContain('assets/images/special-cards/characters/observer_will.png');
    expect(cardEl.querySelector('.card-cost-badge')).toBeNull();
    expect(cardEl.querySelector('.card-badge-row')).toBeNull();
    expect(cardEl.querySelector('.special-card-sigil')).toBeTruthy();
    expect(cardEl.querySelector('.special-card-title').textContent).toBe('盤理の観測者');

    dom.window.close();
  });
  test('createCardFaceElement uses blockade image override for blockade will cards', () => {
    const dom = createRendererContext();
    const { window } = dom;

    window.CARD_DEFS = [
      {
        id: 'blockade_01',
        name: '封鎖の意志',
        desc: 'd',
        cost: 1,
        type: 'BLOCKADE_WILL',
        display_type_ja: '特殊'
      }
    ];

    const cardEl = window.createCardFaceElement('blockade_01', { ownerKey: 'black' });

    expect(cardEl.classList.contains('has-special-art')).toBe(true);
    expect(cardEl.querySelector('.card-special-art')).toBeTruthy();
    expect(cardEl.style.getPropertyValue('--card-special-art-image')).toContain('assets/images/other/X.png');
    expect(cardEl.dataset.cardVisualEffect).toBe('blockadeMark');

    dom.window.close();
  });

  test('fitCardNameElement snaps reduced names to integer pixels to avoid blurry text', () => {
    const dom = createRendererContext();
    const { window } = dom;
    const nameEl = window.document.createElement('div');

    window.document.body.appendChild(nameEl);
    window.requestAnimationFrame = (callback) => callback();
    window.getComputedStyle = jest.fn(() => ({ fontSize: '15.5px' }));

    Object.defineProperty(nameEl, 'clientWidth', {
      configurable: true,
      get: () => 96
    });
    Object.defineProperty(nameEl, 'offsetWidth', {
      configurable: true,
      get: () => 96
    });
    Object.defineProperty(nameEl, 'scrollWidth', {
      configurable: true,
      get: () => {
        const fontPx = parseFloat(nameEl.style.fontSize || '15.5');
        return Math.ceil(fontPx * 7.4);
      }
    });

    window.fitCardNameElement(nameEl, 0);

    expect(nameEl.style.fontSize).toBe('12px');
    expect(nameEl.style.fontSize).toMatch(/^\d+px$/);

    dom.window.close();
  });

  test('fitCardNameElement marks dense kanji names for readable fallback in dot font mode', () => {
    const dom = createRendererContext();
    const { window } = dom;
    const nameEl = window.document.createElement('div');

    nameEl.textContent = '入替の意志';
    window.document.body.setAttribute('data-font-skin-id', 'dot-gothic');
    window.document.body.appendChild(nameEl);
    window.requestAnimationFrame = (callback) => callback();
    window.getComputedStyle = jest.fn(() => ({
      fontSize: '15.5px',
      fontFamily: 'DotGothic16'
    }));

    Object.defineProperty(nameEl, 'clientWidth', {
      configurable: true,
      get: () => 120
    });
    Object.defineProperty(nameEl, 'offsetWidth', {
      configurable: true,
      get: () => 120
    });
    Object.defineProperty(nameEl, 'scrollWidth', {
      configurable: true,
      get: () => 100
    });

    window.fitCardNameElement(nameEl, 0);

    expect(nameEl.classList.contains('card-name-readable-fallback')).toBe(true);

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

  test('hand card cost badge uses copy-specific effective cost', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['silver_stone'], white: [] }
    });
    const { window } = dom;

    window.CARD_DEFS.push({ id: 'silver_stone', name: 'Silver', desc: 'd', cost: 3 });
    window.cardState._handCopyIdsByPlayer = {
      black: [301],
      white: []
    };
    window.cardState.cardCostOverridesByCopyId = {
      301: { cost: 0, sourceType: 'OBSERVER_WILL' }
    };
    window.cardState.cardCostModifiersByCopyId = {};

    window.renderCardUI();

    const costValue = window.document.querySelector('#hand-black .card-cost-badge .cost-value');
    const cardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(costValue.textContent).toBe('0');
    expect(cardEl.classList.contains('cost-tier-white')).toBe(true);

    dom.window.close();
  });

  test('observed opponent hand cost badge updates when observer cost modifier is applied after first render', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [201]
    };
    window.cardState._revealedHandCopyIdsByViewer = {
      black: [201],
      white: []
    };
    window.cardState.cardCostModifiersByCopyId = {};

    window.renderCardUI();
    const initialCostValue = window.document.querySelector('#hand-white .card-cost-badge .cost-value');
    const initialCost = Number(initialCostValue.textContent);
    expect(Number.isFinite(initialCost)).toBe(true);

    window.cardState.cardCostModifiersByCopyId = {
      201: [{ delta: 5, sourceType: 'OBSERVER_WILL' }]
    };
    window.renderCardUI();

    const costValue = window.document.querySelector('#hand-white .card-cost-badge .cost-value');
    expect(Number(costValue.textContent)).toBe(initialCost + 5);

    dom.window.close();
  });

  test('network observed opponent hand cost badge uses projected slot cost adjustment', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      networkClientIsActive: true,
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.CARD_DEFS = [
      { id: 'own_card', name: 'Own Card', desc: 'd', cost: 1 },
      { id: 'opp_card', name: 'Opp Card', desc: 'd', cost: 1 }
    ];
    window.cardState.handCostAdjustmentsByPlayer = {
      black: [],
      white: [{ delta: 5 }]
    };

    window.renderCardUI();

    const costValue = window.document.querySelector('#hand-white .card-cost-badge .cost-value');
    expect(costValue.textContent).toBe('6');

    dom.window.close();
  });

  test('network own hand cost badge uses projected observer will override', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      networkClientIsActive: true,
      currentPlayer: 1,
      hands: { black: ['hard_01'], white: [] }
    });
    const { window } = dom;

    window.CARD_DEFS = [
      { id: 'hard_01', name: 'Hard', desc: 'd', cost: 20 }
    ];
    window.cardState.handCostAdjustmentsByPlayer = {
      black: [{ overrideCost: 0 }],
      white: []
    };

    window.renderCardUI();

    const costValue = window.document.querySelector('#hand-black .card-cost-badge .cost-value');
    const cardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(costValue.textContent).toBe('0');
    expect(cardEl.classList.contains('cost-tier-white')).toBe(true);

    dom.window.close();
  });

  test('network own hand projected observer zero-cost card stays visually usable with real rule logic', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      networkClientIsActive: true,
      currentPlayer: 1,
      hands: { black: ['hard_01'], white: [] }
    });
    const { window } = dom;

    const cardLogic = require('../game/logic/cards.js');
    window.CardLogic = cardLogic;
    global.CardLogic = cardLogic;
    window.CARD_DEFS = [
      { id: 'hard_01', name: '弱い意志', desc: 'd', cost: 1, type: 'PROTECTED_NEXT_STONE' }
    ];
    window.cardState.charge.black = 0;
    window.cardState.handCostAdjustmentsByPlayer = {
      black: [{ overrideCost: 0 }],
      white: []
    };

    window.renderCardUI();

    const cardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(cardEl.classList.contains('usable')).toBe(true);

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

  test('cpu mode marks persistently revealed opponent hand cards as observed', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card', 'own_card'] }
    });
    const { window } = dom;

    window.cardState._handCopyIdsByPlayer = {
      black: [1],
      white: [201, 202]
    };
    window.cardState._revealedHandCopyIdsByViewer = {
      black: [201],
      white: []
    };

    window.renderCardUI();

    const whiteCards = window.document.querySelectorAll('#hand-white .card-item');
    expect(whiteCards[0].classList.contains('observed-hand-card')).toBe(true);
    expect(whiteCards[0].querySelector('.observed-hand-tag').textContent).toBe('観測済み');
    expect(whiteCards[1].classList.contains('observed-hand-card')).toBe(false);
    expect(whiteCards[1].querySelector('.observed-hand-tag')).toBeNull();

    dom.window.close();
  });

  test('cpu mode keeps opponent hand face-up while owned observer stone remains active', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card', 'own_card', 'opp_card'] }
    });
    const { window } = dom;

    window.cardState.markers = [{
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true }
    }];

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

    window.cardState.charge.white = 3;
    window.renderCardUI();

    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    const oppCardEl = window.document.querySelector('#hand-white .card-item.hidden');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('clickable')).toBe(true);
    expect(ownCardEl.classList.contains('usable')).toBe(false);
    expect(ownCardEl.classList.contains('affordable')).toBe(true);
    const ownGlowLayerEl = window.document.querySelector('#hand-black .hand-availability-glow-layer');
    const ownGlowEl = ownGlowLayerEl?.querySelector('.hand-availability-glow');
    expect(ownGlowLayerEl?.children).toHaveLength(1);
    expect(ownGlowEl?.getAttribute('data-card-id')).toBe('own_card');
    expect(ownGlowEl?.getAttribute('data-owner-key')).toBe('white');
    expect(ownCardEl.querySelector('.hand-availability-glow')).toBeNull();
    expect(oppCardEl).not.toBeNull();
    expect(oppCardEl.classList.contains('clickable')).toBe(false);

    ownCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white', 0);

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

    expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white', 0);

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
    const blackGlowLayerEl = window.document.querySelector('#hand-black .hand-availability-glow-layer');
    const blackGlowEl = blackGlowLayerEl?.querySelector('.hand-availability-glow');
    expect(blackGlowLayerEl?.children).toHaveLength(1);
    expect(blackGlowEl?.getAttribute('data-card-id')).toBe('own_card');
    expect(blackGlowEl?.getAttribute('aria-hidden')).toBe('true');
    expect(blackCardEl.querySelector('.hand-availability-glow')).toBeNull();
    expect(window.document.querySelector('#hand-white .hand-availability-glow-layer')?.children).toHaveLength(0);

    whiteCardEl.click();

    expect(window.onCardClick).toHaveBeenCalledWith('opp_card', 'white', 0);

    dom.window.close();
  });

  test('capture will pending keeps the used hand slot reserved before target selection completes', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card', 'opp_card'], white: [] }
    });
    const { window } = dom;

    window.cardState.pendingEffectByPlayer.black = {
      type: 'CAPTURE_WILL',
      stage: 'selectTarget',
      sourceHandIndex: 1,
      cardId: 'capture_01'
    };

    window.renderCardUI();

    const blackHandSlots = window.document.querySelectorAll('#hand-black .card-item');
    const reservedSlot = window.document.querySelector('#hand-black .card-item[data-hand-index="1"]');
    const shiftedCard = window.document.querySelector('#hand-black .card-item[data-hand-index="2"]');

    expect(blackHandSlots).toHaveLength(3);
    expect(reservedSlot).not.toBeNull();
    expect(reservedSlot.classList.contains('capture-reserved-slot')).toBe(true);
    expect(reservedSlot.style.opacity).toBe('0');
    expect(shiftedCard).not.toBeNull();
    expect(shiftedCard.dataset.cardId).toBe('opp_card');
    expect(shiftedCard.dataset.handIndex).toBe('2');
    expect(shiftedCard.dataset.actualHandIndex).toBe('1');

    dom.window.close();
  });

  test('capture animation state can reserve an appended target slot before reveal render catches up', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: [] }
    });
    const { window } = dom;

    window.__captureReservedHandSlotState = {
      playerKey: 'black',
      handIndex: 1,
      token: 'capture-slot-test'
    };

    window.renderCardUI();

    const blackHandSlots = window.document.querySelectorAll('#hand-black .card-item');
    const reservedSlot = window.document.querySelector('#hand-black .card-item[data-hand-index="1"]');

    expect(blackHandSlots).toHaveLength(2);
    expect(reservedSlot).not.toBeNull();
    expect(reservedSlot.classList.contains('capture-reserved-slot')).toBe(true);

    dom.window.close();
  });

  test('steady-state rerender reuses the hand track and unchanged visible cards', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card', 'opp_card'], white: [] }
    });
    const { window } = dom;

    window.renderCardUI();

    const handEl = window.document.getElementById('hand-black');
    const handTrackBefore = handEl.querySelector('.hand-track');
    const firstCardBefore = handEl.querySelector('.card-item[data-hand-index="0"]');
    const secondCardBefore = handEl.querySelector('.card-item[data-hand-index="1"]');

    window.cardState.selectedCardId = 'own_card';
    window.cardState.selectedCardOwnerKey = 'black';
    window.renderCardUI();

    expect(handEl.querySelector('.hand-track')).toBe(handTrackBefore);
    expect(handEl.querySelector('.card-item[data-hand-index="0"]')).toBe(firstCardBefore);
    expect(handEl.querySelector('.card-item[data-hand-index="1"]')).toBe(secondCardBefore);
    expect(firstCardBefore.classList.contains('selected')).toBe(true);

    dom.window.close();
  });

  test('adding a card keeps existing hand DOM and only appends the new slot', () => {
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: [] }
    });
    const { window } = dom;

    window.renderCardUI();

    const handEl = window.document.getElementById('hand-black');
    const handTrackBefore = handEl.querySelector('.hand-track');
    const firstCardBefore = handEl.querySelector('.card-item[data-hand-index="0"]');

    window.cardState.hands.black.push('opp_card');
    window.renderCardUI();

    expect(handEl.querySelector('.hand-track')).toBe(handTrackBefore);
    expect(handEl.querySelector('.card-item[data-hand-index="0"]')).toBe(firstCardBefore);
    expect(handEl.querySelectorAll('.card-item')).toHaveLength(2);
    expect(handEl.querySelector('.card-item[data-hand-index="1"]').dataset.cardId).toBe('opp_card');

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

    expect(window.onCardClick).toHaveBeenCalledWith('own_card', 'white', 0);

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

describe('card renderer FATE_WILL hand visibility', () => {
  test('network mode: controller sees victim hand face-up and usable during controlled turn', () => {
    // Black controls white's turn (FATE_WILL). Local player is black (the controller).
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'black',
      networkClientIsActive: true,
      currentPlayer: -1, // white's turn
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
    window.cardState.charge = { black: 5, white: 5 };

    window.renderCardUI();

    // Controller sees victim (white) hand face-up
    const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
    expect(victimCardEl).not.toBeNull();
    expect(victimCardEl.classList.contains('clickable')).toBe(true);
    expect(victimCardEl.classList.contains('usable')).toBe(true);

    dom.window.close();
  });

  test('network mode: victim sees own hand face-up but cannot use it (locked out)', () => {
    // Black controls white's turn. Local player is white (the victim).
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'white',
      networkClientIsActive: true,
      currentPlayer: -1, // white's turn
      hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
    });
    const { window } = dom;

    window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
    window.cardState.charge = { black: 5, white: 5 };

    window.renderCardUI();

    // Victim's own hand is still face-up (they can see their cards)
    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    // But it is NOT usable (victim is locked out)
    expect(ownCardEl.classList.contains('usable')).toBe(false);

    dom.window.close();
  });

  test('network mode: victim sees time stop active overlay above the local hand', () => {
    const dom = createRendererContext({
      matchMode: 'network',
      seatKey: 'white',
      networkClientIsActive: true,
      currentPlayer: 1,
      hands: { black: ['__hidden_hand__:black:0'], white: ['own_card'] }
    });
    const { window } = dom;

    window.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    window.renderCardUI();

    const ownHandOverlayEl = window.document.querySelector('#hand-black .time-stop-hand-overlay');
    expect(ownHandOverlayEl).not.toBeNull();
    expect(ownHandOverlayEl.textContent).toBe('時間停止発動中');
    expect(window.document.querySelector('#hand-white .time-stop-hand-overlay')).toBeNull();

    dom.window.close();
  });

  test('cpu mode: controller (black) sees victim (white) hand face-up and usable during controlled turn', () => {
    // Black controls white's turn in local/cpu mode.
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: -1, // white's turn
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
    window.cardState.charge = { black: 5, white: 5 };

    window.renderCardUI();

    // White's hand (topOwnerKey) should now be face-up and usable for controller (black)
    const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
    expect(victimCardEl).not.toBeNull();
    expect(victimCardEl.classList.contains('clickable')).toBe(true);
    expect(victimCardEl.classList.contains('usable')).toBe(true);

    dom.window.close();
  });

  test('cpu mode: victim (black) hand is NOT usable when white controls black turn', () => {
    // White controls black's turn in local/cpu mode. Black (always input in cpu mode) is the victim.
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1, // black's turn
      hands: { black: ['own_card'], white: [] }
    });
    const { window } = dom;

    window.cardState.fateWillControllerByTurnOwner = { black: 'white', white: null };
    window.cardState.charge = { black: 5, white: 5 };

    window.renderCardUI();

    // Black's hand is still face-up (in cpu mode bottomOwnerKey=black, revealByDefault=true)
    // but must NOT be usable since black is the victim
    const ownCardEl = window.document.querySelector('#hand-black .card-item.visible');
    expect(ownCardEl).not.toBeNull();
    expect(ownCardEl.classList.contains('usable')).toBe(false);

    dom.window.close();
  });

  test('HvH mode: controller sees victim hand face-up and usable; victim hand locked out', () => {
    // Black controls white's turn in HvH mode.
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: -1, // white's turn
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.DEBUG_UNLIMITED_USAGE = true;
    window.cardState.fateWillControllerByTurnOwner = { black: null, white: 'black' };
    window.cardState.charge = { black: 5, white: 5 };

    window.renderCardUI();

    // inputPlayerKey in HvH during FATE_WILL should be the controller (black)
    // White's hand (victim) is visible and usable (controlled by black)
    const victimCardEl = window.document.querySelector('#hand-white .card-item.visible');
    expect(victimCardEl).not.toBeNull();
    expect(victimCardEl.classList.contains('usable')).toBe(true);

    dom.window.close();
  });

  test('normal turns: FATE_WILL absent does not affect existing render behavior', () => {
    // No FATE_WILL — black's turn, cpu mode, basic hand render unchanged.
    const dom = createRendererContext({
      matchMode: 'cpu',
      currentPlayer: 1,
      hands: { black: ['own_card'], white: ['opp_card'] }
    });
    const { window } = dom;

    // fateWillControllerByTurnOwner absent — should not crash and behave as before
    window.renderCardUI();

    const blackCardEl = window.document.querySelector('#hand-black .card-item.visible');
    const whiteCardEl = window.document.querySelector('#hand-white .card-item.hidden');
    expect(blackCardEl).not.toBeNull();
    expect(blackCardEl.classList.contains('clickable')).toBe(true);
    expect(whiteCardEl).not.toBeNull();

    dom.window.close();
  });
});
