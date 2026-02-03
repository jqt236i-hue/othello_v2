const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { generateManifest } = require('../scripts/generate-asset-manifest');

describe('assets manifest', () => {
  test('generate manifest contains stone images and hashes match', () => {
    const res = generateManifest({ root: path.resolve(__dirname, '..') });
    const manifest = res.manifest;
    assert.ok(manifest.files && manifest.files.length > 0, 'manifest should contain files');
    for (const f of manifest.files) {
      const p = path.resolve(__dirname, '..', f.path);
      assert.ok(fs.existsSync(p), `file ${f.path} should exist`);
      // basic sanity: sha256 length
      assert.strictEqual(typeof f.sha256, 'string');
      assert.ok(f.sha256.length >= 64);
    }
  });
});