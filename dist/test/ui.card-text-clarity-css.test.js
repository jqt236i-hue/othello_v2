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
function readCardNameBlock(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
    return match ? match[1] : '';
}
describe('card text clarity css', () => {
    test('base card name plate avoids opacity and text stroke blur', () => {
        const cssPath = path.join(__dirname, '..', 'styles-cards.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        const block = readCardNameBlock(css, '.card-name');
        expect(block).toContain('text-rendering: optimizeLegibility;');
        expect(block).toContain('left: 50%;');
        expect(block).toContain('transform: translateX(-50%);');
        expect(block).not.toMatch(/opacity\s*:/);
        expect(block).not.toMatch(/-webkit-text-stroke\s*:/);
    });
    test('high-tier card name overrides do not reintroduce text stroke', () => {
        const cssPath = path.join(__dirname, '..', 'styles-cards.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        expect(readCardNameBlock(css, '.card-item.visible.cost-tier-gold .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
        expect(readCardNameBlock(css, '.card-item.visible[data-card-id="rainbow_stone"] .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
        expect(readCardNameBlock(css, '.card-item.visible[data-card-id="crystal_stone"] .card-name')).not.toMatch(/-webkit-text-stroke\s*:/);
    });
    test('special and rainbow name plates keep the same horizontal anchor as normal cards', () => {
        const cssPath = path.join(__dirname, '..', 'styles-cards.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        expect(css).toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*50%/);
        expect(css).not.toMatch(/\.card-item\.visible\.cost-tier-special \.card-name,[\s\S]*?\.card-item\.visible\[data-card-id="rainbow_stone"\] \.card-name\s*\{[\s\S]*?left:\s*49%/);
    });
});
//# sourceMappingURL=ui.card-text-clarity-css.test.js.map