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
describe('initializeUI hand skin wiring', () => {
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <button id="handSkinBtn" aria-expanded="false"></button>
      <div id="handSkinPanel" aria-hidden="true">
        <button id="handSkinCloseBtn" type="button"></button>
        <div id="handSkinOptions"></div>
      </div>
      <img id="handImage" src="assets/images/hand-skin/勇者の手.png" alt="" />
    </body></html>`, { url: 'https://example.test/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.resetGame = jest.fn();
        global.SoundEngine = {
            primeEffectSounds: jest.fn()
        };
        global.setupHandSkinControls = jest.fn();
        const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
        jest.doMock(bootstrapPath, () => ({
            installGameDI: jest.fn()
        }), { virtual: false });
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.resetGame;
        delete global.SoundEngine;
        delete global.setupHandSkinControls;
    });
    test('UI初期化時に手スキン設定を接続する', () => {
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        expect(global.setupHandSkinControls).toHaveBeenCalledWith(expect.objectContaining({
            button: document.getElementById('handSkinBtn'),
            panel: document.getElementById('handSkinPanel'),
            closeBtn: document.getElementById('handSkinCloseBtn'),
            optionsEl: document.getElementById('handSkinOptions'),
            handImage: document.getElementById('handImage'),
            root: window
        }));
    });
});
//# sourceMappingURL=ui.init.hand-skin.test.js.map