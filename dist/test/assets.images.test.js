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
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
describe('stone image assets', () => {
    const stonesDir = path.join(__dirname, '..', 'assets', 'images', 'stones');
    it('includes the normal stone PNGs', () => {
        assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-black.png')));
        assert.ok(fs.existsSync(path.join(stonesDir, 'normal_stone-white.png')));
    });
    test('includes the TIME_STOP stone PNGs', () => {
        assert.ok(fs.existsSync(path.join(stonesDir, 'TIME_STOP-black.png')));
        assert.ok(fs.existsSync(path.join(stonesDir, 'TIME_STOP-white.png')));
    });
    it('includes the promoted strongest-stone PNGs used after 強い意志 evolves', () => {
        assert.ok(fs.existsSync(path.join(stonesDir, 'absolute_protect_next_stone-black.png')));
        assert.ok(fs.existsSync(path.join(stonesDir, 'absolute_protect_next_stone-white.png')));
    });
    it('declares CSS variables for the normal stone images', () => {
        const variablesCss = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
        assert.ok(variablesCss.includes('--normal-stone-black-image'));
        assert.ok(variablesCss.includes('--normal-stone-white-image'));
    });
    it('uses the shared render skeleton hooks in board styles', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        assert.ok(boardCss.includes('.disc[data-render-mode="overlay"] .disc__overlay-image'));
        assert.ok(boardCss.includes('.disc[data-render-mode="replace"] .disc__overlay-image'));
    });
    it('includes a rule to hide base backgrounds when stone images are loaded', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        assert.ok(boardCss.includes('html.stone-images-loaded .disc.black'));
        assert.ok(boardCss.includes('html.stone-images-loaded .disc.white'));
    });
    it('keeps the stone-images-loaded compatibility selectors for black/white discs', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        assert.ok(boardCss.includes('html.stone-images-loaded .disc.black'));
        assert.ok(boardCss.includes('html.stone-images-loaded .disc.white'));
    });
    it('keeps HUD layers above image overlays in the shared skeleton', () => {
        const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        assert.ok(boardCss.includes('.disc__hud'));
        assert.ok(boardCss.includes('z-index: 40'));
        assert.ok(boardCss.includes('.disc.stone-fade-overlay'));
        assert.ok(boardCss.includes('z-index: 20'));
    });
});
//# sourceMappingURL=assets.images.test.js.map