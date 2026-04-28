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
describe('ui/move-executor-visuals instant hyperactive placement sync', () => {
    let originalGlobals = null;
    let dom = null;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body><div id="board"></div><div id="card-fx-layer"></div></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        global.boardEl = document.getElementById('board');
        global.BLACK = 1;
        global.WHITE = -1;
        global.LOG_MESSAGES = {
            placedWithFlips: jest.fn(() => 'placed'),
            regenTriggered: jest.fn(() => 'regen'),
            regenCapture: jest.fn(() => 'regen-capture')
        };
        global.addLog = jest.fn();
        global.posToNotation = jest.fn(() => 'D3');
        global.getPlayerName = jest.fn(() => 'black');
        global.logPlacementEffects = jest.fn();
        global.resetRenderStats = jest.fn();
        global.BoardUpdateDispatch = { requestBoardUpdate: jest.fn() };
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        originalGlobals = {
            windowMoveActive: window.__moveVisualSequenceActive
        };
    });
    afterEach(() => {
        jest.resetModules();
        const activeWindow = global.window;
        if (activeWindow && originalGlobals && originalGlobals.windowMoveActive === undefined) {
            delete activeWindow.__moveVisualSequenceActive;
        }
        else if (activeWindow && originalGlobals) {
            activeWindow.__moveVisualSequenceActive = originalGlobals.windowMoveActive;
        }
        if (dom && typeof dom.window.close === 'function')
            dom.window.close();
        delete global.window;
        delete global.document;
        delete global.boardEl;
        delete global.BLACK;
        delete global.WHITE;
        delete global.LOG_MESSAGES;
        delete global.addLog;
        delete global.posToNotation;
        delete global.getPlayerName;
        delete global.logPlacementEffects;
        delete global.resetRenderStats;
        delete global.BoardUpdateDispatch;
        delete global.emitCardStateChange;
        delete global.emitGameStateChange;
        delete global.animateHyperactiveMove;
    });
    test('syncs placed cell before animating an immediate hyperactive move', async () => {
        const syncDiscVisualToCurrentState = jest.fn();
        const animateHyperactiveMove = jest.fn(async () => { });
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'), () => ({
            syncDiscVisualToCurrentState,
            setDiscColorAt: jest.fn(),
            removeBombOverlayAt: jest.fn(),
            clearAllStoneVisualEffectsAt: jest.fn()
        }));
        jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-utils.js'), () => ({
            animateHyperactiveMove,
            animateFadeOutAt: jest.fn(async () => { }),
            animateDestroyAt: jest.fn(async () => { })
        }));
        global.animateHyperactiveMove = animateHyperactiveMove;
        const visuals = require(path.resolve(__dirname, '..', 'ui', 'move-executor-visuals.js'));
        await visuals.runMoveVisualSequence({ row: 2, col: 3, player: 1 }, false, { primaryFlips: [], chainFlips: [], regenCaptureFlips: [], regened: [] }, { hyperactivePlaced: true, instantHyperactivePlaced: true }, { hyperactiveMoved: [{ from: { row: 2, col: 3 }, to: { row: 1, col: 2 } }] });
        expect(syncDiscVisualToCurrentState).toHaveBeenCalledWith(2, 3);
        expect(animateHyperactiveMove).toHaveBeenCalledWith({ row: 2, col: 3 }, { row: 1, col: 2 });
        expect(syncDiscVisualToCurrentState.mock.invocationCallOrder[0]).toBeLessThan(animateHyperactiveMove.mock.invocationCallOrder[0]);
    });
});
//# sourceMappingURL=ui.move-executor-visuals.instant-hyperactive.test.js.map