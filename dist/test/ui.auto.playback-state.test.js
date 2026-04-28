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
describe('setupAutoToggle playback-state gating', () => {
    let dom;
    let playbackStateMock;
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body><button id="autoToggleBtn">AUTO</button></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.BLACK = 1;
        global.gameState = { currentPlayer: 1, turnNumber: 3 };
        global.cardState = { presentationEvents: [], _presentationEventsPersist: [] };
        global.isProcessing = false;
        global.isCardAnimating = false;
        global.processAutoBlackTurn = jest.fn();
        global.addLog = jest.fn();
        global.window.isProcessing = false;
        global.window.isCardAnimating = false;
        global.window.VisualPlaybackActive = false;
        playbackStateMock = {
            getPlaybackActive: jest.fn(() => true),
            getCardAnimating: jest.fn(() => false)
        };
        const playbackStatePath = path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js');
        jest.doMock(playbackStatePath, () => playbackStateMock, { virtual: false });
        const autoModulePath = path.resolve(__dirname, '..', 'game', 'auto.js');
        jest.doMock(autoModulePath, () => ({
            isEnabled: jest.fn(() => false),
            disable: jest.fn()
        }), { virtual: false });
    });
    afterEach(() => {
        try {
            if (global.window && typeof global.window.disableAutoMode === 'function') {
                global.window.disableAutoMode();
            }
        }
        catch (e) { /* ignore */ }
        if (dom && dom.window)
            dom.window.close();
        delete global.window;
        delete global.document;
        delete global.BLACK;
        delete global.gameState;
        delete global.cardState;
        delete global.isProcessing;
        delete global.isCardAnimating;
        delete global.processAutoBlackTurn;
        delete global.addLog;
        jest.useRealTimers();
    });
    test('blocks auto turns when the playback manager reports active playback', () => {
        import * as autoModule from '../ui/handlers/auto.js';
        const button = document.getElementById('autoToggleBtn');
        autoModule.setupAutoToggle(button);
        button.click();
        jest.advanceTimersByTime(800);
        expect(playbackStateMock.getPlaybackActive).toHaveBeenCalled();
        expect(global.window.VisualPlaybackActive).toBe(false);
        expect(global.window.isCardAnimating).toBe(false);
        expect(global.processAutoBlackTurn).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=ui.auto.playback-state.test.js.map