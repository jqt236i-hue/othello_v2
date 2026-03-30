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
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <button id="use-card-btn" type="button"></button>
        <button id="destroy-card-btn" type="button"></button>
        <button id="toggle-card-detail-btn" type="button"></button>
        <button id="pass-btn" type="button"></button>
        <button id="sell-card-btn" type="button"></button>
        <button id="cancel-card-btn" type="button"></button>
        <div id="use-card-reason"></div>
        <div id="card-detail-actions"></div>
        <div id="card-detail-more"></div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    const playbackStateManager = require('../ui/playback-state-manager');
    playbackStateManager.abortPlayback();
    playbackStateManager.setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
    global.PlaybackStateManager = playbackStateManager;
    global.window.PlaybackStateManager = playbackStateManager;

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
    try {
      if (global.PlaybackStateManager && typeof global.PlaybackStateManager.abortPlayback === 'function') {
        global.PlaybackStateManager.abortPlayback();
      }
    } catch (e) { /* ignore */ }
    delete global.PlaybackStateManager;
    delete global.window;
    delete global.document;
  });

  test('prefers owner hand element when same card id exists in both hands', () => {
    const ownCardEl = document.querySelector('#hand-black .card-item[data-card-id="dup_card"]');
    ownCardEl.getBoundingClientRect = () => ({
      left: 220,
      top: 500,
      width: 90,
      height: 120,
      right: 310,
      bottom: 620
    });

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
    const payload = global.playCardUseHandAnimation.mock.calls[0][0];
    expect(payload.owner).toBe('black');
    expect(payload.sourceCardEl).toBeTruthy();
    expect(payload.sourceCardEl.closest('#hand-black')).not.toBeNull();
    expect(payload.sourceCardEl.closest('#hand-white')).toBeNull();
    expect(payload.sourceCardRect).toEqual({
      left: 220,
      top: 500,
      width: 90,
      height: 120,
      right: 310,
      bottom: 620
    });
  });

  test('useSelectedCard skips direct fallback when playback already contains card_use_animation', () => {
    const ownCardEl = document.querySelector('#hand-black .card-item[data-card-id="dup_card"]');
    ownCardEl.getBoundingClientRect = () => ({
      left: 220,
      top: 500,
      width: 90,
      height: 120,
      right: 310,
      bottom: 620
    });
    const playbackEvents = [{
      type: 'card_use_animation',
      targets: [{ player: 'black', owner: 'black', cardId: 'dup_card' }]
    }];
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      nextCardState: global.cardState,
      nextGameState: global.gameState,
      playbackEvents
    }));

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.playCardUseHandAnimation).not.toHaveBeenCalled();
    expect(playbackEvents[0].targets[0].sourceCardEl).toBeTruthy();
    expect(playbackEvents[0].targets[0].sourceCardEl.closest('#hand-black')).not.toBeNull();
    expect(playbackEvents[0].targets[0].sourceCardRect).toEqual({
      left: 220,
      top: 500,
      width: 90,
      height: 120,
      right: 310,
      bottom: 620
    });
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

  test('useSelectedCard sends a use_card action through the shared adapter path', () => {
    require('../cards/card-interaction.js');

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    const call = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0];
    expect(call[2]).toBe('black');
    expect(call[3]).toEqual(expect.objectContaining({
      type: 'use_card',
      useCardId: 'dup_card',
      useCardOwnerKey: 'black'
    }));
    expect(call[4]).toBe(global.TurnPipeline);
  });

  test('network mode skips direct fallback when card use is server-authored', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      skippedLocalExecution: true,
      nextCardState: global.cardState,
      nextGameState: global.gameState,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.playCardUseHandAnimation).not.toHaveBeenCalled();
  });

  test('network mode keeps card UI busy until server-authored card use publish settles', async () => {
    let resolvePublish;
    const publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      skippedLocalExecution: true,
      publishPromise,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    global.renderCardUI.mockClear();
    global.cardState.selectedCardOwnerKey = 'black';

    window.useSelectedCard();

    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');
    expect(global.window.isProcessing).toBe(true);
    expect(global.window.isCardAnimating).toBe(true);

    resolvePublish({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.cardState.selectedCardId).toBeNull();
    expect(global.cardState.selectedCardOwnerKey).toBeNull();
    expect(global.window.isProcessing).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('network mode keeps selection and logs failure when server-authored card use publish is rejected', async () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      skippedLocalExecution: true,
      publishPromise: Promise.resolve({ ok: false, reason: 'OUT_OF_TURN' }),
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    global.addLog.mockClear();
    global.cardState.selectedCardOwnerKey = 'black';

    window.useSelectedCard();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');
    expect(global.window.isProcessing).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.addLog).toHaveBeenCalledWith('カード使用に失敗しました (OUT_OF_TURN)');
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('network mode wakes current player when server-authored card use publish promise rejects', async () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      skippedLocalExecution: true,
      publishPromise: Promise.reject(new Error('SOCKET_DOWN')),
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    global.addLog.mockClear();
    global.cardState.selectedCardOwnerKey = 'black';

    window.useSelectedCard();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');
    expect(global.window.isProcessing).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.addLog).toHaveBeenCalledWith('カード使用に失敗しました (SOCKET_DOWN)');
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('network mode does not emit a duplicate effect log for card use', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.emitEffectLog = jest.fn();

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.addLog).not.toHaveBeenCalledWith(expect.stringContaining('黒がカードを使用'));
    expect(global.emitEffectLog).not.toHaveBeenCalled();
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

  test('debug HvH allows inspecting the displayed off-turn hand card', () => {
    require('../cards/card-interaction.js');

    window.DEBUG_HUMAN_VS_HUMAN = true;
    window.DEBUG_UNLIMITED_USAGE = true;
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.hands = {
      black: ['dup_card'],
      white: ['dup_card']
    };
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('dup_card', 'white');

    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('white');

    window.updateCardDetailPanel();

    expect(document.getElementById('card-detail-name').textContent).toBe('Duplicate Card');
    expect(document.getElementById('use-card-btn').disabled).toBe(true);
    expect(document.getElementById('destroy-card-btn').disabled).toBe(true);
  });

  test('stale visual playback lock no longer blocks selecting and using own hand card', () => {
    require('../cards/card-interaction.js');

    global.window.VisualPlaybackActive = true;
    global.window.AnimationEngine = { isPlaying: false };
    global.isCardAnimating = true;
    global.window.isCardAnimating = true;
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('dup_card', 'black');
    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.window.VisualPlaybackActive).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
  });

  test('useSelectedCard keeps window and module shared state snapshots aligned', () => {
    const initialCardStateRef = global.cardState;
    const initialGameStateRef = global.gameState;
    const nextCardState = {
      ...global.cardState,
      charge: { black: 9, white: 10 },
      lastUsedCardByPlayer: {
        black: { id: 'dup_card', name: 'Duplicate Card', desc: 'd' },
        white: null
      },
      selectedCardId: 'dup_card'
    };
    const nextGameState = {
      ...global.gameState,
      currentPlayer: global.WHITE,
      turnNumber: 2
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      nextCardState,
      nextGameState,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');

    window.useSelectedCard();

    expect(global.cardState).toBe(initialCardStateRef);
    expect(global.gameState).toBe(initialGameStateRef);
    expect(global.window.cardState).toBe(global.cardState);
    expect(global.window.gameState).toBe(global.gameState);
    expect(global.cardState.charge.black).toBe(9);
    expect(global.gameState.currentPlayer).toBe(global.WHITE);
    expect(global.cardState.lastUsedCardByPlayer.black).toEqual({
      id: 'dup_card',
      name: 'Duplicate Card',
      desc: 'd'
    });
  });

  test('useSelectedCard hides deferred generated throw-chain card until later placement playback reveals it', () => {
    const nextCardState = {
      ...global.cardState,
      hands: { black: ['triple_01'], white: ['dup_card'] },
      lastUsedCardByPlayer: {
        black: { id: 'dup_card', name: '二連投石', desc: 'd' },
        white: null
      }
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'DOUBLE_PLACE', name: '二連投石', desc: 'd', cost: 1 })
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      nextCardState,
      nextGameState: global.gameState,
      playbackEvents: [{
        type: 'card_use_animation',
        targets: [{ player: 'black', owner: 'black', cardId: 'dup_card' }]
      }],
      deferredGeneratedThrowChainHandAdd: {
        playerKey: 'black',
        count: 1,
        reason: 'generated_throw_chain'
      }
    }));

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
    expect(global.window.__handSequentialRevealState).toMatchObject({
      playerKey: 'black',
      visibleCount: 0,
      reason: 'generated_throw_chain'
    });
  });

  test('active visual playback still blocks selecting own hand card', () => {
    require('../cards/card-interaction.js');

    global.window.VisualPlaybackActive = true;
    global.window.AnimationEngine = { isPlaying: true };
    global.isCardAnimating = true;
    global.window.isCardAnimating = true;
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('dup_card', 'black');

    expect(global.cardState.selectedCardId).toBeNull();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
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

  test('updateCardDetailPanel disables use button when selected card is not currently usable by rules in local mode', () => {
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: 'Duplicate Card', desc: 'd', cost: 1 }),
      getUsableCardIds: () => []
    };
    require('../cards/card-interaction.js');

    global.cardState.selectedCardId = 'dup_card';
    global.cardState.selectedCardOwnerKey = 'black';
    global.gameState.currentPlayer = global.BLACK;

    window.updateCardDetailPanel();

    expect(document.getElementById('use-card-btn').disabled).toBe(true);
    expect(document.getElementById('use-card-reason').textContent).toBe('現在このカードは使用できません（対象不足など）');
  });

  test.each([
    ['SWAP_WITH_ENEMY', '交換する敵石を選んでください', 'none'],
    ['TEMPT_WILL', '対象の相手特殊石を選んでください', 'none'],
    ['CAPTURE_WILL', '捕獲する相手特殊石を選んでください', 'none'],
    ['CORROSION_WILL', '腐食の対象となる特殊石を選んでください', 'none'],
    ['BOARD_EXPANSION_WILL', '左右端マスを選んで盤面を拡張してください', 'block'],
    ['BOARD_EXPANSION_GOD', '角マスを選んで盤面を拡張してください', 'block'],
    ['BLOCKADE_WILL', '封鎖する空きマスを選んでください', 'block'],
    ['FREEZE_WILL', '凍結するマスを選んでください', 'block']
  ])('updateCardDetailPanel shows pending prompt for %s', (pendingType, expectedReason, expectedCancelDisplay) => {
    require('../cards/card-interaction.js');

    global.cardState.pendingEffectByPlayer.black = {
      type: pendingType,
      stage: 'selectTarget',
      cardId: `${String(pendingType).toLowerCase()}_01`
    };

    window.updateCardDetailPanel();

    expect(document.getElementById('use-card-reason').textContent).toBe(expectedReason);
    expect(document.getElementById('cancel-card-btn').style.display).toBe(expectedCancelDisplay);
  });

  test('useSelectedCard blocks cards that are not currently usable by rules in local mode', () => {
    global.CardLogic = {
      getCardDef: (id) => ({ id, name: 'Duplicate Card', desc: 'd', cost: 1 }),
      getUsableCardIds: () => []
    };
    require('../cards/card-interaction.js');

    global.cardState.selectedCardId = 'dup_card';
    global.cardState.selectedCardOwnerKey = 'black';
    global.gameState.currentPlayer = global.BLACK;

    window.useSelectedCard();
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.addLog).toHaveBeenCalledWith('このカードは現在使用できません（対象不足など）');
  });

  test('updateCardDetailPanel does not warn when card use is normally blocked after one use this turn', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    require('../cards/card-interaction.js');

    global.cardState.hasUsedCardThisTurnByPlayer.black = true;
    global.cardState.selectedCardId = 'dup_card';
    global.cardState.selectedCardOwnerKey = 'black';
    global.gameState.currentPlayer = global.BLACK;

    window.updateCardDetailPanel();

    expect(document.getElementById('use-card-btn').disabled).toBe(true);
    expect(document.getElementById('use-card-reason').textContent).toBe('このターンは既に使用済み');
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[CARD_UI] USE DISABLED - already used this turn',
      expect.anything()
    );

    warnSpy.mockRestore();
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

    test('board を変える card playback がある時は emitBoardUpdate を playback 完了まで待つ', async () => {
      let resolvePlayback;
      const playbackPromise = new Promise((resolve) => { resolvePlayback = resolve; });
      global.waitForPlaybackIdle = jest.fn(() => playbackPromise);
      global.CardLogic = {
        getCardDef: (id) => ({ id, type: 'EQUALITY_WILL', name: '平等の意志', desc: 'd', cost: 1 })
      };
      global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
        ok: true,
        nextCardState: global.cardState,
        nextGameState: global.gameState,
        playbackEvents: [
          { type: 'card_use_animation', targets: [{ player: 'black', owner: 'black', cardId: 'dup_card' }] },
          { type: 'spawn', targets: [{ r: 2, col: 2, cause: 'EQUALITY_WILL', reason: 'equality_will_spawn' }] }
        ]
      }));

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      global.emitBoardUpdate.mockClear();
      window.useSelectedCard();

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(0);

      resolvePlayback();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      delete global.waitForPlaybackIdle;
    });

    test('capture_to_hand_animation がある時も emitBoardUpdate を playback 完了まで待つ', async () => {
      let resolvePlayback;
      const playbackPromise = new Promise((resolve) => { resolvePlayback = resolve; });
      global.waitForPlaybackIdle = jest.fn(() => playbackPromise);
      global.CardLogic = {
        getCardDef: (id) => ({ id, type: 'EQUALITY_WILL', name: '平等の意志', desc: 'd', cost: 1 })
      };
      global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
        ok: true,
        nextCardState: global.cardState,
        nextGameState: global.gameState,
        playbackEvents: [
          { type: 'card_use_animation', targets: [{ player: 'black', owner: 'black', cardId: 'dup_card' }] },
          { type: 'capture_to_hand_animation', targets: [{ player: 'black', cardId: 'guardian_god_01', sourceRow: 4, sourceCol: 5, insertIndex: 1 }] }
        ]
      }));

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      global.emitBoardUpdate.mockClear();
      window.useSelectedCard();

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(0);

      resolvePlayback();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      delete global.waitForPlaybackIdle;
    });
  });
