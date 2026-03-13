const { JSDOM } = require('jsdom');

describe('手札破壊ボタン', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-actions"></div>
        <button id="destroy-card-btn">破壊</button>
        <button id="use-card-btn">使用</button>
        <button id="toggle-card-detail-btn">詳細</button>
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

    global.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    global.cardState = {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      turnIndex: 0,
      charge: { black: 10, white: 10 },
      hands: { black: ['trash_card', 'use_card_1'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: { black: null, white: null },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    };

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: id, desc: id, cost: id === 'use_card_1' ? 4 : 0 })
    };

    global.Core = {
      getLegalMoves: () => []
    };

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
      runTurnWithAdapter: jest.fn((_cs, _gs, _player, action) => {
        if (action.type === 'destroy_hand_card') {
          const hand = (global.cardState.hands.black || []).filter((id) => id !== action.destroyCardId);
          const nextCardState = {
            ...global.cardState,
            hands: { black: hand, white: [] },
            hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
            discard: [...(global.cardState.discard || []), action.destroyCardId],
            selectedCardId: null,
            selectedCardOwnerKey: null
          };
          global.cardState = nextCardState;
          return { ok: true, nextCardState, nextGameState: global.gameState, playbackEvents: [] };
        }
        if (action.type === 'use_card') {
          const hand = (global.cardState.hands.black || []).filter((id) => id !== action.useCardId);
          const nextCardState = {
            ...global.cardState,
            hands: { black: hand, white: [] },
            hasUsedCardThisTurnByPlayer: { black: true, white: false },
            discard: [...(global.cardState.discard || []), action.useCardId],
            selectedCardId: null,
            selectedCardOwnerKey: null
          };
          global.cardState = nextCardState;
          return { ok: true, nextCardState, nextGameState: global.gameState, playbackEvents: [] };
        }
        return { ok: false, rejectedReason: 'UNSUPPORTED' };
      })
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  test('破壊後でも同ターンにカード使用できる', () => {
    require('../cards/card-interaction.js');

    window.onCardClick('trash_card', 'black');
    window.destroySelectedHandCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const destroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(destroyAction.type).toBe('destroy_hand_card');
    expect(destroyAction.destroyCardId).toBe('trash_card');
    expect(global.cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
    expect(global.cardState.hands.black).toEqual(['use_card_1']);

    window.onCardClick('use_card_1', 'black');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    const useAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[1][3];
    expect(useAction.type).toBe('use_card');
    expect(useAction.useCardId).toBe('use_card_1');
  });

  test('同一ターンに手札破壊を連続実行できる', () => {
    require('../cards/card-interaction.js');
    global.cardState.hands.black = ['trash_card', 'trash_card_2', 'use_card_1'];

    window.onCardClick('trash_card', 'black');
    window.destroySelectedHandCard();

    window.onCardClick('trash_card_2', 'black');
    window.destroySelectedHandCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(2);
    const firstDestroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    const secondDestroyAction = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[1][3];
    expect(firstDestroyAction.type).toBe('destroy_hand_card');
    expect(secondDestroyAction.type).toBe('destroy_hand_card');
    expect(global.cardState.hands.black).toEqual(['use_card_1']);
    expect(global.cardState.discard).toEqual(expect.arrayContaining(['trash_card', 'trash_card_2']));
  });
});
