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
describe('status-display cpu image scaling', () => {
    test('uses CSS variable based level scaling without JS pixel width override', () => {
        const jsPath = path.join(__dirname, '..', 'ui', 'status-display.js');
        const js = fs.readFileSync(jsPath, 'utf8');
        const cssPath = path.join(__dirname, '..', 'styles-layout.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        const varsPath = path.join(__dirname, '..', 'styles-variables.css');
        const varsCss = fs.readFileSync(varsPath, 'utf8');
        const responsiveCssPath = path.join(__dirname, '..', 'styles-responsive.css');
        const responsiveCss = fs.readFileSync(responsiveCssPath, 'utf8');
        expect(js).toMatch(/function\s+applyCpuCharacterLevelScale[\s\S]*setProperty\('--cpu-level-scale'/);
        expect(js).toMatch(/CPU_BASE_VISUAL_SCALE\s*=\s*0\.88/);
        expect(js).not.toMatch(/function\s+applyCpuCharacterLevelScale[\s\S]*safeBaseWidth/);
        expect(varsCss).toMatch(/--layout-character-image-scale:\s*0\.8/);
        expect(css).toMatch(/#cpu-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
        expect(css).toMatch(/#cpu-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)\s*scale\(var\(--cpu-level-scale,\s*1\)\)/);
        expect(css).toMatch(/#cpu-character-img[\s\S]*scaleX\(var\(--cpu-character-face-direction,\s*1\)\)/);
        expect(css).toMatch(/#cpu-character-img\.is-network-opponent-hero[\s\S]*--cpu-character-face-direction:\s*-1/);
        expect(css).toMatch(/#cpu-character-img:hover[\s\S]*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)\s*scale\(calc\(var\(--cpu-level-scale,\s*1\)\s*\*\s*1\.04\)\)/);
        expect(css).toMatch(/#hero-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
        expect(css).toMatch(/#hero-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
        expect(css).toMatch(/#hero-character-img:hover[\s\S]*scale\(1\.04\)/);
        expect(css).toMatch(/#cpu-character-panel[\s\S]*gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
        expect(css).toMatch(/#hero-character-panel[\s\S]*gap:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)/);
        expect(css).toMatch(/#cpu-level-label[\s\S]*margin-top:\s*0/);
        expect(css).toMatch(/#hero-label[\s\S]*margin-top:\s*0/);
        expect(responsiveCss).toMatch(/#cpu-level-label[\s\S]*margin-top:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\s*!important/);
        expect(responsiveCss).toMatch(/#cpu-level-label[\s\S]*transform:\s*translateY\(calc\(48px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
        expect(responsiveCss).toMatch(/#hero-label[\s\S]*margin-top:\s*calc\(1px\s*\*\s*var\(--layout-stage-scale\)\)\s*!important/);
        expect(responsiveCss).toMatch(/#hero-label[\s\S]*transform:\s*translateY\(calc\(48px\s*\*\s*var\(--layout-stage-scale\)\)\)\s*!important/);
        expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#cpu-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
        expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#hero-character-img[\s\S]*width:\s*calc\(var\(--layout-anchor-hero-size\)\s*\*\s*var\(--layout-stage-scale\)\s*\*\s*var\(--layout-character-image-scale\)\)/);
        expect(responsiveCss).toMatch(/html\.layout-stage-enabled(?::not\(\.layout-profile-phone-portrait\))?\s+#hero-character-img[\s\S]*transform:\s*translateY\(calc\(var\(--layout-anchor-character-offset-y\)\s*\*\s*var\(--layout-stage-scale\)\)\)/);
    });
});
//# sourceMappingURL=ui.status-display.cpu-scale.test.js.map