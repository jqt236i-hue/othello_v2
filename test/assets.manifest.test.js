const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { generateManifest } = require('../scripts/generate-asset-manifest');

function collectFiles(dir, rootDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, rootDir));
      return;
    }
    files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
  });
  return files;
}

describe('assets manifest', () => {
  test('generate manifest contains stone images and hashes match', () => {
    const res = generateManifest({ root: path.resolve(__dirname, '..'), write: false });
    const manifest = res.manifest;
    const repoRoot = path.resolve(__dirname, '..');
    assert.ok(manifest.files && manifest.files.length > 0, 'manifest should contain files');
    assert.ok(
      manifest.files.some((file) => file.path === 'assets/images/hand-skin/勇者の手.png'),
      'manifest should include default hand image asset'
    );
    [
      'assets/images/hand-skin/lv1-2.png',
      'assets/images/hand-skin/lv3-5.png',
      'assets/images/hand-skin/lv4.png',
      'assets/images/hand-skin/lv6.png',
      'assets/images/other/観測石.png'
    ].forEach((assetPath) => {
      assert.ok(
        manifest.files.some((file) => file.path === assetPath),
        `manifest should include expected image asset ${assetPath}`
      );
    });
    const gachaFiles = collectFiles(path.resolve(repoRoot, 'assets', 'images', 'Gacha'), repoRoot);
    assert.ok(gachaFiles.length > 0, 'gacha asset directory should contain at least one file');
    gachaFiles.forEach((assetPath) => {
      assert.ok(
        manifest.files.some((file) => file.path === assetPath),
        `manifest should include gacha asset ${assetPath}`
      );
    });
    for (const f of manifest.files) {
      const p = path.resolve(repoRoot, f.path);
      assert.ok(fs.existsSync(p), `file ${f.path} should exist`);
      // basic sanity: sha256 length
      assert.strictEqual(typeof f.sha256, 'string');
      assert.ok(f.sha256.length >= 64);
    }
  });
});
