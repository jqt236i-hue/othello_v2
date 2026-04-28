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
describe('custom board frame styling', () => {
    test('styles keep the standard frame as the default and allow runtime expansion for oversized custom boards', () => {
        const baseCss = fs.readFileSync(path.join(__dirname, '..', 'styles-base.css'), 'utf8');
        const layoutCss = fs.readFileSync(path.join(__dirname, '..', 'styles-layout.css'), 'utf8');
        const boardCss = fs.readFileSync(path.join(__dirname, '..', 'styles-board.css'), 'utf8');
        expect(baseCss).toMatch(/body\.board-oversize-active[\s\S]*overflow:\s*auto/);
        expect(layoutCss).toMatch(/#game-container\.board-oversize-active[\s\S]*width:\s*max-content/);
        expect(layoutCss).toMatch(/#game-container\.board-oversize-active[\s\S]*min-width:\s*100vw/);
        expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-padding:\s*calc\(25px\s*\*\s*var\(--layout-stage-scale\)\)/);
        expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-inner-size:\s*calc\(var\(--layout-anchor-board-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-board-scale\)\)/);
        expect(layoutCss).toMatch(/#board-frame[\s\S]*--board-frame-fill-background:/);
        expect(layoutCss).toMatch(/#board-frame[\s\S]*width:\s*var\(--board-frame-outer-width,\s*calc\(var\(--board-frame-inner-size\)\s*\+\s*\(var\(--board-frame-padding\)\s*\*\s*2\)\)\)/);
        expect(layoutCss).toMatch(/#board-frame[\s\S]*height:\s*var\(--board-frame-outer-height,\s*calc\(var\(--board-frame-inner-size\)\s*\+\s*\(var\(--board-frame-padding\)\s*\*\s*2\)\)\)/);
        expect(boardCss).toMatch(/#board[\s\S]*--board-max-size:\s*var\(--board-frame-inner-size,\s*calc\(var\(--layout-anchor-board-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-priority-board-scale\)\)\)/);
        expect(boardCss).toMatch(/#board[\s\S]*--board-disc-size:\s*var\(--board-disc-size-px,\s*89\.9%\)/);
        expect(boardCss).toMatch(/#board[\s\S]*--board-disc-inset:\s*var\(--board-disc-inset-px,\s*5\.05%\)/);
        expect(boardCss).toMatch(/#board[\s\S]*width:\s*calc\(var\(--board-max-size\)\s*\*\s*\(var\(--board-cols\)\s*\/\s*var\(--board-max-grid\)\)\)/);
        expect(boardCss).toMatch(/#board[\s\S]*height:\s*calc\(var\(--board-max-size\)\s*\*\s*\(var\(--board-rows\)\s*\/\s*var\(--board-max-grid\)\)\)/);
        expect(boardCss).toMatch(/#board \.disc[\s\S]*width:\s*var\(--board-disc-size\)/);
        expect(boardCss).toMatch(/#board \.disc[\s\S]*top:\s*var\(--board-disc-inset\)/);
        expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell[\s\S]*border:\s*none/);
        expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark[\s\S]*background:\s*var\(--board-frame-fill-background/);
        expect(boardCss).toMatch(/\.cell\.blocked-cell\.board-shrink-hole-cell\s+\.board-shrink-hole-mark[\s\S]*inset:\s*calc\(-1\s*\*\s*var\(--layout-size-border-thin\)\)/);
        expect(boardCss).toMatch(/\.board-shrink-hole-inner-edge\.inner-edge-bottom[\s\S]*height:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
        expect(boardCss).toMatch(/\.board-shrink-hole-inner-edge\.inner-edge-right[\s\S]*width:\s*calc\(4px\s*\*\s*var\(--layout-stage-scale\)\)/);
    });
});
//# sourceMappingURL=ui.board-frame.custom-size.test.js.map