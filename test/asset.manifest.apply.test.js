const assert = require('assert');
const bootstrap = require('../ui/bootstrap');
const { generateManifest } = require('../scripts/generate-asset-manifest');

describe('applyAssetManifest', () => {
  test('applies valid manifest in compat mode', async () => {
    // Mock Image so preloadAssets succeeds in Node test env
    global.Image = function() {
      this.onload = null; this.onerror = null;
      Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0); } });
    };
    const res = generateManifest({ root: require('path').resolve(__dirname, '..') }).manifest;
    const out = await bootstrap.applyAssetManifest(res, { mode: 'compat' }, { timeoutMs: 1000 });
    assert.strictEqual(out.status, 'ok');
  });

  test('fails gracefully in compat mode when assets missing', async () => {
    // simulate image error
    global.Image = function() {
      this.onload = null; this.onerror = null;
      Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function') this.onerror(); }, 0); } });
    };
    const fake = { version: 'x', files: [ { path: 'assets/images/stones/nonexistent.png', sha256: 'x' } ] };
    const out = await bootstrap.applyAssetManifest(fake, { mode: 'compat' }, { timeoutMs: 100 });
    assert.strictEqual(out.status, 'fallback');
  });

  test('errors in strict mode when assets missing', async () => {
    // simulate image error
    global.Image = function() {
      this.onload = null; this.onerror = null;
      Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function') this.onerror(); }, 0); } });
    };
    const fake = { version: 'x', files: [ { path: 'assets/images/stones/nonexistent.png', sha256: 'x' } ] };
    const out = await bootstrap.applyAssetManifest(fake, { mode: 'strict' }, { timeoutMs: 100 });
    assert.strictEqual(out.status, 'error');
  });
});