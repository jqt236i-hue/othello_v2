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
describe('game ↔ UI boundary (headless)', () => {
    afterEach(() => {
        // Ensure module cache is cleared between tests
        jest.resetModules();
        try {
            delete global.__uiImpl;
        }
        catch (e) { /* ignore */ }
    });
    test('game/visual-effects-map exports DI and delegates when implanted', () => {
        import * as vmap from '../game/visual-effects-map.js';
        expect(typeof vmap.setUIImpl).toBe('function');
        expect(typeof vmap.applyStoneVisualEffect).toBe('function');
        // Without UI impl, should be a safe no-op/undefined
        expect(vmap.applyStoneVisualEffect(undefined, 'goldStone')).toBeUndefined();
        // With mock UI impl, delegation should occur
        const mock = {
            applyStoneVisualEffect: jest.fn(() => 'ok'),
            removeStoneVisualEffect: jest.fn(() => 'ok')
        };
        vmap.setUIImpl(mock);
        expect(vmap.applyStoneVisualEffect({}, 'goldStone')).toBe('ok');
        expect(mock.applyStoneVisualEffect).toHaveBeenCalled();
        // restore
        vmap.setUIImpl({});
    });
    test('game/move-executor-visuals exports DI and delegates when implanted', () => {
        import * as mv from '../game/move-executor-visuals.js';
        expect(typeof mv.setUIImpl).toBe('function');
        expect(typeof mv.applyFlipAnimations).toBe('function');
        // No UI -> safe no-op
        expect(mv.applyFlipAnimations([])).toBeUndefined();
        // With mock: note the module checks both module-local and global __uiImpl
        const mock = { applyFlipAnimations: jest.fn(() => 'flip-ok') };
        mv.setUIImpl(mock);
        // Also populate legacy global hook to emulate bootstrap behavior
        global.__uiImpl = mock;
        expect(mv.applyFlipAnimations([])).toBe('flip-ok');
        expect(mock.applyFlipAnimations).toHaveBeenCalled();
        // restore
        mv.clearUIImpl && mv.clearUIImpl();
        try {
            delete global.__uiImpl;
        }
        catch (e) { /* Intentionally empty: test cleanup guard */ }
    });
    test('turn-manager loads safely and cooperates with ui/bootstrap registerUIGlobals', () => {
        jest.resetModules();
        const registerMock = jest.fn();
        // Provide a mock ui/bootstrap before requiring the module
        jest.doMock('../shared/ui-bootstrap-shared', () => ({ registerUIGlobals: registerMock }));
        import * as tm from '../game/turn-manager.js';
        expect(typeof tm.setUIImpl).toBe('function');
        // turn-manager attempts to register resetGame on bootstrap; ensure it called safely
        expect(registerMock).toHaveBeenCalled();
    });
    test('static scan: game/ does not contain direct DOM API usages', () => {
        const forbidden = [
            'document.querySelector',
            'document.getElementById',
            'document.querySelectorAll',
            'document.createElement',
            'document.getElementsByClassName'
        ];
        function listJsFiles(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const out = [];
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory())
                    out.push(...listJsFiles(p));
                else if (e.isFile() && p.endsWith('.js'))
                    out.push(p);
            }
            return out;
        }
        const gameDir = path.join(__dirname, '..', 'game');
        const files = listJsFiles(gameDir);
        const hits = [];
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf8');
            for (const pat of forbidden) {
                if (content.indexOf(pat) !== -1)
                    hits.push({ file: path.relative(process.cwd(), f), pattern: pat });
            }
        }
        expect(hits).toEqual([]);
    });
    test.skip('static scan: game/ does not contain globalThis property access', () => {
        // globalThis refs still present — will be removed in global-dep-refactor waves
        const forbidden = [
            'globalThis.',
            '(globalThis as any).'
        ];
        function listSourceFiles(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            const out = [];
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory())
                    out.push(...listSourceFiles(p));
                else if (e.isFile() && (p.endsWith('.js') || p.endsWith('.ts')))
                    out.push(p);
            }
            return out;
        }
        const gameDir = path.join(__dirname, '..', 'game');
        const files = listSourceFiles(gameDir);
        const hits = [];
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf8');
            for (const pat of forbidden) {
                if (content.indexOf(pat) !== -1)
                    hits.push({ file: path.relative(process.cwd(), f), pattern: pat });
            }
        }
        expect(hits).toEqual([]);
    });
});
//# sourceMappingURL=game.ui-boundary.test.js.map