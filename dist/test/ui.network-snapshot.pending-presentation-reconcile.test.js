"use strict";
function createBaseCardState() {
    return {
        selectedCardId: null,
        selectedCardOwnerKey: null,
        hands: { black: [], white: [] },
        charge: { black: 10, white: 10 },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        lastUsedCardByPlayer: { black: null, white: null },
        markers: [],
        discard: [],
        turnIndex: 1,
        presentationEvents: [],
        _presentationEventsPersist: []
    };
}
function createBoard(rows = 8, cols = 8) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}
function createSnapshot(stateVersion, options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const gameStateOverrides = (opts.gameState && typeof opts.gameState === 'object')
        ? opts.gameState
        : {};
    return {
        stateVersion,
        _meta: {
            authority: 'server',
            version: stateVersion,
            projectedForSeat: null,
            turnStartReconciled: true
        },
        gameState: {
            currentPlayer: 1,
            turnNumber: stateVersion,
            board: opts.board || createBoard(8, 8),
            ...gameStateOverrides
        },
        cardState: createBaseCardState()
    };
}
function createPlaybackBatch(phase) {
    return [{
            type: 'PLAYBACK_EVENTS',
            events: [{ type: 'flip', phase, targets: [{ r: 2, col: 3 }] }]
        }];
}
describe('network snapshot pending presentation reconcile', () => {
    let busyStateCalls;
    let playbackActive;
    beforeEach(() => {
        jest.resetModules();
        const initial = createSnapshot(10);
        global.gameState = initial.gameState;
        global.cardState = initial.cardState;
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.renderCardUI = jest.fn();
        global.VisualPlaybackActive = false;
        global.__playbackActiveSince = null;
        global.isProcessing = false;
        global.isCardAnimating = false;
        busyStateCalls = [];
        playbackActive = false;
    });
    afterEach(() => {
        delete global.gameState;
        delete global.cardState;
        delete global.emitCardStateChange;
        delete global.emitGameStateChange;
        delete global.emitBoardUpdate;
        delete global.renderCardUI;
        delete global.BoardOps;
        delete global.VisualPlaybackActive;
        delete global.__playbackActiveSince;
        delete global.isProcessing;
        delete global.isCardAnimating;
        delete global.AnimationEngine;
    });
    function createController(stateObj) {
        import { createNetworkSnapshotController } from '../ui/network/snapshot.js';
        return (0, snapshot_js_1.createNetworkSnapshotController)({
            getState: () => stateObj,
            emitCardStateChange: global.emitCardStateChange,
            emitGameStateChange: global.emitGameStateChange,
            emitBoardUpdate: global.emitBoardUpdate,
            renderCardUI: global.renderCardUI,
            playbackState: {
                setBusyState: jest.fn((flags) => {
                    busyStateCalls.push(flags);
                    global.isProcessing = !!(flags && flags.processing === true);
                    global.isCardAnimating = !!(flags && flags.cardAnimating === true);
                    if (Object.prototype.hasOwnProperty.call(flags || {}, 'playbackActive')) {
                        global.VisualPlaybackActive = !!(flags && flags.playbackActive === true);
                        playbackActive = !!(flags && flags.playbackActive === true);
                        global.__playbackActiveSince = playbackActive ? 123 : null;
                    }
                }),
                abortPlayback: jest.fn(() => {
                    busyStateCalls.push({ abortPlayback: true });
                    global.isProcessing = false;
                    global.isCardAnimating = false;
                    global.VisualPlaybackActive = false;
                    global.__playbackActiveSince = null;
                    playbackActive = false;
                }),
                getProcessing: jest.fn(() => global.isProcessing === true),
                getCardAnimating: jest.fn(() => global.isCardAnimating === true || playbackActive === true),
                getPlaybackActive: jest.fn(() => playbackActive === true),
                getPlaybackStartedAt: jest.fn(() => {
                    const startedAt = Number(global.__playbackActiveSince);
                    return Number.isFinite(startedAt) ? startedAt : null;
                })
            }
        });
    }
    test('restored queues are cleared when refresh leaves stale pending presentation behind', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        const liveQueue = createPlaybackBatch(1);
        const persistQueue = createPlaybackBatch(2);
        global.cardState.presentationEvents = liveQueue.slice();
        global.cardState._presentationEventsPersist = persistQueue.slice();
        const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.presentationEvents).toEqual([]);
        expect(global.cardState._presentationEventsPersist).toEqual([]);
        expect(busyStateCalls).toEqual([
            { processing: true, cardAnimating: true },
            { processing: false, cardAnimating: false }
        ]);
    });
    test('restored queues stay intact while local busy state is already active', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        const liveQueue = createPlaybackBatch(1);
        const persistQueue = createPlaybackBatch(2);
        global.isProcessing = true;
        global.isCardAnimating = true;
        global.cardState.presentationEvents = liveQueue.slice();
        global.cardState._presentationEventsPersist = persistQueue.slice();
        const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.cardState.presentationEvents).toEqual(liveQueue);
        expect(global.cardState._presentationEventsPersist).toEqual(persistQueue);
        expect(busyStateCalls).toEqual([
            { processing: true, cardAnimating: true }
        ]);
    });
    test('force snapshot clears stale playback lock when no new playback exists and engine is idle', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        playbackActive = true;
        global.VisualPlaybackActive = true;
        global.__playbackActiveSince = 100;
        global.AnimationEngine = { isPlaying: false };
        const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(playbackActive).toBe(false);
        expect(global.VisualPlaybackActive).toBe(false);
        expect(busyStateCalls).toEqual([
            { processing: false, cardAnimating: false },
            { abortPlayback: true }
        ]);
    });
    test('force snapshot keeps playback lock while engine still reports active playback', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        playbackActive = true;
        global.VisualPlaybackActive = true;
        global.__playbackActiveSince = 100;
        global.AnimationEngine = { isPlaying: true };
        const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(playbackActive).toBe(true);
        expect(global.VisualPlaybackActive).toBe(true);
        expect(busyStateCalls).toEqual([
            { processing: false, cardAnimating: false }
        ]);
    });
    test('undrained playback stays locked until a later drain claims ownership', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        global.BoardOps = {
            emitPresentationEvent: jest.fn((cardStateRef, event) => {
                if (!Array.isArray(cardStateRef.presentationEvents))
                    cardStateRef.presentationEvents = [];
                if (!Array.isArray(cardStateRef._presentationEventsPersist))
                    cardStateRef._presentationEventsPersist = [];
                cardStateRef.presentationEvents.push(event);
                cardStateRef._presentationEventsPersist.push(event);
            })
        };
        global.emitBoardUpdate = jest.fn(() => true);
        const applied = ctrl.applySnapshot(createSnapshot(11), {
            playbackEvents: createPlaybackBatch(3)
        });
        expect(applied).toBe(true);
        expect(global.isProcessing).toBe(true);
        expect(global.isCardAnimating).toBe(true);
        expect(global.VisualPlaybackActive).toBe(true);
        expect(global.cardState.presentationEvents).toHaveLength(1);
        expect(global.cardState.presentationEvents[0].type).toBe('PLAYBACK_EVENTS');
        expect(global.cardState._presentationEventsPersist).toHaveLength(1);
        expect(global.cardState._presentationEventsPersist[0].type).toBe('PLAYBACK_EVENTS');
        expect(busyStateCalls).toEqual([
            { processing: true, cardAnimating: true },
            { processing: true, cardAnimating: true, playbackActive: true }
        ]);
    });
    test('force snapshot drops preserved queues when board geometry changes on custom board sync', () => {
        const stateObj = { stateVersion: 10 };
        const ctrl = createController(stateObj);
        const liveQueue = createPlaybackBatch(1);
        const persistQueue = createPlaybackBatch(2);
        global.cardState.presentationEvents = liveQueue.slice();
        global.cardState._presentationEventsPersist = persistQueue.slice();
        const applied = ctrl.applySnapshot(createSnapshot(11, {
            board: createBoard(7, 9),
            gameState: {
                boardConfig: { rows: 7, cols: 9, standard8x8: false }
            }
        }), { playbackEvents: [] });
        expect(applied).toBe(true);
        expect(global.gameState.board).toHaveLength(7);
        expect(global.gameState.board[0]).toHaveLength(9);
        expect(global.cardState.presentationEvents).toEqual([]);
        expect(global.cardState._presentationEventsPersist).toEqual([]);
        expect(busyStateCalls).toEqual([
            { processing: false, cardAnimating: false }
        ]);
    });
});
//# sourceMappingURL=ui.network-snapshot.pending-presentation-reconcile.test.js.map