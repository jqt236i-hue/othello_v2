const assert = require('assert');
const bootstrap = require('../ui/bootstrap');
const { generateManifest } = require('../scripts/generate-asset-manifest');

describe('handleGameInit with assetManifest', () => {
  test('handles manifest and sets window flag on success', async () => {
    global.Image = function() { this.onload = null; this.onerror = null; Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0); } }); };
    const manifest = generateManifest({ root: require('path').resolve(__dirname, '..') }).manifest;
    const payload = { assetManifest: manifest };
    const res = await bootstrap.handleGameInit(payload, { assetPolicy: { mode: 'compat' }, timeoutMs: 1000 });
    assert.strictEqual(res.status, 'asset_manifest_handled');
    assert.ok(res.result && (res.result.status === 'ok'));
  });

  test('handles missing manifest gracefully in compat mode', async () => {
    global.Image = function() { this.onload = null; this.onerror = null; Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function') this.onerror(); }, 0); } }); };
    const payload = { assetManifest: { version: 'x', files: [ { path: 'assets/images/stones/nonexistent.png' } ] } };
    const res = await bootstrap.handleGameInit(payload, { assetPolicy: { mode: 'compat' }, timeoutMs: 100 });
    assert.strictEqual(res.status, 'asset_manifest_handled');
    assert.strictEqual(res.result.status, 'fallback');
  });
});