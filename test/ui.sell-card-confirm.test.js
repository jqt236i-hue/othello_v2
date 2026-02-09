const { JSDOM } = require('jsdom');

describe('SELL_CARD_WILL confirm flow', () => {
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
      hands: { black: ['sell_01', 'gold_stone'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: { type: 'SELL_CARD_WILL', stage: 'selectTarget' }, white: null },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: []
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: id, desc: id, cost: id === 'gold_stone' ? 6 : 1 })
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

  test('card click only selects sell target, confirm button executes sell', () => {
    require('../cards/card-interaction.js');

    window.onCardClick('gold_stone');
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(0);

    window.updateCardDetailPanel();
    expect(document.getElementById('use-card-btn').style.display).toBe('none');
    expect(document.getElementById('pass-btn').style.display).toBe('none');
    expect(document.getElementById('sell-card-btn').style.display).toBe('inline-block');
    expect(document.getElementById('sell-card-btn').disabled).toBe(false);

    window.confirmSellCardSelection();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const callArgs = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0];
    const action = callArgs[3];
    expect(action.sellCardId).toBe('gold_stone');
  });
});
