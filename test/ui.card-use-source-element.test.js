const { JSDOM } = require('jsdom');

describe('card use source element selection', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="hand-white" class="hand-container">
          <div class="card-item hidden" data-card-id="dup_card">CARD</div>
        </div>
        <div id="hand-black" class="hand-container">
          <div class="card-item visible" data-card-id="dup_card">
            <span class="card-name">Duplicate Card</span>
          </div>
        </div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = { currentPlayer: 1 };
    global.cardState = {
      selectedCardId: 'dup_card',
      turnIndex: 1,
      charge: { black: 10, white: 10 },
      hands: { black: ['dup_card'], white: ['dup_card'] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: 'Duplicate Card', desc: 'd', cost: 1 })
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
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };
    global.playCardUseHandAnimation = jest.fn(() => Promise.resolve());
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.addLog = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.isProcessing = false;
    global.isCardAnimating = false;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('prefers owner hand element when same card id exists in both hands', () => {
    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    const payload = global.playCardUseHandAnimation.mock.calls[0][0];
    expect(payload.owner).toBe('black');
    expect(payload.sourceCardEl).toBeTruthy();
    expect(payload.sourceCardEl.closest('#hand-black')).not.toBeNull();
    expect(payload.sourceCardEl.closest('#hand-white')).toBeNull();
  });
});
