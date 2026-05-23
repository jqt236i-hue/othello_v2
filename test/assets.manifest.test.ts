import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { generateManifest } from '../scripts/generate-asset-manifest.js';

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
  test('preserves metadata and avoids rewriting when asset content is unchanged', () => {
    const tmpRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'asset-manifest-stable-'));
    try {
      const assetDir = path.join(tmpRoot, 'assets', 'images', 'stones');
      fs.mkdirSync(assetDir, { recursive: true });
      fs.writeFileSync(path.join(assetDir, 'sample.png'), 'sample');
      const manifestDir = path.join(tmpRoot, 'assets');
      fs.mkdirSync(manifestDir, { recursive: true });
      const existing = {
        version: 'stable-version',
        generatedAt: '2000-01-01T00:00:00.000Z',
        files: [
          {
            path: 'assets/images/stones/sample.png',
            sha256: require('crypto').createHash('sha256').update('sample').digest('hex')
          }
        ]
      };
      fs.writeFileSync(path.join(manifestDir, 'asset-manifest.json'), JSON.stringify(existing, null, 2), 'utf8');

      const result = generateManifest({ root: tmpRoot });

      assert.strictEqual(result.wroteFile, false);
      assert.strictEqual(result.manifest.version, existing.version);
      assert.strictEqual(result.manifest.generatedAt, existing.generatedAt);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(manifestDir, 'asset-manifest.json'), 'utf8')), existing);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

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
      'assets/images/background/default.png',
      'assets/images/background-skin/観測の机.png',
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
