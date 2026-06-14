import { JSDOM } from 'jsdom';

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
        <button id="cancel-card-btn" type="button"></button>
        <div id="use-card-reason"></div>
        <div id="card-detail-actions"></div>
        <div id="card-detail-more"></div>
      </body></html>
    `);
    global.window = dom.window;
    global.document = dom.window.document;
    const playbackStateManager = require('../ui/playback-state-manager.js');
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
      lastTurnStartedFor: null,
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
    global.renderBoard = jest.fn();
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
    delete global.renderBoard;
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

  test('onCardClick refreshes the board when selection changes', () => {
    require('../cards/card-interaction.js');

    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;

    window.onCardClick('dup_card', 'black');

    expect(global.cardState.selectedCardId).toBe('dup_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');
    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
    expect(global.renderBoard).toHaveBeenCalledTimes(1);

    window.onCardClick('dup_card', 'black');

    expect(global.cardState.selectedCardId).toBeNull();
    expect(global.cardState.selectedCardOwnerKey).toBeNull();
    expect(global.renderCardUI).toHaveBeenCalledTimes(2);
    expect(global.renderBoard).toHaveBeenCalledTimes(2);
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

  test('switching selected hand cards settles lingering fade on the owner-matched hand container', () => {
    document.getElementById('hand-black').dataset.ownerKey = 'white';
    document.getElementById('hand-white').dataset.ownerKey = 'black';
    document.getElementById('hand-white').innerHTML = `
      <div class="card-item selected card-fade-in" data-card-id="old_card" data-owner-key="black" style="--card-fade-in-duration: 1s;">Old</div>
      <div class="card-item clickable" data-card-id="new_card" data-owner-key="black">New</div>
    `;
    global.cardState.hands = {
      black: ['old_card', 'new_card'],
      white: ['dup_card']
    };
    global.cardState.selectedCardId = 'old_card';
    global.cardState.selectedCardOwnerKey = 'black';
    global.window.__handFadeInState = { playerKey: 'black', token: 'fade-token', count: 1 };
    global.window.__handFadeInHint = { playerKey: 'black', token: 'fade-token', count: 1 };

    require('../cards/card-interaction.js');
    window.onCardClick('new_card', 'black');

    const oldCardEl = document.querySelector('#hand-white .card-item[data-card-id="old_card"]');
    expect(global.cardState.selectedCardId).toBe('new_card');
    expect(global.cardState.selectedCardOwnerKey).toBe('black');
    expect(oldCardEl.classList.contains('card-fade-prep')).toBe(false);
    expect(oldCardEl.classList.contains('card-fade-in')).toBe(false);
    expect(oldCardEl.style.getPropertyValue('--card-fade-in-duration')).toBe('');
    expect(global.window.__handFadeInState).toBeNull();
    expect(global.window.__handFadeInHint).toBeNull();
    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
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

  test('network mode blocks use when projected hand slot cost exceeds charge', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.selectedCardId = 'support_troops_01';
    global.cardState.selectedCardOwnerKey = 'black';
    global.cardState.charge.black = 14;
    global.cardState.hands.black = ['support_troops_01'];
    global.cardState.handCostAdjustmentsByPlayer = {
      black: [{ delta: 5 }],
      white: []
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'SUPPORT_TROOPS_WILL', name: '援軍の意志', desc: 'd', cost: 14 }),
      getUsableCardIds: () => ['support_troops_01']
    };

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    expect(global.addLog).toHaveBeenCalledWith('布石不足: 援軍の意志 (必要: 19, 所持: 14)');
  });

  test('network mode allows observer will stolen cards with projected zero cost', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.selectedCardId = 'supply_01';
    global.cardState.selectedCardOwnerKey = 'black';
    global.cardState.charge.black = 0;
    global.cardState.hands.black = ['supply_01'];
    global.cardState.handCostAdjustmentsByPlayer = {
      black: [{ overrideCost: 0 }],
      white: []
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'SUPPORT_TROOPS_WILL', name: '援軍の意志', desc: 'd', cost: 20 }),
      getUsableCardIds: () => ['supply_01']
    };

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.addLog).not.toHaveBeenCalledWith(expect.stringContaining('布石不足'));
  });

  test('network mode allows projected observer zero-cost cards through real rule usability checks', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.selectedCardId = 'supply_01';
    global.cardState.selectedCardOwnerKey = 'black';
    global.cardState.selectedCardHandIndex = 0;
    global.cardState.charge.black = 0;
    global.cardState.hands.black = ['supply_01'];
    global.cardState.handCostAdjustmentsByPlayer = {
      black: [{ overrideCost: 0 }],
      white: []
    };
    global.CardLogic = require('../game/logic/cards.js');

    require('../cards/card-interaction.js');
    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.addLog).not.toHaveBeenCalledWith(expect.stringContaining('現在使用できません'));
  });

  test('network mode uses clicked hand slot for duplicate observer will stolen cards', () => {
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.gameState.currentPlayer = global.BLACK;
    global.cardState.selectedCardId = null;
    global.cardState.selectedCardOwnerKey = null;
    global.cardState.charge.black = 0;
    global.cardState.hands.black = ['supply_01', 'supply_01'];
    global.cardState.handCostAdjustmentsByPlayer = {
      black: [null, { overrideCost: 0 }],
      white: []
    };
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'SUPPORT_TROOPS_WILL', name: '援軍の意志', desc: 'd', cost: 20 }),
      getUsableCardIds: () => ['supply_01']
    };

    require('../cards/card-interaction.js');
    window.onCardClick('supply_01', 'black', 1);
    expect(global.cardState.selectedCardHandIndex).toBe(1);

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3]).toEqual(expect.objectContaining({
      useCardId: 'supply_01',
      useCardOwnerKey: 'black',
      useCardHandIndex: 1
    }));
    expect(global.addLog).not.toHaveBeenCalledWith(expect.stringContaining('布石不足'));
  });

  test('network server-authored card use does not advance local action history', () => {
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

    expect(global.ActionManager.ActionManager.recordAction).not.toHaveBeenCalled();
    expect(global.ActionManager.ActionManager.incrementTurnIndex).not.toHaveBeenCalled();
  });

  test('network pending target-card use attaches source element to returned card_use_animation and skips direct fallback', () => {
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
      phase: 1,
      targets: [{
        player: 'black',
        owner: 'black',
        cardId: 'dup_card',
        cardType: 'CAPTURE_WILL'
      }]
    }, {
      type: 'sound_effect',
      phase: 1,
      targets: [{ soundKey: 'card_use_button' }],
      meta: { sourceType: 'card_used', localPendingPreview: true }
    }];

    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'CAPTURE_WILL', name: '捕獲の意志', desc: 'd', cost: 1 })
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      pendingSelectionActive: true,
      nextCardState: {
        ...global.cardState,
        pendingEffectByPlayer: {
          ...global.cardState.pendingEffectByPlayer,
          black: { type: 'CAPTURE_WILL', stage: 'selectTarget', cardId: 'dup_card' }
        }
      },
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

  test('network mode does not auto-advance after server-authored card use leaves board target pending', async () => {
    let resolvePublish;
    const publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    window.MATCH_MODE = 'network';
    window.LOCAL_PLAYER_KEY = 'black';
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: 'METEOR_WILL', name: '因果抹消', desc: 'd', cost: 1 })
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      skippedLocalExecution: true,
      pendingSelectionActive: true,
      publishPromise,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');
    global.renderCardUI.mockClear();
    global.cardState.selectedCardOwnerKey = 'black';

    window.useSelectedCard();

    global.cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'dup_card'
    };
    resolvePublish({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'METEOR_WILL',
      stage: 'selectTarget'
    }));
    expect(global.window.isProcessing).toBe(false);
    expect(global.window.isCardAnimating).toBe(false);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
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

  test.each([
    ['seed_01', 'SEED_WILL'],
    ['cell_teleport_01', 'CELL_TELEPORT_WILL']
  ])('useSelectedCard restores %s board pending when adapter snapshot misses it', (cardId, cardType) => {
    global.cardState.selectedCardId = cardId;
    global.cardState.selectedCardOwnerKey = 'black';
    global.cardState.hands.black = [cardId];
    global.cardState.pendingEffectByPlayer.black = null;
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: cardType, name: cardType, desc: 'd', cost: 1 })
    };
    const nextCardState = {
      ...global.cardState,
      charge: { black: 9, white: 10 },
      hands: { black: [], white: ['dup_card'] },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      pendingEffectByPlayer: { black: null, white: null }
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      nextCardState,
      nextGameState: global.gameState,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: cardType,
      cardId,
      stage: 'selectTarget'
    }));
  });

  test.each([
    ['seed_01', 'SEED_WILL'],
    ['cell_teleport_01', 'CELL_TELEPORT_WILL']
  ])('debug useSelectedCard restores %s board pending when adapter snapshot misses it', (cardId, cardType) => {
    window.DEBUG_UNLIMITED_USAGE = true;
    global.cardState.selectedCardId = cardId;
    global.cardState.selectedCardOwnerKey = 'black';
    global.cardState.hands.black = [cardId];
    global.cardState.pendingEffectByPlayer.black = null;
    global.CardLogic = {
      getCardDef: (id) => ({ id, type: cardType, name: cardType, desc: 'd', cost: 1 })
    };
    const nextCardState = {
      ...global.cardState,
      pendingEffectByPlayer: { black: null, white: null }
    };
    global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
      ok: true,
      nextCardState,
      nextGameState: global.gameState,
      playbackEvents: []
    }));

    require('../cards/card-interaction.js');

    window.useSelectedCard();

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: cardType,
      cardId,
      stage: 'selectTarget'
    }));
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
    ['SEED_WILL', '種をまく空きマスを選んでください', 'block'],
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

  test('updateCardDetailPanel keeps SEED_WILL cancellable when pending-state-manager fallback is used', () => {
    jest.doMock('../game/logic/cards-internal/pending-state-manager', () => {
      throw new Error('pending-state-manager unavailable');
    });

    try {
      require('../cards/card-interaction.js');

      global.cardState.pendingEffectByPlayer.black = {
        type: 'SEED_WILL',
        stage: 'selectTarget',
        cardId: 'seed_01'
      };

      window.updateCardDetailPanel();

      expect(document.getElementById('use-card-reason').textContent).toBe('種をまく空きマスを選んでください');
      expect(document.getElementById('cancel-card-btn').style.display).toBe('block');
    } finally {
      jest.dontMock('../game/logic/cards-internal/pending-state-manager');
    }
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

    global.cardState.lastTurnStartedFor = 'black';
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

    test('selectTarget へ入る card use は card_use_animation 中でも即座に emitBoardUpdate する', async () => {
      let resolvePlayback;
      const playbackPromise = new Promise((resolve) => { resolvePlayback = resolve; });
      global.waitForPlaybackIdle = jest.fn(() => playbackPromise);
      global.CardLogic = {
        getCardDef: (id) => ({ id, type: 'CAPTURE_WILL', name: '捕獲の意志', desc: 'd', cost: 1 })
      };
      global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: {
            ...global.cardState.pendingEffectByPlayer,
            black: { type: 'CAPTURE_WILL', stage: 'selectTarget' }
          }
        },
        nextGameState: global.gameState,
        playbackEvents: [
          { type: 'card_use_animation', targets: [{ player: 'black', owner: 'black', cardId: 'dup_card' }] }
        ]
      }));

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      global.emitBoardUpdate.mockClear();
      window.useSelectedCard();

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);

      resolvePlayback();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(0);
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      delete global.waitForPlaybackIdle;
    });

    test('selectTarget へ入る card use は direct fallback card animation 中でも即座に emitBoardUpdate する', async () => {
      let resolveAnimation;
      global.playCardUseHandAnimation = jest.fn(() => {
        global.window.isCardAnimating = true;
        return new Promise((resolve) => {
          resolveAnimation = () => {
            global.window.isCardAnimating = false;
            resolve();
          };
        });
      });
      global.CardLogic = {
        getCardDef: (id) => ({ id, type: 'CAPTURE_WILL', name: '捕獲の意志', desc: 'd', cost: 1 })
      };
      global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: {
            ...global.cardState.pendingEffectByPlayer,
            black: { type: 'CAPTURE_WILL', stage: 'selectTarget' }
          }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }));

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      global.emitBoardUpdate.mockClear();
      window.useSelectedCard();

      expect(global.playCardUseHandAnimation).toHaveBeenCalledTimes(1);
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);

      resolveAnimation();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
      global.window.isCardAnimating = false;
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

    test('hand_remove を含む capture_to_hand_animation は予約スロット表示のため手札を先に 1 回描く', async () => {
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
          { type: 'hand_remove', targets: [{ player: 'black', count: 1 }] },
          { type: 'capture_to_hand_animation', targets: [{ player: 'black', cardId: 'guardian_god_01', sourceRow: 4, sourceCol: 5, insertIndex: 1 }] }
        ]
      }));

      require('../cards/card-interaction.js');
      global.renderCardUI.mockClear();
      window.useSelectedCard();

      expect(global.renderCardUI).toHaveBeenCalledTimes(1);
      expect(global.window.__captureReservedHandSlotState).toEqual(expect.objectContaining({
        playerKey: 'black',
        handIndex: 1
      }));

      resolvePlayback();
      await Promise.resolve();
      await Promise.resolve();

      expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(2);
      expect(global.renderCardUI).toHaveBeenCalledTimes(2);
      delete global.waitForPlaybackIdle;
    });

    test('cancelPendingSelection accepts other cancellable board-target pending types', () => {
      global.cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' };
      global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { black: null, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }));

      require('../cards/card-interaction.js');
      global.emitBoardUpdate.mockClear();
      global.renderBoard.mockClear();
      global.renderCardUI.mockClear();
      global.addLog.mockClear();

      window.cancelPendingSelection('black');

      expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledTimes(1);
      expect(global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3]).toEqual(
        expect.objectContaining({ type: 'cancel_card' })
      );
      expect(global.renderCardUI).toHaveBeenCalledTimes(1);
      expect(global.renderBoard).toHaveBeenCalledTimes(1);
      expect(global.emitBoardUpdate).toHaveBeenCalledTimes(0);
      expect(global.addLog).toHaveBeenCalledWith('黒の対象選択をキャンセルしました');
    });
  });
