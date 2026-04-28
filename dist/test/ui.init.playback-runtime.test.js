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
const jsdom_1 = require("jsdom");
describe('initializeUI playback runtime delegation', () => {
    let dom;
    let playbackStateMock;
    let playbackRuntimeMock;
    let busyState;
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', {
            url: 'https://example.com/?debug=1'
        });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.resetGame = jest.fn();
        global.watchdogPing = jest.fn();
        busyState = {
            cardAnimating: false,
            processing: false
        };
        playbackStateMock = {
            getCardAnimating: jest.fn(() => busyState.cardAnimating === true),
            getProcessing: jest.fn(() => busyState.processing === true),
            setBusyState: jest.fn((config) => {
                if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
                    busyState.cardAnimating = config.cardAnimating === true;
                    global.window.isCardAnimating = busyState.cardAnimating;
                }
                if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
                    busyState.processing = config.processing === true;
                    global.window.isProcessing = busyState.processing;
                }
                return {
                    isCardAnimating: busyState.cardAnimating,
                    isProcessing: busyState.processing
                };
            }),
            syncLegacyWindowFlags: jest.fn(),
            ensureDebugRuntime: jest.fn()
        };
        playbackRuntimeMock = {
            syncLegacyWindowFlags: jest.fn((playbackState, { readCardAnimating, readProcessing } = {}) => {
                expect(playbackState).toBe(playbackStateMock);
                if (typeof readCardAnimating === 'function') {
                    global.window.isCardAnimating = readCardAnimating() === true;
                }
                if (typeof readProcessing === 'function') {
                    global.window.isProcessing = readProcessing() === true;
                }
                return {
                    isCardAnimating: global.window.isCardAnimating === true,
                    isProcessing: global.window.isProcessing === true,
                    playbackActive: false
                };
            }),
            ensureDebugRuntime: jest.fn((playbackState, options) => {
                expect(playbackState).toBe(playbackStateMock);
                expect(options).toEqual(expect.objectContaining({
                    readCardAnimating: expect.any(Function),
                    readProcessing: expect.any(Function),
                    abortPlayback: expect.any(Function),
                    getBoardElement: expect.any(Function)
                }));
                return { mirrorIntervalId: null, playbackWatchdogId: null };
            })
        };
        const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
        jest.doMock(bootstrapPath, () => ({
            installGameDI: jest.fn()
        }), { virtual: false });
        const playbackStatePath = path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js');
        jest.doMock(playbackStatePath, () => playbackStateMock, { virtual: false });
        const playbackRuntimePath = path.resolve(__dirname, '..', 'ui', 'playback-runtime.js');
        jest.doMock(playbackRuntimePath, () => playbackRuntimeMock, { virtual: false });
    });
    afterEach(() => {
        try {
            if (global.window && global.window._watchdogIntervalId) {
                clearInterval(global.window._watchdogIntervalId);
                global.window._watchdogIntervalId = null;
            }
        }
        catch (e) { /* ignore */ }
        if (dom && dom.window)
            dom.window.close();
        delete global.window;
        delete global.document;
        delete global.location;
        delete global.resetGame;
        delete global.watchdogPing;
        jest.useRealTimers();
    });
    test('delegates debug playback runtime setup to PlaybackRuntime', async () => {
        import * as initModule from '../ui/handlers/init.js';
        await initModule.initializeUI();
        expect(playbackRuntimeMock.syncLegacyWindowFlags).toHaveBeenCalled();
        expect(playbackRuntimeMock.ensureDebugRuntime).toHaveBeenCalled();
        expect(playbackStateMock.syncLegacyWindowFlags).not.toHaveBeenCalled();
        expect(playbackStateMock.ensureDebugRuntime).not.toHaveBeenCalled();
        expect(global.window._uiMirrorIntervalId).toBeUndefined();
        expect(global.window._playbackWatchdogId).toBeUndefined();
        expect(global.window._watchdogIntervalId).toBeDefined();
    });
    test('uses PlaybackStateManager to clear no-anim busy flags', async () => {
        busyState.cardAnimating = true;
        busyState.processing = true;
        global.window.DISABLE_ANIMATIONS = true;
        import * as initModule from '../ui/handlers/init.js';
        await initModule.initializeUI();
        expect(playbackStateMock.setBusyState).toHaveBeenCalledWith(expect.objectContaining({
            cardAnimating: false,
            processing: false
        }));
        expect(global.window.isCardAnimating).toBe(false);
        expect(global.window.isProcessing).toBe(false);
    });
});
//# sourceMappingURL=ui.init.playback-runtime.test.js.map