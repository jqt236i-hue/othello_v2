"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
describe('SWAP_WITH_ENEMY selection turn handoff', () => {
    const swapPath = path.resolve(__dirname, '..', 'game', 'card-effects', 'swap.js');
    const presentationPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        jest.doMock(presentationPath, () => ({
            emitPresentationEvent: jest.fn(() => true)
        }), { virtual: false });
        delete require.cache[swapPath];
        global.BLACK = 1;
        global.WHITE = -1;
        global.CPU_TURN_DELAY_MS = 0;
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.cardState = {
            turnIndex: 4,
            pendingEffectByPlayer: {
                black: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' },
                white: null
            }
        };
        global.gameState = {
            currentPlayer: global.BLACK,
            turnNumber: 11
        };
        global.ActionManager = {
            ActionManager: {
                createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
            }
        };
        global.TurnPipeline = {};
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                rawEvents: [{ type: 'swap_selected', swapped: true }],
                nextCardState: {
                    ...global.cardState,
                    pendingEffectByPlayer: { black: null, white: null }
                },
                nextGameState: {
                    ...global.gameState,
                    currentPlayer: global.WHITE,
                    turnNumber: 12
                },
                playbackEvents: [{ type: 'status_applied', phase: 1 }]
            }))
        };
        global.LOG_MESSAGES = {
            swapSelectPrompt: jest.fn(() => 'select'),
            swapApplied: jest.fn(() => 'applied')
        };
        global.posToNotation = jest.fn(() => 'c3');
        global.emitLogAdded = jest.fn();
        global.emitCardStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.ensureCurrentPlayerCanActOrPass = jest.fn();
        global.waitForPlaybackIdle = jest.fn(async () => { });
        globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
        global.onTurnStart = jest.fn(async () => ({
            playbackEvents: [{ type: 'draw', phase: 2 }]
        }));
        global.processCpuTurn = jest.fn();
        global.isGameOver = jest.fn(() => false);
        global.NetworkMatchClient = {
            publishSnapshot: jest.fn(),
            isActive: jest.fn(() => true)
        };
        global.MATCH_MODE = 'cpu';
        global.DEBUG_HUMAN_VS_HUMAN = false;
        global.requestAnimationFrame = jest.fn();
        import * as playbackStateManager from '../ui/playback-state-manager.js';
        playbackStateManager.clearPlaybackLock();
        global.PlaybackStateManager = playbackStateManager;
    });
    afterEach(() => {
        jest.useRealTimers();
        delete global.BLACK;
        delete global.WHITE;
        delete global.CPU_TURN_DELAY_MS;
        delete global.isProcessing;
        delete global.isCardAnimating;
        delete global.cardState;
        delete global.gameState;
        delete global.ActionManager;
        delete global.TurnPipeline;
        delete global.TurnPipelineUIAdapter;
        delete global.LOG_MESSAGES;
        delete global.posToNotation;
        delete global.emitLogAdded;
        delete global.emitCardStateChange;
        delete global.emitBoardUpdate;
        delete global.emitGameStateChange;
        delete global.ensureCurrentPlayerCanActOrPass;
        delete global.waitForPlaybackIdle;
        delete global.onTurnStart;
        delete global.processCpuTurn;
        delete global.isGameOver;
        delete global.NetworkMatchClient;
        delete global.MATCH_MODE;
        delete global.DEBUG_HUMAN_VS_HUMAN;
        delete global.requestAnimationFrame;
        delete global.PlaybackStateManager;
        delete globalThis.waitForPlaybackIdle;
    });
    test('keeps busy flags through playback wait, then starts next turn and schedules white CPU', async () => {
        let releasePlayback = null;
        global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
            releasePlayback = resolve;
        }));
        globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
        import { handleSwapSelection } from '../game/card-effects/swap.js';
        const pendingPromise = (0, swap_js_1.handleSwapSelection)(2, 2, 'black');
        await Promise.resolve();
        await Promise.resolve();
        expect(typeof releasePlayback).toBe('function');
        expect(global.isProcessing).toBe(true);
        expect(global.isCardAnimating).toBe(true);
        expect(global.onTurnStart).not.toHaveBeenCalled();
        releasePlayback();
        await pendingPromise;
        expect(global.onTurnStart).toHaveBeenCalledWith(global.WHITE);
        expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
        expect(global.isCardAnimating).toBe(false);
        expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);
        const snapshot = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
        expect(snapshot).toEqual(expect.objectContaining({
            playerKey: 'black',
            actionType: 'place'
        }));
        expect(snapshot.snapshot).toBeUndefined();
        expect(snapshot.playbackEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'status_applied', phase: 1 }),
            expect.objectContaining({ type: 'draw', phase: 2 })
        ]));
        jest.runAllTimers();
        expect(global.processCpuTurn).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=game.swap-selection-turn-handoff.test.js.map