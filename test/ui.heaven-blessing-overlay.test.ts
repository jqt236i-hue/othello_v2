import { JSDOM } from 'jsdom';

async function flushOverlaySelection() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('HEAVEN_BLESSING overlay flow', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <button id="use-card-btn">使用</button>
        <button id="pass-btn">パス</button>
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: 1 };
    global.cardState = {
      selectedCardId: null,
      turnIndex: 0,
      charge: { black: 10, white: 10 },
      hands: { black: ['dummy_01'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: {
        black: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['offer_1', 'offer_2', 'offer_3', 'offer_4', 'offer_5'] },
        white: null
      },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: []
    };
    global.getCardCostTier = () => 'gray';
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: `name_${id}`, desc: `desc_${id}`, cost: 2 })
    };
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.Core = { getLegalMoves: () => [] };
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.addLog = jest.fn();
    global.processPassTurn = jest.fn();
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: global.cardState,
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };
  });

  afterEach(() => {
    delete global.SoundEngine;
    delete global.window;
    delete global.document;
    delete global.processPassTurn;
  });

  test('shows overlay and confirms selected offer with select button', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('active')).toBe(true);

    expect(document.getElementById('use-card-btn').style.display).toBe('none');
    expect(document.getElementById('pass-btn').style.display).toBe('none');
    const offers = overlay.querySelectorAll('.heaven-offer-card');
    expect(offers.length).toBe(5);
    offers[1].click();
    expect(document.getElementById('heaven-blessing-detail-name').textContent).toBe('name_offer_2');
    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('hand_card_select');

    global.SoundEngine.init.mockClear();
    global.SoundEngine.playEffectByKey.mockClear();

    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn.disabled).toBe(false);
    selectBtn.click();

    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('treasure_gain');
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.heavenBlessingCardId).toBe('offer_2');
  });

  test('renders offer cards with the normal card face renderer', () => {
    const overlayView = require('../cards/card-interaction-overlay-view.ts');
    const textTermHighlighterModule = require('../ui/text-term-highlighter.ts');
    let overlayRefs = null;
    const createCardFaceElement = jest.fn((cardId, options) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card-item visible has-special-art';
      cardEl.dataset.cardId = cardId;
      cardEl.dataset.ownerKey = options.ownerKey;
      const artEl = document.createElement('div');
      artEl.className = 'card-special-art';
      cardEl.appendChild(artEl);
      const nameEl = document.createElement('span');
      nameEl.className = 'card-name';
      nameEl.textContent = '金の意志';
      cardEl.appendChild(nameEl);
      const costEl = document.createElement('div');
      costEl.className = 'card-cost-badge';
      cardEl.appendChild(costEl);
      return cardEl;
    });
    overlayView.renderHeavenOverlay('black', {
      getDocumentRef: () => document,
      getWindowRef: () => window,
      getOverlayRefs: () => overlayRefs,
      setOverlayRefs: (refs) => { overlayRefs = refs; },
      getCardStateValue: () => ({
        hands: { black: ['dummy_01'], white: [] },
        pendingEffectByPlayer: {
          black: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['gold_stone'] },
          white: null
        }
      }),
      getHandLimit: () => 5,
      getHeavenSelection: () => null,
      setHeavenSelection: jest.fn(),
      resolveCardDef: () => ({ id: 'gold_stone', name: '金の意志', cost: 6 }),
      getCardCostTier: () => 'red',
      getCardDisplayTypeKey: () => 'mining',
      getCardDisplayLabel: () => '金の意志',
      fitCardNameForDisplay: jest.fn(),
      appendCardDisplayBadges: jest.fn(),
      createCardFaceElement,
      getOverlayCardDescriptionText: () => '反転する特殊石。破壊は受ける。',
      textTermHighlighterModule,
      playUiEffectSound: jest.fn(),
      executeHeavenSelection: jest.fn(),
      executeCondemnSelection: jest.fn(),
      executeObserverWillSelection: jest.fn()
    });

    const offer = document.querySelector('.heaven-offer-card');

    expect(createCardFaceElement).toHaveBeenCalledWith('gold_stone', { ownerKey: 'black' });
    expect(offer).toBeTruthy();
    expect(offer.classList.contains('card-item')).toBe(true);
    expect(offer.classList.contains('visible')).toBe(true);
    expect(offer.classList.contains('has-special-art')).toBe(true);
    expect(offer.querySelector('.card-special-art')).toBeTruthy();
    expect(offer.querySelector('.card-cost-badge')).toBeTruthy();
    const desc = document.getElementById('heaven-blessing-detail-desc') as HTMLElement;
    expect(desc.textContent).toContain('反転');
    expect(desc.textContent).toContain('特殊石');
    expect(desc.textContent).toContain('破壊');
    expect(Array.from(desc.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['反転', '特殊石', '破壊']);
  });

  test('CONDEMN_WILL overlay click does not switch to treasure_gain sound', () => {
    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'offer_1' },
        { handIndex: 1, cardId: 'offer_2' }
      ]
    };
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    const offers = overlay.querySelectorAll('.heaven-offer-card');
    offers[1].click();

    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('treasure_gain');
  });

  test('OBSERVER_WILL overlay shows cost warning only during observer selection', () => {
    global.cardState.hands.white = ['offer_1', 'offer_2'];
    global.cardState.pendingEffectByPlayer.black = {
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'offer_1' },
        { handIndex: 1, cardId: 'offer_2' }
      ]
    };
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    const warning = document.getElementById('heaven-blessing-warning');
    expect(warning).toBeTruthy();
    expect(warning.hidden).toBe(false);
    expect(warning.textContent).toContain('選択したカードは0コストで獲得');
    expect(warning.textContent).toContain('観測済みの相手手札はコスト+5');

    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [{ handIndex: 0, cardId: 'offer_1' }]
    };

    window.updateCardDetailPanel();

    expect(warning.hidden).toBe(true);
    expect(warning.textContent).toBe('');
  });

  test('hand overlay select button is disabled while interaction is busy', () => {
    const overlayView = require('../cards/card-interaction-overlay-view.ts');
    let overlayRefs = null;
    let selectedKey = null;
    let canInteract = false;
    const executeObserverWillSelection = jest.fn();

    const deps = {
      getDocumentRef: () => document,
      getWindowRef: () => window,
      getOverlayRefs: () => overlayRefs,
      setOverlayRefs: (refs) => { overlayRefs = refs; },
      getCardStateValue: () => ({
        hands: { black: ['dummy_01'], white: ['offer_1'] },
        pendingEffectByPlayer: {
          black: {
            type: 'OBSERVER_WILL',
            stage: 'selectTarget',
            offers: [{ handIndex: 0, cardId: 'offer_1' }]
          },
          white: null
        }
      }),
      getHandLimit: () => 5,
      getHeavenSelection: () => selectedKey,
      setHeavenSelection: (_playerKey, offerKey) => { selectedKey = offerKey; },
      resolveCardDef: (id) => ({ id, name: `name_${id}`, desc: `desc_${id}`, cost: 2 }),
      getCardCostTier: () => 'gray',
      getCardDisplayTypeKey: () => 'test',
      getCardDisplayLabel: (cardId) => `name_${cardId}`,
      fitCardNameForDisplay: jest.fn(),
      appendCardDisplayBadges: jest.fn(),
      getOverlayCardDescriptionText: (_cardDef, cardId) => `desc_${cardId}`,
      canInteractWithCardUi: () => canInteract,
      playUiEffectSound: jest.fn(),
      executeHeavenSelection: jest.fn(),
      executeCondemnSelection: jest.fn(),
      executeObserverWillSelection
    };

    overlayView.renderHeavenOverlay('black', deps);
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    const reason = document.getElementById('heaven-blessing-reason');

    expect(selectBtn.disabled).toBe(true);
    expect(reason.textContent).toBe('演出中...');
    selectBtn.click();
    expect(executeObserverWillSelection).not.toHaveBeenCalled();

    canInteract = true;
    overlayView.renderHeavenOverlay('black', deps);

    expect(selectBtn.disabled).toBe(false);
    expect(reason.textContent).toBe('');
    selectBtn.click();
    expect(executeObserverWillSelection).toHaveBeenCalledWith('black', 0, 'offer_1');
  });

  test('hand full disables selection with reason text', () => {
    global.cardState.hands.black = ['a', 'b', 'c', 'd', 'e'];
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();

    expect(document.getElementById('heaven-blessing-select-btn').disabled).toBe(true);
    expect(document.getElementById('heaven-blessing-reason').textContent).toContain('手札上限');
  });

  test('CONDEMN_WILL sends target hand index (not card id)', () => {
    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'offer_1' },
        { handIndex: 3, cardId: 'offer_1' },
        { handIndex: 1, cardId: 'offer_2' }
      ]
    };
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    const offers = overlay.querySelectorAll('.heaven-offer-card');
    expect(offers.length).toBe(3);

    offers[1].click();
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn.textContent).toBe('破壊');
    selectBtn.click();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.condemnTargetIndex).toBe(3);
    expect(action.heavenBlessingCardId).toBeUndefined();
  });

  test('CONDEMN_WILL enemy hand click keeps hand_card_select until destroy button press', () => {
    global.window.DEBUG_HUMAN_VS_HUMAN = true;
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.hands.white = ['offer_1', 'offer_2'];
    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'offer_1' },
        { handIndex: 1, cardId: 'offer_2' }
      ]
    };
    require('../cards/card-interaction.js');

    window.onCardClick('offer_2', 'white');

    expect(global.SoundEngine.init).toHaveBeenCalledTimes(1);
    expect(global.SoundEngine.playEffectByKey).toHaveBeenCalledWith('hand_card_select');
    expect(global.cardState.selectedCardId).toBe('offer_2');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');
  });

  test('HEAVEN_BLESSING selection settles and re-enables interaction after local resolution', async () => {
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((cardState, gameState, playerKey, action) => ({
      ok: true,
      nextCardState: {
        ...cardState,
        selectedCardId: null,
        selectedCardOwnerKey: null,
        hands: {
          ...cardState.hands,
          [playerKey]: [...cardState.hands[playerKey], action.heavenBlessingCardId]
        },
        pendingEffectByPlayer: {
          ...cardState.pendingEffectByPlayer,
          [playerKey]: null
        }
      },
      nextGameState: gameState,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    const selectionFlow = require('../game/card-effects/selection-flow.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    const offers = overlay.querySelectorAll('.heaven-offer-card');
    offers[0].click();
    document.getElementById('heaven-blessing-select-btn').click();

    await flushOverlaySelection();

    expect(selectionFlow.isSelectionSettlementLocked()).toBe(false);
    expect(window.isProcessing).toBe(false);
    expect(window.isCardAnimating).toBe(false);

    window.onCardClick('dummy_01', 'black');
    expect(global.cardState.selectedCardId).toBe('dummy_01');
  });

  test('CONDEMN_WILL selection settles and re-enables interaction after local resolution', async () => {
    global.cardState.hands.white = ['offer_1', 'offer_2'];
    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [
        { handIndex: 0, cardId: 'offer_1' },
        { handIndex: 1, cardId: 'offer_2' }
      ]
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((cardState, gameState, playerKey, action) => {
      const opponentKey = playerKey === 'black' ? 'white' : 'black';
      const nextOpponentHand = [...cardState.hands[opponentKey]];
      nextOpponentHand.splice(action.condemnTargetIndex, 1);
      return {
        ok: true,
        nextCardState: {
          ...cardState,
          selectedCardId: null,
          selectedCardOwnerKey: null,
          hands: {
            ...cardState.hands,
            [opponentKey]: nextOpponentHand
          },
          pendingEffectByPlayer: {
            ...cardState.pendingEffectByPlayer,
            [playerKey]: null
          }
        },
        nextGameState: gameState,
        playbackEvents: []
      };
    });

    require('../cards/card-interaction.js');
    const selectionFlow = require('../game/card-effects/selection-flow.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    const offers = overlay.querySelectorAll('.heaven-offer-card');
    offers[1].click();
    document.getElementById('heaven-blessing-select-btn').click();

    await flushOverlaySelection();

    expect(selectionFlow.isSelectionSettlementLocked()).toBe(false);
    expect(window.isProcessing).toBe(false);
    expect(window.isCardAnimating).toBe(false);

    window.onCardClick('dummy_01', 'black');
    expect(global.cardState.selectedCardId).toBe('dummy_01');
  });
});
