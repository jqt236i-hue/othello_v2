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
describe('status-display network seat labels', () => {
    test('normalizes padded uppercase seat key before applying network labels', () => {
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body>' +
            '<img id="cpu-character-img" />' +
            '<div id="cpu-level-label"></div>' +
            '<div id="hero-label"></div>' +
            '</body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
        const { window } = dom;
        const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
        const code = fs.readFileSync(jsPath, 'utf8');
        window.cpuSmartness = { white: 2 };
        window.CPU_LEVEL_NAMES = { 2: 'CPU Lv2' };
        window.getElement = (key) => {
            const map = {
                cpuCharacterImg: window.document.getElementById('cpu-character-img'),
                cpuLevelLabel: window.document.getElementById('cpu-level-label')
            };
            return map[key] || null;
        };
        window.OwnerHelpers = require('../utils/owner-helpers');
        window.MatchMode = { isNetworkModeActive: () => true };
        window.NetworkMatchClient = {
            getSeatKey: () => ' WHITE ',
            getSeatNames: () => ({ black: '  Alpha  ', white: '  Beta  ' })
        };
        window.Image = class FakeImage {
            set src(value) {
                this._src = value;
                if (typeof this.onload === 'function')
                    this.onload();
            }
            get src() {
                return this._src || '';
            }
        };
        global.window = window;
        global.document = window.document;
        global.cpuSmartness = window.cpuSmartness;
        global.CPU_LEVEL_NAMES = window.CPU_LEVEL_NAMES;
        global.getElement = window.getElement;
        global.Image = window.Image;
        window.eval(code);
        window.updateCpuCharacter();
        expect(window.document.getElementById('hero-label').textContent).toBe('白:Beta');
        expect(window.document.getElementById('cpu-level-label').textContent).toBe('黒:Alpha');
        expect(window.document.getElementById('cpu-character-img').src).toContain('/assets/images/hero/hero.png');
        expect(window.document.getElementById('cpu-character-img').alt).toBe('対戦相手の勇者');
        expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(true);
        delete global.window;
        delete global.document;
        delete global.cpuSmartness;
        delete global.CPU_LEVEL_NAMES;
        delete global.getElement;
        delete global.Image;
        dom.window.close();
    });
    test('keeps cpu portrait unmirrored outside network mode', () => {
        const dom = new jsdom_1.JSDOM('<!doctype html><html><body>' +
            '<img id="cpu-character-img" />' +
            '<div id="cpu-level-label"></div>' +
            '<div id="hero-label"></div>' +
            '</body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
        const { window } = dom;
        const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
        const code = fs.readFileSync(jsPath, 'utf8');
        window.cpuSmartness = { white: 2 };
        window.CPU_LEVEL_NAMES = { 2: 'CPU Lv2' };
        window.getElement = (key) => {
            const map = {
                cpuCharacterImg: window.document.getElementById('cpu-character-img'),
                cpuLevelLabel: window.document.getElementById('cpu-level-label')
            };
            return map[key] || null;
        };
        window.OwnerHelpers = require('../utils/owner-helpers');
        window.MatchMode = { isNetworkModeActive: () => false };
        window.Image = class FakeImage {
            set src(value) {
                this._src = value;
                if (typeof this.onload === 'function')
                    this.onload();
            }
            get src() {
                return this._src || '';
            }
        };
        global.window = window;
        global.document = window.document;
        global.cpuSmartness = window.cpuSmartness;
        global.CPU_LEVEL_NAMES = window.CPU_LEVEL_NAMES;
        global.getElement = window.getElement;
        global.Image = window.Image;
        window.eval(code);
        window.updateCpuCharacter();
        expect(window.document.getElementById('cpu-character-img').classList.contains('is-network-opponent-hero')).toBe(false);
        delete global.window;
        delete global.document;
        delete global.cpuSmartness;
        delete global.CPU_LEVEL_NAMES;
        delete global.getElement;
        delete global.Image;
        dom.window.close();
    });
});
//# sourceMappingURL=ui.status-display.network-seat.test.js.map