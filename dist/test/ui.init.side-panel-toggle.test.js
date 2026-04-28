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
describe('initializeUI side panel toggle', () => {
    let consoleErrorSpy;
    beforeEach(() => {
        jest.resetModules();
        const dom = new jsdom_1.JSDOM(`<!doctype html><html><body>
      <div id="side-panel">
        <button id="sidePanelToggleBtn" type="button" aria-controls="control-panel" aria-expanded="true">−</button>
        <div id="control-panel"></div>
        <div id="log"></div>
        <div id="discard-display"></div>
      </div>
    </body></html>`);
        global.window = dom.window;
        global.document = dom.window.document;
        global.resetGame = jest.fn();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
        jest.doMock(bootstrapPath, () => ({
            installGameDI: jest.fn()
        }), { virtual: false });
    });
    afterEach(() => {
        if (consoleErrorSpy) {
            consoleErrorSpy.mockRestore();
            consoleErrorSpy = null;
        }
        delete global.window;
        delete global.document;
        delete global.resetGame;
    });
    function sawResetGameThrowLog() {
        return consoleErrorSpy.mock.calls.some((args) => args.some((value) => String(value || '').includes('[init] resetGame threw')));
    }
    test('初期表示は展開状態で、ボタン押下で折りたたみ/再展開できる', () => {
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        const sidePanel = document.getElementById('side-panel');
        const toggleBtn = document.getElementById('sidePanelToggleBtn');
        expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
        expect(toggleBtn.textContent).toBe('−');
        toggleBtn.click();
        expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
        expect(toggleBtn.textContent).toBe('＋');
        toggleBtn.click();
        expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
        expect(toggleBtn.textContent).toBe('−');
        expect(sawResetGameThrowLog()).toBe(false);
    });
    test('iPhone縦プロファイルでは初期表示を折りたたみ状態にする', () => {
        document.documentElement.classList.add('layout-profile-phone-portrait');
        document.documentElement.setAttribute('data-layout-profile', 'layout-profile-phone-portrait');
        import * as initModule from '../ui/handlers/init.js';
        initModule.initializeUI();
        const sidePanel = document.getElementById('side-panel');
        const toggleBtn = document.getElementById('sidePanelToggleBtn');
        expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(true);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
        expect(toggleBtn.textContent).toBe('＋');
        toggleBtn.click();
        expect(sidePanel.classList.contains('side-panel-collapsed')).toBe(false);
        expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
        expect(toggleBtn.textContent).toBe('−');
        expect(sawResetGameThrowLog()).toBe(false);
    });
});
//# sourceMappingURL=ui.init.side-panel-toggle.test.js.map