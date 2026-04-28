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
describe('shared/ui-bootstrap-shared', () => {
    const sharedPath = path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js');
    afterEach(() => {
        jest.resetModules();
        try {
            delete global.__uiImpl_turn_manager;
        }
        catch (e) { /* ignore */ }
        try {
            delete global.SharedUIBootstrap;
        }
        catch (e) { /* ignore */ }
    });
    test('register and get work', () => {
        jest.isolateModules(() => {
            const shared = require(sharedPath);
            const result = shared.registerUIGlobals({ a: 1 });
            expect(result.a).toBe(1);
            expect(shared.getRegisteredUIGlobals()).toEqual(expect.objectContaining({ a: 1 }));
        });
    });
    test('resolves playback runtime modules through the shared resolver', () => {
        const playbackStateMock = {
            setBusyState: jest.fn()
        };
        const playbackRuntimeMock = {
            syncLegacyWindowFlags: jest.fn()
        };
        jest.isolateModules(() => {
            jest.doMock(path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js'), () => playbackStateMock, { virtual: false });
            jest.doMock(path.resolve(__dirname, '..', 'ui', 'playback-runtime.js'), () => playbackRuntimeMock, { virtual: false });
            const shared = require(sharedPath);
            expect(shared.resolvePlaybackStateManager()).toBe(playbackStateMock);
            expect(shared.resolvePlaybackRuntime()).toBe(playbackRuntimeMock);
        });
    });
    test('mergeUIImpl syncs the turn-manager impl to root and globalThis', () => {
        jest.isolateModules(() => {
            const shared = require(sharedPath);
            const root = {};
            const buildCardInitOptions = jest.fn(() => ({ initialDeckSpec: null }));
            const merged = shared.mergeUIImpl(root, 'turn_manager', { buildCardInitOptions });
            expect(merged.buildCardInitOptions).toBe(buildCardInitOptions);
            expect(root.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
            expect(global.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
            expect(shared.readUIImpl(root, 'turn_manager').buildCardInitOptions).toBe(buildCardInitOptions);
        });
    });
});
//# sourceMappingURL=ui.bootstrap-shared.test.js.map