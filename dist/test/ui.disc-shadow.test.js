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
describe('stone shadow styles', () => {
    test('styles-variables.css contains shadow variables', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-variables.css'), 'utf8');
        expect(css).toMatch(/--stone-shadow-color/);
        expect(css).toMatch(/--stone-shadow-blur/);
        expect(css).toMatch(/--stone-shadow-offset-x/);
        expect(css).toMatch(/--stone-shadow-offset-y/);
        expect(css).toMatch(/--stone-keyline-width/);
        expect(css).toMatch(/--stone-keyline-color/);
        expect(css).toMatch(/--board-shadow-outer/);
        expect(css).toMatch(/--cell-contact-shadow-color/);
        expect(css).toMatch(/--cell-contact-shadow-offset-x/);
    });
    test('styles-stone-shadows.css enables only the canonical cell/disc shadow selectors', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-stone-shadows.css'), 'utf8');
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.cell\.has-disc::before/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::before/);
        expect(css).not.toMatch(/:has\(/);
        expect(css).not.toMatch(/\.disc::after/);
        expect(css).not.toMatch(/special-stone-img/);
        expect(css).not.toMatch(/drop-shadow/);
    });
    test('styles-board.css contains board depth shadow, contact shadow, and disc skeleton', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        const discRootBlock = css.match(/\.disc\s*\{[^}]*\}/);
        expect(css).toMatch(/#board[\s\S]*box-shadow:[\s\S]*var\(--board-shadow-outer\)/);
        expect(css).toMatch(/\.cell\.has-disc::before/);
        expect(css).toMatch(/var\(--cell-contact-shadow-color\)/);
        expect(css).toMatch(/var\(--cell-contact-shadow-offset-x\)/);
        expect(css).toMatch(/\.disc__face/);
        expect(css).toMatch(/\.disc__face::after/);
        expect(css).toMatch(/\.disc__base-image/);
        expect(css).toMatch(/\.disc__overlay-image/);
        expect(css).toMatch(/\.disc__hud/);
        expect(css).toMatch(/html\.stone-shadow-enabled\s+\.disc::before/);
        expect(css).toMatch(/--disc-base-fallback-color/);
        expect(css).toMatch(/\.disc\[data-image-state=\"loaded\"\]\s+\.disc__face/);
        expect(css).toMatch(/\.disc\[data-image-state=\"fallback\"\]\.black/);
        expect(discRootBlock).not.toBeNull();
        expect(discRootBlock[0]).not.toMatch(/transition:/);
        expect(css).not.toMatch(/html\.stone-shadow-enabled\s+\.disc__face/);
        expect(css).toMatch(/radial-gradient/);
        expect(css).toMatch(/translate\(var\(--stone-shadow-offset-x\), var\(--stone-shadow-offset-y\)\)/);
    });
});
//# sourceMappingURL=ui.disc-shadow.test.js.map