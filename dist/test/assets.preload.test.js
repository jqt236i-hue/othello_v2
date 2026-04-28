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
const bootstrap = __importStar(require("../ui/bootstrap.js"));
describe('asset preloader', () => {
    test('preloadAssets resolves and sets class when images load', async () => {
        // Mock document and Image
        // Provide a minimal document with a couple of .disc elements to validate per-disc assignment
        const fakeBlackDisc = { classList: { contains: (k) => k === 'black' }, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } }, dataset: {} };
        const fakeWhiteDisc = { classList: { contains: (k) => k === 'white' }, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } }, dataset: {} };
        global.document = {
            documentElement: { classList: { added: {}, add(k) { this.added[k] = true; }, remove(k) { delete this.added[k]; }, contains(k) { return !!this.added[k]; } } },
            querySelectorAll: (sel) => {
                // return both discs when asked for .disc.black, .disc.white
                return [fakeBlackDisc, fakeWhiteDisc];
            }
        };
        const created = [];
        global.Image = function () {
            this.onload = null;
            this.onerror = null;
            Object.defineProperty(this, 'src', {
                set(v) {
                    created.push(v);
                    // simulate load asynchronously
                    setTimeout(() => { if (typeof this.onload === 'function')
                        this.onload(); }, 0);
                }
            });
        };
        const manifest = { files: [{ path: 'assets/images/stones/normal_stone-black.png' }, { path: 'assets/images/stones/normal_stone-white.png' }] };
        const res = await bootstrap.preloadAssets(manifest, { timeoutMs: 1000 });
        assert.ok(res.success, 'preload should succeed');
        assert.ok(document.documentElement.classList.added['stone-images-loaded'], 'class should be set');
        assert.ok(document.documentElement.classList.added['stone-base-images-ready'], 'base stone images ready class should be set');
        // default shadows enabled via toggleStoneShadows
        // toggleStoneShadows is attached to global root (window/globalThis) and should enable the class
        assert.ok(document.documentElement.classList.added['stone-shadow-enabled'], 'shadow-enabled class should be set');
        if (typeof global.toggleStoneShadows === 'function') {
            // toggling should remove the class
            global.toggleStoneShadows(false);
            assert.ok(!document.documentElement.classList.added['stone-shadow-enabled'], 'shadow-enabled class should be removed after toggle');
            // re-enable for cleanup
            global.toggleStoneShadows(true);
            assert.ok(document.documentElement.classList.added['stone-shadow-enabled'], 'shadow-enabled class should be set again');
        }
        // validate per-disc var assignment
        assert.strictEqual(fakeBlackDisc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-black-image)');
        assert.strictEqual(fakeWhiteDisc.style.getPropertyValue('--stone-image'), 'var(--normal-stone-white-image)');
        assert.strictEqual(fakeBlackDisc.style.getPropertyValue('--disc-base-image'), 'var(--normal-stone-black-image)');
        assert.strictEqual(fakeWhiteDisc.style.getPropertyValue('--disc-base-image'), 'var(--normal-stone-white-image)');
        assert.strictEqual(fakeBlackDisc.style.getPropertyValue('--disc-base-fallback-color'), 'transparent');
        assert.strictEqual(fakeWhiteDisc.style.getPropertyValue('--disc-base-fallback-color'), 'transparent');
        assert.strictEqual(fakeBlackDisc.dataset.imageState, 'loaded');
        assert.strictEqual(fakeWhiteDisc.dataset.imageState, 'loaded');
    });
    test('preloadAssets returns failed list on error', async () => {
        // Error simulation
        global.document = { documentElement: { classList: { added: {}, add(k) { this.added[k] = true; }, remove(k) { delete this.added[k]; }, contains(k) { return !!this.added[k]; } } } };
        global.Image = function () {
            this.onload = null;
            this.onerror = null;
            Object.defineProperty(this, 'src', {
                set(v) {
                    // simulate error
                    setTimeout(() => { if (typeof this.onerror === 'function')
                        this.onerror(); }, 0);
                }
            });
        };
        const manifest = { files: [{ path: 'assets/images/stones/normal_stone-black.png' }] };
        const res = await bootstrap.preloadAssets(manifest, { timeoutMs: 1000 });
        assert.ok(!res.success, 'preload should fail');
        assert.ok(!document.documentElement.classList.added['stone-images-loaded'], 'class should not be set');
    });
});
//# sourceMappingURL=assets.preload.test.js.map