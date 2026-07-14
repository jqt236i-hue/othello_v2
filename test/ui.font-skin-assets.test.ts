import * as fs from 'fs';
import * as path from 'path';

describe('font skin bundled assets', () => {
  test('declares subset-first and full-fallback faces for every bundled game-fit font skin', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'styles-base.css'), 'utf8');
    const expected = [
      ['CR-Cinzel', 'cinzel-400'],
      ['CR-Shippori Mincho', 'shippori-mincho-400'],
      ['CR-Kaisei Tokumin', 'kaisei-tokumin-400'],
      ['CR-Zen Antique Soft', 'zen-antique-soft-400'],
      ['CR-Yusei Magic', 'yusei-magic-400'],
      ['CR-RocknRoll One', 'rocknroll-one-400']
    ];

    expected.forEach(([family, fileStem]) => {
      expect(css).toContain(`font-family: "${family} Subset"`);
      expect(css).toContain(`font-family: "${family} Full"`);
      expect(css).toContain(`url("assets/fonts/${fileStem}-subset.woff2")`);
      expect(css).toContain(`url("assets/fonts/${fileStem}.woff2")`);
    });
    expect(css).toContain('unicode-range:');
    expect(css).toContain('FONT_ASSETS_GENERATED_START');
    expect(css).toContain('FONT_ASSETS_GENERATED_END');
  });

  test('ships local font files and source license notes', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'styles-base.css'), 'utf8');
    const fullFiles = [
      'cinzel-400.woff2',
      'cinzel-700.woff2',
      'cinzel-900.woff2',
      'shippori-mincho-400.woff2',
      'shippori-mincho-700.woff2',
      'shippori-mincho-800.woff2',
      'kaisei-tokumin-400.woff2',
      'kaisei-tokumin-700.woff2',
      'kaisei-tokumin-800.woff2',
      'zen-antique-soft-400.woff2',
      'yusei-magic-400.woff2',
      'rocknroll-one-400.woff2'
    ];
    [
      ...fullFiles,
      ...fullFiles.map((name) => name.replace('.woff2', '-subset.woff2')),
      'font-build-manifest.json',
      'OFL.txt'
    ].forEach((name) => {
      const filePath = path.join(root, 'assets', 'fonts', name);
      expect(fs.existsSync(filePath)).toBe(true);
    });
    expect(fs.readdirSync(path.join(root, 'assets', 'fonts')).some((name) => name.endsWith('.ttf'))).toBe(false);
    expect(css).not.toContain('.ttf');
    expect(css).toContain('format("woff2")');
  });

  test('records deterministic corpus coverage, fallback probe, and subset savings', () => {
    const root = path.resolve(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'assets', 'fonts', 'font-build-manifest.json'),
      'utf8'
    ));

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.coverage).toBe('runtime-corpus-subset-with-full-fallback');
    expect(manifest.fallbackProbe).toEqual({ text: '丈', codepoint: 'U+4E08' });
    expect(manifest.corpus.codepointCount).toBeGreaterThan(1000);
    expect(manifest.corpus.sources).toEqual([...manifest.corpus.sources].sort());
    expect(manifest.fonts).toHaveLength(12);
    expect(manifest.fonts.every((font: any) => font.subset.corpusMissingCodepoints === 0)).toBe(true);
    expect(manifest.fonts.some((font: any) => font.full.fallbackProbeSupported === true)).toBe(true);
    expect(manifest.totals.subsetBytes).toBeLessThan(manifest.totals.fullBytes);
    expect(manifest.totals.savedBytesVsFull).toBe(
      manifest.totals.fullBytes - manifest.totals.subsetBytes
    );
  });
});
