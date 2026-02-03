const assert = require('assert');
const bootstrap = require('../ui/bootstrap');

describe('asset preloader', () => {
  test('preloadAssets resolves and sets class when images load', async () => {
    // Mock document and Image
    // Provide a minimal document with a couple of .disc elements to validate per-disc assignment
    const fakeBlackDisc = { classList: { contains: (k) => k === 'black' }, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } } };
    const fakeWhiteDisc = { classList: { contains: (k) => k === 'white' }, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } } };
    global.document = {
      documentElement: { classList: { added: {}, add(k) { this.added[k] = true; } } },
      querySelectorAll: (sel) => {
        // return both discs when asked for .disc.black, .disc.white
        return [fakeBlackDisc, fakeWhiteDisc];
      }
    };

    const created = [];
    global.Image = function() {
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set(v) {
          created.push(v);
          // simulate load asynchronously
          setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0);
        }
      });
    };

    const manifest = { files: [ { path: 'assets/images/stones/normal_stone-black.png' }, { path: 'assets/images/stones/normal_stone-white.png' } ] };
    const res = await bootstrap.preloadAssets(manifest, { timeoutMs: 1000 });
    assert.ok(res.success, 'preload should succeed');
    assert.ok(document.documentElement.classList.added['stone-images-loaded'], 'class should be set');
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
  });

  test('preloadAssets returns failed list on error', async () => {
    // Error simulation
    global.document = { documentElement: { classList: { added: {}, add(k) { this.added[k] = true; } } } };
    global.Image = function() {
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set(v) {
          // simulate error
          setTimeout(() => { if (typeof this.onerror === 'function') this.onerror(); }, 0);
        }
      });
    };

    const manifest = { files: [ { path: 'assets/images/stones/normal_stone-black.png' } ] };
    const res = await bootstrap.preloadAssets(manifest, { timeoutMs: 1000 });
    assert.ok(!res.success, 'preload should fail');
    assert.ok(!document.documentElement.classList.added['stone-images-loaded'], 'class should not be set');
  });
});