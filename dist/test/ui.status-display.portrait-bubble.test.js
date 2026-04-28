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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jsdom_1 = require("jsdom");
function bindDynamicBubbleRect(element) {
    element.getBoundingClientRect = () => {
        const maxWidth = Number.parseFloat(element.style.maxWidth) || 420;
        const contentWidth = Math.max(140, Math.ceil(String(element.textContent || '').length * 7.2) + 24);
        const width = Math.min(maxWidth, contentWidth);
        const height = 62;
        const centerX = Number.parseFloat(element.style.left) || 0;
        const bottom = Number.parseFloat(element.style.top) || 0;
        return {
            left: centerX - (width / 2),
            top: bottom - height,
            right: centerX + (width / 2),
            bottom,
            width,
            height
        };
    };
}
function setupPortraitBubbleDom() {
    const dom = new jsdom_1.JSDOM('<!doctype html><html><body>' +
        '<div id="board-frame"></div>' +
        '<div id="cpu-character-panel"></div>' +
        '<img id="cpu-character-img" />' +
        '<div id="hero-character-panel"></div>' +
        '<img id="hero-character-img" />' +
        '</body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
    const { window } = dom;
    const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
    const code = fs.readFileSync(jsPath, 'utf8');
    const boardFrame = window.document.getElementById('board-frame');
    const heroImg = window.document.getElementById('hero-character-img');
    const cpuImg = window.document.getElementById('cpu-character-img');
    const nativeAppendChild = window.document.body.appendChild.bind(window.document.body);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    heroImg.setAttribute('src', 'hero.png');
    cpuImg.setAttribute('src', 'cpu.png');
    boardFrame.getBoundingClientRect = () => ({
        left: 356,
        top: 110,
        width: 404,
        height: 404,
        right: 760,
        bottom: 514
    });
    heroImg.getBoundingClientRect = () => ({
        left: 90,
        top: 590,
        width: 210,
        height: 140,
        right: 300,
        bottom: 730
    });
    cpuImg.getBoundingClientRect = () => ({
        left: 812,
        top: 70,
        width: 140,
        height: 140,
        right: 952,
        bottom: 210
    });
    window.document.body.appendChild = (node) => {
        if (node && (node.id === 'hero-speech-bubble' || node.id === 'cpu-speech-bubble')) {
            bindDynamicBubbleRect(node);
        }
        return nativeAppendChild(node);
    };
    global.window = window;
    global.document = window.document;
    window.eval(code);
    return { dom, window, boardFrame };
}
function teardownPortraitBubbleDom(dom) {
    delete global.window;
    delete global.document;
    if (dom && dom.window)
        dom.window.close();
}
describe('status-display portrait commentary bubbles', () => {
    test('showPortraitSpeechBubble only resets the same speaker role', () => {
        const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
        const js = fs.readFileSync(jsPath, 'utf8');
        expect(js).toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(config\.role\);/);
        expect(js).not.toMatch(/function\s+showPortraitSpeechBubble[\s\S]*hidePortraitSpeechBubble\(\);/);
    });
    test('keeps hero and cpu portrait bubbles outside the board on tablet widths', () => {
        const { dom, window, boardFrame } = setupPortraitBubbleDom();
        try {
            const line = 'よし、言っとくけど盤面の機嫌がこっち向いてる。このくらいなら片手で読めるし、このまま先回りして終わらせる。';
            const boardRect = boardFrame.getBoundingClientRect();
            window.showHeroSpeechBubble(line);
            const heroBubble = window.document.getElementById('hero-speech-bubble');
            expect(heroBubble).not.toBeNull();
            expect(heroBubble.getBoundingClientRect().right).toBeLessThanOrEqual(boardRect.left - 12);
            window.showCpuSpeechBubble(line);
            const cpuBubble = window.document.getElementById('cpu-speech-bubble');
            expect(cpuBubble).not.toBeNull();
            expect(cpuBubble.getBoundingClientRect().left).toBeGreaterThanOrEqual(boardRect.right + 12);
        }
        finally {
            teardownPortraitBubbleDom(dom);
        }
    });
});
//# sourceMappingURL=ui.status-display.portrait-bubble.test.js.map