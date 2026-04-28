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
describe('initializeUI action button binding', () => {
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <button id="destroy-card-btn">破壊</button>
      <button id="use-card-btn">使用</button>
    </body></html>`);
        global.window = dom.window;
        global.document = dom.window.document;
        global.destroySelectedHandCard = jest.fn();
        global.useSelectedCard = jest.fn();
        global.cardState = { selectedCardId: null };
        global.CardLogic = {
            getCardDef: jest.fn(() => ({ type: 'WORK_WILL' }))
        };
        global.SoundEngine = {
            primeEffectSounds: jest.fn(),
            init: jest.fn(),
            playEffectByKey: jest.fn()
        };
        global.resetGame = jest.fn();
        const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
        jest.doMock(bootstrapPath, () => ({
            installGameDI: jest.fn()
        }), { virtual: false });
    });
    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.destroySelectedHandCard;
        delete global.useSelectedCard;
        delete global.cardState;
        delete global.CardLogic;
        delete global.SoundEngine;
        delete global.resetGame;
    });
    test('UI初期化時に効果音を先読みする', () => {
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        expect(global.SoundEngine.primeEffectSounds).toHaveBeenCalledTimes(1);
        expect(global.SoundEngine.init).not.toHaveBeenCalled();
        expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
    });
    test('破壊ボタン押下で既存処理を呼ぶ', () => {
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        document.getElementById('destroy-card-btn').click();
        expect(global.SoundEngine.init).not.toHaveBeenCalled();
        expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
        expect(global.destroySelectedHandCard).toHaveBeenCalledTimes(1);
    });
    test('通常カードの使用ボタン押下では既存処理だけを呼ぶ', () => {
        global.cardState.selectedCardId = 'WORK_WILL_001';
        global.CardLogic.getCardDef.mockReturnValue({ id: 'WORK_WILL_001', type: 'WORK_WILL' });
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        document.getElementById('use-card-btn').click();
        expect(global.SoundEngine.init).not.toHaveBeenCalled();
        expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
        expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
    });
    test('宝箱カードの使用ボタン押下でも既存処理だけを呼ぶ', () => {
        global.cardState.selectedCardId = 'TREASURE_BOX_001';
        global.CardLogic.getCardDef.mockReturnValue({ id: 'TREASURE_BOX_001', type: 'TREASURE_BOX' });
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        document.getElementById('use-card-btn').click();
        expect(global.SoundEngine.init).not.toHaveBeenCalled();
        expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalledWith('card_use_button');
        expect(global.useSelectedCard).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=ui.init.action-button-binding.test.js.map