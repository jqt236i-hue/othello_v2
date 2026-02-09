const { JSDOM } = require('jsdom');

describe('HEAVEN_BLESSING overlay flow', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <button id="use-card-btn">使用</button>
        <button id="pass-btn">パス</button>
        <button id="sell-card-btn" style="display:none;">売却</button>
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
    global.Core = { getLegalMoves: () => [] };
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.addLog = jest.fn();
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
    delete global.window;
    delete global.document;
  });

  test('shows overlay and confirms selected offer with select button', () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const overlay = document.getElementById('heaven-blessing-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('active')).toBe(true);

    expect(document.getElementById('use-card-btn').style.display).toBe('none');
    expect(document.getElementById('pass-btn').style.display).toBe('none');
    expect(document.getElementById('sell-card-btn').style.display).toBe('none');

    const offers = overlay.querySelectorAll('.heaven-offer-card');
    expect(offers.length).toBe(5);
    offers[1].click();
    expect(document.getElementById('heaven-blessing-detail-name').textContent).toBe('name_offer_2');

    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn.disabled).toBe(false);
    selectBtn.click();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action.heavenBlessingCardId).toBe('offer_2');
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
});
