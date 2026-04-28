/**
 * @file ui.fate-will-ui-controlled-turn.test.js
 * Focused tests for FATE_WILL UI/UX: controller can act, victim is read-only, banner shown.
 */
'use strict';

import { JSDOM } from 'jsdom';
import * as path from 'path';

function makeDom() {
    return new JSDOM(`
        <!doctype html><html><body>
            <div id="card-detail-name"></div>
            <div id="card-detail-desc"></div>
            <div id="card-detail-actions"></div>
            <button id="destroy-card-btn">破壊</button>
            <button id="use-card-btn">使用</button>
            <button id="toggle-card-detail-btn">詳細</button>
            <button id="pass-btn">パス</button>
            <button id="cancel-card-btn" style="display:none;">キャンセル</button>
            <div id="use-card-reason"></div>
        </body></html>
    `);
}

function makeBaseCardState(overrides) {
    return Object.assign({
        selectedCardId: null,
        selectedCardOwnerKey: null,
        lastTurnStartedFor: null,
        turnIndex: 0,
        charge: { black: 10, white: 10 },
        hands: { black: ['black_card'], white: ['white_card'] },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        pendingEffectByPlayer: { black: null, white: null },
        lastUsedCardByPlayer: { black: null, white: null },
        fateWillControllerByTurnOwner: { black: null, white: null },
        markers: [],
        discard: []
    }, overrides || {});
}

function setupCardInteractionGlobals(dom, gameStateCurrent, localPlayerKey, fateWillActive) {
    jest.resetModules();
    global.window = dom.window;
    global.document = dom.window.document;
    global.BLACK = 1;
    global.WHITE = -1;

    global.gameState = {
        currentPlayer: gameStateCurrent === 'black' ? 1 : -1,
        board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };

    global.cardState = makeBaseCardState({
        fateWillControllerByTurnOwner: fateWillActive
            ? { black: null, white: localPlayerKey === 'black' ? 'black' : null }
            : { black: null, white: null }
    });

    // localPlayerKey resolves via window.LOCAL_PLAYER_KEY
    dom.window.LOCAL_PLAYER_KEY = localPlayerKey;

    global.CardLogic = {
        getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
        getUsableCardIds: () => ['white_card', 'black_card'],
        canUseCard: () => true,
        getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
        getSelectableTargets: () => []
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
        runTurnWithAdapter: jest.fn((_cs, _gs, _playerKey, action) => {
            const nextCardState = { ...global.cardState };
            if (action.type === 'destroy_hand_card') {
                nextCardState.hands = {
                    black: (global.cardState.hands.black || []).filter(id => id !== action.destroyCardId),
                    white: (global.cardState.hands.white || []).filter(id => id !== action.destroyCardId)
                };
            }
            global.cardState = nextCardState;
            return { ok: true, nextCardState, nextGameState: global.gameState, playbackEvents: [] };
        })
    };

    require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));
}

// ===== _canInputPlayerActNow helper proxy (test via side effects of updateCardDetailPanel) =====

describe('FATE_WILL UI: controller can act on victim turn', () => {
    let dom;

    beforeEach(() => { dom = makeDom(); });

    test('controller (black) can click victim (white) card during FATE_WILL turn', () => {
        // Setup: white's turn, black is FATE_WILL controller
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        // Simulate clicking white's card as the controller
        global.window.onCardClick('white_card', 'white');
        // Selection should be set (no early return due to FATE_WILL)
        expect(global.cardState.selectedCardId).toBe('white_card');
    });

    test('controller (black) can still use victim card before victim turn-start clears stale used flag', () => {
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        global.cardState.lastTurnStartedFor = 'black';
        global.cardState.hasUsedCardThisTurnByPlayer.white = true;
        global.cardState.selectedCardId = 'white_card';
        global.cardState.selectedCardOwnerKey = 'white';

        global.window.updateCardDetailPanel();

        expect(dom.window.document.getElementById('use-card-btn').disabled).toBe(false);

        global.window.useSelectedCard();

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({
                type: 'use_card',
                useCardId: 'white_card',
                useCardOwnerKey: 'white'
            }),
            expect.anything()
        );
    });

    test('victim card still stays blocked after same-turn card use was already recorded', () => {
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        global.cardState.lastTurnStartedFor = 'white';
        global.cardState.hasUsedCardThisTurnByPlayer.white = true;
        global.cardState.selectedCardId = 'white_card';
        global.cardState.selectedCardOwnerKey = 'white';

        global.window.updateCardDetailPanel();

        expect(dom.window.document.getElementById('use-card-btn').disabled).toBe(true);

        global.window.useSelectedCard();

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    });

    test('victim (black) cannot destroy card in local (cpu) mode when FATE_WILL active', () => {
        // Local mode: black's turn, white controls via FATE_WILL → black (local player) is locked out.
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: 'white', white: null }  // white controls black's turn
        });

        // Local player is black (the victim) — no MATCH_MODE so local mode
        dom.window.LOCAL_PLAYER_KEY = 'black';
        global.CardLogic = {
            getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
            getUsableCardIds: () => ['black_card'],
            canUseCard: () => true,
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
            getSelectableTargets: () => []
        };
        global.Core = { getLegalMoves: () => [] };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.addLog = jest.fn();
        global.processPassTurn = jest.fn();
        global.ActionManager = { ActionManager: {
            createAction: (t, p, x) => ({ type: t, player: p, ...(x || {}) }),
            recordAction: jest.fn(), incrementTurnIndex: jest.fn()
        } };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({ ok: true, nextCardState: global.cardState, nextGameState: global.gameState, playbackEvents: [] }))
        };

        require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));

        global.cardState.selectedCardId = 'black_card';
        global.cardState.selectedCardOwnerKey = 'black';
        global.window.destroySelectedHandCard();

        // Victim is blocked by _canInputPlayerActNow in local mode
        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    });

    test('victim (black) cannot pass in local (cpu) mode when FATE_WILL active', () => {
        // Local mode: black's turn, white controls via FATE_WILL → black cannot pass.
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: 'white', white: null }
        });

        dom.window.LOCAL_PLAYER_KEY = 'black';
        global.CardLogic = {
            getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
            getUsableCardIds: () => [],
            canUseCard: () => false,
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
            getSelectableTargets: () => []
        };
        global.Core = { getLegalMoves: () => [] };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.addLog = jest.fn();
        global.processPassTurn = jest.fn();
        global.ActionManager = { ActionManager: {
            createAction: jest.fn(), recordAction: jest.fn(), incrementTurnIndex: jest.fn()
        } };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = { runTurnWithAdapter: jest.fn() };

        require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));

        global.window.passCurrentTurn();

        // Victim cannot pass — _canInputPlayerActNow returns false in local mode
        expect(global.processPassTurn).not.toHaveBeenCalled();
    });

    test('controller (black) can pass in local (cpu) mode on victim (white) turn', () => {
        // Local mode: white's turn controlled by black → controller (black) can pass when no legal moves.
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        // No pending, no legal moves → pass should proceed
        global.window.passCurrentTurn();
        expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    });

    test('victim (white) cannot click their own cards when being controlled (network mode)', () => {
        // In network mode, white is victim, white's local player tries to act
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = { currentPlayer: -1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: null, white: 'black' }  // black controls white's turn
        });

        // Local player is white (the victim), network mode
        dom.window.MATCH_MODE = 'network';
        dom.window.NetworkMatchClient = { getSeatKey: () => 'white', isActive: () => true };
        global.CardLogic = {
            getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
            getUsableCardIds: () => ['white_card'],
            canUseCard: () => true,
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
            getSelectableTargets: () => []
        };
        global.Core = { getLegalMoves: () => [] };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.addLog = jest.fn();
        global.processPassTurn = jest.fn();
        global.ActionManager = { ActionManager: {
            createAction: (t, p, x) => ({ type: t, player: p, ...(x || {}) }),
            recordAction: jest.fn(), incrementTurnIndex: jest.fn()
        } };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({ ok: true, nextCardState: global.cardState, nextGameState: global.gameState, playbackEvents: [] }))
        };

        require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));

        // White (victim) tries to destroy a card but should be blocked
        global.cardState.selectedCardId = 'white_card';
        global.cardState.selectedCardOwnerKey = 'white';
        global.window.destroySelectedHandCard();

        // Pipeline should NOT have been called (victim is blocked by _canInputPlayerActNow)
        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
    });

    test('controller destroySelectedHandCard uses victim key for ownership check', () => {
        // white's turn, black controls; victim card is white_card
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        global.cardState.selectedCardId = 'white_card';
        global.cardState.selectedCardOwnerKey = 'white';

        global.window.destroySelectedHandCard();

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',  // controller's seat key (network auth)
            expect.objectContaining({ type: 'destroy_hand_card', destroyCardId: 'white_card' }),
            expect.anything()
        );
    });

    test('passCurrentTurn uses victim pending check when FATE_WILL active', () => {
        // white's turn, black controls; white has a pending selectTarget
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        global.cardState.pendingEffectByPlayer.white = { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' };

        global.window.passCurrentTurn();

        // Should NOT call processPassTurn because victim has a pending selection
        expect(global.processPassTurn).not.toHaveBeenCalled();
    });

    test('passCurrentTurn proceeds when victim has no pending', () => {
        setupCardInteractionGlobals(dom, 'white', 'black', true);
        // No pending, no legal moves

        global.window.passCurrentTurn();

        // Should call processPassTurn with controller's (black) key
        expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    });

    test('normal turn: _canInputPlayerActNow still works for normal black turn', () => {
        setupCardInteractionGlobals(dom, 'black', 'black', false);
        global.cardState.selectedCardId = 'black_card';
        global.cardState.selectedCardOwnerKey = 'black';

        global.window.destroySelectedHandCard();

        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({ type: 'destroy_hand_card', destroyCardId: 'black_card' }),
            expect.anything()
        );
    });
});

// ===== canLocalUserOperateCurrentTurn in turn-manager.js =====

describe('FATE_WILL UI: canLocalUserOperateCurrentTurn', () => {
    function loadTurnManager(gameStateCurrent, localPlayerKey, fateWillActive, matchMode) {
        jest.resetModules();
        const dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = {
            currentPlayer: gameStateCurrent === 'black' ? 1 : -1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: fateWillActive
                ? { black: null, white: 'black' }
                : { black: null, white: null }
        });
        // Set on globalThis (which is `global` in Jest) so turn-manager reads correctly
        global.MATCH_MODE = matchMode || 'cpu';
        global.LOCAL_PLAYER_KEY = localPlayerKey;

        // Set up minimal globals for turn-manager to load
        global.getAnimationTiming = () => 600;
        global.cpuSmartness = { white: 1 };
        global.isGameOver = () => false;
        global.addLog = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.playHandAnimation = jest.fn();
        global.findMoveForCell = jest.fn(() => null);
        global.getActiveProtectionForPlayer = jest.fn(() => []);
        global.getFlipBlockers = jest.fn(() => []);
        global.emitPresentationEventViaBoardOps = jest.fn();
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.PlaybackStateManager = null;

        const mod = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
        return mod;
    }

    afterEach(() => {
        delete global.MATCH_MODE;
        delete global.LOCAL_PLAYER_KEY;
        delete global.__uiImpl_turn_manager;
    });

    test('FATE_WILL: controller (black) can operate white victim turn in network mode', () => {
        const tm = loadTurnManager('white', 'black', true, 'network');
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(true);
    });

    test('FATE_WILL: controller (black) can operate white victim turn in network HvH debug mode', () => {
        const tm = loadTurnManager('white', 'black', true, 'network');
        tm.setUIImpl({ DEBUG_HUMAN_VS_HUMAN: true });
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(true);
    });

    test('FATE_WILL: victim (white) cannot operate their own turn in network mode', () => {
        // Reload with white as local player, black as controller
        jest.resetModules();
        const dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;
        global.gameState = { currentPlayer: -1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        });
        // Set on globalThis so turn-manager reads correctly
        global.LOCAL_PLAYER_KEY = 'white';  // local player is victim
        global.MATCH_MODE = 'network';
        global.getAnimationTiming = () => 600;
        global.cpuSmartness = { white: 1 };
        global.isGameOver = () => false;
        global.addLog = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.playHandAnimation = jest.fn();
        global.findMoveForCell = jest.fn(() => null);
        global.getActiveProtectionForPlayer = jest.fn(() => []);
        global.getFlipBlockers = jest.fn(() => []);
        global.emitPresentationEventViaBoardOps = jest.fn();
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.PlaybackStateManager = null;

        const tm = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(false);
    });

    test('normal turn: local player matches current player', () => {
        const tm = loadTurnManager('black', 'black', false, 'network');
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(true);
    });

    test('FATE_WILL: controller (black) can operate white victim turn in local (cpu) mode', () => {
        const tm = loadTurnManager('white', 'black', true, 'cpu');
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(true);
    });

    test('FATE_WILL: victim (black) cannot operate their own turn in local (cpu) mode', () => {
        // Black's turn, but white is the FATE_WILL controller → black (local) is locked out.
        jest.resetModules();
        const dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;
        global.gameState = { currentPlayer: 1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: 'white', white: null }  // white controls black's turn
        });
        global.LOCAL_PLAYER_KEY = 'black';  // local player is the victim
        // No MATCH_MODE → local (cpu) mode
        global.getAnimationTiming = () => 600;
        global.cpuSmartness = { white: 1 };
        global.isGameOver = () => false;
        global.addLog = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.playHandAnimation = jest.fn();
        global.findMoveForCell = jest.fn(() => null);
        global.getActiveProtectionForPlayer = jest.fn(() => []);
        global.getFlipBlockers = jest.fn(() => []);
        global.emitPresentationEventViaBoardOps = jest.fn();
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.PlaybackStateManager = null;

        const tm = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
        expect(tm.canLocalUserOperateCurrentTurn()).toBe(false);
    });
});

describe('FATE_WILL UI: network placement auth', () => {
    let dom;

    function loadNetworkPlacementHarness(options) {
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;
        global.MATCH_MODE = 'network';
        global.LOCAL_PLAYER_KEY = (options && options.localPlayerKey) || 'black';

        global.gameState = {
            currentPlayer: options && options.currentPlayer === 'white' ? -1 : 1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0)),
            turnNumber: 3
        };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: (options && options.fateMap) || { black: null, white: null }
        });

        global.getAnimationTiming = () => 600;
        global.cpuSmartness = { white: 1 };
        global.isGameOver = () => false;
        global.addLog = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.playHandAnimation = jest.fn((player, row, col, callback) => callback());
        global.findMoveForCell = jest.fn((player, row, col) => ({ row, col, flips: [], player }));
        global.getActiveProtectionForPlayer = jest.fn(() => []);
        global.getFlipBlockers = jest.fn(() => []);
        global.emitPresentationEventViaBoardOps = jest.fn();
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.PlaybackStateManager = null;
        global.SoundEngine = { init: jest.fn() };
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.ActionManager = {
            ActionManager: {
                createAction: (type, playerKey, extra) => ({ type, playerKey, ...(extra || {}) }),
                recordAction: jest.fn(),
                incrementTurnIndex: jest.fn()
            }
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                skippedLocalExecution: true,
                playbackEvents: [],
                publishPromise: Promise.resolve({ ok: true }),
                nextCardState: global.cardState,
                nextGameState: global.gameState
            }))
        };

        require(path.resolve(__dirname, '..', 'game', 'move-executor.js'));
        const turnManager = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
        if (options && options.debugHvH) {
            turnManager.setUIImpl({ DEBUG_HUMAN_VS_HUMAN: true });
        }
        return turnManager;
    }

    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        } catch (e) {
            // ignore
        }
        delete global.window;
        delete global.document;
        delete global.BLACK;
        delete global.WHITE;
        delete global.MATCH_MODE;
        delete global.LOCAL_PLAYER_KEY;
        delete global.gameState;
        delete global.cardState;
        delete global.getAnimationTiming;
        delete global.cpuSmartness;
        delete global.isGameOver;
        delete global.addLog;
        delete global.emitBoardUpdate;
        delete global.playHandAnimation;
        delete global.findMoveForCell;
        delete global.getActiveProtectionForPlayer;
        delete global.getFlipBlockers;
        delete global.emitPresentationEventViaBoardOps;
        delete global.isProcessing;
        delete global.isCardAnimating;
        delete global.PlaybackStateManager;
        delete global.__uiImpl_turn_manager;
        delete global.SoundEngine;
        delete global.BoardOps;
        delete global.ActionManager;
        delete global.TurnPipeline;
        delete global.TurnPipelineUIAdapter;
        delete global.executeMove;
        jest.clearAllMocks();
    });

    test('controller seat is used for place auth during network FATE_WILL turn', async () => {
        const tm = loadNetworkPlacementHarness({
            currentPlayer: 'white',
            localPlayerKey: 'black',
            fateMap: { black: null, white: 'black' }
        });

        tm.handleCellClick(2, 3);
        await Promise.resolve();

        expect(global.findMoveForCell).toHaveBeenCalledWith(-1, 2, 3, null, [], []);
        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({
                type: 'place',
                row: 2,
                col: 3,
                playerKey: 'black'
            }),
            expect.anything()
        );
    });

    test('controller seat is used for place auth during network FATE_WILL turn with HvH debug enabled', async () => {
        const tm = loadNetworkPlacementHarness({
            currentPlayer: 'white',
            localPlayerKey: 'black',
            fateMap: { black: null, white: 'black' },
            debugHvH: true
        });

        tm.handleCellClick(2, 3);
        await Promise.resolve();

        expect(global.findMoveForCell).toHaveBeenCalledWith(-1, 2, 3, null, [], []);
        expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({
                type: 'place',
                row: 2,
                col: 3,
                playerKey: 'black'
            }),
            expect.anything()
        );
    });
});

// ===== Status display: FATE_WILL banner =====

describe('FATE_WILL UI: banner (status-display)', () => {
    let dom;

    function loadStatusDisplay(gameStateCurrent, localPlayerKey, fateWillActive, isNetwork) {
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = {
            currentPlayer: gameStateCurrent === 'black' ? 1 : -1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: fateWillActive
                ? { black: null, white: 'black' }
                : { black: null, white: null }
        });

        if (isNetwork) {
            dom.window.MATCH_MODE = 'network';
            dom.window.NetworkMatchClient = {
                getSeatKey: () => localPlayerKey,
                getSeatNames: () => ({ black: 'PlayerB', white: 'PlayerW' }),
                isActive: () => true
            };
        }
        dom.window.LOCAL_PLAYER_KEY = localPlayerKey;

        global.cpuSmartness = { white: 1 };
        global.CPU_LEVEL_NAMES = { 1: 'レベル1' };
        global.countDiscs = () => ({ black: 2, white: 2 });
        global.getElement = () => null;

        require(path.resolve(__dirname, '..', 'ui', 'status-display.js'));
    }

    test('banner shows when FATE_WILL controller is active', () => {
        loadStatusDisplay('white', 'black', true, false);
        global.window.updateFateWillBanner();
        const banner = dom.window.document.getElementById('fate-will-banner');
        expect(banner).not.toBeNull();
        expect(banner.classList.contains('is-visible')).toBe(true);
        expect(banner.textContent).toContain('運命の意志発動中');
    });

    test('banner hidden when no FATE_WILL active', () => {
        loadStatusDisplay('black', 'black', false, false);
        global.window.updateFateWillBanner();
        const banner = dom.window.document.getElementById('fate-will-banner');
        if (banner) {
            expect(banner.classList.contains('is-visible')).toBe(false);
        } else {
            expect(banner).toBeNull();
        }
    });

    test('banner shows controller role text in network mode (controller side)', () => {
        loadStatusDisplay('white', 'black', true, true);
        global.window.updateFateWillBanner();
        const banner = dom.window.document.getElementById('fate-will-banner');
        expect(banner).not.toBeNull();
        expect(banner.classList.contains('is-visible')).toBe(true);
        expect(banner.textContent).toContain('代理操作中');
    });

    test('banner shows victim role text in network mode (victim side)', () => {
        // Reload: white is victim but local player is white
        jest.resetModules();
        dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;
        global.gameState = { currentPlayer: -1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        });
        dom.window.MATCH_MODE = 'network';
        dom.window.LOCAL_PLAYER_KEY = 'white';  // victim's local player
        dom.window.NetworkMatchClient = {
            getSeatKey: () => 'white',
            getSeatNames: () => ({ black: 'B', white: 'W' }),
            isActive: () => true
        };
        global.cpuSmartness = { white: 1 };
        global.CPU_LEVEL_NAMES = {};
        global.countDiscs = () => ({ black: 2, white: 2 });
        global.getElement = () => null;

        require(path.resolve(__dirname, '..', 'ui', 'status-display.js'));
        global.window.updateFateWillBanner();

        const banner = dom.window.document.getElementById('fate-will-banner');
        expect(banner).not.toBeNull();
        expect(banner.classList.contains('is-visible')).toBe(true);
        expect(banner.textContent).toContain('相手代理操作中');
    });
});

// ===== FATE_WILL: cancel pending selection lockout (regression) =====

describe('FATE_WILL UI: victim cannot cancel pending selection', () => {
    function setupCancelTest(options) {
        // options: { localPlayerKey, currentPlayer, fateWillController, matchMode }
        jest.resetModules();
        const dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = {
            currentPlayer: options.currentPlayer === 'black' ? 1 : -1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = makeBaseCardState({
            fateWillControllerByTurnOwner: options.fateWillController
        });

        dom.window.LOCAL_PLAYER_KEY = options.localPlayerKey;
        if (options.matchMode === 'network') {
            dom.window.MATCH_MODE = 'network';
            dom.window.NetworkMatchClient = {
                getSeatKey: () => options.localPlayerKey,
                isActive: () => true
            };
        }

        global.CardLogic = {
            getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
            getUsableCardIds: () => [],
            canUseCard: () => false,
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
            getSelectableTargets: () => []
        };
        global.Core = { getLegalMoves: () => [] };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.addLog = jest.fn();
        global.processPassTurn = jest.fn();
        const runMock = jest.fn(() => ({ ok: true, nextCardState: global.cardState, nextGameState: global.gameState, playbackEvents: [] }));
        global.ActionManager = {
            ActionManager: {
                createAction: (t, p, x) => ({ type: t, player: p, ...(x || {}) }),
                recordAction: jest.fn(),
                incrementTurnIndex: jest.fn()
            }
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = { runTurnWithAdapter: runMock };

        require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));
        return { dom, runMock };
    }

    test('victim (black, local) cannot cancel DESTROY_ONE_STONE pending in local mode', () => {
        const { runMock } = setupCancelTest({
            localPlayerKey: 'black',
            currentPlayer: 'black',
            fateWillController: { black: 'white', white: null },  // white controls black's turn
            matchMode: 'cpu'
        });
        global.cardState.pendingEffectByPlayer.black = {
            type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget'
        };

        global.window.cancelPendingSelection('black');

        // Victim must not dispatch cancel_card
        expect(runMock).not.toHaveBeenCalled();
    });

    test('victim (white, network) cannot cancel DESTROY_ONE_STONE pending in network mode', () => {
        const { runMock } = setupCancelTest({
            localPlayerKey: 'white',
            currentPlayer: 'white',
            fateWillController: { black: null, white: 'black' },  // black controls white's turn
            matchMode: 'network'
        });
        global.cardState.pendingEffectByPlayer.white = {
            type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget'
        };

        global.window.cancelPendingSelection('white');

        // Victim must not dispatch cancel_card
        expect(runMock).not.toHaveBeenCalled();
    });

    test('controller (black) can cancel victim (white) DESTROY_ONE_STONE pending in local mode', () => {
        const { runMock } = setupCancelTest({
            localPlayerKey: 'black',
            currentPlayer: 'white',
            fateWillController: { black: null, white: 'black' },  // black controls white's turn
            matchMode: 'cpu'
        });
        global.cardState.pendingEffectByPlayer.white = {
            type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget'
        };

        global.window.cancelPendingSelection();  // no specificPlayerKey → controller path

        // Controller should dispatch cancel_card
        expect(runMock).toHaveBeenCalled();
    });

    test('victim (black, local) cannot cancel POSITION_SWAP_WILL pending in local mode', () => {
        const { runMock } = setupCancelTest({
            localPlayerKey: 'black',
            currentPlayer: 'black',
            fateWillController: { black: 'white', white: null },
            matchMode: 'cpu'
        });
        global.cardState.pendingEffectByPlayer.black = {
            type: 'POSITION_SWAP_WILL', cardId: 'swap_01', stage: 'selectTarget'
        };

        global.window.cancelPendingSelection('black');

        expect(runMock).not.toHaveBeenCalled();
    });

    test('normal turn: player can cancel their own pending without FATE_WILL', () => {
        const { runMock } = setupCancelTest({
            localPlayerKey: 'black',
            currentPlayer: 'black',
            fateWillController: { black: null, white: null },
            matchMode: 'cpu'
        });
        global.cardState.pendingEffectByPlayer.black = {
            type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget'
        };

        global.window.cancelPendingSelection('black');

        expect(runMock).toHaveBeenCalled();
    });
});

// ===== HvH mode: controller-seat alignment with renderer =====
// These tests prove that card-interaction and the renderer agree on who the input player is
// during a FATE_WILL controlled turn in HvH mode (same device).

describe('FATE_WILL UI: HvH controller-seat alignment', () => {
    function setupHvHTest({ currentPlayer, fateWillController }) {
        jest.resetModules();
        const dom = makeDom();
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.WHITE = -1;

        global.gameState = {
            currentPlayer: currentPlayer === 'black' ? 1 : -1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        };
        global.cardState = makeBaseCardState({ fateWillControllerByTurnOwner: fateWillController });

        dom.window.DEBUG_HUMAN_VS_HUMAN = true;

        global.CardLogic = {
            getCardDef: (id) => ({ id, name: id, desc: id, cost: 0, type: 'TEST' }),
            getUsableCardIds: () => ['white_card', 'black_card'],
            canUseCard: () => true,
            getCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
            getSelectableTargets: () => []
        };
        global.Core = { getLegalMoves: () => [] };
        global.renderCardUI = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.ensureCurrentPlayerCanActOrPass = jest.fn();
        global.addLog = jest.fn();
        global.processPassTurn = jest.fn();

        const runMock = jest.fn(() => ({
            ok: true,
            nextCardState: global.cardState,
            nextGameState: global.gameState,
            playbackEvents: []
        }));
        global.ActionManager = {
            ActionManager: {
                createAction: (t, p, x) => ({ type: t, player: p, ...(x || {}) }),
                recordAction: jest.fn(),
                incrementTurnIndex: jest.fn()
            }
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = { runTurnWithAdapter: runMock };

        require(path.resolve(__dirname, '..', 'cards', 'card-interaction.js'));
        return { dom, runMock };
    }

    test('HvH: controller (black) destroySelectedHandCard uses controller key for auth, victim key for card', () => {
        // White's turn, black controls via FATE_WILL in HvH mode.
        // Render side: inputPlayerKey = controller (black). Action side must match.
        const { runMock } = setupHvHTest({
            currentPlayer: 'white',
            fateWillController: { black: null, white: 'black' }
        });
        global.cardState.selectedCardId = 'white_card';
        global.cardState.selectedCardOwnerKey = 'white';

        global.window.destroySelectedHandCard();

        // Auth must be controller's key (black), not victim's (white).
        expect(runMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({ type: 'destroy_hand_card', destroyCardId: 'white_card' }),
            expect.anything()
        );
    });

    test('HvH: controller (black) passCurrentTurn uses controller key on victim (white) turn', () => {
        // White's turn, black controls via FATE_WILL in HvH mode.
        const { } = setupHvHTest({
            currentPlayer: 'white',
            fateWillController: { black: null, white: 'black' }
        });

        global.window.passCurrentTurn();

        // Pass must carry the controller's key, not the victim's.
        expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    });

    test('HvH: controller (black) can click victim (white) card and selection is set on victim', () => {
        // White's turn, black controls via FATE_WILL in HvH mode.
        setupHvHTest({
            currentPlayer: 'white',
            fateWillController: { black: null, white: 'black' }
        });

        global.window.onCardClick('white_card', 'white');

        expect(global.cardState.selectedCardId).toBe('white_card');
        expect(global.cardState.selectedCardOwnerKey).toBe('white');
    });

    test('HvH: normal black turn without FATE_WILL is unaffected', () => {
        // Black's turn, no FATE_WILL.
        const { runMock } = setupHvHTest({
            currentPlayer: 'black',
            fateWillController: { black: null, white: null }
        });
        global.cardState.selectedCardId = 'black_card';
        global.cardState.selectedCardOwnerKey = 'black';

        global.window.destroySelectedHandCard();

        expect(runMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'black',
            expect.objectContaining({ type: 'destroy_hand_card', destroyCardId: 'black_card' }),
            expect.anything()
        );
    });

    test('HvH: normal white turn without FATE_WILL is unaffected', () => {
        // White's turn, no FATE_WILL — white should be able to click own card.
        setupHvHTest({
            currentPlayer: 'white',
            fateWillController: { black: null, white: null }
        });

        global.window.onCardClick('white_card', 'white');

        expect(global.cardState.selectedCardId).toBe('white_card');
        expect(global.cardState.selectedCardOwnerKey).toBe('white');
    });
});
