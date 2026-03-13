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

  test('network mode blocks selecting and using opponent hand card', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'white';
    global.gameState.currentPlayer = global.WHITE;
    global.cardState.hands = {
      black: ['opp_card'],
      white: ['own_card']
    };
    global.cardState.selectedCardId = null;

    window.onCardClick('opp_card');
    expect(global.cardState.selectedCardId).toBeNull();

    global.cardState.selectedCardId = 'opp_card';
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.cardState.selectedCardId).toBeNull();
  });

  test('network mode ignores click with opponent ownerKey even when card id is duplicated', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'white';
    global.gameState.currentPlayer = global.WHITE;
    global.cardState.hands = {
      black: ['dup_card'],
      white: ['dup_card']
    };
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('dup_card', 'black');
    expect(global.cardState.selectedCardId).toBeNull();

    window.onCardClick('dup_card', 'white');
    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');
  });

  test('network mode resolves local seat from BOARD_VIEWER_KEY when LOCAL_PLAYER_KEY is missing', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    delete window.LOCAL_PLAYER_KEY;
    window.BOARD_VIEWER_KEY = 'white';
    window.NetworkMatchClient = {
      getSeatKey: () => 'white'
    };
    global.gameState.currentPlayer = global.WHITE;
    global.cardState.hands = {
      black: ['opp_card'],
      white: ['own_card']
    };
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('own_card', 'white');
    expect(global.cardState.selectedCardId).toBe('own_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');

    window.useSelectedCard();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const call = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0];
    expect(call[2]).toBe('white');
    expect(call[3].type).toBe('use_card');
    expect(call[3].useCardOwnerKey).toBe('white');
  });

  test('network mode prioritizes NetworkMatchClient seat over stale LOCAL_PLAYER_KEY', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    window.BOARD_VIEWER_KEY = 'black';
    window.NetworkMatchClient = {
      getSeatKey: () => 'white'
    };
    global.gameState.currentPlayer = global.WHITE;
    global.cardState.hands = {
      black: ['opp_card'],
      white: ['own_card']
    };
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('own_card', 'white');
    expect(global.cardState.selectedCardId).toBe('own_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');

    window.useSelectedCard();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const call = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0];
    expect(call[2]).toBe('white');
  });

  test('network mode allows selecting own hand card while waiting for opponent turn', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'white';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.hands = {
      black: ['opp_card'],
      white: ['own_card']
    };
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('own_card', 'white');

    expect(global.cardState.selectedCardId).toBe('own_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');
  });

  test('network mode keeps useSelectedCard blocked while waiting for opponent turn', () => {
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'white';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.hands = {
      black: ['opp_card'],
      white: ['own_card']
    };
    global.cardState.selectedCardId = 'own_card';
    global.cardState.selectedCardOwnerKey = 'white';

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.cardState.selectedCardId).toBe('own_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');
  });

  test('useSelectedCard blocks cards that are not currently usable by rules', () => {
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: 'Duplicate Card', desc: 'd', cost: 1 }),
      getUsableCardIds: () => []
    };
    require('../cards/card-interaction.js');

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.cardState.selectedCardId = 'dup_card';
    global.cardState.selectedCardOwnerKey = 'black';
    global.gameState.currentPlayer = global.BLACK;

    window.useSelectedCard();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.addLog).toHaveBeenCalledWith('このカードは現在使用できません（対象不足など）');
  });

    test('TREASURE_BOX 使用時は playback 完了後に renderCardUI で布石表示を更新する', async () => {
      let resolvePlayback;
      const playbackPromise = new Promise((resolve) => { resolvePlayback = resolve; });
      global.waitForPlaybackIdle = jest.fn(() => playbackPromise);
      global.CardLogic = {
        getCardDef: (id) => ({ id, type: 'TREASURE_BOX', name: '宝箱', desc: 'd', cost: 1 })
      };

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      global.emitBoardUpdate.mockClear();
      window.useSelectedCard();

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      expect(global.renderCardUI).toHaveBeenCalledTimes(0);

      resolvePlayback();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
      expect(global.renderCardUI).toHaveBeenCalledTimes(1);
      delete global.waitForPlaybackIdle;
    });
});
