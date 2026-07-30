import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('PC smartphone preview entry', () => {
  test('owns an exact 393x852 same-origin game viewport', () => {
    const html = read('mobile-preview.html');

    expect(html).toContain('data-card-reversi-mobile-preview="phone-portrait"');
    expect(html).toContain('src="index.html?mobilePreview=1"');
    expect(html).toContain('width="393"');
    expect(html).toContain('height="852"');
    expect(html).toMatch(/\.mobile-preview-frame\s*\{[\s\S]*width:\s*393px;[\s\S]*height:\s*852px;/);
    expect(html).toContain('title="Card Reversi スマホ版プレビュー"');
  });

  test('is included through the canonical Worker root-file list', () => {
    const prepareWorkerAssets = read('scripts/prepare-worker-assets.ts');

    expect(prepareWorkerAssets).toMatch(/ROOT_FILES[\s\S]*'mobile-preview\.html'/);
  });
});
